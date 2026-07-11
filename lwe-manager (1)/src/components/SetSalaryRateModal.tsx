import React, { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import { X, DollarSign, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface SetSalaryRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRate: (salary: number) => Promise<void>;
  player: PlayerProfile | null;
}

export const SetSalaryRateModal: React.FC<SetSalaryRateModalProps> = ({ isOpen, onClose, onSaveRate, player }) => {
  const [rate, setRate] = useState('0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (player) {
      setRate(player.salary.toString());
    }
  }, [player, isOpen]);

  if (!isOpen || !player) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(rate);

    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Please enter a valid positive salary rate');
      return;
    }

    setLoading(true);
    try {
      await onSaveRate(rateNum);
      toast.success(`Successfully updated monthly salary rate to $${rateNum} for ${player.name}`);
      onClose();
    } catch (err: any) {
      toast.error('Failed to update salary rate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass panel-cut max-w-sm w-full rounded-2xl border border-purple-500/30 p-6 bg-[#0a0a14] shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-display font-bold text-white mb-1 flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-purple-400" />
          <span>SET MONTHLY SALARY</span>
        </h3>
        <p className="text-[11px] font-mono text-purple-400 uppercase tracking-widest mb-4">Player: {player.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Base Monthly Rate (USD)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Amount in USD"
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'SAVING...' : 'SAVE SALARY RATE'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
