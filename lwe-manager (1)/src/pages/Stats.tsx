// Modification: Integrated click-to-reveal full screen MvpRevealModal animation spotlight
// Replacement of /src/pages/Stats.tsx - Performance hub refactored to support Season-based MVP calculations and dynamic leaderboard
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers } from '../lib/players';
import { watchMVPSettings, checkAndResetSeason } from '../lib/settings';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { PlayerProfile, MVPSettings, PerformanceLog } from '../types';
import { getSeasonRankedPlayers, SeasonRankedPlayer } from '../utils/mvp';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { MvpRevealModal } from '../components/MvpRevealModal';
import { Trophy, Crown, Star, Medal, Crosshair, Flame, TrendingUp, Sparkles, BarChart3, Calendar, Heart, Shield, Zap, Skull } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const Stats: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLog[]>([]);
  const [mvpSettings, setMvpSettings] = useState<MVPSettings>({ 
    kdWeight: 10, 
    killsWeight: 1, 
    damageWeight: 0.1,
    seasonStartDate: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [isMvpModalOpen, setIsMvpModalOpen] = useState(false);
  const [selectedMvpPlayer, setSelectedMvpPlayer] = useState<any>(null);
  const [selectedMvpTitle, setSelectedMvpTitle] = useState<string>('Season MVP');
  const [activeTab, setActiveTab] = useState<'mvp' | 'leaderboard'>('mvp');

  useEffect(() => {
    // Listen to players
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
    });

    // Listen to performance logs
    const unsubLogs = watchPerformanceLogs((logs) => {
      setPerformanceLogs(logs);
    });

    // Listen to MVP formula configurations
    const unsubSettings = watchMVPSettings((settings) => {
      setMvpSettings(settings);
      
      // Perform 30-day season auto-reset check
      if (settings.seasonStartDate) {
        checkAndResetSeason(settings, !!isAdmin);
      }
      
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubLogs();
      unsubSettings();
    };
  }, [isAdmin]);

  // Run midnight daily auto-sync when page mounts or players/performanceLogs are updated
  useEffect(() => {
    if (players.length > 0 && performanceLogs.length > 0) {
      import('../lib/sync').then(({ checkAndTriggerDailySync }) => {
        checkAndTriggerDailySync(players, performanceLogs, !!isAdmin).then((res) => {
          if (res.triggered && res.success && res.updatedCount > 0) {
            toast.success(`Midnight Auto-Sync: Automatically updated scoring stats for ${res.updatedCount} active players!`);
          }
        });
      });
    }
  }, [players, performanceLogs, isAdmin]);

  // Compute Season-Based Rankings
  const rankedPlayers: SeasonRankedPlayer[] = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);

  const mvp = rankedPlayers.length > 0 ? rankedPlayers[0] : null;
  const runnerUp = rankedPlayers.length > 1 ? rankedPlayers[1] : null;
  const thirdPlace = rankedPlayers.length > 2 ? rankedPlayers[2] : null;

  // Specific Category MVPs
  const getTopPlayerByMetric = (metric: 'healing' | 'assists' | 'damage' | 'kills') => {
    if (rankedPlayers.length === 0) return null;
    const sorted = [...rankedPlayers].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
    return (sorted[0] && (sorted[0][metric] || 0) > 0) ? sorted[0] : null;
  };

  const healingMvp = getTopPlayerByMetric('healing');
  const assistMvp = getTopPlayerByMetric('assists');
  const damageMvp = getTopPlayerByMetric('damage');
  const killsMvp = getTopPlayerByMetric('kills');

  const formattedSeasonStart = mvpSettings.seasonStartDate 
    ? new Date(mvpSettings.seasonStartDate).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Stats Area */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Performance <span className="text-purple-500">Hub</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Live season-based rankings and MVP recognition</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <BalanceIndicator />
            <div className="bg-[#11111a] border border-white/5 px-4 py-2.5 rounded-xl font-mono text-[10px] text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
              <span>Season Started: {formattedSeasonStart}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">CALCULATING ANALYTICS...</p>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-[#0c0c14] rounded-3xl border border-white/5 p-12 text-center max-w-2xl">
            <Trophy className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No Stats Available</h3>
            <p className="text-gray-400 text-sm">Please ensure there are active players registered in the team roster.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Custom Tab Switcher */}
            <div className="flex border-b border-white/5 mb-6">
              <button
                onClick={() => setActiveTab('mvp')}
                className={`pb-4 px-6 font-display font-bold uppercase text-xs tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'mvp'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                🏆 MVP Spotlight
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`pb-4 px-6 font-display font-bold uppercase text-xs tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                📊 Season Leaderboards
              </button>
            </div>

            {activeTab === 'mvp' ? (
              <div className="space-y-8 animate-fade-in">
                {/* MVP Top Showcase Section */}
                {mvp && (
                  <div 
                    onClick={() => {
                      setSelectedMvpPlayer(mvp);
                      setSelectedMvpTitle('Season MVP');
                      setIsMvpModalOpen(true);
                    }}
                    className="bg-[#0c0c14] border border-purple-500/30 rounded-3xl relative overflow-hidden shadow-[0_0_30px_rgba(147,51,234,0.15)] p-8 cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(147,51,234,0.25)] transition-all group"
                  >
                    {/* Visual particle sparkles design decoration */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute top-6 right-6 text-amber-400 animate-bounce">
                      <Crown className="w-10 h-10" />
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                      {/* Left profile/badge */}
                      <div className="relative">
                        <div className="w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/5 overflow-hidden">
                          {mvp.photoUrl || mvp.mvpPhotoUrl ? (
                            <img 
                              src={mvp.photoUrl || mvp.mvpPhotoUrl} 
                              alt={mvp.name} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Crown className="w-12 h-12" />
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 text-[#050507] font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded shadow">
                          MVP
                        </div>
                      </div>

                      {/* Middle player credentials */}
                      <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center space-x-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded text-[9px] font-mono text-amber-400 uppercase tracking-wider mb-2">
                          <Sparkles className="w-3 h-3" />
                          <span>Season Top Performer</span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-wider uppercase">{mvp.name}</h2>
                        <span className="text-xs font-mono text-purple-300 uppercase tracking-widest block mt-1">Role: {mvp.role}</span>
                      </div>

                      {/* Right calculated score and stats */}
                      <div className="grid grid-cols-5 gap-4 bg-[#050507]/60 border border-white/5 p-5 rounded-2xl md:min-w-[480px]">
                        <div className="text-center">
                          <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Matches</span>
                          <span className="text-sm font-bold text-white font-mono">{mvp.matches}</span>
                        </div>
                        <div className="text-center border-l border-white/5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">K/D</span>
                          <span className="text-sm font-bold text-white font-mono">
                            {mvp.matches > 0 ? (mvp.kills / Math.max(1, mvp.matches - mvp.booyahs)).toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="text-center border-l border-white/5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Kills</span>
                          <span className="text-sm font-bold text-white font-mono">{mvp.kills}</span>
                        </div>
                        <div className="text-center border-l border-white/5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Damage</span>
                          <span className="text-sm font-bold text-white font-mono">{mvp.damage}</span>
                        </div>
                        <div className="text-center border-l border-white/5 bg-amber-500/5 rounded-lg">
                          <span className="text-[9px] font-mono text-amber-500 uppercase block mb-1">Score</span>
                          <span className="text-sm font-bold text-amber-400 font-mono">{mvp.score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific Category MVPs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Kills Wise MVP */}
                  <div 
                    onClick={() => {
                      if (killsMvp) {
                        setSelectedMvpPlayer(killsMvp);
                        setSelectedMvpTitle('Kills MVP');
                        setIsMvpModalOpen(true);
                      }
                    }}
                    className={`bg-[#0c0c14] border border-red-500/10 hover:border-red-500/35 rounded-2xl p-4 flex items-center gap-4 transition-all relative overflow-hidden group shadow-lg ${killsMvp ? 'cursor-pointer hover:scale-[1.02] hover:bg-[#110c18]' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 overflow-hidden">
                      {killsMvp?.photoUrl || killsMvp?.mvpPhotoUrl ? (
                        <img src={killsMvp.photoUrl || killsMvp.mvpPhotoUrl} alt={killsMvp.name} className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                      ) : (
                        <Skull className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-black text-red-400 uppercase tracking-widest block mb-0.5">Kills MVP</span>
                      <h4 className="text-sm font-sans font-bold text-white uppercase truncate">{killsMvp?.name || 'No MVP Yet'}</h4>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">Total Kills: <strong className="text-white">{killsMvp?.kills || 0}</strong></p>
                    </div>
                  </div>

                  {/* Actual Damage Wise MVP */}
                  <div 
                    onClick={() => {
                      if (damageMvp) {
                        setSelectedMvpPlayer(damageMvp);
                        setSelectedMvpTitle('Damage MVP');
                        setIsMvpModalOpen(true);
                      }
                    }}
                    className={`bg-[#0c0c14] border border-amber-500/10 hover:border-amber-500/35 rounded-2xl p-4 flex items-center gap-4 transition-all relative overflow-hidden group shadow-lg ${damageMvp ? 'cursor-pointer hover:scale-[1.02] hover:bg-[#18110c]' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
                      {damageMvp?.photoUrl || damageMvp?.mvpPhotoUrl ? (
                        <img src={damageMvp.photoUrl || damageMvp.mvpPhotoUrl} alt={damageMvp.name} className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                      ) : (
                        <Zap className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-black text-amber-400 uppercase tracking-widest block mb-0.5">Damage MVP</span>
                      <h4 className="text-sm font-sans font-bold text-white uppercase truncate">{damageMvp?.name || 'No MVP Yet'}</h4>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">Total Damage: <strong className="text-white">{damageMvp?.damage || 0}</strong></p>
                    </div>
                  </div>

                  {/* Assist Wise MVP */}
                  <div 
                    onClick={() => {
                      if (assistMvp) {
                        setSelectedMvpPlayer(assistMvp);
                        setSelectedMvpTitle('Assists MVP');
                        setIsMvpModalOpen(true);
                      }
                    }}
                    className={`bg-[#0c0c14] border border-blue-500/10 hover:border-blue-500/35 rounded-2xl p-4 flex items-center gap-4 transition-all relative overflow-hidden group shadow-lg ${assistMvp ? 'cursor-pointer hover:scale-[1.02] hover:bg-[#0c121c]' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 overflow-hidden">
                      {assistMvp?.photoUrl || assistMvp?.mvpPhotoUrl ? (
                        <img src={assistMvp.photoUrl || assistMvp.mvpPhotoUrl} alt={assistMvp.name} className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                      ) : (
                        <Shield className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-black text-blue-400 uppercase tracking-widest block mb-0.5">Assists MVP</span>
                      <h4 className="text-sm font-sans font-bold text-white uppercase truncate">{assistMvp?.name || 'No MVP Yet'}</h4>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">Total Assists: <strong className="text-white">{assistMvp?.assists || 0}</strong></p>
                    </div>
                  </div>

                  {/* Healing Wise MVP */}
                  <div 
                    onClick={() => {
                      if (healingMvp) {
                        setSelectedMvpPlayer(healingMvp);
                        setSelectedMvpTitle('Healing MVP');
                        setIsMvpModalOpen(true);
                      }
                    }}
                    className={`bg-[#0c0c14] border border-emerald-500/10 hover:border-emerald-500/35 rounded-2xl p-4 flex items-center gap-4 transition-all relative overflow-hidden group shadow-lg ${healingMvp ? 'cursor-pointer hover:scale-[1.02] hover:bg-[#0c1811]' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-xl bg-[#0c2415] border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 overflow-hidden">
                      {healingMvp?.photoUrl || healingMvp?.mvpPhotoUrl ? (
                        <img src={healingMvp.photoUrl || healingMvp.mvpPhotoUrl} alt={healingMvp.name} className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                      ) : (
                        <Heart className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Healing MVP</span>
                      <h4 className="text-sm font-sans font-bold text-white uppercase truncate">{healingMvp?.name || 'No MVP Yet'}</h4>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">Total Healing: <strong className="text-white">{healingMvp?.healing || 0}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Podium Top 3 cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {rankedPlayers.slice(0, 3).map((player, idx) => {
                    const colors = [
                      { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-[#11111a]', label: '1ST PLACE' },
                      { text: 'text-slate-300', border: 'border-white/10', bg: 'bg-[#11111a]', label: '2ND PLACE' },
                      { text: 'text-amber-700', border: 'border-white/10', bg: 'bg-[#11111a]', label: '3RD PLACE' }
                    ][idx];

                    return (
                      <div 
                        key={player.id} 
                        className={`border rounded-2xl p-6 flex flex-col justify-between ${colors.border} ${colors.bg}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${colors.text} border-current/25 bg-current/5`}>
                              {colors.label}
                            </span>
                            <Medal className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <h4 className="text-lg font-display font-bold text-white tracking-wide truncate uppercase">{player.name}</h4>
                          <span className="text-[10px] font-mono text-purple-400 uppercase block mt-0.5">{player.role}</span>
                        </div>

                        <div className="flex items-end justify-between mt-6 border-t border-white/5 pt-4">
                          <div className="flex space-x-3.5 font-mono text-xs">
                            <div>
                              <span className="text-gray-500 text-[9px] block">Matches</span>
                              <span className="text-white font-bold">{player.matches}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-[9px] block">K/D</span>
                              <span className="text-white font-bold text-xs">
                                {player.matches > 0 ? (player.kills / Math.max(1, player.matches - player.booyahs)).toFixed(2) : '0.00'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-[9px] block">KILLS</span>
                              <span className="text-white font-bold">{player.kills}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 text-[9px] font-mono block">SEASON SCORE</span>
                            <span className={`text-lg font-black font-mono ${colors.text}`}>{player.score}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* 4 Metric-Wise Leaders lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Kills Wise Leaderboard */}
                  <div className="bg-[#0c0c14] border border-red-500/15 rounded-3xl p-6 flex flex-col">
                    <h4 className="text-xs font-black font-mono text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Skull className="w-4 h-4" />
                      Kills Wise Leaderboard
                    </h4>
                    <div className="space-y-2">
                      {[...rankedPlayers].sort((a, b) => b.kills - a.kills).slice(0, 5).map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-[#050507]/40 border border-white/5 rounded-xl text-xs font-mono">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-red-500 w-5 text-center">#{idx + 1}</span>
                            <span className="text-white font-sans font-bold uppercase">{p.name}</span>
                          </div>
                          <span className="text-red-400 font-bold">{p.kills} Kills</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Damage Wise Leaderboard */}
                  <div className="bg-[#0c0c14] border border-amber-500/15 rounded-3xl p-6 flex flex-col">
                    <h4 className="text-xs font-black font-mono text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Damage Wise Leaderboard
                    </h4>
                    <div className="space-y-2">
                      {[...rankedPlayers].sort((a, b) => b.damage - a.damage).slice(0, 5).map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-[#050507]/40 border border-white/5 rounded-xl text-xs font-mono">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-amber-500 w-5 text-center">#{idx + 1}</span>
                            <span className="text-white font-sans font-bold uppercase">{p.name}</span>
                          </div>
                          <span className="text-amber-400 font-bold">{p.damage} DMG</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assists Wise Leaderboard */}
                  <div className="bg-[#0c0c14] border border-blue-500/15 rounded-3xl p-6 flex flex-col">
                    <h4 className="text-xs font-black font-mono text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Assists Wise Leaderboard
                    </h4>
                    <div className="space-y-2">
                      {[...rankedPlayers].sort((a, b) => (b.assists || 0) - (a.assists || 0)).slice(0, 5).map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-[#050507]/40 border border-white/5 rounded-xl text-xs font-mono">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-blue-500 w-5 text-center">#{idx + 1}</span>
                            <span className="text-white font-sans font-bold uppercase">{p.name}</span>
                          </div>
                          <span className="text-blue-400 font-bold">{p.assists || 0} AST</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Healing Wise Leaderboard */}
                  <div className="bg-[#0c0c14] border border-emerald-500/15 rounded-3xl p-6 flex flex-col">
                    <h4 className="text-xs font-black font-mono text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Healing Wise Leaderboard
                    </h4>
                    <div className="space-y-2">
                      {[...rankedPlayers].sort((a, b) => (b.healing || 0) - (a.healing || 0)).slice(0, 5).map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-[#050507]/40 border border-white/5 rounded-xl text-xs font-mono">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-emerald-500 w-5 text-center">#{idx + 1}</span>
                            <span className="text-white font-sans font-bold uppercase">{p.name}</span>
                          </div>
                          <span className="text-emerald-400 font-bold">{p.healing || 0} HP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Complete Rankings List Table (Global) */}
                <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>COMPLETE SEASON LEADERBOARD</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-500 uppercase font-mono tracking-widest text-[9px]">
                          <th className="py-3 px-4 text-center w-12">Rank</th>
                          <th className="py-3 px-4">Player</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4 text-center">Matches</th>
                          <th className="py-3 px-4 text-center">Booyahs</th>
                          <th className="py-3 px-4 text-center">Season K/D</th>
                          <th className="py-3 px-4 text-center">Season Kills</th>
                          <th className="py-3 px-4 text-center">Season Damage</th>
                          <th className="py-3 px-4 text-right">Weighted Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {rankedPlayers.map((player, idx) => (
                          <tr 
                            key={player.id}
                            className={`transition-colors ${idx === 0 ? 'bg-amber-500/5' : 'hover:bg-white/5'}`}
                          >
                            <td className="py-4 px-4 text-center font-bold">
                              {idx === 0 ? (
                                <span className="text-amber-400">#1</span>
                              ) : (
                                <span className="text-gray-400">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-sans font-bold text-white uppercase">{player.name}</td>
                            <td className="py-4 px-4 text-purple-300">{player.role}</td>
                            <td className="py-4 px-4 text-center text-white">{player.matches}</td>
                            <td className="py-4 px-4 text-center text-amber-500">{player.booyahs}</td>
                            <td className="py-4 px-4 text-center text-white">
                              {player.matches > 0 ? (player.kills / Math.max(1, player.matches - player.booyahs)).toFixed(2) : '0.00'}
                            </td>
                            <td className="py-4 px-4 text-center text-white">{player.kills}</td>
                            <td className="py-4 px-4 text-center text-white">{player.damage}</td>
                            <td className="py-4 px-4 text-right font-black text-purple-400">{player.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedMvpPlayer && (
          <MvpRevealModal 
            isOpen={isMvpModalOpen}
            onClose={() => setIsMvpModalOpen(false)}
            mvp={selectedMvpPlayer}
            title={selectedMvpTitle}
          />
        )}
      </main>
    </div>
  );
};
