import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { watchPlayers, updatePlayer } from '../lib/players';
import { uploadImage } from '../lib/uploadImage';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { User, Upload, Image, Loader2, Check, ShieldAlert, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [ign, setIgn] = useState('');
  const [role, setRole] = useState('Fragger');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [mvpFile, setMvpFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [mvpPreview, setMvpPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Watch players list to find the profile
  useEffect(() => {
    const unsub = watchPlayers((data) => {
      setPlayers(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const playerProfile = players.find(p => p.id === user?.uid || p.userId === user?.uid);

  useEffect(() => {
    if (user) {
      setName(playerProfile?.name || user?.name || '');
      setIgn(playerProfile?.ign || user?.ign || '');
      setRole(playerProfile?.role || 'Fragger');
      setPhotoPreview(playerProfile?.photoUrl || '');
      setMvpPreview(playerProfile?.mvpPhotoUrl || '');
    }
  }, [user, playerProfile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleMvpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMvpFile(file);
      setMvpPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Saving your profile changes...');

    try {
      let finalPhotoUrl = playerProfile?.photoUrl || '';
      let finalMvpPhotoUrl = playerProfile?.mvpPhotoUrl || '';

      // 1. Upload Profile Photo if changed
      if (photoFile) {
        try {
          finalPhotoUrl = await uploadImage(photoFile, 'players/profile');
        } catch (uploadErr: any) {
          throw new Error(`Profile photo upload failed: ${uploadErr.message}`);
        }
      }

      // 2. Upload MVP Display Photo if changed
      if (mvpFile) {
        try {
          finalMvpPhotoUrl = await uploadImage(mvpFile, 'players/mvp');
        } catch (uploadErr: any) {
          throw new Error(`MVP spotlight photo upload failed: ${uploadErr.message}`);
        }
      }

      // 3. Update users collection
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: name.trim(),
        ign: ign.trim()
      });

      // 4. Update or Create player profile in Firestore & local storage
      const targetPlayerId = playerProfile?.id || user.uid;
      const playerDocRef = doc(db, 'players', targetPlayerId);
      const playerDocSnap = await getDoc(playerDocRef);

      const updatedPlayerData = {
        name: name.trim(),
        ign: ign.trim(),
        role: role,
        photoUrl: finalPhotoUrl,
        mvpPhotoUrl: finalMvpPhotoUrl
      };

      if (playerDocSnap.exists()) {
        await updatePlayer(targetPlayerId, updatedPlayerData);
      } else {
        // Create player profile
        const initialProfile = {
          userId: user.uid,
          name: name.trim(),
          ign: ign.trim(),
          role: role,
          status: 'active' as const,
          kd: 0,
          kills: 0,
          damage: 0,
          salary: user.role === 'admin' ? 1000 : 0,
          warnings: 0,
          joinedAt: user.createdAt || new Date().toISOString(),
          wallet: 0,
          matches: 0,
          booyahs: 0,
          lineup: user.lineup || '1st Lineup',
          photoUrl: finalPhotoUrl,
          mvpPhotoUrl: finalMvpPhotoUrl
        };
        await setDoc(playerDocRef, initialProfile);

        // Update local storage fallback
        try {
          const local = localStorage.getItem('lwe_players_fallback_v2');
          const list = local ? JSON.parse(local) : [];
          if (!list.some((p: any) => p.id === targetPlayerId)) {
            list.push({
              ...initialProfile,
              id: targetPlayerId
            });
            localStorage.setItem('lwe_players_fallback_v2', JSON.stringify(list));
          }
        } catch (e) {
          console.warn('Failed to update local storage roster fallback:', e);
        }
      }

      toast.success('Gamer Profile updated successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 font-sans">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              MY GAMER <span className="text-purple-500">PROFILE</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Manage and sync your gaming alias, role, and visual assets</p>
          </div>
          
          <div className="flex items-center gap-3">
            <BalanceIndicator />
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-3xl bg-[#0c0c14] border border-white/5 rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden">
            {/* Ambient Background Grid and Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Identity Details */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Identity Settings</span>
                </h3>

                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                    Full Name / Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-white focus:outline-none transition-colors"
                    required
                  />
                </div>

                {/* In-Game Name (IGN) */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                    In-Game Name (IGN)
                  </label>
                  <input
                    type="text"
                    value={ign}
                    onChange={(e) => setIgn(e.target.value)}
                    placeholder="e.g. LWE_Demon"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-white focus:outline-none transition-colors"
                    required
                  />
                </div>

                {/* In Game Role Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 font-mono">
                    In-Game Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-sm text-purple-300 focus:outline-none transition-colors font-mono"
                  >
                    <option value="First Rusher">First Rusher</option>
                    <option value="Second Rusher">Second Rusher</option>
                    <option value="Fragger">Fragger</option>
                    <option value="IGL">IGL</option>
                    <option value="Sniper">Sniper</option>
                    <option value="Support">Support</option>
                    <option value="Assaulter">Assaulter</option>
                  </select>
                </div>

                {/* Info status boxes */}
                {playerProfile && (
                  <div className="bg-[#050507]/40 border border-white/5 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase">Roster Status</span>
                      <strong className="text-emerald-400 uppercase mt-0.5 block">
                        {user?.role === 'admin' ? 'Management' : playerProfile.status}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase">Current Lineup</span>
                      <strong className="text-purple-400 uppercase mt-0.5 block">
                        {user?.role === 'admin' ? 'Neutral' : (playerProfile.lineup || '1st Lineup')}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Graphical Visuals */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Image className="w-4 h-4 text-purple-400" />
                  <span>Visual Assets</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Standard Avatar */}
                  <div className="flex flex-col items-center p-4 bg-[#050507]/80 border border-white/5 rounded-2xl relative group">
                    <span className="text-[9px] font-mono uppercase text-gray-400 mb-3 text-center">Standard Profile Pic</span>
                    <div className="w-24 h-24 rounded-full border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center mb-4 relative">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Standard Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                    <label className="w-full py-2 bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/20 text-purple-300 text-[10px] font-bold uppercase rounded-xl transition-colors cursor-pointer text-center font-mono flex items-center justify-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* MVP Portrait */}
                  <div className="flex flex-col items-center p-4 bg-[#050507]/80 border border-white/5 rounded-2xl relative group">
                    <span className="text-[9px] font-mono uppercase text-gray-400 mb-3 text-center">MVP Spotlight Pic</span>
                    <div className="w-24 h-24 rounded-2xl border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center mb-4 relative">
                      {mvpPreview ? (
                        <img src={mvpPreview} alt="MVP Spotlight" className="w-full h-full object-cover" />
                      ) : (
                        <Award className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                    <label className="w-full py-2 bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/20 text-purple-300 text-[10px] font-bold uppercase rounded-xl transition-colors cursor-pointer text-center font-mono flex items-center justify-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMvpChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button Bar */}
            <div className="pt-6 border-t border-white/5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white text-xs font-bold uppercase rounded-xl shadow-[0_0_25px_rgba(147,51,234,0.3)] hover:shadow-[0_0_35px_rgba(147,51,234,0.5)] transition-all flex items-center gap-2 border border-purple-400/20 cursor-pointer font-mono"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
