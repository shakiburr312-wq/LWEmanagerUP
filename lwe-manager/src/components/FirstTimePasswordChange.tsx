import React, { useState } from 'react';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword 
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Eye, EyeOff, Lock, ShieldAlert, Key, Save, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export const FirstTimePasswordChange: React.FC = () => {
  const { logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    if (newPassword === currentPassword) {
      toast.error('New password cannot be the same as your old password!');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Re-authenticating and updating password...');

    try {
      // 1. Re-authenticate user to verify current password
      const credential = EmailAuthProvider.credential(auth.currentUser.email || user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // 2. Update password in auth
      await updatePassword(auth.currentUser, newPassword);

      // 3. Update passwordChanged flag in users collection
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        passwordChanged: true
      });

      toast.success('Password successfully changed! Welcome to LWE Esports Hub.', { id: toastId, duration: 5000 });
    } catch (err: any) {
      let msg = err.message || 'Failed to update password';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect current password. Please try again.';
      }
      toast.error(msg, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050507] relative overflow-hidden select-none">
      {/* Background design accents */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-4 bg-[#0c0c14] rounded-2xl border border-white/5 mb-3 shadow-[0_0_30px_rgba(168,85,247,0.15)] w-[64px] h-[64px]">
            <Key className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            LWE <span className="text-purple-500">Esports</span>
          </h1>
          <p className="text-[10px] font-mono text-purple-400 uppercase tracking-[0.25em] mt-1 font-bold">
            Security Clearance Required
          </p>
        </div>

        {/* Change Password Card */}
        <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-8 relative shadow-2xl space-y-6">
          <div className="absolute top-3 right-4 flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="text-[10px] font-mono text-purple-400 tracking-wider">FIRST-TIME PASSWORD RESET</span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">
              Update Initial Credentials
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              Welcome, <span className="text-purple-400 font-bold">{user?.name}</span>! Your LWE player profile is now approved. For security reasons, you must change your initial registration password before accessing the hub.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
                Current Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#050507]/60 text-white font-mono text-sm border border-white/10 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#050507]/60 text-white font-mono text-sm border border-white/10 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#050507]/60 text-white font-mono text-sm border border-white/10 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'UPDATING CREDENTIALS...' : 'SAVE & UPDATE PASSWORD'}</span>
            </button>
          </form>

          {/* Sign Out Option */}
          <div className="border-t border-white/5 pt-4 flex justify-between items-center text-xs">
            <span className="text-gray-500">Want to update later?</span>
            <button
              type="button"
              onClick={() => logout()}
              className="text-red-400 hover:text-red-300 font-mono flex items-center space-x-1 bg-transparent border-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
