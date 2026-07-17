import React from 'react';
import { X, Crown, Sparkles, Shield, Flame, Target } from 'lucide-react';

interface TeamRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    displayName: string;
    logoUrl?: string;
    playersCount: number;
    score: number;
    kills: number;
    damage: number;
    assists: number;
    healing: number;
    matches: number;
  } | null;
  seasonName?: string;
}

export const TeamRevealModal: React.FC<TeamRevealModalProps> = ({ isOpen, onClose, team, seasonName }) => {
  if (!isOpen || !team) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scope keyframes inside styled component block */}
      <style>{`
        @keyframes team-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes team-slide-left {
          from { opacity: 0; transform: translateX(-100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes team-slide-right {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes team-slide-down {
          from { opacity: 0; transform: translateY(-50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes team-zoom-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        .animate-team-backdrop {
          animation: team-fade-in 0.3s ease-out forwards;
        }
        .animate-team-card {
          animation: team-zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-team-title {
          animation: team-slide-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
          opacity: 0;
        }
        .animate-team-top-header {
          animation: team-slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }
        .animate-team-badge {
          animation: team-slide-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
      `}</style>

      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-team-backdrop" 
        onClick={onClose}
      />

      {/* Portrait Card */}
      <div className="animate-team-card bg-[#0b0b11] border border-purple-500/30 rounded-[2.5rem] w-full max-w-md aspect-[3/4.5] overflow-hidden relative z-10 shadow-[0_0_80px_rgba(147,51,234,0.15)] flex flex-col justify-between">
        
        {/* TEAM Big Outline Background Text */}
        <div 
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none z-0 overflow-hidden font-display font-black tracking-widest text-transparent uppercase animate-team-title"
          style={{
            WebkitTextStroke: '2px rgba(147, 51, 234, 0.08)',
            fontSize: '11rem',
            transform: 'rotate(-5deg)'
          }}
        >
          TEAM
        </div>

        {/* Team Logo Background Spotlight */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none flex items-center justify-center p-8">
          {team.logoUrl ? (
            <img 
              src={team.logoUrl} 
              alt={team.displayName} 
              className="w-48 h-48 object-contain opacity-10 filter blur-[2px]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Shield className="w-48 h-48 text-purple-500/5 animate-pulse" />
          )}
          {/* Gradients blending */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-[#0b0b11]/60 to-[#0b0b11]/80" />
        </div>

        {/* TOP HEADER SECTION */}
        <header className="p-8 flex items-center justify-between z-10 relative animate-team-top-header">
          {/* Active Members */}
          <div className="bg-black/40 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-mono font-black text-gray-300 uppercase tracking-widest">
              {team.playersCount} ACTIVE PLAYERS
            </span>
          </div>

          {/* MVT Pill */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(147,51,234,0.4)] border border-purple-400/20">
            <Sparkles className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
            <span className="text-[9px] font-mono font-black uppercase tracking-wider">
              MVT SPOTLIGHT
            </span>
          </div>
        </header>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-2 rounded-full bg-black/60 border border-white/10 hover:bg-black/80 hover:border-white/20 text-gray-400 hover:text-white transition-all cursor-pointer shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Giant Team Logo Center Presentation */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 relative px-8">
          <div className="relative group/logo">
            <div className="absolute inset-0 bg-purple-500/20 rounded-3xl blur-2xl group-hover/logo:bg-purple-500/30 transition-all duration-500" />
            <div className="w-32 h-32 rounded-3xl bg-[#050507]/80 border-2 border-purple-500/30 p-4 flex items-center justify-center relative shadow-[0_0_30px_rgba(147,51,234,0.2)] group-hover/logo:border-purple-400 transition-all duration-300">
              {team.logoUrl ? (
                <img 
                  src={team.logoUrl} 
                  alt={team.displayName} 
                  className="w-full h-full object-contain p-1"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Shield className="w-16 h-16 text-purple-400" />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white px-2.5 py-0.5 rounded-md text-[8px] font-mono font-extrabold uppercase border border-purple-400/30 shadow-lg">
              LEADER
            </div>
          </div>
        </div>

        {/* BOTTOM SHOWCASE SECTION */}
        <div className="p-8 z-10 relative space-y-6">
          
          {/* Display Name */}
          <div className="animate-team-badge flex flex-col items-center text-center">
            <div 
              className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 text-white py-3 px-8 shadow-2xl relative inline-block rounded-xl border border-purple-400/30"
            >
              <h2 className="text-xl sm:text-2xl font-display font-black tracking-wider uppercase">
                {team.displayName}
              </h2>
            </div>
            
            {/* Subtitle / Season */}
            <div className="mt-2 bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-xl border border-white/5">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">
                {seasonName || 'CURRENT SEASON'}
              </span>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-black/50 backdrop-blur-md border border-white/5 rounded-3xl p-5 grid grid-cols-3 gap-4 animate-team-badge">
            <div className="text-center">
              <span className="text-[8px] font-mono text-gray-500 uppercase block mb-1">Total Kills</span>
              <div className="flex items-center justify-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-bold font-mono text-white">{team.kills}</span>
              </div>
            </div>
            <div className="text-center border-x border-white/5">
              <span className="text-[8px] font-mono text-gray-500 uppercase block mb-1">Total Matches</span>
              <div className="flex items-center justify-center space-x-1">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-bold font-mono text-white">
                  {team.matches}
                </span>
              </div>
            </div>
            <div className="text-center bg-purple-500/10 border border-purple-500/25 rounded-2xl p-1">
              <span className="text-[8px] font-mono text-purple-400 uppercase block mb-0.5 font-bold">Total Score</span>
              <span className="text-sm font-black font-mono text-purple-400">{team.score}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
