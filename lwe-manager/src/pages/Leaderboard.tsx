import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers } from '../lib/players';
import { watchMVPSettings, watchLineups } from '../lib/settings';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { PlayerProfile, MVPSettings, PerformanceLog, Lineup } from '../types';
import { getSeasonRankedPlayers, SeasonRankedPlayer } from '../utils/mvp';
import { getSeasonName } from '../utils/season';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { BarChart3, Trophy, Users, Shield, Calendar } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  const { isAdmin } = useAuth();
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

  useEffect(() => {
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
    });

    const unsubLogs = watchPerformanceLogs((logs) => {
      setPerformanceLogs(logs);
    });

    const unsubSettings = watchMVPSettings((settings) => {
      setMvpSettings(settings);
      setLoading(false);
    });

    const unsubLineups = watchLineups((data) => {
      setLineups(data);
    });

    return () => {
      unsubPlayers();
      unsubLogs();
      unsubSettings();
      unsubLineups();
    };
  }, []);

  const rankedPlayers: SeasonRankedPlayer[] = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);

  const teamStats = (lineups.length > 0 ? lineups : [
    { id: '1st Lineup', name: '1st Lineup', logoUrl: '' },
    { id: 'second lineup', name: 'second lineup', logoUrl: '' }
  ]).map(lineup => {
    const teamPlayers = rankedPlayers.filter(p => {
      const pLineup = p.lineup || '1st Lineup';
      return pLineup.toLowerCase() === lineup.id.toLowerCase() || pLineup.toLowerCase() === lineup.name.toLowerCase();
    });

    const totalScore = teamPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
    const totalKills = teamPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);
    const totalDamage = teamPlayers.reduce((sum, p) => sum + (p.damage || 0), 0);
    const totalMatches = teamPlayers.reduce((sum, p) => sum + (p.matches || 0), 0);

    const displayName = lineup.name === 'second lineup' ? '2nd Lineup' : lineup.name;

    return {
      ...lineup,
      displayName,
      playersCount: teamPlayers.length,
      score: Number(totalScore.toFixed(1)),
      kills: totalKills,
      damage: totalDamage,
      matches: totalMatches
    };
  });

  const sortedTeams = [...teamStats].sort((a, b) => b.score - a.score);

  const formattedSeasonStart = mvpSettings.seasonStartDate 
    ? new Date(mvpSettings.seasonStartDate).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Season <span className="text-purple-500">Leaderboard</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Live team standings and complete player rankings</p>
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
              <p className="text-purple-400 font-mono text-xs">LOADING LEADERBOARD...</p>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-[#0c0c14] rounded-3xl border border-white/5 p-12 text-center max-w-2xl">
            <Trophy className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No Data Available</h3>
            <p className="text-gray-400 text-sm">Roster data is currently empty.</p>
          </div>
        ) : (
          <div className="space-y-8 max-w-7xl">
            {/* Team Lineup Standings Card */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2 font-mono">
                    <Users className="w-4 h-4 text-purple-400" />
                    {getSeasonName(mvpSettings.seasonStartDate)} LINEUP STANDINGS
                  </h3>
                  <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 rounded">
                    Division Ranks
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Complete Rankings List Table (Global) */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center space-x-2 font-mono">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span>COMPLETE {getSeasonName(mvpSettings.seasonStartDate)} LEADERBOARD</span>
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
      </main>
    </div>
  );
};
