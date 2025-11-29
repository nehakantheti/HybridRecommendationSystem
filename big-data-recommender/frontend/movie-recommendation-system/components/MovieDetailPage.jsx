import { 
  Play, Database, Loader2, Star, ThumbsUp, ThumbsDown,
  Users, Layers, Sliders, Film, ArrowLeft, Info, WifiOff, RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import MovieCard from './MovieCard';

const API_URL = "http://localhost:8000";

// Detailed Inner Page
const MovieDetailPage = ({ movie, onClose, onInteraction, userId, weights, isOffline }) => {
  const [similarMovies, setSimilarMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    // Fetch "More Like This" (Item-to-Item Recs)
    const fetchSimilar = async () => {
      if (isOffline) {
        setSimilarMovies(Array.from({ length: 4 }).map((_, i) => ({
           id: i + 900, title: `Similar Movie ${i}`, year: 2022, poster: movie.poster, finalScore: 0.8, genres: ["Demo"]
        })));
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, weights, limit: 10, focus_movie_id: movie.id })
        });
        const data = await res.json();
        setSimilarMovies(data);
      } catch (err) {
        console.warn("Failed to fetch similar movies", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSimilar();
  }, [movie]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Hero Section */}
      <div className={`relative h-[60vh] bg-${movie.poster}-900 flex items-end`}>
        {/* Fake Backdrop Image Pattern */}
        <div className={`absolute inset-0 bg-gradient-to-br from-${movie.poster}-500/20 to-slate-900 opacity-50`}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        
        <button onClick={onClose} className="absolute top-6 left-6 z-20 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 p-2 rounded-full backdrop-blur transition-all">
          <ArrowLeft size={24} />
        </button>

        <div className="relative z-10 p-8 lg:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-end">
          {/* Poster Box */}
          <div className={`w-48 h-72 bg-${movie.poster}-500 rounded-lg shadow-2xl border-4 border-white/10 hidden md:flex items-center justify-center shrink-0`}>
             <Film className="text-white/30" size={64} />
          </div>

          <div className="flex-1 space-y-4 mb-4">
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-xl">{movie.title}</h1>
            <div className="flex items-center gap-4 text-sm md:text-base text-white/80 font-medium">
               <span className="bg-white/20 px-2 py-0.5 rounded backdrop-blur border border-white/10">{movie.year}</span>
               <span>{movie.genres?.join(' • ')}</span>
               <span className="text-green-400 font-bold">{(movie.finalScore * 100).toFixed(0)}% Match</span>
            </div>
            <p className="text-white/70 max-w-2xl text-lg leading-relaxed line-clamp-3">
              Experience the drama and intensity of {movie.title}. A cinematic journey through {movie.genres?.join(' and ')} that will leave you breathless. 
            </p>

            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={() => onInteraction(movie, 'watch')}
                className="bg-white text-slate-900 hover:bg-slate-200 px-8 py-3 rounded font-bold text-lg flex items-center gap-2 transition-colors shadow-lg shadow-white/10"
              >
                <Play fill="currentColor" /> Play Now
              </button>
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur px-4 py-3 rounded-lg border border-white/10">
                 <span className="text-white/60 text-sm font-bold uppercase mr-2">Rate:</span>
                 <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => { setRating(s); onInteraction(movie, 'rate', s); }} className={`${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500 hover:text-white'} transition-colors`}>
                      <Star size={20} />
                    </button>
                  ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto p-8 space-y-12">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Database size={20} className="text-emerald-500"/> More Like This
          </h2>
          {loading ? (
             <div className="flex gap-2 text-slate-400"><Loader2 className="animate-spin" /> finding matches...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {similarMovies.length > 0 ? similarMovies.map(m => (
                 <MovieCard key={m.id} movie={m} onOpen={() => {}} onInteraction={onInteraction} />
              )) : (
                 <p className="text-slate-400 italic">No similar movies found.</p>
              )}
            </div>
          )}
        </section>

        {/* Debug Info */}
        <section className="bg-slate-100 rounded-xl p-6 border border-slate-200">
           <h3 className="text-xs font-bold uppercase text-slate-500 mb-4">Why was this recommended?</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-sm font-bold text-blue-700 mb-1">Collaborative Score</div>
                <div className="text-3xl font-mono">{movie.scores.als.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Users with similar taste also watched this.</p>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-700 mb-1">Semantic Match</div>
                <div className="text-3xl font-mono">{movie.scores.semantic.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Content (tags/genres) matches your interests.</p>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-700 mb-1">Topic Fit</div>
                <div className="text-3xl font-mono">{movie.scores.lda.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Fits the thematic topics you enjoy.</p>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default MovieDetailPage;