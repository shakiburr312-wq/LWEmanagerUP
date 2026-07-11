// Modification: Use Cloudinary upload helper instead of Firebase Storage
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePlayer } from '../lib/players';
import { uploadImage } from '../lib/uploadImage';
import { X, Upload, User, Image, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile?: any; // Current player profile from watchPlayers
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, playerProfile }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [mvpFile, setMvpFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [mvpPreview, setMvpPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name || playerProfile?.name || '');
      setPhotoPreview(playerProfile?.photoUrl || '');
      setMvpPreview(playerProfile?.mvpPhotoUrl || '');
      setPhotoFile(null);
      setMvpFile(null);
    }
  }, [isOpen, user, playerProfile]);

  if (!isOpen) return null;

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
          finalPhotoUrl = await uploadImage(photoFile);
        } catch (uploadErr: any) {
          throw new Error(`Profile photo upload failed: ${uploadErr.message}`);
        }
      }

      // 2. Upload MVP Display Photo if changed
      if (mvpFile) {
        try {
          finalMvpPhotoUrl = await uploadImage(mvpFile);
        } catch (uploadErr: any) {
          throw new Error(`MVP spotlight photo upload failed: ${uploadErr.message}`);
        }
      }

      // 3. Update users collection
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: name.trim()
      });

      // 4. Update players collection only if they have a real roster player profile in Firestore
      if (playerProfile && playerProfile.id) {
        await updatePlayer(playerProfile.id, {
          name: name.trim(),
          photoUrl: finalPhotoUrl,
          mvpPhotoUrl: finalMvpPhotoUrl
        });
      }

      toast.success('Profile updated successfully!', { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="bg-[#0c0c14] border border-purple-500/25 rounded-3xl w-full max-w-lg overflow-hidden relative z-10 shadow-[0_0_50px_rgba(147,51,234,0.15)] animate-in fade-in zoom-in duration-200">
        <header className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white">Edit Profile Settings</h3>
              <p className="text-[10px] text-gray-500 font-mono">Sync your gamer identity and visuals</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Gamer Name Input */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-purple-400/95 font-mono">
              In-Game Display Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gamer Name"
                className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Profile Photo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-purple-400/95 font-mono block">
                Standard Profile Photo
              </label>
              <div className="flex flex-col items-center p-4 bg-[#050507]/80 border border-white/5 rounded-2xl relative group">
                <div className="w-20 h-20 rounded-full border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center mb-3 relative">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-600" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>
                <label className="w-full py-1.5 px-3 bg-purple-950/25 hover:bg-purple-950/45 border border-purple-500/25 text-purple-300 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer text-center font-mono flex items-center justify-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  Browse Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[8px] text-gray-500 text-center mt-2 leading-relaxed">
                  Shows as avatar in roster lists
                </p>
              </div>
            </div>

            {/* MVP Spotlight Photo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-purple-400/95 font-mono block">
                MVP Spotlight Photo (Portrait)
              </label>
              <div className="flex flex-col items-center p-4 bg-[#050507]/80 border border-white/5 rounded-2xl relative group">
                <div className="w-20 h-20 rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0f] flex items-center justify-center mb-3 relative">
                  {mvpPreview ? (
                    <img src={mvpPreview} alt="MVP Spotlight Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-8 h-8 text-gray-600" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>
                <label className="w-full py-1.5 px-3 bg-purple-950/25 hover:bg-purple-950/45 border border-purple-500/25 text-purple-300 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer text-center font-mono flex items-center justify-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  Browse Portrait
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMvpChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[8px] text-gray-500 text-center mt-2 leading-relaxed">
                  Used for custom #1 Season MVP card animation
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-xl transition-all font-mono cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center gap-2 border border-purple-400/20 font-mono cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
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
      </div>
    </div>
  );
};
