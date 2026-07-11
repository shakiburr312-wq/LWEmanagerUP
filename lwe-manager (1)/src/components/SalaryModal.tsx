import React, { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import { X, DollarSign, Send, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface SalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSalary: (amount: number, reason: string, paymentMethod: 'bKash' | 'Nagad') => Promise<void>;
  player: PlayerProfile | null;
}

export const SalaryModal: React.FC<SalaryModalProps> = ({ isOpen, onClose, onAddSalary, player }) => {
  const [amount, setAmount] = useState('1000');
  const [reason, setReason] = useState('June 2026 Monthly Salary');
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad'>('bKash');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (player) {
      const baseSalary = player.salary || 0;
      const warningDeductionActive = (player.warnings || 0) >= 3;
      const finalSalary = warningDeductionActive ? baseSalary * 0.9 : baseSalary;
      setAmount(finalSalary.toString());
      
      const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      setReason(`${currentMonthYear} Monthly Salary`);
      setShowConfirm(false);
    }
  }, [player, isOpen]);

  if (!isOpen || !player) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive salary amount');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please enter a reason/payout reference');
      return;
    }

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    try {
      await onAddSalary(amountNum, reason.trim(), paymentMethod);
      toast.success(`Successfully logged $${amountNum} payout via ${paymentMethod} for ${player.name}`);
      onClose();
    } catch (err: any) {
      toast.error('Payout failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass panel-cut max-w-md w-full rounded-2xl border border-purple-500/30 p-6 bg-[#0a0a14] shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-display font-bold text-white mb-1 flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-purple-400" />
          <span>ADD SALARY PAYOUT</span>
        </h3>
        <p className="text-[11px] font-mono text-purple-400 uppercase tracking-widest mb-4">Player: {player.name}</p>

        {player.warnings >= 3 ? (
          <div className="bg-red-950/20 border border-red-500/25 rounded-xl p-3 mb-4 text-xs font-mono">
            <p className="text-red-400 font-bold mb-1 font-sans">⚠️ 10% PENALTY DEDUCTION ACTIVE</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              This player has {player.warnings} warning(s). Since warnings &ge; 3, a 10% penalty is automatically applied.
              <br />
              Base Monthly Rate: <span className="text-white">${player.salary}</span>
              <br />
              Deducted Rate (10% off): <span className="text-emerald-400 font-bold">${player.salary * 0.9}</span>
            </p>
          </div>
        ) : player.warnings > 0 ? (
          <div className="bg-purple-950/25 border border-purple-500/25 rounded-xl p-3 mb-4 text-xs font-mono">
            <p className="text-purple-300 font-bold mb-1 font-sans">⚠️ ACTIVE WARNINGS DETECTED</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              This player has {player.warnings} warning(s). 10% deduction triggers at 3 warnings.
              <br />
              Base Monthly Rate: <span className="text-white">${player.salary}</span>
            </p>
          </div>
        ) : (
          <div className="bg-[#050507] border border-white/5 rounded-xl p-3 mb-4 text-xs font-mono">
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Base Monthly Rate: <span className="text-white">${player.salary}</span>
              <br />
              Warnings: <span className="text-white">0 / 3</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!showConfirm ? (
            <>
              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#0d0720] border border-purple-500/20 focus:border-purple-500 rounded py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Salary Amount (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                    <DollarSign className="w-4 h-4" />
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount in USD"
                    className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Payout Reference / Reason</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                    <FileText className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Monthly Roster Stipend"
                    className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>CONTINUE</span>
              </button>
            </>
          ) : (
            <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 space-y-4 text-center">
              <h4 className="text-xs font-mono text-purple-400 uppercase tracking-widest font-black">Are you sure?</h4>
              <p className="text-sm text-gray-300 font-sans">
                You are about to payout <strong className="text-emerald-400 font-mono">${amount}</strong> to <strong className="text-white">{player.name}</strong> via <strong className="text-purple-400 font-mono">{paymentMethod}</strong>.
              </p>
              <p className="text-[11px] text-gray-500 italic">
                Reference: "{reason}"
              </p>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 bg-transparent hover:bg-white/5 border border-white/10 text-gray-400 text-xs font-mono uppercase rounded-lg cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono uppercase rounded-lg font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <span>{loading ? 'PAYING...' : 'YES, CONFIRM'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
