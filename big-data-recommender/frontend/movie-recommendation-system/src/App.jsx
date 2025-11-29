import React, { useState, useEffect } from 'react';
import { 
  Play, Database, Loader2, Star, ThumbsUp, ThumbsDown,
  Users, Layers, Sliders, Film, ArrowLeft, Info, WifiOff, RefreshCw
} from 'lucide-react';
import MovieCard from '../components/MovieCard.jsx';
import MovieDetailPage from '../components/MovieDetailPage.jsx';

const API_URL = "http://localhost:8000";

// --- HELPERS ---
const generateSessionId = () => 'session_' + Math.random().toString(36).substr(2, 9);

// --- MAIN APP ---

const App = () => {
  const [userId] = useState(generateSessionId);
  const [view, setView] = useState('feed'); // 'feed' | 'detail'
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weights, setWeights] = useState({ als: 0.5, semantic: 0.3, lda: 0.2 });
  const [isOffline, setIsOffline] = useState(false);
  const [sessionRatings, setSessionRatings] = useState([]);

  // --- ACTIONS ---

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, weights, limit: 100 })
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setRecommendations(data);
      setIsOffline(false);
    } catch (err) {
      console.warn("Switching to Offline Mode"); 
      setIsOffline(true);
      const mockData = Array.from({ length: 20 }).map((_, i) => ({
        id: i + 1000,
        title: `Demo Movie ${i + 1}`,
        year: 2024,
        genres: ["Action", "Sci-Fi"],
        poster: ["blue", "red", "green", "amber", "slate", "purple"][i % 6],
        finalScore: 0.95 - (i * 0.03),
        scores: { als: 0.5, semantic: 0.5, lda: 0.5 }
      }));
      setRecommendations(mockData);
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (movie, type, value = null) => {
    // Map Interaction to Rating Value
    let rating = 0;
    if (type === 'watch') rating = 5.0; // Implicit Strong Positive
    if (type === 'like') rating = 4.0;
    if (type === 'dislike') rating = 1.0; // Strong Negative
    if (type === 'rate') rating = value;

    console.log(`Interaction: ${type} on ${movie.title} -> Rating: ${rating}`);

    // Update Local Session State
    setSessionRatings(prev => [...prev.filter(r => r.id !== movie.id), { ...movie, rating, type }]);

    if (isOffline) return;

    try {
      await fetch(`${API_URL}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, movie_id: movie.id, rating })
      });
      
      // AUTO-REFRESH: Automatically re-fetch recommendations after ANY interaction
      // This happens silently in the background if we are on the Detail page,
      // or visible if we are on the Feed.
      fetchRecommendations();

    } catch (err) {
      console.warn("Backend offline");
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [userId]);

  // --- RENDER ---

  if (view === 'detail' && selectedMovie) {
    return (
      <MovieDetailPage 
        movie={selectedMovie} 
        onClose={() => setView('feed')} 
        onInteraction={handleInteraction}
        userId={userId}
        weights={weights}
        isOffline={isOffline}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col xl:flex-row bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-full xl:w-80 bg-white border-r border-slate-200 flex flex-col h-auto xl:h-full z-10 shadow-xl">
        <div className="p-6 bg-slate-900 text-white shrink-0">
          <h1 className="font-bold text-xl flex items-center gap-2">
            <Film className="text-emerald-400" /> MovieLens Live
          </h1>
          <p className="text-xs text-slate-400 mt-1">Session: <span className="font-mono text-emerald-300">{userId}</span></p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isOffline && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <WifiOff size={14} className="shrink-0 mt-0.5" />
              <div>
                <strong>Offline Mode</strong>
                <p className="mt-1 opacity-90">Backend unreachable. Using mock data.</p>
              </div>
            </div>
          )}

          <div>
             <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2"><Sliders size={14} /> Hybrid Weights</h3>
            {[{ k:'als', l:'Collaborative', c:'blue' }, { k:'semantic', l:'Semantic', c:'emerald' }, { k:'lda', l:'Topics', c:'amber' }].map((alg) => (
              <div key={alg.k} className="mb-5">
                <div className="flex justify-between text-sm mb-1">
                  <span className={`font-semibold text-${alg.c}-600`}>{alg.l}</span>
                  <span className="text-xs bg-slate-100 px-2 rounded">{weights[alg.k].toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.1" value={weights[alg.k]} onChange={(e) => setWeights(p => ({...p, [alg.k]: parseFloat(e.target.value)}))} className={`w-full accent-${alg.c}-600 h-1.5 bg-slate-200 rounded-lg appearance-none`} />
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
             <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2"><ThumbsUp size={14} /> Activity ({sessionRatings.length})</h3>
             <div className="space-y-2 max-h-40 overflow-y-auto pr-2 text-xs">
                {sessionRatings.map((r, i) => (
                   <div key={i} className="flex justify-between p-2 bg-white rounded border border-slate-100">
                      <span className="truncate w-24">{r.title}</span>
                      <span className="uppercase font-bold text-slate-400 text-[10px]">{r.type}</span>
                   </div>
                ))}
             </div>
          </div>
          
          <button onClick={fetchRecommendations} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh Feed
          </button>
        </div>
      </aside>

      {/* Main Feed */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-100 p-4 lg:p-8">
        <header className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Top Picks For You</h2>
          <p className="text-sm text-slate-500">Based on your real-time session interactions.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {recommendations.map((movie) => (
            <MovieCard 
              key={movie.id} 
              movie={movie} 
              onOpen={(m) => { setSelectedMovie(m); setView('detail'); }} 
              onInteraction={handleInteraction} 
            />
          ))}
        </div>
        
        {recommendations.length === 0 && !loading && (
          <div className="text-center py-20 opacity-50"><Database size={48} className="mx-auto mb-4"/>Start backend...</div>
        )}
      </main>
    </div>
  );
};

export default App;