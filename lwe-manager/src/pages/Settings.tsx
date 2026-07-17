// Modification: Replaced Firebase Storage with Cloudinary uploadImage helper for site branding and lineup logos
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  watchMVPSettings, 
  saveMVPSettings, 
  watchSiteSettings, 
  saveSiteSettings, 
  watchLineups, 
  saveLineupLogo 
} from '../lib/settings';
import { uploadImage } from '../lib/uploadImage';
import { MVPSettings, SiteSettings, Lineup, HeroBannerItem } from '../types';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { 
  Settings, 
  Save, 
  ShieldAlert, 
  Sliders, 
  Info, 
  Percent, 
  Globe, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Users,
  Plus,
  Trash2,
  Link as LinkIcon,
  Key
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, firebaseUser, isAdmin } = useAuth();
  const [kdWeight, setKdWeight] = useState(10);
  const [killsWeight, setKillsWeight] = useState(1);
  const [damageWeight, setDamageWeight] = useState(0.1);
  const [saving, setSaving] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<MVPSettings | null>(null);

  // Site settings state
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [announcementBgUrl, setAnnouncementBgUrl] = useState('');
  const [heroBanners, setHeroBanners] = useState<HeroBannerItem[]>([]);
  const [siteSaving, setSiteSaving] = useState(false);

  // EmailJS configuration
  const [emailjsServiceId, setEmailjsServiceId] = useState('service_6tdx97u');
  const [emailjsTemplateIdMatch, setEmailjsTemplateIdMatch] = useState('template_xeeyqwh');
  const [emailjsTemplateIdAnnounce, setEmailjsTemplateIdAnnounce] = useState('');
  const [emailjsTemplateIdForgot, setEmailjsTemplateIdForgot] = useState('');
  const [emailjsPublicKey, setEmailjsPublicKey] = useState('');

  // Form fields for adding/editing a banner
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerImageUrl, setNewBannerImageUrl] = useState('');
  const [newBannerLinkUrl, setNewBannerLinkUrl] = useState('');
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);

  // Lineups state
  const [lineups, setLineups] = useState<Lineup[]>([]);

  // Service Account Status
  const [saExists, setSaExists] = useState(false);
  const [saProjectId, setSaProjectId] = useState('');
  const [saInput, setSaInput] = useState('');
  const [saSaving, setSaSaving] = useState(false);

  const fetchSaStatus = async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/service-account/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSaExists(data.exists);
        setSaProjectId(data.projectId);
      }
    } catch (e) {
      console.error('Failed to load Service Account status:', e);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchSaStatus();
    }
  }, [firebaseUser]);

  const handleSaveSa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only LWE Administrators can modify service credentials');
      return;
    }
    if (!saInput.trim()) {
      toast.error('Please paste your Firebase Service Account JSON');
      return;
    }

    setSaSaving(true);
    const toastId = toast.loading('Saving service credentials & re-initializing SDK...');
    try {
      if (!firebaseUser) throw new Error('Not logged in');
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/service-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ serviceAccountJson: saInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save service account');
      }

      toast.success(data.message || 'Credentials updated successfully!', { id: toastId });
      setSaInput('');
      fetchSaStatus();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setSaSaving(false);
    }
  };

  useEffect(() => {
    const unsubscribe = watchMVPSettings((data) => {
      setKdWeight(data.kdWeight);
      setKillsWeight(data.killsWeight);
      setDamageWeight(data.damageWeight);
      setCurrentSettings(data);
    });

    const unsubSite = watchSiteSettings((data) => {
      setHeroTitle(data.heroTitle || '');
      setHeroSubtitle(data.heroSubtitle || '');
      setHeroImageUrl(data.heroImageUrl || '');
      setLogoUrl(data.logoUrl || '');
      setAnnouncementBgUrl(data.announcementBgUrl || '');
      setHeroBanners(data.heroBanners || []);
      setEmailjsServiceId(data.emailjsServiceId || 'service_6tdx97u');
      setEmailjsTemplateIdMatch(data.emailjsTemplateIdMatch || data.emailjsTemplateId || 'template_xeeyqwh');
      setEmailjsTemplateIdAnnounce(data.emailjsTemplateIdAnnounce || '');
      setEmailjsTemplateIdForgot(data.emailjsTemplateIdForgot || '');
      setEmailjsPublicKey(data.emailjsPublicKey || '');
    });

    const unsubLineups = watchLineups((data) => {
      setLineups(data);
    });

    return () => {
      unsubscribe();
      unsubSite();
      unsubLineups();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only LWE Administrators can modify formula weights');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Updating LWE mathematical parameters...');
    try {
      await saveMVPSettings({
        kdWeight: Number(kdWeight),
        killsWeight: Number(killsWeight),
        damageWeight: Number(damageWeight),
        seasonStartDate: currentSettings?.seasonStartDate || '2026-07-01T00:00:00.000Z'
      });
      toast.success('MVP scoring weights successfully updated!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to update weights: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleSiteSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only LWE Administrators can update site branding');
      return;
    }

    setSiteSaving(true);
    const toastId = toast.loading('Saving Site Branding configuration...');
    try {
      await saveSiteSettings({
        heroTitle: heroTitle.trim(),
        heroSubtitle: heroSubtitle.trim(),
        heroImageUrl: heroImageUrl.trim(),
        logoUrl: logoUrl.trim(),
        announcementBgUrl: announcementBgUrl.trim(),
        heroBanners,
        emailjsServiceId: emailjsServiceId.trim(),
        emailjsTemplateId: emailjsTemplateIdMatch.trim(), // fallback
        emailjsTemplateIdMatch: emailjsTemplateIdMatch.trim(),
        emailjsTemplateIdAnnounce: emailjsTemplateIdAnnounce.trim(),
        emailjsTemplateIdForgot: emailjsTemplateIdForgot.trim(),
        emailjsPublicKey: emailjsPublicKey.trim()
      });
      toast.success('Site branding and EmailJS configuration updated!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message, { id: toastId });
    } finally {
      setSiteSaving(false);
    }
  };

  const handleNewBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingBannerImage(true);
      const toastId = toast.loading('Uploading banner image directly to Cloudinary...');
      try {
        const url = await uploadImage(file, 'site/hero');
        setNewBannerImageUrl(url);
        toast.success('Banner image uploaded successfully!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload failed: ' + err.message, { id: toastId });
      } finally {
        setUploadingBannerImage(false);
      }
    }
  };

  const handleAddBanner = async () => {
    if (!newBannerTitle.trim()) {
      toast.error('Please enter a banner title');
      return;
    }
    if (!newBannerImageUrl.trim()) {
      toast.error('Please upload or enter a banner image URL');
      return;
    }

    const newItem: HeroBannerItem = {
      id: crypto.randomUUID(),
      title: newBannerTitle.trim(),
      imageUrl: newBannerImageUrl.trim(),
      linkUrl: newBannerLinkUrl.trim() || undefined
    };

    const updated = [...heroBanners, newItem];
    setHeroBanners(updated);

    const toastId = toast.loading('Uploading and auto-saving hero banner...');
    try {
      await saveSiteSettings({
        heroTitle: heroTitle.trim(),
        heroSubtitle: heroSubtitle.trim(),
        heroImageUrl: heroImageUrl.trim(),
        logoUrl: logoUrl.trim(),
        heroBanners: updated
      });
      toast.success('Hero banner added and saved successfully!', { id: toastId });
      setNewBannerTitle('');
      setNewBannerImageUrl('');
      setNewBannerLinkUrl('');
    } catch (err: any) {
      toast.error('Failed to auto-save: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteBanner = async (id: string) => {
    const updated = heroBanners.filter((b) => b.id !== id);
    setHeroBanners(updated);

    const toastId = toast.loading('Removing and auto-saving banner...');
    try {
      await saveSiteSettings({
        heroTitle: heroTitle.trim(),
        heroSubtitle: heroSubtitle.trim(),
        heroImageUrl: heroImageUrl.trim(),
        logoUrl: logoUrl.trim(),
        heroBanners: updated
      });
      toast.success('Banner removed and saved successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to auto-save: ' + err.message, { id: toastId });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading('Uploading and auto-saving Site Logo...');
      try {
        const url = await uploadImage(file, 'site');
        setLogoUrl(url);
        await saveSiteSettings({
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: heroImageUrl.trim(),
          logoUrl: url,
          announcementBgUrl,
          heroBanners
        });
        toast.success('Site Logo uploaded and saved successfully!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload or save failed: ' + err.message, { id: toastId });
      }
    }
  };

  const handleAnnouncementBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading('Uploading and auto-saving Announcement Background...');
      try {
        const url = await uploadImage(file, 'site');
        setAnnouncementBgUrl(url);
        await saveSiteSettings({
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: heroImageUrl.trim(),
          logoUrl,
          announcementBgUrl: url,
          heroBanners
        });
        toast.success('Announcement Background uploaded and saved successfully!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload or save failed: ' + err.message, { id: toastId });
      }
    }
  };

  const handleHeroBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading('Uploading and auto-saving Hero Banner...');
      try {
        const url = await uploadImage(file, 'site/hero');
        setHeroImageUrl(url);
        await saveSiteSettings({
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: url,
          logoUrl: logoUrl.trim(),
          heroBanners
        });
        toast.success('Hero Banner image uploaded and saved successfully!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload or save failed: ' + err.message, { id: toastId });
      }
    }
  };

  const handleLineupUploadClick = async (lineupId: string, lineupName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleLineupLogoUpload(lineupId, lineupName, file);
    }
  };

  const handleLineupLogoUpload = async (lineupId: string, lineupName: string, file: File) => {
    const toastId = toast.loading(`Uploading team logo for ${lineupName}...`);
    try {
      const url = await uploadImage(file, 'lineups');
      await saveLineupLogo(lineupId, lineupName, url);
      toast.success(`${lineupName} logo updated successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error('Logo upload failed: ' + err.message, { id: toastId });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              LWE COMMAND <span className="text-purple-500">SETTINGS</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Configure criteria, site branding, and lineup configurations</p>
          </div>
          <BalanceIndicator />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl">
          
          {/* LEFT AREA: Scoring Weights & Site Branding */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 1. Scoring Weights Form */}
            <form onSubmit={handleSave} className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 mb-4 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Formula Criteria weights</span>
              </h3>

              {/* KD Ratio slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-gray-300">
                  <span className="uppercase tracking-wider font-bold">K/D Ratio Weight</span>
                  <span className="text-purple-400 font-bold bg-[#050507] border border-white/10 px-2.5 py-0.5 rounded-lg">
                    x{kdWeight}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={kdWeight}
                  onChange={(e) => setKdWeight(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1.5 bg-[#050507] rounded-lg appearance-none cursor-pointer border border-white/5"
                />
                <p className="text-[10px] font-sans text-gray-500 leading-relaxed">
                  Highly critical in modern PUBG/Esports. Defines the direct survival efficiency of individual matches.
                </p>
              </div>

              {/* Kills Weight slider */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center text-xs font-mono text-gray-300">
                  <span className="uppercase tracking-wider font-bold">Total Kills Weight</span>
                  <span className="text-purple-400 font-bold bg-[#050507] border border-white/10 px-2.5 py-0.5 rounded-lg">
                    x{killsWeight}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={killsWeight}
                  onChange={(e) => setKillsWeight(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1.5 bg-[#050507] rounded-lg appearance-none cursor-pointer border border-white/5"
                />
                <p className="text-[10px] font-sans text-gray-500 leading-relaxed">
                  Direct contribution of player to securing squad points and eliminating opponents.
                </p>
              </div>

              {/* Damage Weight slider */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center text-xs font-mono text-gray-300">
                  <span className="uppercase tracking-wider font-bold">Damage Weight</span>
                  <span className="text-purple-400 font-bold bg-[#050507] border border-white/10 px-2.5 py-0.5 rounded-lg">
                    x{damageWeight}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={damageWeight}
                  onChange={(e) => setDamageWeight(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1.5 bg-[#050507] rounded-lg appearance-none cursor-pointer border border-white/5"
                />
                <p className="text-[10px] font-sans text-gray-500 leading-relaxed">
                  Reflects the total impact of a player's support fire and team damage. Typically configured slightly lower.
                </p>
              </div>

              {/* Submit buttons */}
              <button
                type="submit"
                disabled={saving}
                className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'UPDATING WEIGHTS...' : 'COMMIT SCORING METRICS'}</span>
              </button>
            </form>

            {/* 2. Site Branding Settings Form */}
            <form onSubmit={handleSiteSave} className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 mb-4 flex items-center space-x-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <span>Site Identity & Branding</span>
              </h3>

              {/* Site Logo Upload */}
              <div className="space-y-2 bg-[#050507]/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block">Site Logo Logo</span>
                  <p className="text-[10px] text-gray-500">Upload directly from device (direct upload only)</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center text-purple-400 flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <label className="py-2 px-3.5 bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/25 text-purple-300 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer text-center font-mono flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Announcement Background Upload */}
              <div className="space-y-2 bg-[#050507]/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block">Announcement Background</span>
                  <p className="text-[10px] text-gray-500">Only used as the background of the Notice Board</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center text-purple-400 flex-shrink-0">
                    {announcementBgUrl ? (
                      <img src={announcementBgUrl} alt="Bg Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <label className="py-2 px-3.5 bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/25 text-purple-300 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer text-center font-mono flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Bg</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAnnouncementBgUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* --- Multiple Carousel Slides Section --- */}
              <div className="border border-purple-500/20 bg-purple-950/5 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block font-mono">
                      Carousel Hero Banners
                    </span>
                    <p className="text-[10px] text-gray-500">
                      Add multiple banners to enable the swipeable/automatic slider on the dashboard
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/25 rounded text-[9px] font-mono font-bold text-purple-300">
                    {heroBanners.length} SLIDES
                  </span>
                </div>

                {/* Slides List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {heroBanners.length > 0 ? (
                    heroBanners.map((slide, index) => (
                      <div 
                        key={slide.id || index} 
                        className="flex items-center justify-between gap-3 bg-[#050507] border border-white/5 hover:border-white/10 rounded-xl p-2.5 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                            <img 
                              src={slide.imageUrl} 
                              alt={slide.title} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          {/* Details */}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate uppercase font-display">
                              {slide.title}
                            </h4>
                            {slide.linkUrl && (
                              <p className="text-[10px] text-purple-400 truncate flex items-center gap-1 font-mono">
                                <LinkIcon className="w-2.5 h-2.5" />
                                {slide.linkUrl}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(slide.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 rounded-lg border border-red-500/15 transition-all focus:outline-none flex-shrink-0"
                          title="Remove Banner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center border border-dashed border-white/5 rounded-xl bg-[#050507]/25">
                      <ImageIcon className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-500">No carousel slides added yet</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">Falls back to the default fallback banner below</p>
                    </div>
                  )}
                </div>

                {/* Add New Slide Subform */}
                <div className="bg-[#050507]/60 border border-white/5 rounded-xl p-3.5 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 font-mono block border-b border-white/5 pb-1.5">
                    Add Slide Banner
                  </span>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-gray-500 font-mono">
                      Banner Title Text
                    </label>
                    <input
                      type="text"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      placeholder="e.g., WELCOME TO LUMINOUS WINGS"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-xs text-white focus:outline-none transition-colors font-sans"
                    />
                  </div>

                  {/* Image Upload and Link */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[9px] uppercase font-bold text-gray-500 font-mono">
                        Banner Image URL / Upload
                      </label>
                      <label className="py-1 px-2.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 text-purple-300 text-[9px] font-bold uppercase rounded cursor-pointer transition-colors font-mono flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>{uploadingBannerImage ? 'UPLOADING...' : 'UPLOAD FILE'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleNewBannerImageUpload}
                          disabled={uploadingBannerImage}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      value={newBannerImageUrl}
                      onChange={(e) => setNewBannerImageUrl(e.target.value)}
                      placeholder="Paste Image URL here or use Upload button"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  {/* Optional Action link (YT, FB, etc.) */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
                      <span>Action Redirect Link (Optional)</span>
                      <span className="text-purple-400 text-[8px] font-normal lowercase">(youtube/facebook/etc.)</span>
                    </label>
                    <input
                      type="text"
                      value={newBannerLinkUrl}
                      onChange={(e) => setNewBannerLinkUrl(e.target.value)}
                      placeholder="e.g., https://www.youtube.com/watch?v=..."
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-lg py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  {/* Add slide button */}
                  <button
                    type="button"
                    onClick={handleAddBanner}
                    disabled={uploadingBannerImage}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 focus:outline-none"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ADD SLIDE TO LIST</span>
                  </button>
                </div>
              </div>

              {/* --- Fallback Single Banner Settings --- */}
              <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-4.5 space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block font-mono">
                    Fallback Single Banner Settings
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Used only when no carousel slides are configured above
                  </p>
                </div>

                {/* Hero Title */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                    Default Hero Title
                  </label>
                  <input
                    type="text"
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    placeholder="LWE ESPORTS COMMAND CENTER"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none transition-colors font-sans"
                  />
                </div>

                {/* Hero Subtitle */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                    Default Hero Subtitle
                  </label>
                  <textarea
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="Real-time statistics, automated monthly rosters, and financial operations tracking"
                    rows={2}
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none transition-colors font-sans resize-none"
                  />
                </div>

                {/* Hero Banner Upload / URL Config */}
                <div className="space-y-3 bg-[#050507]/40 border border-white/5 rounded-xl p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block font-mono">Fallback Banner Image</span>
                    </div>
                    
                    <label className="py-1 px-2.5 bg-[#050507] hover:bg-purple-950/20 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase rounded cursor-pointer transition-colors font-mono flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHeroBannerUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="Paste fallback image URL here"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />

                  {heroImageUrl && (
                    <div className="w-full h-20 rounded-lg border border-white/5 overflow-hidden bg-[#0a0a0f] relative mt-1">
                      <img src={heroImageUrl} alt="Fallback Banner Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* --- EmailJS Notification Integration --- */}
              <div className="border border-purple-500/20 bg-purple-950/5 rounded-2xl p-4.5 space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block font-mono flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    EmailJS Notification Credentials
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Configure EmailJS credentials to automatically dispatch match reminders containing match names and match times.
                  </p>
                </div>

                {/* EmailJS Service ID */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    EmailJS Service ID
                  </label>
                  <input
                    type="text"
                    value={emailjsServiceId}
                    onChange={(e) => setEmailjsServiceId(e.target.value)}
                    placeholder="e.g., service_6tdx97u"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />
                </div>

                {/* EmailJS Match Campaign Template ID */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    Match Reminder Template ID
                  </label>
                  <input
                    type="text"
                    value={emailjsTemplateIdMatch}
                    onChange={(e) => setEmailjsTemplateIdMatch(e.target.value)}
                    placeholder="e.g., template_xeeyqwh"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />
                  <p className="text-[8.5px] text-gray-500 leading-normal font-sans">
                    Used to notify players about upcoming tournaments and lineups.
                  </p>
                </div>

                {/* EmailJS Announcement Template ID */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    Announcement Board Template ID
                  </label>
                  <input
                    type="text"
                    value={emailjsTemplateIdAnnounce}
                    onChange={(e) => setEmailjsTemplateIdAnnounce(e.target.value)}
                    placeholder="e.g., template_announcements"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />
                  <p className="text-[8.5px] text-gray-500 leading-normal font-sans">
                    Used to broadcast offical notices and custom broadcast updates.
                  </p>
                </div>

                {/* EmailJS Forgot Password Template ID */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block">
                    Forgot Password OTP Template ID
                  </label>
                  <input
                    type="text"
                    value={emailjsTemplateIdForgot}
                    onChange={(e) => setEmailjsTemplateIdForgot(e.target.value)}
                    placeholder="e.g., template_forgot_otp"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />
                  <p className="text-[8.5px] text-gray-500 leading-normal font-sans">
                    Used to dispatch 6-digit OTP codes securely for forgotten passwords.
                  </p>
                </div>

                {/* EmailJS Public Key */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono block flex items-center justify-between">
                    <span>EmailJS Public Key (User ID)</span>
                    <span className="text-[8px] text-amber-500 font-bold uppercase">Required</span>
                  </label>
                  <input
                    type="text"
                    value={emailjsPublicKey}
                    onChange={(e) => setEmailjsPublicKey(e.target.value)}
                    placeholder="Enter your EmailJS Public Key (from Account Settings)"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors font-mono"
                  />
                  <p className="text-[8.5px] text-gray-500 leading-normal font-sans">
                    Required to authenticate and send emails. Retrieve this from your EmailJS dashboard under Account Settings / Public Key.
                  </p>
                </div>
              </div>

              {/* Submit branding */}
              <button
                type="submit"
                disabled={siteSaving}
                className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
              >
                <Save className="w-4 h-4" />
                <span>{siteSaving ? 'UPDATING BRANDING...' : 'COMMIT BRANDING SETTINGS'}</span>
              </button>
            </form>

            {/* Firebase Admin Credentials (for secure password reset synchronization) */}
            <div className="bg-[#0c0c14] border border-purple-500/10 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 flex items-center space-x-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span>🛡️ Firebase Admin Service Account</span>
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                Upload your Firebase Service Account JSON credentials to authorize secure, automated background administrative tasks like OTP Password Resets and player user account updates.
              </p>

              {/* Live Connection Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                saExists 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}>
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${saExists ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-gray-500 block font-bold leading-none">STATUS</span>
                    <span className="text-xs font-mono font-bold block mt-1 truncate">
                      {saExists ? `ACTIVE (${saProjectId})` : 'NOT INITIALIZED (FALLBACK MODE)'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded text-gray-400">
                  {saExists ? 'Production' : 'Manual Queue'}
                </span>
              </div>

              <form onSubmit={handleSaveSa} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Paste Service Account JSON:</label>
                  <textarea
                    placeholder='{"type": "service_account", "project_id": "lwemanager-75ee0", ...}'
                    value={saInput}
                    onChange={(e) => setSaInput(e.target.value)}
                    className="w-full bg-[#050507] text-[10px] font-mono text-gray-400 border border-white/10 rounded-xl p-3 h-32 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                  <p className="text-[9px] font-mono text-gray-500">
                    ⚠️ Keep this JSON safe. It is stored securely on the isolated server container and ignored by git.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saSaving}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saSaving ? 'SAVING CREDENTIALS...' : 'SAVE & RE-INITIALIZE SDK'}</span>
                </button>
              </form>
            </div>

          </div>

          {/* RIGHT AREA: Formula Visualizer & Lineups */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Visualizer card */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 mb-4 flex items-center space-x-2">
                <Info className="w-4 h-4 text-purple-400" />
                <span>Formula Visualizer</span>
              </h3>

              <div className="bg-[#050507] border border-white/10 p-4 rounded-2xl font-mono text-xs mb-4">
                <div className="text-gray-400 mb-2 font-semibold">Active Calculation:</div>
                <div className="text-purple-400 leading-relaxed font-bold break-words">
                  Score = (K/D × {kdWeight}) + (Kills × {killsWeight}) + (Damage × {damageWeight})
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                The LWE Manager uses this active weight formula to rank players' stats and automatically calculate the **Roster MVP** on the Performance & MVP dashboard tab. 
              </p>
              <p className="text-xs text-gray-400 leading-relaxed mt-2.5">
                Adjusting the sliders will instantly recalculate and live-update the MVP designation for players across all views in real-time.
              </p>
            </div>

            {/* 3. Lineup Logos settings card */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Lineup Team Logos</span>
              </h3>
              
              <p className="text-xs text-gray-400 leading-relaxed">
                Upload team logos for the squad lineups. These will appear as distinctive badges on player profile cards.
              </p>

              <div className="space-y-4">
                {lineups.map((lineup) => (
                  <div key={lineup.id} className="bg-[#050507] border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-white/10 bg-[#0c0c14] overflow-hidden flex items-center justify-center flex-shrink-0 text-purple-400">
                        {lineup.logoUrl ? (
                          <img src={lineup.logoUrl} alt={lineup.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase text-white font-mono block">
                          {lineup.name}
                        </span>
                        <span className="text-[8px] font-mono text-purple-400 uppercase tracking-widest block mt-0.5">
                          ID: {lineup.id}
                        </span>
                      </div>
                    </div>

                    <label className="py-1.5 px-3 bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/25 text-purple-300 text-[9px] font-mono font-bold uppercase rounded-lg transition-colors cursor-pointer text-center flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLineupUploadClick(lineup.id, lineup.name, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

