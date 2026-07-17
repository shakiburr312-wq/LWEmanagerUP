// New file /src/pages/DailyStats.tsx - Admin-only page for bulk entry and history editing of daily player performance stats
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers } from '../lib/players';
import { watchPerformanceLogs, addPerformanceLogs, updatePerformanceLog, deletePerformanceLog } from '../lib/performanceLogs';
import { PlayerProfile, PerformanceLog } from '../types';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { Save, Calendar, User, Eye, Plus, TrendingUp, BarChart2, Edit, Trash2, Check, X, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlayerStatsInput {
  matches: number;
  booyahs: number;
  kills: number;
  damage: number;
  assists?: number;
  healing?: number;
}

type StatsInputsState = Record<string, PlayerStatsInput>;

export const DailyStats: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [inputs, setInputs] = useState<StatsInputsState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Performance Log History States
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    matches: number;
    booyahs: number;
    kills: number;
    damage: number;
    assists: number;
    healing: number;
  } | null>(null);

  useEffect(() => {
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data.filter(p => p.status === 'active'));
      setLoading(false);
    });

    const unsubLogs = watchPerformanceLogs((data) => {
      setLogs(data);
    });

    return () => {
      unsubPlayers();
      unsubLogs();
    };
  }, []);

  // Run midnight daily auto-sync when page mounts or players/logs are updated
  useEffect(() => {
    if (players.length > 0 && logs.length > 0) {
      import('../lib/sync').then(({ checkAndTriggerDailySync }) => {
        checkAndTriggerDailySync(players, logs, !!isAdmin).then((res) => {
          if (res.triggered && res.success && res.updatedCount > 0) {
            console.log(`Midnight Auto-Sync: Automatically updated scoring stats for ${res.updatedCount} active players!`);
          }
        });
      });
    }
  }, [players, logs, isAdmin]);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading('Synchronizing and updating player scores...');
    try {
      const { performScoreSync } = await import('../lib/sync');
      const result = await performScoreSync(players, logs);
      if (result.success) {
        toast.success(`Successfully synchronized scores! Updated ${result.updatedCount} players.`, { id: toastId });
      } else {
        toast.error('Failed to sync scores.', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleInputChange = (playerId: string, field: keyof PlayerStatsInput, valStr: string) => {
    const val = parseInt(valStr) || 0;
    setInputs(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || { matches: 0, booyahs: 0, kills: 0, damage: 0, assists: 0, healing: 0 }),
        [field]: Math.max(0, val)
      }
    }));
  };

  const handleSaveAll = async () => {
    if (saving) return;

    const logsToSave = players.map(p => {
      const stats = inputs[p.id] || { matches: 0, booyahs: 0, kills: 0, damage: 0, assists: 0, healing: 0 };
      return {
        playerId: p.id,
        playerName: p.name,
        date: new Date().toISOString(),
        matches: stats.matches,
        booyahs: stats.booyahs,
        kills: stats.kills,
        damage: stats.damage,
        assists: stats.assists || 0,
        healing: stats.healing || 0,
        addedBy: user?.name || 'Admin'
      };
    }).filter(log => log.matches > 0 || log.booyahs > 0 || log.kills > 0 || log.damage > 0 || log.assists > 0 || log.healing > 0);

    if (logsToSave.length === 0) {
      toast.error('Please enter performance stats (above 0) for at least one active player.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Saving bulk performance entries to database...');
    try {
      await addPerformanceLogs(logsToSave);
      
      // Run score synchronization in the background
      const { performScoreSync } = await import('../lib/sync');
      await performScoreSync(players, [...logsToSave, ...logs]);

      toast.success(`Successfully recorded performance stats for ${logsToSave.length} players!`, { id: toastId });
      // Reset all form inputs to 0
      setInputs({});
    } catch (error: any) {
      toast.error('Failed to save performance stats: ' + error.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (log: PerformanceLog) => {
    if (!log.id) return;
    setEditingLogId(log.id);
    setEditForm({
      matches: log.matches,
      booyahs: log.booyahs,
      kills: log.kills,
      damage: log.damage,
      assists: log.assists || 0,
      healing: log.healing || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async (logId: string) => {
    if (!editForm) return;
    const toastId = toast.loading('Saving corrected stats...');
    try {
      await updatePerformanceLog(logId, {
        matches: Number(editForm.matches),
        booyahs: Number(editForm.booyahs),
        kills: Number(editForm.kills),
        damage: Number(editForm.damage),
        assists: Number(editForm.assists),
        healing: Number(editForm.healing),
      });

      // Recalculate locally and sync
      const updatedLogs = logs.map(l => l.id === logId ? {
        ...l,
        matches: Number(editForm.matches),
        booyahs: Number(editForm.booyahs),
        kills: Number(editForm.kills),
        damage: Number(editForm.damage),
        assists: Number(editForm.assists),
        healing: Number(editForm.healing),
      } : l);
      const { performScoreSync } = await import('../lib/sync');
      await performScoreSync(players, updatedLogs);

      toast.success('Stats successfully corrected!', { id: toastId });
      setEditingLogId(null);
      setEditForm(null);
    } catch (error: any) {
      toast.error('Failed to update stats: ' + error.message, { id: toastId });
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Are you sure you want to delete this stats log entry? This will correct the player\'s total metrics.')) {
      return;
    }
    const toastId = toast.loading('Deleting stats entry...');
    try {
      await deletePerformanceLog(logId);

      // Recalculate locally and sync
      const remainingLogs = logs.filter(l => l.id !== logId);
      const { performScoreSync } = await import('../lib/sync');
      await performScoreSync(players, remainingLogs);

      toast.success('Stats log deleted successfully!', { id: toastId });
    } catch (error: any) {
      toast.error('Failed to delete stats: ' + error.message, { id: toastId });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Daily Stats <span className="text-purple-500">Entry</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Admin console for bulk logging player daily metrics</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <BalanceIndicator />
            {isAdmin && (
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-500 rounded-xl font-mono text-[10px] text-purple-400 hover:text-white uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'SYNCING...' : 'SYNC SCORES'}</span>
              </button>
            )}
            <div className="bg-[#11111a] border border-white/5 px-4 py-2.5 rounded-xl font-mono text-[10px] text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Session Date: {new Date().toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">LOADING ACTIVE ROSTER...</p>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-[#0c0c14] rounded-3xl border border-white/5 p-12 text-center max-w-2xl">
            <User className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No Active Players</h3>
            <p className="text-gray-400 text-sm">Activate players in the players list page before logging their stats.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center space-x-2">
                  <BarChart2 className="w-4 h-4 text-purple-400" />
                  <span>ACTIVE TEAM MEMBER MATRIX ({players.length})</span>
                </h3>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded">
                  Append-Only Logging Mode
                </span>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto relative z-10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-500 uppercase font-mono tracking-widest text-[9px]">
                      <th className="py-3 px-4">Player Name</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center w-24">Matches</th>
                      <th className="py-3 px-4 text-center w-24">Booyahs</th>
                      <th className="py-3 px-4 text-center w-24">Kills</th>
                      <th className="py-3 px-4 text-center w-24">Damage</th>
                      <th className="py-3 px-4 text-center w-24">Assists</th>
                      <th className="py-3 px-4 text-center w-24">Healing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {players.map((player) => {
                      const stats = inputs[player.id] || { matches: 0, booyahs: 0, kills: 0, damage: 0, assists: 0, healing: 0 };
                      return (
                        <tr key={player.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 font-sans font-bold text-white uppercase text-sm">
                            {player.name}
                          </td>
                          <td className="py-4 px-4 text-purple-300 font-sans">
                            {player.role}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.matches || ''}
                              onChange={(e) => handleInputChange(player.id, 'matches', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.booyahs || ''}
                              onChange={(e) => handleInputChange(player.id, 'booyahs', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.kills || ''}
                              onChange={(e) => handleInputChange(player.id, 'kills', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.damage || ''}
                              onChange={(e) => handleInputChange(player.id, 'damage', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.assists || ''}
                              onChange={(e) => handleInputChange(player.id, 'assists', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              value={stats.healing || ''}
                              onChange={(e) => handleInputChange(player.id, 'healing', e.target.value)}
                              placeholder="0"
                              className="w-full text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Save Bar */}
              <div className="mt-8 border-t border-white/5 pt-6 flex justify-end relative z-10">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center gap-2 cursor-pointer border border-purple-400/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'RECORDING ENTRIES...' : 'SAVE ALL ENTRIES'}</span>
                </button>
              </div>
            </div>

            {/* Performance Log History Section */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden mt-6">
              <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span>PERFORMANCE LOG HISTORY & CORRECTIONS</span>
                  </h3>
                  <p className="text-gray-500 text-[11px] mt-1 font-sans">
                    View previous entries, correct typos, or delete incorrect stats
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-500" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search player name..."
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans"
                  />
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-mono text-xs border border-dashed border-white/5 rounded-2xl relative z-10">
                  No stats history found.
                </div>
              ) : (
                <div className="overflow-x-auto relative z-10 max-h-[500px] overflow-y-auto pr-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500 uppercase font-mono tracking-widest text-[9px]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Player</th>
                        <th className="py-3 px-4 text-center">Matches</th>
                        <th className="py-3 px-4 text-center">Booyahs</th>
                        <th className="py-3 px-4 text-center">Kills</th>
                        <th className="py-3 px-4 text-center">Damage</th>
                        <th className="py-3 px-4">Logged By</th>
                        <th className="py-3 px-4 text-right w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {logs
                        .filter(log => log.playerName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((log) => {
                          const isEditing = editingLogId === log.id;
                          const logDate = log.date 
                            ? new Date(log.date).toLocaleDateString('default', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) 
                            : 'N/A';

                          return (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3.5 px-4 text-gray-400 text-[10px]">{logDate}</td>
                              <td className="py-3.5 px-4 font-sans font-bold text-white uppercase">{log.playerName}</td>
                              
                              {/* Matches */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.matches}
                                    onChange={(e) => setEditForm({ ...editForm, matches: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-white font-bold">{log.matches}</span>
                                )}
                              </td>

                              {/* Booyahs */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.booyahs}
                                    onChange={(e) => setEditForm({ ...editForm, booyahs: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-amber-500 font-bold">{log.booyahs}</span>
                                )}
                              </td>

                              {/* Kills */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.kills}
                                    onChange={(e) => setEditForm({ ...editForm, kills: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-white font-bold">{log.kills}</span>
                                )}
                              </td>

                              {/* Damage */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.damage}
                                    onChange={(e) => setEditForm({ ...editForm, damage: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-20 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-white font-bold">{log.damage}</span>
                                )}
                              </td>

                              {/* Assists */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.assists}
                                    onChange={(e) => setEditForm({ ...editForm, assists: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-white font-bold">{log.assists || 0}</span>
                                )}
                              </td>

                              {/* Healing */}
                              <td className="py-3 px-4 text-center">
                                {isEditing && editForm ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.healing}
                                    onChange={(e) => setEditForm({ ...editForm, healing: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center bg-[#050507] border border-white/10 focus:border-purple-500 rounded py-1 px-1.5 text-white text-xs font-mono"
                                  />
                                ) : (
                                  <span className="text-white font-bold">{log.healing || 0}</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-purple-300 text-[10px] uppercase">{log.addedBy}</td>
                              
                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                {isEditing ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleSaveEdit(log.id || '')}
                                      className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                                      title="Save Correction"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleStartEdit(log)}
                                      className="p-1 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors cursor-pointer"
                                      title="Edit Stats"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLog(log.id || '')}
                                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                      title="Delete Log Entry"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
