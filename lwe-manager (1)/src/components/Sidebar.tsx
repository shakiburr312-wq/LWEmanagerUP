// Replacement of /src/components/Sidebar.tsx - Added mobile hamburger navigation and fully responsive mobile layout
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { watchSiteSettings } from '../lib/settings';
import { watchLineupChats } from '../lib/chats';
import { watchPlayers } from '../lib/players';
import { SiteSettings, PlayerProfile } from '../types';
import { 
  Users, 
  Trophy, 
  DollarSign, 
  AlertTriangle, 
  UserCheck, 
  Settings, 
  LogOut, 
  MessageSquare,
  ShieldAlert,
  BarChart2,
  Menu,
  X,
  Home as HomeIcon,
  User as UserIcon,
  History as HistoryIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Sidebar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [playersList, setPlayersList] = useState<PlayerProfile[]>([]);

  useEffect(() => {
    const unsub = watchSiteSettings((data) => {
      setSiteSettings(data);
    });
    const unsubPlayers = watchPlayers((data) => {
      setPlayersList(data);
    });
    return () => {
      unsub();
      unsubPlayers();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const userLineup = user.lineup || '1st Lineup';
    
    const unsub = watchLineupChats(userLineup as any, (msgs) => {
      const lastReadStr = localStorage.getItem(`chat_last_read_time_${userLineup}`);
      const lastReadTime = lastReadStr ? new Date(lastReadStr).getTime() : 0;
      
      if (location.pathname === '/chatbox') {
        const nowStr = new Date().toISOString();
        localStorage.setItem(`chat_last_read_time_${userLineup}`, nowStr);
        setUnreadCount(0);
      } else {
        const unread = msgs.filter(m => {
          if (m.senderId === user.uid) return false;
          const msgTime = new Date(m.timestamp).getTime();
          return msgTime > lastReadTime;
        }).length;
        setUnreadCount(unread);
      }
    });

    return () => unsub();
  }, [user, location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (err: any) {
      toast.error('Failed to log out: ' + err.message);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      name: 'Home',
      path: '/home',
      icon: HomeIcon,
      show: true,
    },
    {
      name: 'My Profile',
      path: '/profile',
      icon: UserIcon,
      show: true,
    },
    {
      name: 'Players List',
      path: '/players',
      icon: Users,
      show: true,
    },
    {
      name: 'Chatbox',
      path: '/chatbox',
      icon: MessageSquare,
      show: true,
    },
    {
      name: 'Performance & MVP',
      path: '/stats',
      icon: Trophy,
      show: true,
    },
    {
      name: 'Payment History',
      path: '/payment-history',
      icon: HistoryIcon,
      show: true,
    },
    {
      name: 'Complaints',
      path: '/complaints',
      icon: ShieldAlert,
      show: true,
    },
    {
      name: 'Finance & Overview',
      path: '/finance',
      icon: DollarSign,
      show: isAdmin, // Admin only
    },
    {
      name: 'Daily Stats Entry',
      path: '/daily-stats',
      icon: BarChart2,
      show: isAdmin, // Admin only
    },
    {
      name: 'Pending Approvals',
      path: '/approvals',
      icon: UserCheck,
      show: isAdmin, // Admin only
    },
    {
      name: 'MVP Settings',
      path: '/settings',
      icon: Settings,
      show: isAdmin, // Admin only
    }
  ];

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] cursor-pointer transition-colors border border-purple-400/25 flex items-center justify-center"
        aria-label="Toggle Navigation Menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Navigation Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#0a0a0f] border-r border-purple-500/20 flex flex-col min-h-screen text-gray-300 flex-shrink-0 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:flex
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3">
          {siteSettings.logoUrl ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.3)] bg-[#050507]">
              <img src={siteSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
              <Trophy className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white">LWE <span className="text-purple-500">MANAGER</span></h1>
            <span className="text-[9px] font-mono text-purple-400 uppercase tracking-widest block">Command Center</span>
          </div>
        </div>

        {/* Nav Menu Links */}
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest px-4 block mb-3">Navigation Modules</span>
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)} // Close drawer on selection on mobile
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs uppercase tracking-widest font-medium transition-all ${
                  active
                    ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : 'text-gray-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.name === 'Chatbox' && unreadCount > 0 && (
                  <span className="bg-purple-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-bounce shadow-lg shadow-purple-500/30 border border-purple-400/30">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile and Secure Signout Card */}
        <div className="p-4 mt-auto">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-[#050507] overflow-hidden">
                  {(() => {
                    const loggedInPlayer = playersList.find(p => p.id === user?.uid || p.userId === user?.uid);
                    return loggedInPlayer?.photoUrl ? (
                      <img src={loggedInPlayer.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xs font-bold uppercase">{user?.name ? user.name[0] : 'U'}</span>
                    );
                  })()}
                </div>
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0a0a0f] ${isAdmin ? 'bg-amber-400' : 'bg-purple-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white uppercase truncate">{user?.name || 'Loading...'}</p>
                <p className="text-[9px] text-purple-400 font-medium uppercase">
                  {(() => {
                    const loggedInPlayer = playersList.find(p => p.id === user?.uid || p.userId === user?.uid);
                    return loggedInPlayer?.role || user?.role || 'PLAYER';
                  })()}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-colors cursor-pointer"
            >
              Secure Signout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
