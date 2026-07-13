// Modification: Connected Player Profile Edit modal props and MvpRevealModal click animation spotlight
// Replacement of /src/pages/Players.tsx - Roster dashboard updated to calculate and showcase Season MVP dynamically
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers, updatePlayer, addSalaryPayment, issueWarning, setBanStatus, watchSalaryTransactions } from '../lib/players';
import { watchInvestmentCampaigns } from '../lib/investments';
import { watchSalaryRequests } from '../lib/salaryRequests';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { watchMVPSettings, checkAndResetSeason, watchLineups } from '../lib/settings';
import { watchLineupChats, sendLineupChatMessage } from '../lib/chats';
import { PlayerProfile, InvestmentCampaign, SalaryRequest, PerformanceLog, MVPSettings, Lineup, SalaryTransaction, ChatMessage } from '../types';
import { getSeasonRankedPlayers } from '../utils/mvp';
import { PlayerModal } from '../components/PlayerModal';
import { SalaryModal } from '../components/SalaryModal';
import { SetSalaryRateModal } from '../components/SetSalaryRateModal';
import { RequestSalaryModal } from '../components/RequestSalaryModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { MvpRevealModal } from '../components/MvpRevealModal';
import { HeroBanner } from '../components/HeroBanner';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { 
  Users, 
  Search, 
  ShieldAlert, 
  DollarSign, 
  Ban, 
  CheckCircle, 
  Award, 
  TrendingUp, 
  Crosshair, 
  Flame,
  AlertOctagon,
  Edit,
  UserCheck,
  Crown,
  History,
  MessageSquare,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Players: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [campaigns, setCampaigns] = useState<InvestmentCampaign[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Periodic ticker to refresh relative time / online presence checks in real-time
  const [timeTicker, setTimeTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(prev => prev + 1);
    }, 15000); // 15 seconds
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryPlayer, setSalaryPlayer] = useState<PlayerProfile | null>(null);

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [ratePlayer, setRatePlayer] = useState<PlayerProfile | null>(null);

  const [salaryRequests, setSalaryRequests] = useState<SalaryRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  
  // Custom Profile & MVP spotlight modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMvpModalOpen, setIsMvpModalOpen] = useState(false);
  const [lineups, setLineups] = useState<Lineup[]>([]);

  // Performance Logs and MVP states
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLog[]>([]);
  const [mvpSettings, setMvpSettings] = useState<MVPSettings>({
    kdWeight: 10,
    killsWeight: 1,
    damageWeight: 0.1,
    seasonStartDate: new Date().toISOString()
  });

  // Custom inline confirmations state
  const [confirmingWarnId, setConfirmingWarnId] = useState<string | null>(null);
  const [warningReason, setWarningReason] = useState('Unprofessional conduct / missing practice');
  const [confirmingBanId, setConfirmingBanId] = useState<string | null>(null);

  // Payout History and Lineup Chat states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [salaryTransactions, setSalaryTransactions] = useState<SalaryTransaction[]>([]);
  const [activeTeamTab, setActiveTeamTab] = useState<'roster' | 'chat'>('roster');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
      setLoading(false);
    });

    const unsubCampaigns = watchInvestmentCampaigns((data) => {
      setCampaigns(data);
    });

    const unsubRequests = watchSalaryRequests((data) => {
      setSalaryRequests(data);
    });

    const unsubLogs = watchPerformanceLogs((logs) => {
      setPerformanceLogs(logs);
    });

    const unsubSettings = watchMVPSettings((settings) => {
      setMvpSettings(settings);
      if (settings.seasonStartDate) {
        checkAndResetSeason(settings, !!isAdmin);
      }
    });

    const unsubLineups = watchLineups((data) => {
      setLineups(data);
    });

    const unsubTxs = watchSalaryTransactions((data) => {
      setSalaryTransactions(data);
    });

    let unsubChats: (() => void) | null = null;
    const userLineup = user?.lineup || '1st Lineup';
    if (user) {
      unsubChats = watchLineupChats(userLineup as any, (msgs) => {
        setChatMessages(msgs);
      });
    }

    return () => {
      unsubPlayers();
      unsubCampaigns();
      unsubRequests();
      unsubLogs();
      unsubSettings();
      unsubLineups();
      unsubTxs();
      if (unsubChats) {
        unsubChats();
      }
    };
  }, [isAdmin, user?.lineup, user]);

  // Auto scroll chatbox to bottom
  useEffect(() => {
    if (activeTeamTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTeamTab]);

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

  const handleEditPlayer = (player: PlayerProfile) => {
    setSelectedPlayer(player);
    setIsPlayerModalOpen(true);
  };

  const handleSavePlayerStats = async (data: Partial<PlayerProfile>) => {
    if (selectedPlayer) {
      await updatePlayer(selectedPlayer.id, data);
    }
  };

  const handleOpenSalary = (player: PlayerProfile) => {
    setSalaryPlayer(player);
    setIsSalaryModalOpen(true);
  };

  const handleOpenRate = (player: PlayerProfile) => {
    setRatePlayer(player);
    setIsRateModalOpen(true);
  };

  const handleSaveSalaryRate = async (rate: number) => {
    if (ratePlayer) {
      await updatePlayer(ratePlayer.id, { salary: rate });
    }
  };

  const handleCommitSalary = async (
    amount: number, 
    reason: string, 
    paymentMethod: 'bKash' | 'Nagad', 
    payoutMode: 'direct' | 'wallet_withdraw' | 'wallet_credit'
  ) => {
    if (salaryPlayer && user) {
      await addSalaryPayment(
        salaryPlayer.id, 
        salaryPlayer.name, 
        amount, 
        reason, 
        user.name, 
        paymentMethod, 
        user.uid, 
        payoutMode
      );
    }
  };

  const handleIssueWarning = async (player: PlayerProfile) => {
    if (!user) return;
    try {
      await issueWarning(player.id, user.name, warningReason);
      toast.success(`Issued official warning to ${player.name}`);
      setConfirmingWarnId(null);
      setWarningReason('Unprofessional conduct / missing practice');
    } catch (err: any) {
      toast.error('Failed to issue warning: ' + err.message);
    }
  };

  const handleToggleBan = async (player: PlayerProfile) => {
    try {
      const isCurrentlyBanned = player.status === 'banned';
      await setBanStatus(player.id, !isCurrentlyBanned);
      toast.success(`Successfully ${isCurrentlyBanned ? 'unbanned' : 'banned'} ${player.name}`);
      setConfirmingBanId(null);
    } catch (err: any) {
      toast.error('Failed to change ban status: ' + err.message);
    }
  };

  const checkIsOnline = (p: PlayerProfile) => {
    if (!p.isOnline || !p.lastActive) return false;
    try {
      const lastActive = new Date(p.lastActive);
      const now = new Date();
      const diffMs = now.getTime() - lastActive.getTime();
      // Within 1 minute (60,000 ms)
      return diffMs >= 0 && diffMs < 60000;
    } catch (e) {
      return false;
    }
  };

  const formatLastSeen = (lastActiveStr?: string) => {
    if (!lastActiveStr) return 'offline';
    try {
      const lastActive = new Date(lastActiveStr);
      const now = new Date();
      const diffMs = now.getTime() - lastActive.getTime();
      if (diffMs < 0) return 'offline';
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'offline'; // within 1 minute they are rendered as online
      if (diffMins < 60) return `offline (${diffMins}m ago)`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `offline (${diffHours}h ago)`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `offline (${diffDays}d ago)`;
    } catch (e) {
      return 'offline';
    }
  };

  // Filter, search and sort by online status (online prioritized first)
  const filteredPlayers = players
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'All' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const aOnline = checkIsOnline(a);
      const bOnline = checkIsOnline(b);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });

  // Season MVP Calculations
  const seasonRankedPlayers = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);
  const seasonMvp = seasonRankedPlayers.length > 0 ? seasonRankedPlayers[0] : null;

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !chatInput.trim()) return;
    
    const userLineup = user.lineup || '1st Lineup';
    const myProfile = players.find(p => p.id === user.uid);
    const photoUrl = myProfile?.photoUrl || '';
    const role = user.inGameRole || 'Fragger';
    
    const msg = chatInput;
    setChatInput('');
    try {
      await sendLineupChatMessage(
        userLineup as any,
        user.uid,
        user.name,
        role,
        photoUrl,
        msg
      );
    } catch (err: any) {
      toast.error('Failed to send message: ' + err.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar Layout Navigation */}
      <Sidebar />

      {/* Main Content Dashboard Area */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Team <span className="text-purple-500">Roster</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">LWE Esports Active Division Roster</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <BalanceIndicator />
            {/* Search input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400/60">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="bg-[#11111a] border border-white/5 focus:border-purple-500 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none transition-all font-mono w-48 sm:w-64"
              />
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#11111a] border border-white/5 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-purple-400 focus:outline-none transition-all font-mono"
            >
              <option value="All">All Roles</option>
              <option value="First Rusher">First Rusher</option>
              <option value="Second Rusher">Second Rusher</option>
              <option value="Fragger">Fragger</option>
              <option value="IGL">IGL</option>
              <option value="Sniper">Sniper</option>
              <option value="Support">Support</option>
              <option value="Assaulter">Assaulter</option>
            </select>

            {/* Payout History Button */}
            {user && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-xl py-2 px-3 text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer font-mono shadow-md"
              >
                <History className="w-3.5 h-3.5" />
                <span>Payout History</span>
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">SYNCHRONIZING ROSTER...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">

            {filteredPlayers.length === 0 ? (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-12 text-center">
                <Users className="w-12 h-12 text-purple-400/40 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-1">No Players Found</h3>
                <p className="text-gray-400 text-sm">No roster entries matched your search or role filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlayers.map((player) => {
                  const isBanned = player.status === 'banned';
                  return (
                    <div 
                      key={player.id} 
                      className={`bg-[#0c0c14] border rounded-3xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                        isBanned 
                          ? 'border-red-500/20 grayscale' 
                          : 'border-white/5 hover:border-purple-500/30 hover:shadow-[0_0_25px_rgba(147,51,234,0.1)]'
                      }`}
                    >
                      {/* Card glow effect */}
                      {!isBanned && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
                      )}

                      {/* Header info */}
                      <div className="p-6 border-b border-white/5 flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-full border border-purple-500/20 bg-[#050507] overflow-hidden flex items-center justify-center font-bold font-mono text-purple-400 uppercase text-sm">
                              {player.photoUrl ? (
                                <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                              ) : (
                                player.name.substring(0, 2)
                              )}
                            </div>
                            {/* Online status indicator dot directly on profile pic */}
                            {!isBanned && (
                              <span className={`absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0c0c14] z-10 ${
                                checkIsOnline(player) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-gray-500'
                              }`} title={checkIsOnline(player) ? 'Online' : 'Offline'} />
                            )}
                            {/* lineup logo badge */}
                            {(() => {
                              const pLineup = lineups.find(l => l.id === player.lineupId || l.name === player.lineup);
                              if (!pLineup?.logoUrl) return null;
                              return (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#050507] border border-purple-500/30 rounded-full overflow-hidden flex items-center justify-center p-0.5 shadow-md">
                                  <img src={pLineup.logoUrl} alt="lineup logo badge" className="w-full h-full object-contain" />
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-display font-bold text-white tracking-wide truncate max-w-[150px] uppercase">{player.name}</h3>
                              {player.inGameRole === 'IGL' && (
                                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] font-black font-mono px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 shadow-sm">
                                  👑 IGL
                                </span>
                              )}
                            </div>
                            {player.ign && (
                              <span className="text-[9px] text-purple-400 font-mono block mt-0.5 lowercase">ign: {player.ign}</span>
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block">
                                {player.inGameRole ? `${player.role} / ${player.inGameRole}` : player.role}
                              </span>
                              <span className="hidden sm:inline text-gray-700 text-[9px]">•</span>
                              <span className={`text-[9px] font-mono block uppercase ${
                                isBanned 
                                  ? 'text-red-400' 
                                  : checkIsOnline(player) 
                                    ? 'text-emerald-400 font-bold' 
                                    : 'text-gray-400'
                              }`}>
                                {isBanned ? 'banned' : checkIsOnline(player) ? 'online' : formatLastSeen(player.lastActive)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                          isBanned 
                            ? 'bg-red-500/15 text-red-400 border-red-500/25' 
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        }`}>
                          {player.status}
                        </span>
                      </div>

                      {/* Statistics Grid */}
                      <div className="p-6 border-b border-white/5">
                        <div className="bg-[#050507]/60 border border-white/5 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center">
                            <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">K/D</span>
                            <div className="flex items-center justify-center space-x-1">
                              <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-xs font-bold text-white font-mono">
                                {((player.matches && player.matches > 0) ? ((player.kills || 0) / Math.max(1, player.matches - (player.booyahs || 0))) : (player.kd || 0)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="text-center border-x border-white/5">
                            <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Kills</span>
                            <div className="flex items-center justify-center space-x-1">
                              <Flame className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-xs font-bold text-white font-mono">{player.kills}</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Damage</span>
                            <div className="flex items-center justify-center space-x-1">
                              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-xs font-bold text-white font-mono">{player.damage}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-2 text-[10px] font-mono text-gray-500">
                          <span>Matches: <strong className="text-white">{player.matches || 0}</strong></span>
                          <span>Booyahs: <strong className="text-emerald-400">{player.booyahs || 0}</strong></span>
                          <span>Lineup: <strong className="text-purple-400 uppercase">{(() => {
                            const pLineup = lineups.find(l => l.id === player.lineupId || l.name === player.lineup);
                            return pLineup?.name || player.lineup || '1st Lineup';
                          })()}</strong></span>
                        </div>
                      </div>

                      {/* Financial & Compliance Info */}
                      <div className="p-6 flex justify-between gap-4 border-b border-white/5">
                        <div>
                          <span className="text-[9px] font-mono text-gray-500 block mb-1 uppercase tracking-wider font-bold">Wallet</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">${(player.wallet || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] font-mono text-gray-500 block mb-1 uppercase tracking-wider font-bold">Monthly Salary</span>
                          <span className="text-sm font-bold text-purple-400 font-mono">
                            ${player.salary.toLocaleString()}
                            {player.warnings >= 3 && (
                              <span className="text-[9px] text-red-400 block font-sans font-bold mt-0.5">(-10% Warn Penalty)</span>
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-gray-500 block mb-1 uppercase tracking-wider font-bold">Warnings</span>
                          <span className={`text-sm font-bold font-mono ${player.warnings > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                            {player.warnings} / 3
                          </span>
                        </div>
                      </div>

                   {/* Admin controls context */}
                  {isAdmin && (
                    <div className="p-4 bg-[#050507]/30 flex flex-col gap-2 border-t border-white/5">
                      {confirmingWarnId === player.id ? (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] text-amber-400 font-mono font-bold uppercase">Warn {player.name}?</p>
                          <input
                            type="text"
                            value={warningReason}
                            onChange={(e) => setWarningReason(e.target.value)}
                            placeholder="Reason for warning..."
                            className="w-full bg-[#050507] border border-white/10 rounded-lg p-1.5 text-[10px] text-white focus:outline-none focus:border-amber-500 font-sans"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleIssueWarning(player)}
                              className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                            >
                              Issue
                            </button>
                            <button
                              onClick={() => {
                                setConfirmingWarnId(null);
                                setWarningReason('Unprofessional conduct / missing practice');
                              }}
                              className="flex-1 py-1 bg-[#050507] hover:bg-white/5 text-gray-400 text-[10px] font-bold uppercase rounded cursor-pointer border border-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : confirmingBanId === player.id ? (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] text-red-400 font-mono font-bold uppercase text-center">
                            Are you sure you want to {isBanned ? 'UNBAN' : 'BAN'} {player.name}?
                          </p>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleToggleBan(player)}
                              className="flex-1 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                            >
                              Yes, Confirm
                            </button>
                            <button
                              onClick={() => setConfirmingBanId(null)}
                              className="flex-1 py-1 bg-[#050507] hover:bg-white/5 text-gray-400 text-[10px] font-bold uppercase rounded cursor-pointer border border-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEditPlayer(player)}
                              title="Edit Player Statistics"
                              className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-purple-500/20 transition-colors cursor-pointer"
                            >
                              Edit Stats
                            </button>
                            <button 
                              onClick={() => handleOpenRate(player)}
                              title="Set Monthly Salary Rate"
                              className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-purple-500/20 transition-colors cursor-pointer"
                            >
                              Set Rate
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleOpenSalary(player)}
                              title="Process Payout"
                              className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                            >
                              Payout
                            </button>
                            <button 
                              onClick={() => {
                                setConfirmingWarnId(player.id);
                                setConfirmingBanId(null);
                              }}
                              title="Issue Warning"
                              className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-amber-500/20 transition-colors cursor-pointer"
                            >
                              Warn
                            </button>
                            <button 
                              onClick={() => {
                                setConfirmingBanId(player.id);
                                setConfirmingWarnId(null);
                              }}
                              title={isBanned ? 'Unban player' : 'Ban player'}
                              className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-bold rounded-lg border transition-colors cursor-pointer ${
                                isBanned 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                              }`}
                            >
                              {isBanned ? 'Unban' : 'Ban'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            )}
          </div>
        )}

        {/* Player, Rate and Salary Modals */}
        <PlayerModal 
          isOpen={isPlayerModalOpen}
          onClose={() => setIsPlayerModalOpen(false)}
          onSave={handleSavePlayerStats}
          player={selectedPlayer}
        />

        <SalaryModal 
          isOpen={isSalaryModalOpen}
          onClose={() => setIsSalaryModalOpen(false)}
          onAddSalary={handleCommitSalary}
          player={salaryPlayer}
        />

        <SetSalaryRateModal 
          isOpen={isRateModalOpen}
          onClose={() => setIsRateModalOpen(false)}
          onSaveRate={handleSaveSalaryRate}
          player={ratePlayer}
        />

        <RequestSalaryModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          playerProfile={
            players.find(p => p.id === user?.uid) || 
            players.find(p => p.userId === user?.uid) || 
            (user ? {
              id: user.uid,
              userId: user.uid,
              name: user.name,
              role: user.inGameRole || 'Fragger',
              status: 'active' as const,
              kd: 0,
              kills: 0,
              damage: 0,
              salary: user.role === 'admin' ? 1000 : 0,
              warnings: 0,
              joinedAt: user.createdAt || new Date().toISOString(),
              wallet: user.wallet || 0,
              matches: 0,
              booyahs: 0,
              lineup: user.lineup || '1st Lineup'
            } : null)
          }
        />

        {/* Player Profile Self-Editor Modal */}
        <EditProfileModal 
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          playerProfile={players.find(p => p.userId === user?.uid)}
        />

        {/* Dynamic Season MVP Revealer Animation Spotlight */}
        <MvpRevealModal 
          isOpen={isMvpModalOpen}
          onClose={() => setIsMvpModalOpen(false)}
          mvp={seasonMvp}
        />

        {/* Payout/Salary History Side Drawer */}
        {isHistoryOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop with blur */}
            <div 
              className="absolute inset-0 bg-[#000]/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsHistoryOpen(false)}
            />
            
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-[#0a0a12] border-l border-white/10 shadow-2xl flex flex-col h-full relative">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0e0e1a]">
                  <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-base font-display font-black text-white italic uppercase tracking-tighter">Payout History</h3>
                  </div>
                  <button 
                    onClick={() => setIsHistoryOpen(false)}
                    className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-mono text-xs border border-white/5 uppercase font-bold"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Content list */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {salaryTransactions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 font-mono text-xs py-12">
                      <History className="w-10 h-10 text-gray-600 mb-2 animate-pulse" />
                      <p>No salary payout history found.</p>
                    </div>
                  ) : (
                    salaryTransactions.map((tx) => (
                      <div key={tx.id} className="bg-[#11111a] border border-white/5 rounded-2xl p-4 space-y-2.5 hover:border-emerald-500/10 transition-all">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">{tx.playerName}</h4>
                            <span className="text-[9px] text-gray-500 font-mono block mt-0.5">{new Date(tx.date).toLocaleString()}</span>
                          </div>
                          <span className="text-xs font-black text-emerald-400 font-mono">+${tx.amount}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed font-sans">{tx.reason}</p>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-mono text-purple-400 uppercase">
                          <span>Method: <strong className="text-white">{tx.paymentMethod || 'bKash'}</strong></span>
                          <span>By: <strong className="text-white">{tx.addedBy}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
