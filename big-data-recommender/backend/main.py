from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import execute_values
import numpy as np
import os
from typing import List, Optional

app = FastAPI()

# --- CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_DSN = "postgresql://postgres:postgres@localhost:5432/postgres"

# --- DATABASE INIT ---
@app.on_event("startup")
def startup_db_check():
    try:
        conn = psycopg2.connect(DB_DSN)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_ratings (
                user_id TEXT,
                movie_id INTEGER,
                rating FLOAT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, movie_id)
            );
        """)
        conn.commit()
        conn.close()
        print("Database check passed: user_ratings table ready.")
    except Exception as e:
        print(f"Database Init Error: {e}")

# --- MODELS ---
class RatingRequest(BaseModel):
    user_id: str
    movie_id: int
    rating: float # 0.5 to 5.0

class RecommendRequest(BaseModel):
    user_id: str
    weights: dict = {"als": 0.5, "semantic": 0.3, "lda": 0.2}
    limit: int = 1000
    focus_movie_id: Optional[int] = None # NEW: For "More Like This" functionality

# --- HELPERS ---
def get_db():
    return psycopg2.connect(DB_DSN)

# --- ENDPOINTS ---

@app.post("/rate")
def rate_movie(req: RatingRequest):
    """Saves a user interaction (Rating, Watch=5.0, Like=4.0, Dislike=1.0)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_ratings (user_id, movie_id, rating)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, movie_id) 
            DO UPDATE SET rating = EXCLUDED.rating, timestamp = CURRENT_TIMESTAMP;
        """, (req.user_id, req.movie_id, req.rating))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/recommend")
def recommend(req: RecommendRequest):
    conn = get_db()
    cur = conn.cursor()
    
    # CALCULATE TARGET VECTOR
    target_als = np.zeros(50)
    target_sem = np.zeros(50)
    target_lda = np.zeros(5)
    
    # CASE A: ITEM-TO-ITEM (Focus Movie ID provided - e.g. Detail Page)
    if req.focus_movie_id:
        cur.execute("SELECT als_vector, semantic_vector, lda_vector FROM movie_vectors WHERE movie_id = %s", (req.focus_movie_id,))
        row = cur.fetchone()
        if not row:
             raise HTTPException(status_code=404, detail="Focus movie not found")
        
        # Parse vectors
        def parse(v): return np.array(eval(v) if isinstance(v, str) else v, dtype=float)
        target_als = parse(row[0])
        target_sem = parse(row[1])
        target_lda = parse(row[2])
        
    # CASE B: USER-TO-ITEM (No focus movie - Main Feed)
    else:
        # Fetch user history
        cur.execute("""
            SELECT m.als_vector, m.semantic_vector, m.lda_vector, r.rating
            FROM user_ratings r
            JOIN movie_vectors m ON r.movie_id = m.movie_id
            WHERE r.user_id = %s
        """, (req.user_id,))
        rated_items = cur.fetchall()
        
        if not rated_items:
            # Cold Start: Return popular
            cur.execute("SELECT movie_id, title, genres, year, poster_color FROM movies ORDER BY popularity DESC LIMIT %s", (req.limit,))
            rows = cur.fetchall()
            conn.close()
            return [{
                "id": r[0], "title": r[1], "genres": r[2], "year": r[3], "poster": r[4], 
                "scores": {"als": 0, "semantic": 0, "lda": 0}, "finalScore": 0
            } for r in rows]

        # Weighted Average of User History
        total_weight = 0
        for row in rated_items:
            def parse(v): return np.array(eval(v) if isinstance(v, str) else v, dtype=float)
            r_als, r_sem, r_lda = parse(row[0]), parse(row[1]), parse(row[2])
            w = max(0.1, row[3] - 2.0) # 5 star = 3.0 weight, 1 star = 0 weight
            
            target_als += r_als * w
            target_sem += r_sem * w
            target_lda += r_lda * w
            total_weight += w

        if total_weight > 0:
            target_als /= total_weight
            target_sem /= total_weight
            target_lda /= total_weight
    
    # 2. CANDIDATE GENERATION & RANKING
    limit_per_index = 600
    query = """
        WITH candidates AS (
            (SELECT movie_id FROM movie_vectors ORDER BY als_vector <=> %s LIMIT %s)
            UNION
            (SELECT movie_id FROM movie_vectors ORDER BY semantic_vector <=> %s LIMIT %s)
            UNION
            (SELECT movie_id FROM movie_vectors ORDER BY lda_vector <=> %s LIMIT %s)
        )
        SELECT 
            v.movie_id, v.als_vector, v.semantic_vector, v.lda_vector,
            m.title, m.genres, m.year, m.poster_color
        FROM candidates c
        JOIN movie_vectors v ON c.movie_id = v.movie_id
        JOIN movies m ON c.movie_id = m.movie_id
    """
    
    cur.execute(query, (
        str(target_als.tolist()), limit_per_index,
        str(target_sem.tolist()), limit_per_index,
        str(target_lda.tolist()), limit_per_index
    ))
    
    candidates = cur.fetchall()
    conn.close()
    
    # 3. PYTHON RE-RANKING
    results = []
    w_als, w_sem, w_lda = req.weights['als'], req.weights['semantic'], req.weights['lda']

    def cosine_sim(a, b):
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0

    for row in candidates:
        mid, v_als_raw, v_sem_raw, v_lda_raw, title, genres, year, poster = row
        
        # Don't recommend the focus movie itself
        if req.focus_movie_id and mid == req.focus_movie_id:
            continue
            
        def parse(v): return np.array(eval(v) if isinstance(v, str) else v)
        v_als, v_sem, v_lda = parse(v_als_raw), parse(v_sem_raw), parse(v_lda_raw)

        s_als = cosine_sim(target_als, v_als)
        s_sem = cosine_sim(target_sem, v_sem)
        s_lda = cosine_sim(target_lda, v_lda)
        
        final_score = (s_als * w_als) + (s_sem * w_sem) + (s_lda * w_lda)
        
        results.append({
            "id": mid,
            "title": title,
            "genres": genres,
            "year": year,
            "poster": poster,
            "scores": {"als": float(s_als), "semantic": float(s_sem), "lda": float(s_lda)},
            "finalScore": float(final_score)
        })
        
    results.sort(key=lambda x: x['finalScore'], reverse=True)
    return results[:req.limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)