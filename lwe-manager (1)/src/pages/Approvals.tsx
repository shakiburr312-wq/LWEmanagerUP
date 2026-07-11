import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchPendingUsers, approveUser, rejectUser } from '../lib/pendingUsers';
import { AppUser } from '../types';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { UserCheck, ShieldAlert, Check, X, Users, Trash, Play } from 'lucide-react';
import toast from 'react-hot-toast';

export const Approvals: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<{ [uid: string]: string }>({});
  const [confirmingApprove, setConfirmingApprove] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = watchPendingUsers((data) => {
      setPendingUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleChange = (uid: string, role: string) => {
    setRoles((prev) => ({ ...prev, [uid]: role }));
  };

  const handleApprove = async (user: AppUser) => {
    const selectedRole = roles[user.uid] || user.inGameRole || 'Fragger';
    const toastId = toast.loading(`Approving player ${user.name}...`);
    try {
      await approveUser(user.uid, user.name, user.email, selectedRole);
      toast.success(`Approved ${user.name}! Initialized active roster entry.`, { id: toastId });
      setConfirmingApprove(null);
    } catch (err: any) {
      toast.error('Approval failed: ' + err.message, { id: toastId });
    }
  };

  const handleReject = async (user: AppUser) => {
    const toastId = toast.loading(`Rejecting request...`);
    try {
      await rejectUser(user.uid);
      toast.success(`Registration request for ${user.name} was rejected.`, { id: toastId });
      setConfirmingReject(null);
    } catch (err: any) {
      toast.error('Rejection failed: ' + err.message, { id: toastId });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Area */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Pending <span className="text-purple-500">Approvals</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Player Signups Verification Queue</p>
          </div>
          <BalanceIndicator />
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">SYNCHRONIZING QUEUE...</p>
            </div>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-12 text-center max-w-2xl">
            <Check className="w-12 h-12 text-emerald-400/50 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">Queue is Empty</h3>
            <p className="text-gray-400 text-sm">All player registrations are fully approved or processed.</p>
          </div>
        ) : (
          <div className="max-w-4xl space-y-4">
            {pendingUsers.map((pUser) => (
              <div 
                key={pUser.uid} 
                className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div>
                  <h3 className="text-lg font-display font-bold text-white tracking-wide uppercase">{pUser.name}</h3>
                  <p className="text-xs font-mono text-purple-400 mt-1">{pUser.email}</p>
                  <p className="text-[10px] font-mono text-gray-500 uppercase mt-2">
                    Registered: {new Date(pUser.createdAt).toLocaleDateString()} at {new Date(pUser.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* In-game Role Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block font-bold">In-Game Role</label>
                    <select
                      value={roles[pUser.uid] || pUser.inGameRole || 'Fragger'}
                      onChange={(e) => handleRoleChange(pUser.uid, e.target.value)}
                      className="bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                    >
                      <option value="First Rusher">First Rusher</option>
                      <option value="Second Rusher">Second Rusher</option>
                      <option value="Fragger">Fragger</option>
                      <option value="IGL">IGL (In-Game Leader)</option>
                      <option value="Sniper">Sniper</option>
                      <option value="Support">Support</option>
                      <option value="Assaulter">Assaulter</option>
                    </select>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center space-x-2 mt-4 md:mt-0">
                    {confirmingApprove === pUser.uid ? (
                      <div className="flex items-center space-x-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-1.5">
                        <span className="text-[10px] font-mono text-purple-300 px-1 font-bold">Sure?</span>
                        <button
                          onClick={() => handleApprove(pUser)}
                          className="py-1 px-2.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingApprove(null)}
                          className="py-1 px-2.5 bg-[#050507] hover:bg-white/5 text-gray-400 text-[10px] font-bold uppercase rounded border border-white/10 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : confirmingReject === pUser.uid ? (
                      <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/30 rounded-lg p-1.5">
                        <span className="text-[10px] font-mono text-red-300 px-1 font-bold">Sure?</span>
                        <button
                          onClick={() => handleReject(pUser)}
                          className="py-1 px-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingReject(null)}
                          className="py-1 px-2.5 bg-[#050507] hover:bg-white/5 text-gray-400 text-[10px] font-bold uppercase rounded border border-white/10 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setConfirmingApprove(pUser.uid);
                            setConfirmingReject(null);
                          }}
                          className="py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => {
                            setConfirmingReject(pUser.uid);
                            setConfirmingApprove(null);
                          }}
                          className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-red-500/20 transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
