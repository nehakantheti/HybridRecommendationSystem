import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from scipy.sparse import csr_matrix
from implicit.als import AlternatingLeastSquares
from sqlalchemy import create_engine, text

# --- CONFIGURATION ---
# Format: postgresql://user:password@localhost:5432/db_name
DB_URL = "postgresql://postgres:<your_postgres_instance_password>@localhost:5432/postgres" 
BATCH_SIZE = 2000

print("1. Connecting to Database...")
engine = create_engine(DB_URL)

print("2. Loading Data (This may take a moment)...")
movies = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\movies.csv')
ratings = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\ratings.csv')
tags = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\tags.csv')
links = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\links.csv')
genome_scores = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\genome-scores.csv')
genome_tags = pd.read_csv('C:\\Nehaaaa\\Course Work\\ASBD\\ASBD_Project\\big-data-recommender\\data\\genome-tags.csv')

# --- PRE-PROCESSING ---
print("3. Pre-processing Metadata...")
movies['year'] = movies['title'].str.extract(r'\((\d{4})\)').fillna(0).astype(int)
movies['genres_list'] = movies['genres'].str.split('|')

# Process User Tags: Aggregate all tags for each movie into a single string
print("   -> Aggregating User Tags...")
tags['tag'] = tags['tag'].fillna('').astype(str).str.lower()
movie_tags = tags.groupby('movieId')['tag'].apply(lambda x: ' '.join(x)).reset_index()
movies = movies.merge(movie_tags, on='movieId', how='left')
movies['tag'] = movies['tag'].fillna('')

# Process Genome Data: Extract high-relevance tags
print("   -> Processing Genome Tags (The 'DNA' of the movies)...")

# 2. Merge Scores with Tag Names
genome_full = genome_scores.merge(genome_tags, on='tagId')

# 3. Filter for High Relevance (> 0.5)
#    We only want tags that STRONGLY describe the movie
genome_relevant = genome_full[genome_full['relevance'] > 0.5].copy()

# 4. Aggregate into a single string per movie
genome_str = genome_relevant.groupby('movieId')['tag'].apply(lambda x: ' '.join(x)).reset_index()
genome_str.rename(columns={'tag': 'genome_desc'}, inplace=True)

# 5. Merge into Movies
movies = movies.merge(genome_str, on='movieId', how='left')
movies['genome_desc'] = movies['genome_desc'].fillna('')

# Merge Links (for IMDB ID)
movies = movies.merge(links, on='movieId', how='left')

# Filter to top 5000 popular movies for speed/demo purposes
pop = ratings.groupby('movieId').size().reset_index(name='counts')
top_movies = pop.sort_values('counts', ascending=False).head(5000)
movies = movies[movies['movieId'].isin(top_movies['movieId'])].copy()
ratings = ratings[ratings['movieId'].isin(top_movies['movieId'])].copy()

# Mappers (ID re-mapping for Matrix Operations)
movie_mapper = {mid: i for i, mid in enumerate(movies['movieId'].unique())}
movies['idx'] = movies['movieId'].map(movie_mapper)
ratings['movie_idx'] = ratings['movieId'].map(movie_mapper)
user_mapper = {uid: i for i, uid in enumerate(ratings['userId'].unique())}
ratings['user_idx'] = ratings['userId'].map(user_mapper)

# --- ALGORITHM 1: ALS (Collaborative) ---
print("4. Training ALS (Collaborative)...")
user_item = csr_matrix((ratings['rating'], (ratings['user_idx'], ratings['movie_idx'])))
model_als = AlternatingLeastSquares(factors=50, iterations=15)
model_als.fit(user_item)
item_factors = model_als.item_factors

# --- ALGORITHM 2: SEMANTIC (Content) ---
print("5. Training Semantic (Content)...")
# Title + Genres + User Tags + Genome Tags
movies['features'] = (
    movies['title'] + " " + 
    movies['genres'].str.replace('|', ' ') + " " + 
    movies['tag'] + " " +
    movies['genome_desc'] # The high-quality genome descriptors
)

tfidf = TfidfVectorizer(stop_words='english', max_features=50)
dense_tfidf = tfidf.fit_transform(movies['features']).toarray()

# --- ALGORITHM 3: LDA (Topics) ---
print("6. Training LDA (Topics)...")
cv = CountVectorizer(max_df=0.95, min_df=2, stop_words='english')
dtm = cv.fit_transform(movies['features'])
lda = LatentDirichletAllocation(n_components=5, random_state=42)
topic_results = lda.fit_transform(dtm)

# --- DATABASE SCHEMA UPDATE ---
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.execute(text("DROP TABLE IF EXISTS movie_vectors"))
    conn.execute(text("DROP TABLE IF EXISTS movies"))
    conn.commit()
    
    # Create Movies Table
    conn.execute(text("""
        CREATE TABLE movies (
            movie_id INTEGER PRIMARY KEY,
            title TEXT,
            genres TEXT[],
            year INTEGER,
            imdb_id TEXT,
            poster_color TEXT,
            popularity INTEGER
        )
    """))
    
    # Create Vectors Table
    conn.execute(text("""
        CREATE TABLE movie_vectors (
            movie_id INTEGER PRIMARY KEY REFERENCES movies(movie_id),
            als_vector vector(50),
            semantic_vector vector(50),
            lda_vector vector(5)
        )
    """))
    
    conn.execute(text("CREATE INDEX ON movie_vectors USING hnsw (als_vector vector_cosine_ops)"))
    conn.execute(text("CREATE INDEX ON movie_vectors USING hnsw (semantic_vector vector_cosine_ops)"))
    conn.commit()

# --- UPLOAD ---
print("7. Uploading to Postgres...")
with engine.connect() as conn:
    # Upload Metadata
    print("   -> Uploading Metadata...")
    movies_export = movies[['movieId', 'title', 'genres_list', 'year', 'imdbId']].copy()
    movies_export.columns = ['movie_id', 'title', 'genres', 'year', 'imdb_id']
    movies_export['poster_color'] = np.random.choice(['blue','red','green','amber','slate','purple'], size=len(movies_export))
    movies_export['popularity'] = 0 
    
    movies_export.to_sql('movies', engine, if_exists='append', index=False, method='multi', chunksize=BATCH_SIZE)

    # Upload Vectors
    print("   -> Uploading Vectors...")
    vectors = []
    for _, row in movies.iterrows():
        idx = row['idx']
        vectors.append({
            'movie_id': row['movieId'],
            'als_vector': item_factors[idx].tolist() if idx < len(item_factors) else [0]*50,
            'semantic_vector': dense_tfidf[row.name].tolist() if row.name < len(dense_tfidf) else [0]*50, 
            'lda_vector': topic_results[row.name].tolist() if row.name < len(topic_results) else [0]*5
        })
        
        if len(vectors) >= BATCH_SIZE:
            conn.execute(
                text("INSERT INTO movie_vectors (movie_id, als_vector, semantic_vector, lda_vector) VALUES (:movie_id, :als_vector, :semantic_vector, :lda_vector)"),
                vectors
            )
            conn.commit()
            vectors = []
            
    if vectors:
        conn.execute(
            text("INSERT INTO movie_vectors (movie_id, als_vector, semantic_vector, lda_vector) VALUES (:movie_id, :als_vector, :semantic_vector, :lda_vector)"),
            vectors
        )
        conn.commit()

print("Done! Data with Genome, Tags, and Links is live in Postgres.")