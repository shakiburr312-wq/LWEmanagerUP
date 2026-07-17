// New file: /src/components/MvpRevealModal.tsx
import React from 'react';
import { X, Crown, Sparkles, TrendingUp, Flame } from 'lucide-react';
import { PlayerProfile } from '../types';

interface MvpRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  mvp: (PlayerProfile & { score?: number }) | null;
  title?: string;
}

export const MvpRevealModal: React.FC<MvpRevealModalProps> = ({ isOpen, onClose, mvp, title }) => {
  if (!isOpen || !mvp) return null;

  const scoreValue = mvp.score !== undefined ? mvp.score : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Injecting CSS Keyframe animations dynamically in a scoped style tag */}
      <style>{`
        @keyframes mvp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mvp-slide-left {
          from { opacity: 0; transform: translateX(-100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mvp-slide-right {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mvp-slide-down {
          from { opacity: 0; transform: translateY(-50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mvp-zoom-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        .animate-mvp-backdrop {
          animation: mvp-fade-in 0.3s ease-out forwards;
        }
        .animate-mvp-card {
          animation: mvp-zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-mvp-title {
          animation: mvp-slide-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
          opacity: 0;
        }
        .animate-mvp-top-header {
          animation: mvp-slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }
        .animate-mvp-badge {
          animation: mvp-slide-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
      `}</style>

      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-mvp-backdrop" 
        onClick={onClose}
      />

      {/* Portrait Card */}
      <div className="animate-mvp-card bg-[#0b0b11] border border-amber-500/30 rounded-[2.5rem] w-full max-w-md aspect-[3/4.5] overflow-hidden relative z-10 shadow-[0_0_80px_rgba(245,158,11,0.15)] flex flex-col justify-between">
        
        {/* MVP Big Outline Background Text */}
        <div 
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none z-0 overflow-hidden font-display font-black tracking-widest text-transparent uppercase animate-mvp-title"
          style={{
            WebkitTextStroke: '2px rgba(245, 158, 11, 0.08)',
            fontSize: '12rem',
            transform: 'rotate(-5deg)'
          }}
        >
          MVP
        </div>

        {/* Player Portrait Image */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
          {mvp.mvpPhotoUrl ? (
            <img 
              src={mvp.mvpPhotoUrl} 
              alt={mvp.name} 
              className="w-full h-full object-cover object-bottom"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-t from-purple-950/20 via-transparent to-amber-950/10 flex items-center justify-center">
              <Crown className="w-48 h-48 text-amber-500/10 animate-pulse" />
            </div>
          )}
          {/* Radial Gradient overlay to blend bottom heavy picture and fade the top */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-[#0b0b11]/30 to-[#0b0b11]/80" />
        </div>

        {/* TOP HEADER SECTION */}
        <header className="p-8 flex items-center justify-between z-10 relative animate-mvp-top-header">
          {/* Lineup Name */}
          <div className="bg-black/40 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-mono font-black text-gray-300 uppercase tracking-widest">
              {mvp.lineup || '1st Lineup'}
            </span>
          </div>

          {/* Season MVP Pill */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-[#050507] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <Sparkles className="w-3.5 h-3.5 text-[#050507] fill-[#050507] animate-pulse" />
            <span className="text-[9px] font-mono font-black uppercase tracking-wider">
              {title || 'Season MVP'}
            </span>
          </div>
        </header>

        {/* Close Button on top right */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-2 rounded-full bg-black/60 border border-white/10 hover:bg-black/80 hover:border-white/20 text-gray-400 hover:text-white transition-all cursor-pointer shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {/* BOTTOM SHOWCASE SECTION */}
        <div className="p-8 z-10 relative space-y-6">
          
          {/* Angled Clip-Path Display Name */}
          <div className="animate-mvp-badge flex flex-col items-start">
            <div 
              className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-[#050507] py-3 px-6 shadow-2xl relative"
              style={{
                clipPath: 'polygon(0% 0%, 95% 0%, 100% 100%, 0% 100%)',
              }}
            >
              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-wider uppercase">
                {mvp.name}
              </h2>
            </div>
            
            {/* Subtitle / Role */}
            <div className="mt-2 bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-xl border border-white/5">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">
                ROLE: {mvp.role}
              </span>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-black/50 backdrop-blur-md border border-white/5 rounded-3xl p-5 grid grid-cols-3 gap-4 animate-mvp-badge">
            <div className="text-center">
              <span className="text-[8px] font-mono text-gray-500 uppercase block mb-1">Total Kills</span>
              <div className="flex items-center justify-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-bold font-mono text-white">{mvp.kills}</span>
              </div>
            </div>
            <div className="text-center border-x border-white/5">
              <span className="text-[8px] font-mono text-gray-500 uppercase block mb-1">MVP Award</span>
              <div className="flex items-center justify-center space-x-1">
                <Crown className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-bold font-sans text-white truncate max-w-[90px]" title={title || 'Season MVP'}>
                  {(() => {
                    if (!title) return 'MVP S1';
                    const match = title.match(/(?:SEASON|S)\s*(\d+)/i);
                    if (match) {
                      return `MVP S${match[1]}`;
                    }
                    return 'MVP S1';
                  })()}
                </span>
              </div>
            </div>
            <div className="text-center bg-amber-500/10 border border-amber-500/25 rounded-2xl p-1">
              <span className="text-[8px] font-mono text-amber-400 uppercase block mb-0.5 font-bold">MVP Score</span>
              <span className="text-sm font-black font-mono text-amber-400">{scoreValue}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
