// Modification: Connected Player Profile Edit modal props and MvpRevealModal click animation spotlight
// Replacement of /src/pages/Players.tsx - Roster dashboard updated to calculate and showcase Season MVP dynamically
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers, updatePlayer, addSalaryPayment, issueWarning, setBanStatus } from '../lib/players';
import { watchInvestmentCampaigns } from '../lib/investments';
import { watchSalaryRequests } from '../lib/salaryRequests';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { watchMVPSettings, checkAndResetSeason, watchLineups } from '../lib/settings';
import { PlayerProfile, InvestmentCampaign, SalaryRequest, PerformanceLog, MVPSettings, Lineup } from '../types';
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
  Crown
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Players: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [campaigns, setCampaigns] = useState<InvestmentCampaign[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [loading, setLoading] = useState(true);

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

    return () => {
      unsubPlayers();
      unsubCampaigns();
      unsubRequests();
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

  // Filter and search
  const filteredPlayers = players.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Season MVP Calculations
  const seasonRankedPlayers = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);
  const seasonMvp = seasonRankedPlayers.length > 0 ? seasonRankedPlayers[0] : null;

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

            {/* Edit Profile Button */}
            {user && (
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded-xl py-2 px-3 text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer font-mono shadow-md"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </header>

        {/* Welcome Back Section */}
        {user && (
          <div className="mb-8 bg-gradient-to-r from-purple-950/20 via-[#0e0e1a] to-purple-950/10 border border-purple-500/20 rounded-3xl p-5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Background glowing effects */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl border-2 border-purple-500/40 bg-[#050507] overflow-hidden flex items-center justify-center font-black text-purple-400 font-display text-lg uppercase shadow-lg shadow-purple-500/10">
                  {(() => {
                    const myProfile = players.find(p => p.id === user?.uid);
                    return myProfile?.photoUrl ? (
                      <img src={myProfile.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name.substring(0, 2)
                    );
                  })()}
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border border-[#050507] rounded-full animate-pulse" title="Online" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-bold block mb-0.5">Welcome Back, Champion</span>
                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">{user.name}</h3>
                <div className="flex flex-wrap gap-2 items-center mt-1">
                  <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded uppercase">
                    Role: <strong className="text-purple-300 font-semibold">{user.role}</strong>
                  </span>
                  <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded uppercase">
                    Division: <strong className="text-purple-300 font-semibold">{user.lineup || '1st Lineup'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Summary Metrics for logged in player */}
            {(() => {
              const myProfile = players.find(p => p.id === user?.uid);
              if (!myProfile) return null;
              return (
                <div className="flex items-center gap-4 sm:border-l border-white/5 sm:pl-6 relative z-10 font-mono text-[10px] text-gray-400">
                  <div className="text-center sm:text-left">
                    <span className="block text-[8px] uppercase tracking-wider text-gray-500">My Balance</span>
                    <strong className="text-emerald-400 text-sm font-bold block mt-0.5">${(myProfile.wallet || 0).toLocaleString()}</strong>
                  </div>
                  <div className="text-center sm:text-left border-l border-white/5 pl-4">
                    <span className="block text-[8px] uppercase tracking-wider text-gray-500">My K/D Ratio</span>
                    <strong className="text-white text-sm font-bold block mt-0.5">
                      {((myProfile.matches && myProfile.matches > 0) ? ((myProfile.kills || 0) / Math.max(1, myProfile.matches - (myProfile.booyahs || 0))) : (myProfile.kd || 0)).toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-center sm:text-left border-l border-white/5 pl-4">
                    <span className="block text-[8px] uppercase tracking-wider text-gray-500">My Warnings</span>
                    <strong className={`text-sm font-bold block mt-0.5 ${myProfile.warnings > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {myProfile.warnings} / 3
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Dynamic Branded Hero Banner */}
        <div className="mb-8">
          <HeroBanner />
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">SYNCHRONIZING ROSTER...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* "My Team" Dedicated Section */}
            {user && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* My Team Section */}
                <div className="lg:col-span-2 bg-gradient-to-r from-purple-950/10 via-[#0c0c14]/80 to-purple-950/10 border border-purple-500/15 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-base font-display font-black text-white italic uppercase tracking-tighter mb-1 flex items-center gap-2">
                          <Award className="w-5 h-5 text-purple-400 animate-pulse" />
                          <span>MY TEAM ({user.lineup || '1st Lineup'})</span>
                        </h3>
                        <p className="text-gray-400 text-xs font-mono">Meet the active roster fighting alongside you in the {user.lineup || '1st Lineup'}</p>
                      </div>

                      {user && (
                        <button
                          onClick={() => setIsRequestModalOpen(true)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all cursor-pointer font-mono"
                        >
                          Request Salary
                        </button>
                      )}
                    </div>

                    {/* Show current player's request status if any exists */}
                    {(() => {
                      const myRequests = salaryRequests.filter(r => r.playerId === user?.uid && r.status === 'pending');
                      if (myRequests.length === 0) return null;
                      return (
                        <div className="mb-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                            <span className="text-xs text-purple-300 font-mono">Pending Salary Request of <strong className="text-white">${myRequests[0].amount}</strong> is in queue</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">Pending Approval</span>
                        </div>
                      );
                    })()}

                    {(() => {
                      const myLineup = user.lineup || '1st Lineup';
                      const teamMembers = players.filter(p => p.lineup === myLineup && p.status !== 'banned');
                      
                      if (teamMembers.length === 0) {
                        return (
                          <p className="text-gray-500 text-xs font-mono py-2">No other active players are currently assigned to your lineup division.</p>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {teamMembers.map(member => (
                            <div key={member.id} className="bg-[#050507]/60 border border-white/5 hover:border-purple-500/20 rounded-2xl p-4 flex items-center space-x-3 transition-all">
                              <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full border border-purple-500/10 bg-purple-950/20 overflow-hidden flex items-center justify-center font-bold text-purple-400 font-mono text-sm uppercase">
                                  {member.photoUrl ? (
                                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                                  ) : (
                                    member.name.substring(0, 2)
                                  )}
                                </div>
                                {/* lineup badge */}
                                {(() => {
                                  const mLineup = lineups.find(l => l.id === member.lineupId || l.name === member.lineup);
                                  if (!mLineup?.logoUrl) return null;
                                  return (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#050507] border border-purple-500/30 rounded-full overflow-hidden flex items-center justify-center p-0.5">
                                      <img src={mLineup.logoUrl} alt="lineup logo" className="w-full h-full object-contain" />
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-white truncate uppercase tracking-wider">{member.name}</h4>
                                <span className="text-[9px] text-gray-500 block uppercase font-mono">{member.role}</span>
                                <div className="flex items-center space-x-2 mt-1 text-[9px] font-mono text-purple-400">
                                  <span>KD: <strong>{((member.matches && member.matches > 0) ? ((member.kills || 0) / Math.max(1, member.matches - (member.booyahs || 0))) : (member.kd || 0)).toFixed(2)}</strong></span>
                                  <span className="text-gray-700">|</span>
                                  <span>Kills: <strong>{member.kills}</strong></span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Sidebar Highlight Columns (Season MVP + Campaigns) */}
                <div className="flex flex-col gap-6">
                  {/* Season MVP Card */}
                  <div 
                    onClick={() => {
                      if (seasonMvp) {
                        setIsMvpModalOpen(true);
                      }
                    }}
                    className="bg-[#0c0c14] border border-amber-500/25 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.05)] cursor-pointer hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all group"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-display font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                          <Crown className="w-5 h-5 text-amber-400 animate-pulse animate-bounce" />
                          <span>SEASON MVP</span>
                        </h3>
                        <span className="text-[9px] font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded group-hover:bg-amber-500/25 transition-all">
                          REVEAL SPOTLIGHT
                        </span>
                      </div>

                      {seasonMvp ? (
                        <div>
                          <div className="flex items-center gap-4 mb-4 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                            <div className="relative flex-shrink-0">
                              <div className="w-14 h-14 rounded-2xl border-2 border-amber-500 bg-[#050507] overflow-hidden flex items-center justify-center font-bold font-mono text-amber-400 text-lg shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                                {seasonMvp.photoUrl ? (
                                  <img src={seasonMvp.photoUrl} alt={seasonMvp.name} className="w-full h-full object-cover" />
                                ) : (
                                  "#1"
                                )}
                              </div>
                              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[8px] font-black font-mono w-4 h-4 flex items-center justify-center rounded-full border border-[#050507] shadow-md">
                                👑
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-wider font-extrabold block">Season Dominator</span>
                              <h4 className="text-lg font-display font-black text-white uppercase tracking-tight truncate leading-none mt-0.5">{seasonMvp.name}</h4>
                              <span className="text-[10px] font-mono text-gray-400 uppercase mt-1 inline-block">{seasonMvp.role || 'Player'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-4 font-mono text-[9px] text-gray-500">
                            <div className="text-center">
                              <span className="block uppercase text-[8px] mb-0.5">Matches</span>
                              <strong className="text-white text-xs">{seasonMvp.matches}</strong>
                            </div>
                            <div className="text-center border-l border-white/5">
                              <span className="block uppercase text-[8px] mb-0.5">Booyahs</span>
                              <strong className="text-white text-xs">{seasonMvp.booyahs}</strong>
                            </div>
                            <div className="text-center border-l border-white/5">
                              <span className="block uppercase text-[8px] mb-0.5">Kills</span>
                              <strong className="text-white text-xs">{seasonMvp.kills}</strong>
                            </div>
                            <div className="text-center border-l border-white/5 bg-amber-500/5 rounded p-0.5">
                              <span className="block uppercase text-[8px] text-amber-500 font-bold mb-0.5">SCORE</span>
                              <strong className="text-amber-400 text-xs font-black">{seasonMvp.score}</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-gray-500 font-mono text-xs border border-dashed border-white/5 rounded-2xl">
                          No performance logged this season.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Campaigns Section */}
                  <div className="bg-[#0c0c14] border border-purple-500/15 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div>
                      <h3 className="text-base font-display font-black text-white italic uppercase tracking-tighter mb-1 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400 animate-pulse" />
                        <span>MATCH CAMPAIGNS</span>
                      </h3>
                      <p className="text-gray-400 text-xs mb-4 font-mono">Assigned campaigns for your lineup division ({user.lineup || '1st Lineup'})</p>

                      {(() => {
                        const myLineup = user.lineup || '1st Lineup';
                        const assignedCampaigns = campaigns.filter(c => c.lineup === myLineup);

                        if (assignedCampaigns.length === 0) {
                          return (
                            <div className="py-8 text-center text-gray-500 font-mono text-xs border border-dashed border-white/5 rounded-2xl">
                              No campaigns assigned to your lineup.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                            {assignedCampaigns.map(camp => (
                              <div key={camp.id} className="bg-[#050507]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-1 transition-all">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[140px]">{camp.title}</span>
                                  <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                                    camp.status === 'win'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                                      : camp.status === 'lose'
                                        ? 'bg-red-500/15 text-red-400 border-red-500/25'
                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                                  }`}>
                                    {camp.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                  <span className="uppercase text-[9px] text-purple-400">{camp.category}</span>
                                  <span>Invested: <strong className="text-white">${camp.amount}</strong></span>
                                </div>
                                {camp.status === 'win' && camp.prizeAmount !== undefined && (
                                  <div className="text-[10px] font-mono text-emerald-400 mt-0.5 flex justify-between">
                                    <span>Prize won:</span>
                                    <strong>+${camp.prizeAmount}</strong>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${isBanned ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                              <h3 className="text-lg font-display font-bold text-white tracking-wide truncate max-w-[150px] uppercase">{player.name}</h3>
                            </div>
                            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block mt-0.5">{player.role}</span>
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
      </main>
    </div>
  );
};
