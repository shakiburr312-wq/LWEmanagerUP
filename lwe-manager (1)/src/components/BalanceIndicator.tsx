import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, Shield, Edit2, Check, TrendingUp, DollarSign } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { watchFinanceTransactions } from '../lib/finance';
import { watchInvestmentCampaigns } from '../lib/investments';
import { FinanceTransaction, InvestmentCampaign } from '../types';
import toast from 'react-hot-toast';

export const BalanceIndicator: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [newWalletValue, setNewWalletValue] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Treasury net flow calculation
  const [netFlow, setNetFlow] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    
    let currentTxs: FinanceTransaction[] = [];
    let currentCampaigns: InvestmentCampaign[] = [];

    const recalculateTreasury = () => {
      const totalInvest = currentTxs
        .filter(t => t.type === 'invest')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalProfit = currentTxs
        .filter(t => t.type === 'tournament_profit')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalSalary = currentTxs
        .filter(t => t.type === 'salary_payment')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalCampaignOutlay = currentCampaigns.reduce((sum, c) => sum + c.amount, 0);
      const totalCampaignWinnings = currentCampaigns
        .filter(c => c.status === 'win')
        .reduce((sum, c) => sum + (c.prizeAmount || 0), 0);

      setNetFlow(totalProfit + totalInvest - totalSalary + totalCampaignWinnings - totalCampaignOutlay);
    };

    // Listen to finance transactions to compute net flow in real-time
    const unsubscribeTx = watchFinanceTransactions((transactions) => {
      currentTxs = transactions;
      recalculateTreasury();
    });

    const unsubscribeCampaigns = watchInvestmentCampaigns((campaigns) => {
      currentCampaigns = campaigns;
      recalculateTreasury();
    });

    return () => {
      unsubscribeTx();
      unsubscribeCampaigns();
    };
  }, [isAdmin]);

  if (!user) return null;

  const currentWallet = user.wallet || 0;

  const handleUpdateAdminWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newWalletValue);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error('Please enter a valid positive number');
      return;
    }

    setSaving(true);
    try {
      const playerRef = doc(db, 'players', user.uid);
      await setDoc(playerRef, {
        userId: user.uid,
        name: user.name || 'Admin',
        role: 'Admin',
        status: 'active',
        kd: 0,
        kills: 0,
        damage: 0,
        salary: 0,
        warnings: 0,
        joinedAt: new Date().toISOString(),
        wallet: amountNum
      }, { merge: true });

      toast.success(`Admin balance updated to $${amountNum}`);
      setShowEditModal(false);
    } catch (err: any) {
      toast.error('Failed to update balance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = () => {
    setNewWalletValue(currentWallet.toString());
    setShowEditModal(true);
  };

  return (
    <div className="flex items-center gap-3 font-mono">
      {/* Treasury Flow for Admin */}
      {isAdmin && (
        <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Treasury Flow
          </span>
          <span className="text-xs font-bold text-white font-mono">
            ${netFlow.toLocaleString()}
          </span>
        </div>
      )}

      {/* Wallet Balance Card */}
      <div 
        onClick={isAdmin ? openEditModal : undefined}
        className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl border transition-all ${
          isAdmin 
            ? 'bg-purple-950/20 hover:bg-purple-950/30 border-purple-500/30 hover:border-purple-500/50 cursor-pointer hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
            : 'bg-white/5 border-white/10'
        }`}
      >
        <div className={`p-1 rounded-lg ${isAdmin ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/15 text-gray-400'}`}>
          <Wallet className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold flex items-center gap-0.5">
            {isAdmin ? <Shield className="w-2 h-2 text-amber-400" /> : null}
            {isAdmin ? 'Admin Wallet' : 'My Wallet'}
          </span>
          <span className="text-xs font-black text-white mt-0.5">
            ${currentWallet.toLocaleString()}
          </span>
        </div>
        {isAdmin && (
          <Edit2 className="w-3 h-3 text-purple-400/60 hover:text-purple-400 ml-1.5 transition-colors" />
        )}
      </div>

      {/* Admin Wallet Editing Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0c0c14] border border-purple-500/30 rounded-3xl max-w-sm w-full p-6 relative shadow-2xl">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all text-xs"
            >
              ✕
            </button>

            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Modify Admin Balance</span>
            </h3>

            <form onSubmit={handleUpdateAdminWallet} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-gray-400 tracking-wider block">Wallet Balance (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={newWalletValue}
                    onChange={(e) => setNewWalletValue(e.target.value)}
                    placeholder="Enter balance"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-10 text-sm text-white focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'UPDATING...' : 'SAVE BALANCE'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
