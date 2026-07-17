import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { useAuth } from '../contexts/AuthContext';
import { 
  watchInvestmentCampaigns, 
  addInvestmentCampaign, 
  resolveInvestmentCampaign, 
  deleteInvestmentCampaign,
  updateCampaignTiming,
  updateCampaignReminder
} from '../lib/investments';
import { 
  watchCampaignNotifications, 
  addCampaignNotification, 
  clearAllNotifications,
  CampaignNotification
} from '../lib/campaignNotifications';
import { watchSiteSettings } from '../lib/settings';
import { InvestmentCampaign, SiteSettings, AppUser } from '../types';
import { watchActiveUsers } from '../lib/announcements';
import { Sidebar } from '../components/Sidebar';
import { 
  TrendingUp, 
  Clock, 
  Bell, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  Send, 
  Volume2, 
  Sparkles, 
  Shield,
  VolumeX,
  RefreshCw,
  Award,
  Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';

export const MatchCampaigns: React.FC = () => {
  const { user, isAdmin } = useAuth();
  
  // Data State
  const [campaigns, setCampaigns] = useState<InvestmentCampaign[]>([]);
  const [notifications, setNotifications] = useState<CampaignNotification[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  
  // Create Campaign Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'champion rush' | 'scrim' | 'paid'>('scrim');
  const [amount, setAmount] = useState('100');
  const [lineup, setLineup] = useState<'1st Lineup' | 'second lineup'>('1st Lineup');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTimeInput, setStartTimeInput] = useState(''); // e.g., "10:00 PM" or dateTime-local
  
  // Editing Timing State
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState('');

  // Audio & Ticker Config
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Time ticks to update countdowns in real time
  const [now, setNow] = useState(Date.now());

  // Listeners
  useEffect(() => {
    const unsubCampaigns = watchInvestmentCampaigns((data) => {
      setCampaigns(data);
    });

    const unsubNotifs = watchCampaignNotifications((notifs) => {
      setNotifications(notifs);
    });

    const unsubSettings = watchSiteSettings((settings) => {
      setSiteSettings(settings);
    });

    const unsubUsers = watchActiveUsers((users) => {
      setActiveUsers(users);
    });

    // Create tick timer
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      unsubCampaigns();
      unsubNotifs();
      unsubSettings();
      unsubUsers();
      clearInterval(interval);
    };
  }, []);

  // Countdown & Alarm trigger algorithm inside a secondary effect
  useEffect(() => {
    campaigns.forEach(async (camp) => {
      if (camp.status !== 'active' || !camp.startTime) return;

      const matchTime = new Date(camp.startTime).getTime();
      const diffMs = matchTime - now;
      const minutesRemaining = diffMs / (1000 * 60);

      // Trigger automatic 15-minute reminder (between 14 and 15 mins left)
      if (minutesRemaining > 0 && minutesRemaining <= 15 && !camp.reminderSent) {
        // Mark as sent in DB immediately to prevent double trigger
        await updateCampaignReminder(camp.id, true);

        // Broadcast web notification
        const messageText = `⚠️ [AUTO REMINDER] Match "${camp.title}" assigned for ${camp.lineup || '1st Lineup'} starts in 15 minutes! Please load Free Fire and gather in discord.`;
        await addCampaignNotification(messageText, 'reminder', camp.lineup || '1st Lineup');

        // Play alarm sound
        if (soundEnabled) {
          playAlarmSound();
        }

        toast(`🔔 15-Minute Alert: "${camp.title}" starts soon!`, {
          icon: '🔥',
          duration: 8000,
        });

        // Simulating auto-email webhook request
        dispatchEmailWebhook(camp, 'Automatic 15-Minute Schedule Reminder');
      }
    });
  }, [campaigns, now, soundEnabled]);

  // Play a beautiful synthesized notification sound
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("Audio Context sound failed to play", e);
    }
  };

  const dispatchEmailWebhook = async (camp: InvestmentCampaign, typeLabel: string) => {
    const serviceId = siteSettings.emailjsServiceId || 'service_6tdx97u';
    const templateId = siteSettings.emailjsTemplateIdMatch || siteSettings.emailjsTemplateId || 'template_xeeyqwh';
    const publicKey = siteSettings.emailjsPublicKey || '';

    if (!publicKey) {
      console.warn('[EMAIL DISPATCHER] Cannot send email because EmailJS Public Key is not configured in settings.');
      toast.error('EmailJS Public Key is not configured in settings! Emails cannot be sent without a public key.', { id: 'emailjs-warn-pk' });
      return;
    }

    const matchTimeFormatted = camp.startTime 
      ? new Date(camp.startTime).toLocaleString('en-US', { 
          timeZone: 'Asia/Dhaka',
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : 'TBA';

    // Normalize lineups for comparison
    const campaignLineup = (camp.lineup || '1st Lineup').trim().toLowerCase();
    let recipients = activeUsers.filter(u => {
      const userLineup = (u.lineup || '1st Lineup').trim().toLowerCase();
      return userLineup === campaignLineup;
    });

    // Fallback: If no players match specifically, send to all active users so nobody misses the summon
    if (recipients.length === 0) {
      recipients = activeUsers;
    }

    if (recipients.length === 0) {
      toast.error('কোনো একটিভ প্লেয়ার পাওয়া যায়নি ইমেইল পাঠানোর জন্য।');
      return;
    }

    const toastId = toast.loading(`ইমেইল পাঠানো হচ্ছে (০/${recipients.length})...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const player = recipients[i];
      const playerEmail = player.email || (player.name.toLowerCase().replace(/\s+/g, '') + '@gmail.com');
      
      const templateParams = {
        to_name: player.name,
        to_email: playerEmail,
        // Also provide 'email' alias as back-compat for templates using {{email}}
        email: playerEmail,
        
        match_name: camp.title,
        match_time: matchTimeFormatted,
        match_title: camp.title,
        match_date: camp.date || new Date().toLocaleDateString('bn-BD'),
        lineup: camp.lineup || '1st Lineup',
        category: camp.category,
        type_label: typeLabel,

        // Direct web application back-link aliases
        website_url: window.location.origin,
        click_link: window.location.origin,
        view_link: window.location.origin,
        match_link: window.location.origin,
        countdown_link: window.location.origin,
        countdown_url: window.location.origin,
        url: window.location.origin,
        link: window.location.origin,
      };

      try {
        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        successCount++;
      } catch (err: any) {
        console.error(`[EMAIL DISPATCHER] Failed sending email to ${player.name}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`"${camp.title}" এর জন্য ${successCount} জন প্লেয়ারকে ইমেইল অ্যালার্ট সফলভাবে পাঠানো হয়েছে! ${failCount > 0 ? `ব্যর্থ: ${failCount}` : ''}`, { id: toastId, duration: 5000 });
    } else {
      toast.error(`দুঃখিত, কোনো ইমেইল পাঠানো সম্ভব হয়নি। (ব্যর্থ: ${failCount})`, { id: toastId });
    }
  };

  // Helper to format remaining time
  const getCountdownString = (startTimeStr?: string) => {
    if (!startTimeStr) return 'No start time set';
    const matchTime = new Date(startTimeStr).getTime();
    const diffMs = matchTime - now;

    if (diffMs <= 0) {
      return '⚔️ MATCH IS LIVE / ENDED';
    }

    const secs = Math.floor((diffMs / 1000) % 60);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours.toString().padStart(2, '0')}h`);
    parts.push(`${mins.toString().padStart(2, '0')}m`);
    parts.push(`${secs.toString().padStart(2, '0')}s`);

    return parts.join(' ');
  };

  // Create Campaign Action
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error('Invalid investment outlay amount');
      return;
    }

    const loadingId = toast.loading('Initiating match campaign schedule...');
    try {
      let combinedStartTime = '';
      if (startTimeInput) {
        // Compose combined date and time
        combinedStartTime = new Date(`${startDate}T${startTimeInput}`).toISOString();
      }

      const campaignId = await addInvestmentCampaign(
        title.trim(),
        category,
        amountNum,
        startDate,
        user.displayName || user.email || 'Admin',
        lineup,
        user.uid,
        combinedStartTime || undefined
      );

      // Add a creation notification
      await addCampaignNotification(
        `🆕 New Campaign "${title.trim()}" ($${amountNum}) initialized for ${lineup}! Start: ${startTimeInput ? `${startDate} at ${startTimeInput}` : 'TBA'}`,
        'info',
        lineup
      );

      toast.success('Match campaign successfully added and active!', { id: loadingId });
      setTitle('');
      setStartTimeInput('');
    } catch (err: any) {
      toast.error('Failed to create campaign: ' + err.message, { id: loadingId });
    }
  };

  // Send Manual Alert Broadcaster
  const handleSendManualAlert = async (camp: InvestmentCampaign) => {
    const loadingId = toast.loading('Broadcasting manual match alert and emails...');
    try {
      const msg = `📢 [MANUAL BROADCAST] Admin is summoning all division players for match: "${camp.title}" (${camp.lineup || '1st Lineup'}) starting soon! Open Free Fire immediately.`;
      
      await addCampaignNotification(msg, 'reminder', camp.lineup || '1st Lineup');
      
      // Mark as notified/reminder sent
      await updateCampaignReminder(camp.id, true);

      // Play local system alarm
      playAlarmSound();

      toast.success(`Success! Broadcasted alarm notification & email triggers to ${camp.lineup || '1st Lineup'}!`, { id: loadingId });
      dispatchEmailWebhook(camp, 'Manual Admin Schedule Summon');
    } catch (err: any) {
      toast.error('Failed to send broadcast alert: ' + err.message, { id: loadingId });
    }
  };

  // Update Start Time Trigger (Inline Admin Action)
  const handleSaveTiming = async (campId: string) => {
    if (!customTime) {
      toast.error('Please pick a date and time');
      return;
    }

    const loadingId = toast.loading('Updating match start schedule...');
    try {
      const isoString = new Date(customTime).toISOString();
      await updateCampaignTiming(campId, isoString);
      
      const camp = campaigns.find(c => c.id === campId);
      if (camp) {
        await addCampaignNotification(
          `🕒 Match timing updated for "${camp.title}"! Scheduled start: ${new Date(isoString).toLocaleString()}`,
          'info',
          camp.lineup || '1st Lineup'
        );
      }

      toast.success('Schedule updated successfully!', { id: loadingId });
      setEditingCampaignId(null);
      setCustomTime('');
    } catch (err: any) {
      toast.error('Failed to update timing: ' + err.message, { id: loadingId });
    }
  };

  // Resolve Campaign (Win/Lose)
  const handleResolveCampaign = async (campId: string, status: 'win' | 'lose', prizeAmount?: number) => {
    const loadingId = toast.loading(`Resolving campaign status as ${status.toUpperCase()}...`);
    try {
      await resolveInvestmentCampaign(campId, status, prizeAmount, user.uid);
      
      const camp = campaigns.find(c => c.id === campId);
      const prizeString = status === 'win' && prizeAmount ? ` winning $${prizeAmount}` : '';
      
      await addCampaignNotification(
        `🏆 Campaign "${camp?.title || 'Match'}" resolved as ${status.toUpperCase()}${prizeString}!`,
        status === 'win' ? 'win' : 'lose',
        camp?.lineup || '1st Lineup'
      );

      toast.success(`Campaign resolved as ${status}!`, { id: loadingId });
    } catch (err: any) {
      toast.error('Failed to resolve campaign: ' + err.message, { id: loadingId });
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campId: string) => {
    if (!window.confirm('Delete this campaign record? History calculations in site stats are preserved.')) return;
    
    const loadingId = toast.loading('Deleting campaign...');
    try {
      await deleteInvestmentCampaign(campId);
      toast.success('Campaign removed.', { id: loadingId });
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message, { id: loadingId });
    }
  };

  // Total Lineup earnings calculations (preserving deleted histories via site archives)
  const firstLineupEarnings = campaigns
    .filter(c => c.lineup === '1st Lineup' && c.status === 'win')
    .reduce((sum, c) => sum + (c.prizeAmount || 0), 0) + (siteSettings.archived1stLineupWinnings || 0);

  const secondLineupEarnings = campaigns
    .filter(c => c.lineup === 'second lineup' && c.status === 'win')
    .reduce((sum, c) => sum + (c.prizeAmount || 0), 0) + (siteSettings.archivedSecondLineupWinnings || 0);

  // Filter campaigns depending on user role and division roster restriction
  const myLineup = user.lineup || '1st Lineup';
  
  const displayedCampaigns = campaigns.filter(c => {
    if (isAdmin) return true; // Admins see everything
    return c.lineup === myLineup; // Players see only their own division
  });

  const activeCampaigns = displayedCampaigns.filter(c => c.status === 'active');
  const resolvedCampaigns = displayedCampaigns.filter(c => c.status !== 'active');

  const filteredNotifications = notifications.filter(n => {
    if (isAdmin || n.lineup === 'all') return true;
    return n.lineup === myLineup;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507] text-gray-100">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto space-y-8 w-full">
        
        {/* HEADER AREA */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-purple-500/10 pb-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-purple-400 font-bold block mb-1">
              Esports Match Management
            </span>
            <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-white uppercase italic">
              Tournament & Scrim <span className="text-purple-500">Campaigns</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle button */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="px-4 py-2 bg-[#0c0c14] border border-white/5 rounded-xl hover:border-purple-500/30 text-xs font-mono text-gray-400 hover:text-white flex items-center gap-2 cursor-pointer transition-all"
              title={soundEnabled ? 'Mute Alarms' : 'Enable Alarms'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>ALARM ACTIVE</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-red-400" />
                  <span>ALARM MUTED</span>
                </>
              )}
            </button>

            {isAdmin && notifications.length > 0 && (
              <button
                onClick={() => clearAllNotifications(notifications)}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-mono text-red-400 hover:bg-red-500/20 cursor-pointer transition-all"
              >
                CLEAR ALERTS FEED
              </button>
            )}
          </div>
        </header>

        {/* NOTIFICATION ticker bar feed */}
        <section className="bg-[#0c0c14] border border-purple-500/15 rounded-2xl p-4 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 left-0 w-2 h-full bg-purple-500" />
          <div className="flex items-center gap-3 mb-2 px-2">
            <Bell className="w-4 h-4 text-purple-400 animate-bounce" />
            <span className="text-xs font-mono font-black uppercase tracking-wider text-purple-300">Live Campaigns Notification Bar</span>
          </div>

          <div className="max-h-[120px] overflow-y-auto pr-2 space-y-2 font-mono scrollbar-thin scrollbar-thumb-purple-900">
            {filteredNotifications.length === 0 ? (
              <p className="text-xs text-gray-500 px-2">No critical match alerts dispatched recently. Timers active.</p>
            ) : (
              filteredNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`text-xs p-2.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    notif.type === 'reminder'
                      ? 'bg-red-500/15 border-red-500/25 text-red-200'
                      : notif.type === 'win'
                        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-200'
                        : notif.type === 'lose'
                          ? 'bg-amber-500/10 border-amber-500/15 text-amber-200'
                          : 'bg-white/5 border-white/5 text-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0">
                      {notif.type === 'reminder' ? '⚠️' : notif.type === 'win' ? '🏆' : notif.type === 'lose' ? '💀' : '📢'}
                    </span>
                    <p className="leading-relaxed break-words">{notif.message}</p>
                  </div>
                  <span className="text-[9px] text-gray-500 shrink-0 whitespace-nowrap">
                    {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* TOTAL DIVISION EARNINGS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a10] border border-emerald-500/10 hover:border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden transition-all shadow-lg group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                <Award className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">1st Lineup Division Winnings</span>
                <span className="text-3xl font-display font-black text-emerald-400 font-mono tracking-tight">
                  ${firstLineupEarnings.toLocaleString()}
                </span>
                <p className="text-[10px] font-mono text-gray-500 mt-1">Preserved automatically across schedule deletions</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a10] border border-purple-500/10 hover:border-purple-500/20 rounded-3xl p-6 relative overflow-hidden transition-all shadow-lg group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/10 transition-all"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400">
                <Award className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">2nd Lineup Division Winnings</span>
                <span className="text-3xl font-display font-black text-purple-400 font-mono tracking-tight">
                  ${secondLineupEarnings.toLocaleString()}
                </span>
                <p className="text-[10px] font-mono text-gray-500 mt-1">Preserved automatically across schedule deletions</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT/MID: ACTIVE & RESOLVED CAMPAIGNS */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active match list */}
            <div className="bg-[#0a0a10] border border-white/5 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                  <h2 className="text-lg font-display font-black text-white uppercase italic tracking-tight">
                    TODAY'S SCHEDULED MATCHES ({activeCampaigns.length})
                  </h2>
                </div>
                {!isAdmin && (
                  <span className="text-[10px] font-mono bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-300">
                    DIV: {myLineup.toUpperCase()}
                  </span>
                )}
              </div>

              {activeCampaigns.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl text-gray-500 font-mono text-xs">
                  ⚔️ No active matches assigned for today. Admins can schedule tournaments above.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCampaigns.map((camp) => {
                    const isEditing = editingCampaignId === camp.id;
                    return (
                      <div 
                        key={camp.id} 
                        className="bg-[#0c0c14] border border-purple-500/10 hover:border-purple-500/30 rounded-2xl p-5 flex flex-col gap-4 transition-all relative overflow-hidden group shadow-md"
                      >
                        {/* Glow indicator */}
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded uppercase">
                                {camp.category}
                              </span>
                              <span className="text-[9px] font-mono bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded uppercase">
                                {camp.lineup || '1st Lineup'}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-white uppercase tracking-wide truncate">
                              {camp.title}
                            </h3>
                            <p className="text-gray-400 text-xs font-mono mt-0.5">
                              Outlay/Capital: <strong className="text-white">${camp.amount}</strong> | Scheduled Date: {camp.date}
                            </p>
                          </div>

                          {/* Countdown Indicator */}
                          <div className="bg-[#050507]/80 border border-purple-500/20 px-4 py-3 rounded-xl flex flex-col items-center justify-center text-center min-w-[150px]">
                            <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-purple-400 animate-spin" /> Countdown to start
                            </span>
                            <span className="text-sm font-black font-mono text-amber-400 uppercase">
                              {getCountdownString(camp.startTime)}
                            </span>
                          </div>
                        </div>

                        {/* Schedule Start Time Edit / Setter for Admin */}
                        {isEditing && isAdmin ? (
                          <div className="bg-[#050507] border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row items-end gap-3 transition-all animate-fade-in">
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Set Target Date & Time</label>
                              <input 
                                type="datetime-local" 
                                value={customTime} 
                                onChange={(e) => setCustomTime(e.target.value)}
                                className="w-full bg-[#0c0c14] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveTiming(camp.id)}
                                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all"
                              >
                                SAVE TIME
                              </button>
                              <button
                                onClick={() => setEditingCampaignId(null)}
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-xs font-mono text-gray-400 cursor-pointer"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {/* Admin Action Bar */}
                        {isAdmin && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 font-mono text-[10px]">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingCampaignId(camp.id);
                                  if (camp.startTime) {
                                    // format ISO back to datetime-local friendly format
                                    const d = new Date(camp.startTime);
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    const localIso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                    setCustomTime(localIso);
                                  } else {
                                    setCustomTime('');
                                  }
                                }}
                                className="px-3 py-1.5 bg-[#050507] hover:bg-purple-950/20 text-gray-300 hover:text-purple-400 border border-white/5 hover:border-purple-500/25 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Clock className="w-3 h-3 text-purple-400" />
                                <span>{camp.startTime ? 'EDIT SCHEDULE' : 'SET START TIME'}</span>
                              </button>

                              {camp.startTime && (
                                <button
                                  onClick={() => handleSendManualAlert(camp)}
                                  className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                                  title="Send instant alarm notice & web/email summon to lineup players"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>SUMMON TEAM</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* WIN RESOLUTION INPUT */}
                              <button
                                onClick={() => {
                                  const prizeInput = window.prompt(`Enter winning prize amount for "${camp.title}" ($):`, "300");
                                  if (prizeInput === null) return;
                                  const prize = parseFloat(prizeInput);
                                  if (isNaN(prize) || prize <= 0) {
                                    toast.error('Invalid prize amount');
                                    return;
                                  }
                                  handleResolveCampaign(camp.id, 'win', prize);
                                }}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>RESOLVE WIN</span>
                              </button>

                              {/* LOSE RESOLUTION */}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Mark "${camp.title}" campaign as LOSE?`)) {
                                    handleResolveCampaign(camp.id, 'lose');
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>LOSE</span>
                              </button>

                              <button
                                onClick={() => handleDeleteCampaign(camp.id)}
                                className="p-1.5 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-lg cursor-pointer transition-all"
                                title="Delete campaign schedule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolved Campaigns history */}
            <div className="bg-[#0a0a10] border border-white/5 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-mono font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-3">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span>RESOLVED CAMPAIGN HISTORY ({resolvedCampaigns.length})</span>
              </h2>

              {resolvedCampaigns.length === 0 ? (
                <div className="py-6 text-center text-gray-500 font-mono text-xs">
                  No resolved campaigns under current view settings.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                  {resolvedCampaigns.slice(0, 15).map((camp) => (
                    <div 
                      key={camp.id} 
                      className="bg-[#0c0c14] border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-4 font-mono text-xs transition-all hover:bg-white/[0.01]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded border ${
                            camp.status === 'win'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                              : 'bg-red-500/15 text-red-400 border-red-500/25'
                          }`}>
                            {camp.status}
                          </span>
                          <span className="text-[9px] text-gray-400 uppercase">{camp.category} | {camp.lineup || '1st Lineup'}</span>
                        </div>
                        <h4 className="text-white font-bold truncate uppercase">{camp.title}</h4>
                        <span className="text-[10px] text-gray-500">Invested: ${camp.amount} | Date: {camp.date}</span>
                      </div>

                      <div className="text-right">
                        {camp.status === 'win' && camp.prizeAmount !== undefined ? (
                          <div className="text-emerald-400 font-bold text-sm">
                            +${camp.prizeAmount}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-sm">-${camp.amount}</div>
                        )}
                        <span className="text-[9px] text-gray-600 block">Resolved</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: ADMIN CREATE CAMPAIGN WIDGET */}
          <div className="space-y-6">
            {isAdmin ? (
              <div className="bg-[#0a0a10] border border-purple-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
                
                <h2 className="text-base font-display font-black text-white italic uppercase tracking-tighter mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                  <Plus className="w-5 h-5 text-purple-400" />
                  <span>SCHEDULE NEW CAMPAIGN</span>
                </h2>

                <form onSubmit={handleCreateCampaign} className="space-y-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <label className="text-gray-400 uppercase text-[9px] tracking-wider block">Campaign Title / Tournament Match</label>
                    <input 
                      type="text"
                      placeholder="e.g. Free Fire Champion Cup Match 1"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#050507] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-gray-400 uppercase text-[9px] tracking-wider block">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full bg-[#050507] border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                      >
                        <option value="scrim">Scrim Campaign</option>
                        <option value="champion rush">Champion Rush</option>
                        <option value="paid">Paid Tournament</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-400 uppercase text-[9px] tracking-wider block">Division Lineup</label>
                      <select
                        value={lineup}
                        onChange={(e) => setLineup(e.target.value as any)}
                        className="w-full bg-[#050507] border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                      >
                        <option value="1st Lineup">1st Lineup</option>
                        <option value="second lineup">Second Lineup</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-gray-400 uppercase text-[9px] tracking-wider block">Investment Outlay ($)</label>
                      <input 
                        type="number"
                        placeholder="100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-[#050507] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-400 uppercase text-[9px] tracking-wider block">Scheduled Date</label>
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-[#050507] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 uppercase text-[9px] tracking-wider block flex items-center justify-between">
                      <span>Target Start Time</span>
                      <span className="text-[8px] text-purple-400">Optional</span>
                    </label>
                    <input 
                      type="time"
                      value={startTimeInput}
                      onChange={(e) => setStartTimeInput(e.target.value)}
                      className="w-full bg-[#050507] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all"
                    />
                    <p className="text-[9px] text-gray-500 leading-normal mt-0.5">
                      If provided, players will see a live countdown clock ticking down to this match start.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3.5 rounded-xl font-bold font-sans uppercase tracking-wide cursor-pointer transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center justify-center gap-2 mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>LAUNCH CAMPAIGN</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#0a0a10] border border-white/5 rounded-3xl p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto text-purple-400">
                  <Shield className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Lineup Access Activated</h3>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    Your account is bound to the <strong className="text-purple-400">{myLineup}</strong> division roster. Only schedules and earnings from this squad division are visible.
                  </p>
                </div>
              </div>
            )}

            {/* Guide Info Box */}
            <div className="bg-[#0a0a10] border border-purple-500/10 rounded-3xl p-6 font-mono text-[10px] text-gray-400 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>HOW DISPATCH WORKS</span>
              </h4>
              <p className="leading-relaxed">
                The automatic scheduler monitors starting times dynamically.
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>15 minutes before the start time, the app triggers a website summond audio-visual notification automatically.</li>
                <li>Admins can summon manual summons anytime using the "Summon Team" button.</li>
              </ul>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};
