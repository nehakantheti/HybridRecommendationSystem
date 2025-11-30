# Hybrid Adaptive Movie Recommendation Engine

This project implements a Hybrid Filtering Architecture that combines Collaborative Filtering (ALS), Content-Based Filtering (Semantic Embeddings), and Topic Modeling (LDA) to provide adaptive recommendations.

##### Documentation : Find Documentation [here](https://docs.google.com/document/d/1tKri7YwxbNQpG1t99Q2U0m5jPT9m3pXmghvZ1kVKnLI/edit?usp=sharing).

### **Key Features**

**Hybrid Algorithm**: Weighted combination of ALS (User Behavior), TF-IDF/Embeddings (Content), and LDA (Thematic Topics).

**Vector Database**: Utilizes PostgreSQL with the pgvector extension for high-speed HNSW (Hierarchical Navigable Small World) similarity search.

**Real-Time Adaptation**: The inference engine updates the user's profile vector instantly after every interaction (Watch, Like, Rate).

**Cold Start Handling**: Leverages semantic genome tags to recommend items with zero user ratings.

**OTT-Style UI**: A responsive React frontend featuring immersive movie details, infinite feeds, and optimistic UI updates.

## **Architecture**

The system follows a modern decoupled architecture:

**Data Ingestion Layer**: Python scripts process raw CSVs, train models (Scikit-Learn/Implicit), and upload vectors to Postgres.

**Storage Layer**: PostgreSQL stores both relational metadata (Movies, Ratings, Tags and other genome data) and high-dimensional vectors.

**API Layer**: FastAPI serves recommendations via Cosine Similarity search and handles user interaction logging.

**Client Layer**: React application manages session state and visualization.

## **Tech Stack**

**Frontend**: React, Vite, Tailwind CSS, Lucide Icons

**Backend**: Python, FastAPI, Uvicorn, SQLAlchemy

**Database**: PostgreSQL 16 + pgvector extension

**ML Libraries**: Scikit-Learn, Implicit, NumPy, Pandas

## **Getting Started**

Follow these instructions to set up the project locally.

### **Prerequisites**
- PostgreSQL 15 or 16 **(Installed Locally)**
- pgvector extension **(Must be installed into your Postgres instance)**
- Python 3.9+
- Node.js 16+ & npm

### Step 1: Database Setup

Ensure PostgreSQL is running and the vector extension is enabled.

Install PostgreSQL: Download from [postgresql.org](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).

Install pgvector: Follow the [installation guide](https://github.com/pgvector/pgvector) for your OS (Windows/Linux/Mac).

**Configure Database**: Run the commands in postgres_schema.txt on pgAdmin to setup database.

### Step 2: Backend & Data Training

Clone the repository:

Install Dependencies on backend:

``` cd big-data-recommender/backend ```


``` pip install -r requirements.txt ```


Check Database Config:
  Open training/populate_script.py and backend/main.py. Ensure the DB_URL matches your local credentials:

#### Update 'postgres:password' to your local username and password
DB_URL = "postgresql://postgres:<your_postgres_instance_password>@localhost:5432/postgres"

## Download Data:

Download the [MovieLens 25M Dataset](https://www.kaggle.com/datasets/garymk/movielens-25m-dataset).

Place movies.csv, ratings.csv, tags.csv, links.csv, genome-scores.csv, and genome-tags.csv inside the *data/* folder.

**Train & Ingest Data**:
Note: This process may take 10-20 minutes depending on your hardware.
python populate_script.py

**Start the API Server**:

```uvicorn main:app --reload  ```


The server will start at http://localhost:8000.

**Step 3: Frontend Setup**
Navigate to frontend directory:
```cd ../frontend```

**Install Node Modules**:

```npm install```

**Run the Application**:

```npm run dev```


### Open in Browser:
Navigate to http://localhost:5173 on your browser to view the application.

### Usage Guide

**Start**: Upon first load, you are assigned a temporary Session ID. The feed will show popular content.

**Interaction**: Click "Watch", "Like", or rate a movie.

**Adaptation**: The system instantly recalculates your User Vector based on these interactions and refreshes the feed.

**Tuning**: Use the sliders in the sidebar to manually adjust the weight of each algorithm (e.g., increase "Semantic" to find movies with similar plot descriptions regardless of popularity).

### Project Structure
```big-data-recommender/
  ├── backend/
  │   ├── main.py    # FastAPI Server & Inference Logic
  │   ├── requirements.txt # Require
  |   └──.env        # env file for backend (example env uploaded)
  ├── data/   
  |   └── (CSV Files in Movielens Dataset...)
  ├── frontend/
  │   ├── components/
  |   │   ├── MovieCard.jsx             
  │   │   └── MovieDetailPage.jsx
  |   ├── src/
  │   │   ├── App.jsx             # Main React Component
  │   │   └── main.jsx            # Entry Point
  |   |   └── (other frontend files)
  │   └── package.json
  |── postgres_schema.txt         # DB Setup Queries
  └── README.md```
