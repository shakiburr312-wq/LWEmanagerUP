import React, { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import { X, DollarSign, Send, FileText } from 'lucide-react';
import { addSalaryRequest } from '../lib/salaryRequests';
import toast from 'react-hot-toast';

interface RequestSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile: PlayerProfile | null;
}

export const RequestSalaryModal: React.FC<RequestSalaryModalProps> = ({ isOpen, onClose, playerProfile }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (playerProfile) {
      const baseSalary = playerProfile.salary || 0;
      const warningDeductionActive = (playerProfile.warnings || 0) >= 3;
      const finalSalary = warningDeductionActive ? baseSalary * 0.9 : baseSalary;
      // Lock requested amount to final pre-configured salary
      setAmount(finalSalary.toString());
      setReason(`Monthly Salary Stipend for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`);
    }
  }, [playerProfile, isOpen]);

  if (!isOpen || !playerProfile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive request amount');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please enter a short explanation / reason for your request');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Submitting salary request to administrative queue...');
    try {
      await addSalaryRequest(playerProfile.id, playerProfile.name, amountNum, reason.trim());
      toast.success('Your salary request has been submitted successfully!', { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error('Failed to submit request: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0c0c14] max-w-md w-full rounded-3xl border border-purple-500/20 p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer text-lg"
        >
          ✕
        </button>

        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-300 mb-6 flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-purple-400" />
          <span>REQUEST SALARY</span>
        </h3>

        <div className="bg-[#050507] border border-white/5 rounded-xl p-3 mb-4 text-xs font-mono">
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Active Base Rate: <span className="text-white font-bold">${playerProfile.salary}</span>
            <br />
            Warnings Penalty: <span className={playerProfile.warnings >= 3 ? 'text-red-400 font-bold' : 'text-gray-400'}>{playerProfile.warnings} / 3 {playerProfile.warnings >= 3 ? '(-10% Active)' : ''}</span>
            {playerProfile.warnings >= 3 && (
              <>
                <br />
                Net Salary Rate (10% off): <span className="text-emerald-400 font-bold">${playerProfile.salary * 0.9}</span>
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Requested Amount (USD)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                $
              </span>
              <input
                type="number"
                value={amount}
                readOnly
                disabled
                placeholder="Amount in USD"
                className="w-full bg-[#050507]/60 border border-white/5 rounded-xl py-2 px-10 text-sm text-gray-400 focus:outline-none cursor-not-allowed"
                required
              />
            </div>
            <p className="text-[10px] text-purple-400/70 leading-relaxed italic">
              * This amount is pre-configured by the administrator and cannot be modified.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Explanation / Month Reference</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                <FileText className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. June Monthly Stipend"
                className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-10 text-sm text-white focus:outline-none font-sans"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'SUBMITTING...' : 'SUBMIT REQUEST'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
