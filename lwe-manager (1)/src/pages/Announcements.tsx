import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import emailjs from '@emailjs/browser';
import { useAuth } from '../contexts/AuthContext';
import { watchSiteSettings } from '../lib/settings';
import { watchAnnouncements, addAnnouncement, watchActiveUsers } from '../lib/announcements';
import { SiteSettings, Announcement, AppUser } from '../types';
import { 
  Megaphone, 
  Send, 
  Clock, 
  User, 
  Mail, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Sidebar } from '../components/Sidebar';

export const Announcements: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    // Watch site settings for EmailJS keys
    const unsubSettings = watchSiteSettings((data) => {
      setSiteSettings(data);
    });

    // Watch announcements in real-time
    const unsubAnnouncements = watchAnnouncements((data) => {
      setAnnouncements(data);
    });

    // Watch active users
    const unsubUsers = watchActiveUsers((data) => {
      setActiveUsers(data);
    });

    return () => {
      unsubSettings();
      unsubAnnouncements();
      unsubUsers();
    };
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      toast.error('অনুগ্রহ করে শিরোনাম এবং বর্ণনা দুটিই পূরণ করুন।');
      return;
    }

    setIsPublishing(true);
    const toastId = toast.loading('অ্যানাউন্সমেন্ট পোস্ট করা হচ্ছে...');
    try {
      await addAnnouncement({
        title: title.trim(),
        content: content.trim(),
        createdBy: user.name || 'Admin',
        createdAt: new Date().toISOString(),
        emailSent: false,
        recipientsCount: 0
      });
      
      toast.success('অ্যানাউন্সমেন্ট সফলভাবে পোস্ট করা হয়েছে!', { id: toastId });
      setTitle('');
      setContent('');
    } catch (err: any) {
      toast.error('পোস্ট করতে সমস্যা হয়েছে: ' + err.message, { id: toastId });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOneTapBroadcast = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      toast.error('ইমেইল ব্রডকাস্ট করার আগে অনুগ্রহ করে শিরোনাম এবং বর্ণনা লিখে নিন।');
      return;
    }

    const serviceId = siteSettings.emailjsServiceId || 'service_6tdx97u';
    const templateId = siteSettings.emailjsTemplateIdAnnounce || siteSettings.emailjsTemplateId || 'template_xeeyqwh';
    const publicKey = siteSettings.emailjsPublicKey || '';

    if (!publicKey) {
      toast.error('EmailJS Public Key সেটিংস-এ কনফিগার করা নেই! Settings থেকে Public Key সেট করুন।');
      return;
    }

    if (activeUsers.length === 0) {
      toast.error('কোনো একটিভ প্লেয়ার পাওয়া যায়নি।');
      return;
    }

    // Confirm broadcast in Bengali
    const confirmSend = window.confirm(`আপনি কি নিশ্চিত যে আপনি ${activeUsers.length} জন একটিভ প্লেয়ারকে এই অ্যানাউন্সমেন্টটি ইমেইল করতে চান?`);
    if (!confirmSend) return;

    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: activeUsers.length });
    const toastId = toast.loading(`ইমেইল ব্রডকাস্ট শুরু হচ্ছে (০/${activeUsers.length})...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < activeUsers.length; i++) {
      const recipient = activeUsers[i];
      setBroadcastProgress({ current: i + 1, total: activeUsers.length });
      toast.loading(`ইমেইল পাঠানো হচ্ছে: ${i + 1}/${activeUsers.length} (${recipient.name})...`, { id: toastId });

      try {
        // Constructing rich template parameters supporting multiple naming styles
        const templateParams = {
          to_name: recipient.name,
          to_email: recipient.email || recipient.name.toLowerCase() + '@gmail.com',
          announcement_title: title.trim(),
          announcement_content: content.trim(),
          sender_name: user.name,
          
          // Match-related parameters as fallback/compatibility aliases
          match_name: title.trim(),
          match_title: title.trim(),
          match_time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) + ' (আজ)',
          match_date: new Date().toLocaleDateString('bn-BD', { dateStyle: 'medium' }),
          lineup: recipient.lineup || 'All Lineups',
          type_label: 'Urgent Announcement Alert'
        };

        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${recipient.name}:`, err);
        failCount++;
      }
    }

    try {
      // Save announcement to database as well
      await addAnnouncement({
        title: title.trim(),
        content: content.trim(),
        createdBy: user.name || 'Admin',
        createdAt: new Date().toISOString(),
        emailSent: true,
        recipientsCount: successCount
      });
    } catch (e) {
      console.warn('Failed to save announcement log:', e);
    }

    setIsBroadcasting(false);
    setTitle('');
    setContent('');

    if (successCount > 0) {
      toast.success(`সফলভাবে ${successCount} জন প্লেয়ারকে ইমেইল পাঠানো হয়েছে! ${failCount > 0 ? `ব্যর্থ: ${failCount}` : ''}`, { id: toastId, duration: 5000 });
    } else {
      toast.error('দুঃখিত, কোনো ইমেইল পাঠানো সম্ভব হয়নি।', { id: toastId });
    }
  };

  return (
    <div className="flex bg-[#050507] min-h-screen text-gray-200 overflow-x-hidden font-sans">
      <Sidebar />

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-purple-500/10 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-6 h-6 text-purple-500 animate-pulse" />
              <h1 className="text-2xl font-black uppercase tracking-wider text-white">
                Announcement <span className="text-purple-500">Board</span>
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              অফিসিয়াল নোটিশ বোর্ড এবং ওয়ান-ট্যাপ ইমেইল ব্রডকাস্ট সেন্টার।
            </p>
          </div>

          <div className="bg-[#0c0c14] border border-purple-500/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <Mail className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">রিসিভার রেডি</p>
              <p className="text-xs font-bold text-emerald-400 font-mono">{activeUsers.length} Active Players</p>
            </div>
          </div>
        </div>

        {/* Info Banner for Template variables in Bengali */}
        <div className="bg-[#0c0c14] border border-amber-500/20 rounded-2xl p-4.5 flex gap-3 text-amber-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="text-xs space-y-1 font-sans leading-relaxed">
            <span className="font-bold block text-amber-200">EmailJS Template সেটআপ গাইড:</span>
            <p className="text-gray-400">
              আপনার EmailJS টেমপ্লেটে নিচের ভেরিয়েবলগুলো ব্যবহার করতে পারবেন। এটি অটোমেটিক প্লেয়ারের কাছে ডাইরেক্ট মেইল পাঠাবে:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 font-mono text-[11px] text-purple-300 bg-[#050507] p-2.5 rounded-xl border border-white/5">
              <div>• <span className="text-amber-400">{"{{to_name}}"}</span> : প্লেয়ারের নাম</div>
              <div>• <span className="text-amber-400">{"{{announcement_title}}"}</span> : নোটিশ শিরোনাম</div>
              <div>• <span className="text-amber-400">{"{{announcement_content}}"}</span> : নোটিশের মূল কথা</div>
              <div>• <span className="text-amber-400">{"{{sender_name}}"}</span> : লেখকের নাম</div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Compose Announcement Area */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-purple-400 mb-5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>নতুন অ্যানাউন্সমেন্ট লিখুন</span>
              </h2>

              <form onSubmit={handlePublish} className="space-y-5">
                {/* Notice Title */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    শিরোনাম (Title)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="যেমন: আজকের স্ক্রিম সময় পরিবর্তন"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-white focus:outline-none transition-colors"
                    required
                  />
                </div>

                {/* Notice Content */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    বিস্তারিত বর্ণনা (Content)
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="আপনার নোটিশ বা বিস্তারিত বার্তাটি এখানে লিখুন..."
                    rows={6}
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-white focus:outline-none transition-colors resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* Buttons Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isPublishing || isBroadcasting}
                    className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/20 hover:border-purple-500/40 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Publish Board</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOneTapBroadcast}
                    disabled={isPublishing || isBroadcasting}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-[#050507] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isBroadcasting ? (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{broadcastProgress.current}/{broadcastProgress.total}</span>
                      </div>
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    <span>One Tap Email</span>
                  </button>
                </div>

                {isBroadcasting && (
                  <div className="mt-4 space-y-2 bg-[#050507] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>ব্রডকাস্ট স্ট্যাটাস</span>
                      <span>{Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Announcement Feed Area */}
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-500" />
              <span>সাম্প্রতিক নোটিশসমূহ ({announcements.length})</span>
            </h2>

            {announcements.length === 0 ? (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <Megaphone className="w-10 h-10 text-gray-600 mx-auto" />
                <p className="text-sm text-gray-500">কোনো নোটিশ এখনও পোস্ট করা হয়নি।</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/45">
                {announcements.map((ann, idx) => (
                  <motion.div
                    key={ann.id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#0c0c14] border border-white/5 hover:border-purple-500/20 rounded-2xl p-5 shadow-lg transition-all space-y-4 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">
                          {ann.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-mono">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-purple-500" />
                            {ann.createdBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-purple-500" />
                            {new Date(ann.createdAt).toLocaleString('bn-BD', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                      </div>

                      {ann.emailSent && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
                          <CheckCircle className="w-3 h-3" />
                          <span>Emailed ({ann.recipientsCount})</span>
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans bg-[#050507]/45 p-4 rounded-xl border border-white/5">
                      {ann.content}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};
