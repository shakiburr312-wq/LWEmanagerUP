// Modification: Integrated click-to-reveal full screen MvpRevealModal animation spotlight
// Replacement of /src/pages/Stats.tsx - Performance hub refactored to support Season-based MVP calculations and dynamic leaderboard
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers } from '../lib/players';
import { watchMVPSettings, checkAndResetSeason, watchLineups, manualResetSeasonAndStats } from '../lib/settings';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { PlayerProfile, MVPSettings, PerformanceLog, Lineup } from '../types';
import { getSeasonRankedPlayers, SeasonRankedPlayer } from '../utils/mvp';
import { getSeasonName } from '../utils/season';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { MvpRevealModal } from '../components/MvpRevealModal';
import { TeamRevealModal } from '../components/TeamRevealModal';
import { Trophy, Crown, Star, Medal, Crosshair, Flame, TrendingUp, Sparkles, BarChart3, Calendar, Heart, Shield, Zap, Skull, Users, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
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
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [isMvpModalOpen, setIsMvpModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [selectedMvpPlayer, setSelectedMvpPlayer] = useState<any>(null);
  const [selectedMvpTitle, setSelectedMvpTitle] = useState<string>('Season MVP');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'mvp' | 'leaderboard'>('mvp');
  const [selectedMetric, setSelectedMetric] = useState<'overall' | 'kills' | 'damage' | 'assists' | 'healing'>('overall');
  const [metricSearchQuery, setMetricSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Auto-switch tabs based on location state (from HeroBanner clicks)
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const handleManualResetSeason = () => {
    if (!isAdmin) return;
    setShowResetConfirm(true);
  };

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

    // Listen to lineups
    const unsubLineups = watchLineups((data) => {
      setLineups(data);
    });

    return () => {
      unsubPlayers();
      unsubLogs();
      unsubSettings();
      unsubLineups();
    };
  }, [isAdmin]);

  // Run midnight daily auto-sync when page mounts or players/performanceLogs are updated
  useEffect(() => {
    if (players.length > 0 && performanceLogs.length > 0) {
      import('../lib/sync').then(({ checkAndTriggerDailySync }) => {
        checkAndTriggerDailySync(players, performanceLogs, !!isAdmin).then((res) => {
          if (res.triggered && res.success && res.updatedCount > 0) {
            console.log(`Midnight Auto-Sync: Automatically updated scoring stats for ${res.updatedCount} active players!`);
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

  // Compute Team Leaderboard Standings and Most Valuable Team (MVT)
  const teamStats = (lineups.length > 0 ? lineups : [
    { id: '1st Lineup', name: '1st Lineup', logoUrl: '' },
    { id: 'second lineup', name: 'second lineup', logoUrl: '' }
  ]).map(lineup => {
    // Filter active players in this lineup
    const teamPlayers = rankedPlayers.filter(p => {
      const pLineup = p.lineup || '1st Lineup';
      return pLineup.toLowerCase() === lineup.id.toLowerCase() || pLineup.toLowerCase() === lineup.name.toLowerCase();
    });

    const totalScore = teamPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
    const totalKills = teamPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);
    const totalDamage = teamPlayers.reduce((sum, p) => sum + (p.damage || 0), 0);
    const totalAssists = teamPlayers.reduce((sum, p) => sum + (p.assists || 0), 0);
    const totalHealing = teamPlayers.reduce((sum, p) => sum + (p.healing || 0), 0);
    const teamMatches = teamPlayers.length > 0 ? Math.max(...teamPlayers.map(p => p.matches || 0)) : 0;

    const displayName = lineup.name === 'second lineup' ? '2nd Lineup' : lineup.name;

    return {
      ...lineup,
      displayName,
      playersCount: teamPlayers.length,
      score: Number(totalScore.toFixed(1)),
      kills: totalKills,
      damage: totalDamage,
      assists: totalAssists,
      healing: totalHealing,
      matches: teamMatches
    };
  });

  const sortedTeams = [...teamStats].sort((a, b) => b.score - a.score);
  const mvt = sortedTeams.length > 0 ? sortedTeams[0] : null;

  const renderTeamAndMVTGrid = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Leading Team (MVT) Card */}
        <div 
          onClick={() => {
            if (mvt) {
              setIsTeamModalOpen(true);
            }
          }}
          className="bg-[#0c0c14] border border-purple-500/25 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(147,51,234,0.05)] cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] transition-all group flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-black text-white italic uppercase tracking-tighter flex items-center gap-1.5 max-w-[70%] truncate" title={getSeasonName(mvpSettings.seasonStartDate)}>
                <Shield className="w-5 h-5 text-purple-400 animate-pulse" />
                <span>{getSeasonName(mvpSettings.seasonStartDate)} TEAM</span>
              </h3>
              <span className="text-[9px] font-mono text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded group-hover:bg-purple-500/25 transition-all">
                REVEAL TEAM
              </span>
            </div>

            {mvt ? (
              <div>
                <div className="flex items-center gap-4 mb-4 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl border-2 border-purple-500 bg-[#050507] overflow-hidden flex items-center justify-center font-bold font-mono text-purple-400 text-lg shadow-[0_0_15px_rgba(147,51,234,0.25)]">
                      {mvt.logoUrl ? (
                        <img src={mvt.logoUrl} alt={mvt.displayName} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      ) : (
                        <Shield className="w-8 h-8 text-purple-400" />
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[8px] font-black font-mono w-4 h-4 flex items-center justify-center rounded-full border border-[#050507] shadow-md">
                      🛡️
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono text-purple-400 uppercase tracking-wider font-extrabold block">Most Valuable Team</span>
                    <h4 className="text-lg font-display font-black text-white uppercase tracking-tight truncate leading-none mt-0.5">{mvt.displayName}</h4>
                    <span className="text-[10px] font-mono text-gray-400 uppercase mt-1 inline-block">{mvt.playersCount} Active Players</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-4 font-mono text-[9px] text-gray-500">
                  <div className="text-center">
                    <span className="block uppercase text-[8px] mb-0.5">Matches</span>
                    <strong className="text-white text-xs">{mvt.matches}</strong>
                  </div>
                  <div className="text-center border-l border-white/5">
                    <span className="block uppercase text-[8px] mb-0.5">Kills</span>
                    <strong className="text-white text-xs">{mvt.kills}</strong>
                  </div>
                  <div className="text-center border-l border-white/5">
                    <span className="block uppercase text-[8px] mb-0.5">Damage</span>
                    <strong className="text-white text-xs">{Math.round(mvt.damage)}</strong>
                  </div>
                  <div className="text-center border-l border-white/5 bg-purple-500/5 rounded p-0.5">
                    <span className="block uppercase text-[8px] text-purple-500 font-bold mb-0.5">SCORE</span>
                    <strong className="text-purple-400 text-xs font-black">{mvt.score}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-gray-500 font-mono text-xs border border-dashed border-white/5 rounded-2xl">
                No lineups data available.
              </div>
            )}
          </div>
        </div>

        {/* Season Leaderboard (Team Standings) - Full width inside grid */}
        <div className="lg:col-span-2 bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold font-display uppercase tracking-widest text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                {getSeasonName(mvpSettings.seasonStartDate)} Leaderboard
              </h3>
              <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 rounded">
                Lineup Standings
              </span>
            </div>
            
            <div className="space-y-4 my-3">
              {sortedTeams.map((team, idx) => {
                const isTop = idx === 0;
                const maxScore = Math.max(...sortedTeams.map(t => t.score));
                const progressPercent = maxScore > 0 ? (team.score / maxScore) * 100 : 50;
                
                return (
                  <div key={team.id} className={`p-5 bg-[#050507]/40 border rounded-2xl transition-all ${isTop ? 'border-amber-500/20 hover:border-amber-500/30 bg-[#0c0c14]/40' : 'border-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center space-x-4 min-w-0">
                        <span className={`w-8 text-center font-mono font-black text-base ${isTop ? 'text-amber-400' : 'text-gray-500'}`}>
                          #{idx + 1}
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                          {team.logoUrl ? (
                            <img src={team.logoUrl} alt={team.displayName} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                          ) : (
                            <Shield className={`w-5 h-5 ${isTop ? 'text-amber-400' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-sans font-black text-white uppercase block tracking-wider truncate">
                            {team.displayName}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 block uppercase mt-0.5">
                            {team.playersCount} players • {team.matches} matches
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-base font-black font-mono tracking-wider block ${isTop ? 'text-amber-400' : 'text-purple-400'}`}>
                          {team.score} pts
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-[#050507] h-2 rounded-full overflow-hidden border border-white/5 mt-3">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest text-center mt-6 pt-4 border-t border-white/5">
            Points calculated using configured active weights
          </div>
        </div>
      </div>
    );
  };

  const formattedSeasonStart = mvpSettings.seasonStartDate 
    ? new Date(mvpSettings.seasonStartDate).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Stats Area */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8">
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
            {isAdmin && (
              <button
                onClick={handleManualResetSeason}
                disabled={isResetting}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/15 hover:border-red-500/30 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Reset Season</span>
              </button>
            )}
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
                📊 {getSeasonName(mvpSettings.seasonStartDate)} Leaderboards
              </button>
            </div>

            {activeTab === 'mvp' ? (
              <div className="space-y-8 animate-fade-in">
                {/* MVP Top Showcase Section */}
                {mvp && mvp.matches > 0 ? (
                  <div 
                    onClick={() => {
                      setSelectedMvpPlayer(mvp);
                      setSelectedMvpTitle(`${getSeasonName(mvpSettings.seasonStartDate)} MVP`);
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
                          <span>{getSeasonName(mvpSettings.seasonStartDate)} Top Performer</span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-wider uppercase">{mvp.name}</h2>
                        <span className="text-xs font-mono text-purple-300 uppercase tracking-widest block mt-1">Role: {mvp.role}</span>
                      </div>

                      {/* Right calculated score and stats */}
                      <div className="grid grid-cols-4 gap-4 bg-[#050507]/60 border border-white/5 p-5 rounded-2xl md:min-w-[400px]">
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
                        <div className="text-center border-l border-white/5 bg-amber-500/5 rounded-lg">
                          <span className="text-[9px] font-mono text-amber-500 uppercase block mb-1">Score</span>
                          <span className="text-sm font-bold text-amber-400 font-mono">{mvp.score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0c0c14] border border-dashed border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500/40">
                      <Crown className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-black text-white italic uppercase tracking-wider">NO MVP YET</h3>
                      <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
                        Season-based player performance rankings are calculated dynamically. Once match performance logs are recorded, the highest scoring active player will take this spotlight!
                      </p>
                    </div>
                  </div>
                )}

                {/* Specific Category MVPs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                {renderTeamAndMVTGrid()}
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* Interactive Metric Leaderboard Hub */}
                <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col gap-6">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

                  {/* Header & Search */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
                    <div>
                      <h3 className="text-lg font-display font-black text-white italic uppercase tracking-tighter">
                        Interactive Stat Leaderboard Hub
                      </h3>
                      <p className="text-gray-400 text-xs font-mono uppercase mt-1">Select a performance metric below to view live standings</p>
                    </div>
                    <div className="relative w-full md:w-72 shrink-0">
                      <input
                        type="text"
                        placeholder="Search players..."
                        value={metricSearchQuery}
                        onChange={(e) => setMetricSearchQuery(e.target.value)}
                        className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Compact Category Selector Pills - User Friendly & Small */}
                  <div className="flex flex-wrap items-center gap-2 pb-2 overflow-x-auto scrollbar-none border-b border-white/5">
                    <button
                      onClick={() => setSelectedMetric('overall')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedMetric === 'overall'
                          ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                          : 'bg-[#050507] border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <Trophy className="w-4 h-4" />
                      <span>Overall MVP Score</span>
                    </button>

                    <button
                      onClick={() => setSelectedMetric('kills')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedMetric === 'kills'
                          ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                          : 'bg-[#050507] border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <Skull className="w-4 h-4" />
                      <span>Total Kills</span>
                    </button>

                    <button
                      onClick={() => setSelectedMetric('damage')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedMetric === 'damage'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          : 'bg-[#050507] border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Total Damage</span>
                    </button>

                    <button
                      onClick={() => setSelectedMetric('assists')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedMetric === 'assists'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                          : 'bg-[#050507] border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Total Assists</span>
                    </button>

                    <button
                      onClick={() => setSelectedMetric('healing')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedMetric === 'healing'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                          : 'bg-[#050507] border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      <span>Total Healing</span>
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                      <h4 className="text-xs font-black font-mono text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        {selectedMetric === 'overall' && <Trophy className="w-4 h-4 text-purple-400 animate-pulse" />}
                        {selectedMetric === 'kills' && <Skull className="w-4 h-4 text-red-400 animate-pulse" />}
                        {selectedMetric === 'damage' && <Zap className="w-4 h-4 text-amber-400 animate-pulse" />}
                        {selectedMetric === 'assists' && <Shield className="w-4 h-4 text-blue-400 animate-pulse" />}
                        {selectedMetric === 'healing' && <Heart className="w-4 h-4 text-emerald-400 animate-pulse" />}
                        <span>Standings Rank List • {selectedMetric.toUpperCase()}</span>
                      </h4>
                      <span className="text-[10px] font-mono text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                        {(() => {
                          const list = [...rankedPlayers];
                          if (selectedMetric === 'kills') list.sort((a, b) => b.kills - a.kills);
                          else if (selectedMetric === 'damage') list.sort((a, b) => b.damage - a.damage);
                          else if (selectedMetric === 'assists') list.sort((a, b) => (b.assists || 0) - (a.assists || 0));
                          else if (selectedMetric === 'healing') list.sort((a, b) => (b.healing || 0) - (a.healing || 0));
                          else list.sort((a, b) => b.score - a.score);
                          
                          const filtered = list.filter(p => p.name.toLowerCase().includes(metricSearchQuery.toLowerCase()));
                          return `${filtered.length} players found`;
                        })()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const list = [...rankedPlayers];
                        
                        // Sort according to metric
                        if (selectedMetric === 'kills') {
                          list.sort((a, b) => b.kills - a.kills);
                        } else if (selectedMetric === 'damage') {
                          list.sort((a, b) => b.damage - a.damage);
                        } else if (selectedMetric === 'assists') {
                          list.sort((a, b) => (b.assists || 0) - (a.assists || 0));
                        } else if (selectedMetric === 'healing') {
                          list.sort((a, b) => (b.healing || 0) - (a.healing || 0));
                        } else {
                          list.sort((a, b) => b.score - a.score);
                        }

                        const filteredList = list.filter(p => p.name.toLowerCase().includes(metricSearchQuery.toLowerCase()));

                        if (filteredList.length === 0) {
                          return (
                            <div className="py-12 text-center text-gray-500 font-mono text-xs border border-dashed border-white/5 rounded-2xl">
                              No matching players found.
                            </div>
                          );
                        }

                        // Find highest value of the current metric for ratio indicator
                        const getMetricVal = (p: SeasonRankedPlayer) => {
                          if (selectedMetric === 'kills') return p.kills;
                          if (selectedMetric === 'damage') return p.damage;
                          if (selectedMetric === 'assists') return p.assists || 0;
                          if (selectedMetric === 'healing') return p.healing || 0;
                          return p.score;
                        };

                        const maxVal = Math.max(...list.map(p => getMetricVal(p)), 1);

                        return filteredList.map((player, idx) => {
                          const val = getMetricVal(player);
                          const progressPercent = Math.min((val / maxVal) * 100, 100);
                          const isTop = idx === 0;

                          const metricLabels: Record<string, string> = {
                            kills: 'Kills',
                            damage: 'DMG',
                            assists: 'Assists',
                            healing: 'HP Healed',
                            overall: 'MVP Pts'
                          };

                          const metricColors: Record<string, string> = {
                            kills: 'from-red-600 to-red-400',
                            damage: 'from-amber-600 to-amber-400',
                            assists: 'from-blue-600 to-blue-400',
                            healing: 'from-emerald-600 to-emerald-400',
                            overall: 'from-purple-600 to-purple-400'
                          };

                          return (
                            <div 
                              key={player.id}
                              className={`p-4 rounded-2xl border transition-all relative group flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                isTop 
                                  ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]' 
                                  : 'bg-[#050507]/40 border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div className="flex items-center space-x-4 min-w-0">
                                <span className={`w-8 text-center font-mono font-black text-sm md:text-base ${
                                  idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-gray-500'
                                }`}>
                                  #{idx + 1}
                                </span>
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                                  {player.photoUrl || player.mvpPhotoUrl ? (
                                    <img src={player.photoUrl || player.mvpPhotoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Users className="w-5 h-5 text-gray-400" />
                                  )}
                                  {idx < 3 && (
                                    <span className="absolute bottom-0 right-0 text-[8px] leading-none bg-black/80 p-0.5 rounded-tl border-t border-l border-white/10">
                                      {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-sans font-black text-white uppercase block tracking-wider truncate">
                                    {player.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-purple-300 block uppercase mt-0.5">
                                    {player.role} • {player.matches} matches
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col md:items-end gap-2 md:min-w-[180px] w-full md:w-auto shrink-0">
                                <div className="flex justify-between md:justify-end items-baseline gap-2 w-full">
                                  <span className="text-[10px] font-mono text-gray-500 uppercase md:hidden">{metricLabels[selectedMetric]}</span>
                                  <span className={`text-base font-black font-mono tracking-wider ${
                                    isTop ? 'text-amber-400' : 'text-white'
                                  }`}>
                                    {selectedMetric === 'damage' ? Math.round(val) : val}
                                    <span className="text-[10px] text-gray-500 uppercase font-mono ml-1">{metricLabels[selectedMetric]}</span>
                                  </span>
                                </div>
                                
                                {/* Visual bar relative to #1 */}
                                <div className="w-full bg-[#050507] h-1.5 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className={`h-full rounded-full bg-gradient-to-r ${metricColors[selectedMetric]} transition-all duration-500`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
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

        <TeamRevealModal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          team={mvt}
          seasonName={getSeasonName(mvpSettings.seasonStartDate)}
        />

        {/* Custom Confirmation Modal for Season Reset */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
            <div className="bg-[#0c0c14] border border-red-500/25 rounded-3xl p-6 max-w-sm w-full relative z-10 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Are you absolutely sure?</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  This will COMPLETELY reset the season. All performance logs will be deleted and all players' stats will be wiped to 0. This cannot be undone!
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowResetConfirm(false);
                    setIsResetting(true);
                    const toastId = toast.loading("Resetting season & deleting stats data...");
                    try {
                      await manualResetSeasonAndStats(mvpSettings, players);
                      toast.success("Season reset successfully! All stats have been wiped.", { id: toastId });
                    } catch (error: any) {
                      toast.error("Failed to reset season: " + error.message, { id: toastId });
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer"
                >
                  Reset Now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
