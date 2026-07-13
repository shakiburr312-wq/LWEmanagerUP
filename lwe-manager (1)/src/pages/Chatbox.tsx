import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { watchLineupChats, sendLineupChatMessage, updateTypingStatus, watchLineupTyping } from '../lib/chats';
import { watchPlayers } from '../lib/players';
import { ChatMessage, PlayerProfile } from '../types';
import { MessageSquare, Send, Users, Flame, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

export const Chatbox: React.FC = () => {
  const { user } = useAuth();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const userLineup = user?.lineup || '1st Lineup';

  // Real-time online status calculation (same robust check)
  const checkIsOnline = (p: PlayerProfile) => {
    if (!p.isOnline || !p.lastActive) return false;
    try {
      const lastActive = new Date(p.lastActive);
      const now = new Date();
      const diffMs = now.getTime() - lastActive.getTime();
      return diffMs >= 0 && diffMs < 60000;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;

    // 1. Subscribe to Chat Messages
    const unsubChats = watchLineupChats(userLineup as any, (msgs) => {
      setChatMessages(msgs);
      setLoading(false);
      
      // Mark all messages as read since we are on the chatbox page
      localStorage.setItem(`chat_last_read_time_${userLineup}`, new Date().toISOString());
    });

    // 2. Subscribe to Players Roster
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
    });

    // 3. Subscribe to Real-time Lineup Typing status
    const unsubTyping = watchLineupTyping(userLineup, user.uid, (typingNames) => {
      setTypingUsers(typingNames);
    });

    return () => {
      unsubChats();
      unsubPlayers();
      unsubTyping();
      // Ensure we clean up typing status when unmounting
      if (isTypingRef.current) {
        updateTypingStatus(user.uid, user.name, userLineup, false);
      }
    };
  }, [user, userLineup]);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, typingUsers]);

  // Handle Input Changes & Publish Typing Status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    if (!user) return;

    // Start typing status
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      updateTypingStatus(user.uid, user.name, userLineup, true);
    }

    // Debounce to stop typing status after 3.5 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      updateTypingStatus(user.uid, user.name, userLineup, false);
    }, 3500);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatInput.trim()) return;

    const msg = chatInput;
    setChatInput('');

    // Clear typing timeout and reset status immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    updateTypingStatus(user.uid, user.name, userLineup, false);

    const myProfile = players.find(p => p.id === user.uid);
    const photoUrl = myProfile?.photoUrl || '';
    const role = user.inGameRole || 'Fragger';

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

  // Filter team members in my lineup
  const teamMembers = players
    .filter(p => p.lineup === userLineup && p.status !== 'banned')
    .sort((a, b) => {
      const aOnline = checkIsOnline(a);
      const bOnline = checkIsOnline(b);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });

  return (
    <div className="flex min-h-screen bg-[#050507]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Section */}
        <header className="p-4 md:p-6 bg-[#0a0a0f] border-b border-purple-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-500 animate-pulse" />
              <span>Lineup <span className="text-purple-500">Chatbox</span></span>
            </h2>
            <p className="text-gray-400 text-xs font-mono">Real-time gaming division frequency for: <strong className="text-purple-400 uppercase">{userLineup}</strong></p>
          </div>
          <div className="flex items-center gap-3">
            <BalanceIndicator />
          </div>
        </header>

        {/* Outer body grid layout */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Main Chat Box Panel */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07070c]/50 relative">
            {/* Message Thread List */}
            <div 
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
            >
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-purple-400 font-mono text-xs">ESTABLISHING ENCRYPTED LINK...</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 font-mono text-xs py-8">
                  <MessageSquare className="w-12 h-12 text-purple-500/20 mb-3 animate-bounce" />
                  <p className="text-gray-400 font-bold text-sm">NO MESSAGES LOGGED YET</p>
                  <p className="text-[10px] text-gray-600 mt-1 max-w-[240px]">Be the first to connect with your team lineup in this secure channel!</p>
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div 
                      key={msg.id || index} 
                      className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full border border-purple-500/20 bg-purple-950/20 overflow-hidden flex items-center justify-center font-bold text-purple-400 font-mono text-xs uppercase flex-shrink-0 relative shadow-md">
                        {msg.senderPhotoUrl ? (
                          <img src={msg.senderPhotoUrl} alt={msg.senderName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          msg.senderName.substring(0, 2)
                        )}
                      </div>

                      <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender Info Label */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-wide">{msg.senderName}</span>
                          {msg.senderRole && (
                            <span className="text-[8px] bg-purple-500/15 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
                              {msg.senderRole}
                            </span>
                          )}
                          <span className="text-[8px] text-gray-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Speech Bubble */}
                        <div className={`p-3.5 rounded-2xl text-xs font-sans break-words leading-relaxed ${
                          isMe 
                            ? 'bg-purple-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(147,51,234,0.25)] border border-purple-500/20' 
                            : 'bg-[#10101c]/90 border border-white/5 text-gray-200 rounded-tl-none shadow-md shadow-black/30'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Typing status bar overlay & input form */}
            <div className="p-4 border-t border-white/5 bg-[#0a0a0f] flex-shrink-0 space-y-2">
              {/* Typing Animation HUD */}
              {typingUsers.length > 0 && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-[10px] font-mono max-w-max animate-pulse">
                  <Activity className="w-3 h-3 text-purple-400 animate-spin mr-1" />
                  <span>
                    <strong>{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing
                  </span>
                  <span className="flex space-x-0.5 ml-1.5">
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              )}

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={handleInputChange}
                  placeholder={`Type a secure transmission to ${userLineup}...`}
                  className="flex-1 bg-[#050507] border border-white/10 focus:border-purple-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white placeholder-gray-500 transition-all font-sans"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/30 disabled:text-gray-600 text-white p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer flex-shrink-0 shadow-md shadow-purple-500/10"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Active Lineup Teammates Panel (Desktop Sidebar Only) */}
          <div className="hidden lg:flex flex-col w-64 bg-[#0a0a10] border-l border-white/5 h-full flex-shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-[#0e0e16]/40">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest">Active Teammates</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {teamMembers.map((member) => {
                const online = checkIsOnline(member);
                return (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#050507]/30 hover:border-purple-500/20 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full border border-purple-500/10 bg-purple-950/20 overflow-hidden flex items-center justify-center font-bold text-purple-400 font-mono text-[10px] uppercase">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            member.name.substring(0, 2)
                          )}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0a0a10] ${
                          online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-600'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate uppercase tracking-wide">{member.name}</p>
                        <p className="text-[9px] text-gray-500 uppercase font-mono truncate">{member.role}</p>
                      </div>
                    </div>
                    {online && (
                      <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
