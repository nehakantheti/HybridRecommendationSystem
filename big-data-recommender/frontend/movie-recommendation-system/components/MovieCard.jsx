import { 
  Play, Database, Loader2, Star, ThumbsUp, ThumbsDown,
  Users, Layers, Sliders, Film, ArrowLeft, Info, WifiOff, RefreshCw
} from 'lucide-react';
import { useState } from 'react';


const MovieCard = ({ movie, onOpen, onInteraction }) => {
  const [interaction, setInteraction] = useState(null); 

  const handleInteraction = (type) => {
    setInteraction(type);      
    onInteraction(movie, type);    
  };
  return (
    <div 
      className="group bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col cursor-pointer"
      onClick={() => onOpen(movie)}
    >
      <div className={`h-40 bg-${movie.poster}-500 relative flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
          {(movie.finalScore * 100).toFixed(0)}% Match
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="font-bold leading-tight text-sm drop-shadow-md line-clamp-2">{movie.title}</h3>
          <div className="text-[10px] opacity-90 mt-0.5">{movie.year}</div>
        </div>
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
           <div className="bg-white/20 backdrop-blur rounded-full p-3 border border-white/50">
             <Play size={24} fill="white" className="text-white ml-1" />
           </div>
        </div>
      </div>

      <div className="p-3 flex items-center justify-between bg-white border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={() => onInteraction(movie, 'watch')}
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded flex items-center gap-1 transition-colors"
        >
          <Play size={10} fill="currentColor" /> Watch
        </button>
        <div className="flex gap-1">
           <button onClick={() => handleInteraction("like")} className={`p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors ${interaction === "like" 
        ? "text-green-900 bg-green-300" 
        : "text-slate-400 hover:text-green-600 hover:bg-green-50"}`}><ThumbsUp size={14} /></button>
           <button onClick={() => handleInteraction("dislike")} className={`p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ${interaction === "dislike" 
        ? "text-red-900 bg-red-300" 
        : "text-slate-400 hover:text-red-500 hover:bg-red-50"}`}><ThumbsDown size={14} /></button>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;