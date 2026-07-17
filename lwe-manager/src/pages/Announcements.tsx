import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import emailjs from '@emailjs/browser';
import { useAuth } from '../contexts/AuthContext';
import { watchSiteSettings } from '../lib/settings';
import { watchAnnouncements, addAnnouncement, watchActiveUsers, updateAnnouncement, deleteAnnouncement } from '../lib/announcements';
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
  Loader2,
  Edit2,
  Trash2,
  X,
  Flame,
  Shield,
  Crown,
  Gamepad2,
  Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Sidebar } from '../components/Sidebar';
// @ts-ignore
import gamingBg from '../assets/images/gaming_island_bg_1784120281828.jpg';

export const Announcements: React.FC = () => {
  const { user, isAdmin } = useAuth();
  
  // States
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0 });

  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      toast.error('Please fill in both the title and content fields.');
      return;
    }

    setIsPublishing(true);
    const toastId = toast.loading('Publishing announcement...');
    try {
      await addAnnouncement({
        title: title.trim(),
        content: content.trim(),
        createdBy: user.name || 'Admin',
        createdAt: new Date().toISOString(),
        emailSent: false,
        recipientsCount: 0
      });
      
      toast.success('Announcement published successfully!', { id: toastId });
      setTitle('');
      setContent('');
    } catch (err: any) {
      toast.error('Failed to publish announcement: ' + err.message, { id: toastId });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOneTapBroadcast = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      toast.error('Please enter a title and content before broadcasting.');
      return;
    }

    const serviceId = siteSettings.emailjsServiceId || 'service_6tdx97u';
    const templateId = siteSettings.emailjsTemplateIdAnnounce || siteSettings.emailjsTemplateId || 'template_xeeyqwh';
    const publicKey = siteSettings.emailjsPublicKey || '';

    if (!publicKey) {
      toast.error('EmailJS Public Key is not configured in settings! Please set the Public Key from settings.');
      return;
    }

    if (activeUsers.length === 0) {
      toast.error('No active players found.');
      return;
    }

    // Confirm broadcast in English
    const confirmSend = window.confirm(`Are you sure you want to broadcast this announcement email to ${activeUsers.length} active players?`);
    if (!confirmSend) return;

    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: activeUsers.length });
    const toastId = toast.loading(`Starting email broadcast (0/${activeUsers.length})...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < activeUsers.length; i++) {
      const recipient = activeUsers[i];
      setBroadcastProgress({ current: i + 1, total: activeUsers.length });
      toast.loading(`Sending email: ${i + 1}/${activeUsers.length} (${recipient.name})...`, { id: toastId });

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
          match_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' (Today)',
          match_date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
          lineup: recipient.lineup || 'All Lineups',
          type_label: 'Urgent Announcement Alert',

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
      toast.success(`Successfully sent emails to ${successCount} players! ${failCount > 0 ? `Failed: ${failCount}` : ''}`, { id: toastId, duration: 5000 });
    } else {
      toast.error('Sorry, no emails could be sent.', { id: toastId });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('Title and content cannot be empty.');
      return;
    }
    setIsUpdating(true);
    const toastId = toast.loading('Updating announcement...');
    try {
      await updateAnnouncement(id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      toast.success('Announcement updated successfully!', { id: toastId });
      setEditingAnnouncementId(null);
    } catch (err: any) {
      toast.error('Failed to update announcement: ' + err.message, { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    const toastId = toast.loading('Deleting announcement...');
    try {
      await deleteAnnouncement(id);
      toast.success('Announcement deleted successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to delete announcement: ' + err.message, { id: toastId });
    }
  };

  return (
    <div className="flex bg-[#050507] h-screen overflow-hidden text-gray-200 font-sans">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
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
              Official notice board and one-tap email broadcast center.
            </p>
          </div>

          <div className="bg-[#0c0c14] border border-purple-500/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <Mail className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">RECIPIENTS READY</p>
              <p className="text-xs font-bold text-emerald-400 font-mono">{activeUsers.length} Active Players</p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Compose Announcement Area */}
          {isAdmin && (
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-purple-400 mb-5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Write New Announcement</span>
                </h2>

                <form onSubmit={handlePublish} className="space-y-5">
                  {/* Notice Title */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Scrim schedule update"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-white focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  {/* Notice Content */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                      Content
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Enter your announcement or message details here..."
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
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4" />
                          <span>One Tap Email</span>
                        </div>
                      )}
                    </button>
                  </div>

                  {isBroadcasting && (
                    <div className="mt-4 space-y-2 bg-[#050507] p-3 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>Broadcast Status</span>
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
          )}

          {/* Announcement Feed Area */}
          <div className={`${isAdmin ? "lg:col-span-7" : "lg:col-span-12"} space-y-5`}>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-500" />
              <span>Recent Announcements ({announcements.length})</span>
            </h2>

            {announcements.length === 0 ? (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <Megaphone className="w-10 h-10 text-gray-600 mx-auto" />
                <p className="text-sm text-gray-500">No announcements have been posted yet.</p>
              </div>
            ) : (
              <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/45">
                {announcements.map((ann, idx) => {
                  const isEditing = editingAnnouncementId === ann.id;
                  const isConfirmingDelete = deleteConfirmId === ann.id;
                  return (
                    <motion.div
                      key={ann.id || idx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{
                        backgroundImage: `url(${siteSettings.announcementBgUrl || gamingBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                      className="relative overflow-hidden rounded-2xl border border-amber-500/20 hover:border-amber-400/40 shadow-xl hover:shadow-[0_0_25px_rgba(245,158,11,0.15)] transition-all duration-300 group"
                    >
                      {/* Dark premium glassmorphism overlay to guarantee text legibility */}
                      <div className="bg-slate-950/85 backdrop-blur-[6px] hover:bg-slate-950/80 transition-all duration-300 p-5 md:p-6 space-y-4">
                        {isEditing ? (
                          /* Inline Edit Form */
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Crown className="w-4 h-4 text-amber-500" />
                                Edit Announcement
                              </span>
                              <button
                                onClick={() => setEditingAnnouncementId(null)}
                                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                                Title
                              </label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-slate-950/95 border border-white/10 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none transition-colors"
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                                Content
                              </label>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={4}
                                className="w-full bg-slate-950/95 border border-white/10 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none transition-colors resize-none leading-relaxed"
                                required
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingAnnouncementId(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdate(ann.id)}
                                disabled={isUpdating}
                                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        ) : isConfirmingDelete ? (
                          /* Inline Delete Confirmation */
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                              <span className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                                Confirm Delete
                              </span>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="bg-red-950/80 border border-red-500/20 p-4 rounded-xl space-y-2">
                              <p className="text-sm text-red-400 font-bold font-sans">
                                Are you sure you want to delete this announcement?
                              </p>
                              <p className="text-xs text-gray-300">
                                Title: <span className="text-white italic font-bold">&ldquo;{ann.title}&rdquo;</span>
                              </p>
                              <p className="text-xs text-red-400/80">
                                Once deleted, this action cannot be undone.
                              </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer border border-white/5"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(ann.id)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Yes, Delete</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Feed View */
                          <>
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Gaming Badge */}
                                <div className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-lg text-[10px] font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-widest font-mono shadow-sm">
                                  <Flame className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                                  <span>System Announcement</span>
                                </div>
                                
                                {ann.emailSent && (
                                  <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Emailed ({ann.recipientsCount})</span>
                                  </span>
                                )}
                              </div>
                              
                              {/* Admin Action Buttons (Edit and Delete) */}
                              {user?.role === 'admin' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingAnnouncementId(ann.id);
                                      setEditTitle(ann.title);
                                      setEditContent(ann.content);
                                    }}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 text-gray-400 hover:border-amber-500/30 border border-white/5 transition-all cursor-pointer"
                                    title="Edit Notice"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(ann.id)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 hover:border-red-500/30 border border-white/5 transition-all cursor-pointer"
                                    title="Delete Notice"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-lg md:text-xl font-black text-white group-hover:text-amber-300 transition-colors tracking-wide leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                {ann.title}
                              </h3>
                              
                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-mono">
                                <span className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-md border border-white/5">
                                  <User className="w-3.5 h-3.5 text-amber-500" />
                                  <span className="text-gray-200 font-semibold">{ann.createdBy}</span>
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-md border border-white/5">
                                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                                  <span>
                                    {new Date(ann.createdAt).toLocaleString('en-US', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short'
                                    })}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="text-sm md:text-base text-gray-100 leading-relaxed whitespace-pre-wrap font-medium bg-slate-950/85 hover:bg-black/85 transition-colors p-4 md:p-5 rounded-xl border border-white/10 shadow-inner select-text">
                              {ann.content}
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};
