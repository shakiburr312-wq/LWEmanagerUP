import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { watchSalaryTransactions, watchPlayers } from '../lib/players';
import { watchSalaryRequests } from '../lib/salaryRequests';
import { SalaryTransaction, SalaryRequest, PlayerProfile } from '../types';
import { RequestSalaryModal } from '../components/RequestSalaryModal';
import { History, DollarSign, Calendar, Clock, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';

export const PaymentHistory: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [salaryRequests, setSalaryRequests] = useState<SalaryRequest[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTxs = watchSalaryTransactions((data) => {
      setTransactions(data);
      setLoading(false);
    });

    const unsubRequests = watchSalaryRequests((data) => {
      setSalaryRequests(data);
    });

    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
    });

    return () => {
      unsubTxs();
      unsubRequests();
      unsubPlayers();
    };
  }, []);

  const myProfile = players.find(p => p.id === user?.uid);

  // Filter transactions for logged in user (or show all for admin)
  const myTransactions = isAdmin 
    ? transactions 
    : transactions.filter(tx => tx.playerId === user?.uid);

  const myRequests = isAdmin 
    ? salaryRequests 
    : salaryRequests.filter(req => req.playerId === user?.uid);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507]">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 font-sans">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              PAYMENT <span className="text-purple-500">HISTORY</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {isAdmin ? 'Complete organization salary and payouts audit log' : 'Track your monthly earnings and submit salary requests'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {!isAdmin && (
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 border border-purple-500/30 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-mono shadow-[0_0_15px_rgba(147,51,234,0.3)]"
              >
                Request Salary
              </button>
            )}
            <BalanceIndicator />
          </div>
        </header>

        {/* Overview Stats for Player */}
        {!isAdmin && myProfile && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-gray-500 block">My Wallet Balance</span>
                <strong className="text-xl font-bold text-emerald-400 font-mono block mt-1">${(myProfile.wallet || 0).toLocaleString()}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            
            <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-gray-500 block">Monthly Salary Rate</span>
                <strong className="text-xl font-bold text-purple-400 font-mono block mt-1">${(myProfile.salary || 0).toLocaleString()}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-gray-500 block">Total Payouts Received</span>
                <strong className="text-xl font-bold text-white font-mono block mt-1">
                  ${myTransactions.reduce((acc, tx) => acc + tx.amount, 0).toLocaleString()}
                </strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-gray-400">
                <History className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Transaction Payout List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Payout logs / Wallet credits</span>
            </h3>

            {loading ? (
              <div className="h-64 flex items-center justify-center bg-[#0c0c14] border border-white/5 rounded-3xl">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : myTransactions.length === 0 ? (
              <div className="bg-[#0c0c14]/50 border border-white/5 rounded-3xl p-12 text-center text-gray-500 font-mono text-xs">
                <History className="w-10 h-10 text-gray-600 mx-auto mb-3 animate-pulse" />
                <p className="text-gray-400 font-bold text-sm">NO TRANSACTION HISTORY YET</p>
                <p className="text-[10px] text-gray-600 mt-1">Salaries paid or wallet distributions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myTransactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="bg-[#0c0c14] border border-white/5 hover:border-emerald-500/20 rounded-2xl p-5 space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">{tx.playerName}</h4>
                        <span className="text-[9px] text-gray-500 font-mono block mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          {new Date(tx.date).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400 font-mono">+${tx.amount.toLocaleString()}</span>
                        <span className="text-[8px] uppercase tracking-wider font-mono text-gray-500 block mt-1">Credited / Paid</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed bg-[#050507]/60 p-3 rounded-xl border border-white/5">
                      {tx.reason}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-purple-400 uppercase">
                      <span>Method: <strong className="text-white">{tx.paymentMethod || 'bKash'}</strong></span>
                      <span>Approved By: <strong className="text-white">{tx.addedBy}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Request Queue */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Requested salaries status</span>
            </h3>

            {myRequests.length === 0 ? (
              <div className="bg-[#0c0c14]/30 border border-white/5 rounded-2xl p-6 text-center text-gray-600 font-mono text-[10px]">
                <p>No active salary requests registered.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="bg-[#0c0c14] border border-white/5 rounded-2xl p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-gray-500 font-mono block">Amount</span>
                        <strong className="text-xs font-bold text-white font-mono">${req.amount.toLocaleString()}</strong>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-gray-500 font-mono block">Status</span>
                        <span className={`text-[8px] uppercase font-mono px-2 py-0.5 rounded-full border mt-1 flex items-center gap-1 ${
                          req.status === 'approved' 
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                            : req.status === 'rejected'
                              ? 'bg-red-500/15 text-red-400 border-red-500/20'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse'
                        }`}>
                          {req.status === 'approved' && <CheckCircle className="w-2.5 h-2.5" />}
                          {req.status === 'rejected' && <AlertCircle className="w-2.5 h-2.5" />}
                          <span>{req.status}</span>
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-2 text-[9px] font-mono text-gray-500 flex justify-between">
                      <span>Method: <strong className="text-white">{req.paymentMethod}</strong></span>
                      <span>Date: <strong>{new Date(req.timestamp).toLocaleDateString()}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <RequestSalaryModal 
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          playerProfile={myProfile || null}
        />
      </main>
    </div>
  );
};
