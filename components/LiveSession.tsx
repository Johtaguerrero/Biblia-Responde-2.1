import React, { useEffect, useState } from 'react';
import { useLiveSession } from '../hooks/useLiveSession';
import { PhoneOff, Mic, AlertCircle, Play } from 'lucide-react';

interface LiveSessionProps {
  onExit: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ onExit }) => {
  const { connect, disconnect, isConnected, isSpeaking, volume, error } = useLiveSession();
  const [showManualConnect, setShowManualConnect] = useState(false);

  useEffect(() => {
    // Attempt auto-connect
    connect();
    
    // If not connected in 4 seconds, show manual connect button (often fixes "user gesture" issues in WebViews)
    const timer = setTimeout(() => {
        if (!isConnected) setShowManualConnect(true);
    }, 4000);

    return () => {
        clearTimeout(timer);
        disconnect();
    };
  }, [connect, disconnect]); // Remove isConnected dependency to avoid loop

  // Clear manual connect if connection succeeds
  useEffect(() => {
    if(isConnected) setShowManualConnect(false);
  }, [isConnected]);

  // Normalize volume for CSS scale (0-255 -> 1.0-2.0 approx)
  const scale = 1 + (volume / 100);

  const handleManualConnect = () => {
      setShowManualConnect(false);
      connect();
  };

  return (
    <div className="fixed inset-0 z-50 bg-leather-dark flex flex-col items-center justify-between p-8 text-ivory overflow-hidden">
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/black-leather.png')] pointer-events-none"></div>

      {/* Header */}
      <div className="relative z-10 w-full text-center mt-8">
        <h2 className="font-display text-lg tracking-[0.2em] text-gold opacity-80 uppercase">Conversa ao Vivo</h2>
        <p className="font-serif text-white/50 text-sm mt-2">Bíblia Responde</p>
      </div>

      {/* Center Visualizer */}
      <div className="flex-1 flex items-center justify-center relative w-full">
        {/* Error State */}
        {error ? (
           <div className="text-center bg-red-900/50 p-6 rounded-2xl border border-red-500/30 max-w-sm">
             <AlertCircle className="mx-auto mb-4 text-red-300" size={48} />
             <p className="text-red-100 font-sans mb-4">{error}</p>
             <button onClick={() => connect()} className="px-6 py-3 bg-red-700 rounded-full text-sm font-bold shadow-lg">
               Tentar Novamente
             </button>
           </div>
        ) : !isConnected && showManualConnect ? (
            /* Manual Connect Button (Fallback for strict WebViews) */
            <div className="text-center animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={handleManualConnect}
                    className="w-32 h-32 rounded-full bg-gold text-leather-dark flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform"
                >
                    <Play size={48} fill="currentColor" className="ml-2"/>
                </button>
                <p className="mt-6 text-gold font-bold uppercase tracking-widest text-sm">Toque para Iniciar</p>
            </div>
        ) : (
          /* Pulsing Orb */
          <div className="relative flex items-center justify-center">
             {/* Glow Rings */}
             <div 
               className="absolute rounded-full bg-gold/10 blur-xl transition-all duration-75"
               style={{ width: `${200 * scale}px`, height: `${200 * scale}px` }}
             />
             <div 
               className="absolute rounded-full bg-gold/20 blur-md transition-all duration-75"
               style={{ width: `${150 * scale}px`, height: `${150 * scale}px` }}
             />
             
             {/* Core */}
             <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gold to-leather border-4 border-gold shadow-gold flex items-center justify-center relative z-20">
               <Mic size={40} className={`text-leather-dark ${isConnected ? 'opacity-100' : 'opacity-50'}`} />
             </div>

             {/* Status Text */}
             <div className="absolute top-40 w-full text-center">
               <span className="font-sans text-sm font-medium tracking-wider animate-pulse text-gold-light">
                 {isConnected ? (isSpeaking ? "Falando..." : "Ouvindo...") : "Conectando..."}
               </span>
             </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="relative z-10 w-full mb-8 flex justify-center">
        <button
          onClick={onExit}
          className="bg-red-600/90 hover:bg-red-500 text-white rounded-full p-6 shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-3"
        >
          <PhoneOff size={32} />
        </button>
      </div>
      
      <div className="absolute bottom-6 text-xs text-white/20 font-sans">
        Gemini Native Audio • 2.5 Flash
      </div>
    </div>
  );
};