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
import { MVPSettings, SiteSettings, Lineup } from '../types';
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
  Users 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
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
  const [siteSaving, setSiteSaving] = useState(false);

  // Lineups state
  const [lineups, setLineups] = useState<Lineup[]>([]);

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
        logoUrl: logoUrl.trim()
      });
      toast.success('Site branding configuration updated!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message, { id: toastId });
    } finally {
      setSiteSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading('Uploading Site Logo directly to Cloudinary...');
      try {
        const url = await uploadImage(file);
        setLogoUrl(url);
        toast.success('Site Logo uploaded successfully!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload failed: ' + err.message, { id: toastId });
      }
    }
  };

  const handleHeroBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading('Uploading Hero Banner image to Cloudinary...');
      try {
        const url = await uploadImage(file);
        setHeroImageUrl(url);
        toast.success('Hero Banner image uploaded!', { id: toastId });
      } catch (err: any) {
        toast.error('Upload failed: ' + err.message, { id: toastId });
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
      const url = await uploadImage(file);
      await saveLineupLogo(lineupId, lineupName, url);
      toast.success(`${lineupName} logo updated successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error('Logo upload failed: ' + err.message, { id: toastId });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
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

              {/* Hero Title */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                  Hero Title Text
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
                  Hero Subtitle Description
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
              <div className="space-y-3 bg-[#050507]/40 border border-white/5 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block">Hero Banner Image</span>
                    <p className="text-[10px] text-gray-500">Provide URL OR upload direct file</p>
                  </div>
                  
                  {/* Direct File Browse Button */}
                  <label className="py-2 px-3.5 bg-[#050507] hover:bg-purple-950/20 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer text-center font-mono flex items-center gap-1.5 self-start sm:self-center">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroBannerUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* URL Input Box */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-500 font-mono text-xs">
                      URL:
                    </span>
                    <input
                      type="text"
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                      placeholder="Paste banner image URL here (Optional fallback)"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-12 pr-4 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Image preview */}
                {heroImageUrl && (
                  <div className="w-full h-24 rounded-xl border border-white/5 overflow-hidden bg-[#0a0a0f] relative mt-2">
                    <img src={heroImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                  </div>
                )}
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

