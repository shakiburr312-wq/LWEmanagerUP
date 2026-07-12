import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPlayers } from '../lib/players';
import { watchInvestmentCampaigns } from '../lib/investments';
import { watchSalaryRequests } from '../lib/salaryRequests';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { watchMVPSettings, checkAndResetSeason, watchLineups } from '../lib/settings';
import { watchLineupChats, sendLineupChatMessage } from '../lib/chats';
import { PlayerProfile, InvestmentCampaign, SalaryRequest, PerformanceLog, MVPSettings, Lineup, ChatMessage } from '../types';
import { getSeasonRankedPlayers } from '../utils/mvp';
import { RequestSalaryModal } from '../components/RequestSalaryModal';
import { MvpRevealModal } from '../components/MvpRevealModal';
import { HeroBanner } from '../components/HeroBanner';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { 
  Award, 
  TrendingUp, 
  Crown, 
  MessageSquare, 
  Send,
  Home as HomeIcon,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Home: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [campaigns, setCampaigns] = useState<InvestmentCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [salaryRequests, setSalaryRequests] = useState<SalaryRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
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

  const [activeTeamTab, setActiveTeamTab] = useState<'roster' | 'chat'>('roster');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

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

  // Season MVP Calculations
  const seasonRankedPlayers = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);
  const seasonMvp = seasonRankedPlayers.length > 0 ? seasonRankedPlayers[0] : null;

  const formatLastSeen = (lastActiveStr?: string) => {
    if (!lastActiveStr) return 'offline';
    try {
      const lastActive = new Date(lastActiveStr);
      const now = new Date();
      const diffMs = now.getTime() - lastActive.getTime();
      if (diffMs < 0) return 'offline';
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'offline (just now)';
      if (diffMins < 60) return `offline (${diffMins}m ago)`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `offline (${diffHours}h ago)`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `offline (${diffDays}d ago)`;
    } catch (e) {
      return 'offline';
    }
  };

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
              LWE COMMAND <span className="text-purple-500">CENTER</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Real-time stats tracking and command dashboard</p>
          </div>
          
          <div className="flex items-center gap-3">
            <BalanceIndicator />
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
              <p className="text-purple-400 font-mono text-xs">SYNCHRONIZING CORE DATA...</p>
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-base font-display font-black text-white italic uppercase tracking-tighter mb-1 flex items-center gap-2">
                          <Award className="w-5 h-5 text-purple-400 animate-pulse" />
                          <span>MY TEAM ({user.lineup || '1st Lineup'})</span>
                        </h3>
                        <p className="text-gray-400 text-xs font-mono">Meet and chat with the active roster in the {user.lineup || '1st Lineup'}</p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Tab Switcher */}
                        <div className="flex bg-[#050507]/80 border border-white/5 rounded-xl p-1 gap-1">
                          <button
                            onClick={() => setActiveTeamTab('roster')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              activeTeamTab === 'roster'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Roster
                          </button>
                          <button
                            onClick={() => setActiveTeamTab('chat')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeTeamTab === 'chat'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chatbox</span>
                          </button>
                        </div>

                        {user && (
                          <button
                            onClick={() => setIsRequestModalOpen(true)}
                            className="px-3 py-2 bg-purple-600/30 hover:bg-purple-600 border border-purple-500/30 text-purple-200 hover:text-white text-[10px] font-bold uppercase rounded-xl transition-all cursor-pointer font-mono"
                          >
                            Request Salary
                          </button>
                        )}
                      </div>
                    </div>

                    {activeTeamTab === 'roster' ? (
                      <>
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
                                <div key={member.id} className="bg-[#050507]/60 border border-white/5 hover:border-purple-500/20 rounded-2xl p-4 flex items-center space-x-3 transition-all relative">
                                  {/* Online status indicator on division roster */}
                                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full border border-[#050507] ${
                                    member.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'
                                  }`} title={member.isOnline ? 'Online' : 'Offline'} />

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
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] text-gray-500 block uppercase font-mono">{member.role}</span>
                                      <span className={`text-[8px] font-mono uppercase ${member.isOnline ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                                        {member.isOnline ? 'online' : formatLastSeen(member.lastActive)}
                                      </span>
                                    </div>
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
                      </>
                    ) : (
                      <div className="flex flex-col h-[340px] bg-[#050507]/60 border border-white/5 rounded-2xl overflow-hidden mt-2">
                        {/* Messages List */}
                        <div 
                          ref={chatScrollRef}
                          className="flex-1 overflow-y-auto p-4 space-y-4"
                        >
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 font-mono text-xs py-8">
                              <MessageSquare className="w-8 h-8 text-purple-500/30 mb-2 animate-pulse" />
                              <p>No messages yet in your division chatbox.</p>
                              <p className="text-[10px] text-gray-600 mt-1">Be the first to say hello!</p>
                            </div>
                          ) : (
                            chatMessages.map((msg) => {
                              const isMe = msg.senderId === user.uid;
                              return (
                                <div 
                                  key={msg.id} 
                                  className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full border border-purple-500/20 bg-purple-950/20 overflow-hidden flex items-center justify-center font-bold text-purple-400 font-mono text-[10px] uppercase flex-shrink-0 relative">
                                    {msg.senderPhotoUrl ? (
                                      <img src={msg.senderPhotoUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                                    ) : (
                                      msg.senderName.substring(0, 2)
                                    )}
                                  </div>

                                  <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {/* Name and Role header */}
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className="text-[10px] font-bold text-white uppercase">{msg.senderName}</span>
                                      {msg.senderRole && (
                                        <span className="text-[8px] bg-purple-500/15 border border-purple-500/30 text-purple-400 px-1 py-0.25 rounded font-mono uppercase">
                                          {msg.senderRole}
                                        </span>
                                      )}
                                      <span className="text-[8px] text-gray-500 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>

                                    {/* Message bubble */}
                                    <div className={`p-3 rounded-2xl text-xs font-sans break-words leading-relaxed ${
                                      isMe 
                                        ? 'bg-purple-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(147,51,234,0.15)]' 
                                        : 'bg-[#0f0f1c] border border-white/5 text-gray-200 rounded-tl-none'
                                    }`}>
                                      {msg.message}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Input Form */}
                        <form 
                          onSubmit={handleSendChatMessage}
                          className="p-3 border-t border-white/5 bg-[#0a0a12]/80 flex gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={`Type a message to ${user.lineup || '1st Lineup'}...`}
                            className="flex-1 bg-[#050507] border border-white/10 focus:border-purple-500 focus:outline-none rounded-xl py-2 px-4 text-xs text-white placeholder-gray-500 transition-all font-sans"
                          />
                          <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/30 disabled:text-gray-500 text-white p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer flex-shrink-0"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    )}
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
                          <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
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
          </div>
        )}

        {/* Salary request modal */}
        <RequestSalaryModal 
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
        />

        {/* Dynamic Season MVP details reveal spotlight */}
        <MvpRevealModal 
          isOpen={isMvpModalOpen}
          onClose={() => setIsMvpModalOpen(false)}
          mvp={seasonMvp}
        />
      </main>
    </div>
  );
};
