import React, { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import { X, User, BarChart, Settings, Plus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<PlayerProfile>) => Promise<void>;
  player?: PlayerProfile | null;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ isOpen, onClose, onSave, player }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Fragger');
  const [kills, setKills] = useState('0');
  const [damage, setDamage] = useState('0');
  const [wallet, setWallet] = useState('0');
  const [matches, setMatches] = useState('0');
  const [booyahs, setBooyahs] = useState('0');
  const [salary, setSalary] = useState('0');
  const [lineup, setLineup] = useState<'1st Lineup' | 'second lineup'>('1st Lineup');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name);
      setRole(player.role);
      setKills(player.kills.toString());
      setDamage(player.damage.toString());
      setWallet((player.wallet || 0).toString());
      setMatches((player.matches || 0).toString());
      setBooyahs((player.booyahs || 0).toString());
      setSalary((player.salary || 0).toString());
      setLineup(player.lineup || '1st Lineup');
    } else {
      setName('');
      setRole('Fragger');
      setKills('0');
      setDamage('0');
      setWallet('0');
      setMatches('0');
      setBooyahs('0');
      setSalary('0');
      setLineup('1st Lineup');
    }
  }, [player, isOpen]);

  if (!isOpen) return null;

  // Real-time Free Fire / Regular K/D calculation
  const killsNum = parseInt(kills) || 0;
  const matchesNum = parseInt(matches) || 0;
  const booyahsNum = parseInt(booyahs) || 0;
  
  let calculatedKd = 0;
  if (matchesNum > 0) {
    const deaths = matchesNum - booyahsNum;
    const divisor = Math.max(1, deaths);
    calculatedKd = killsNum / divisor;
  }
  const displayKd = calculatedKd.toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a player name');
      return;
    }

    const killsVal = parseInt(kills);
    const damageVal = parseInt(damage);
    const walletVal = parseFloat(wallet);
    const matchesVal = parseInt(matches);
    const booyahsVal = parseInt(booyahs);
    const salaryVal = parseFloat(salary);

    if (isNaN(killsVal) || killsVal < 0) {
      toast.error('Kills must be a positive integer');
      return;
    }
    if (isNaN(matchesVal) || matchesVal < 0) {
      toast.error('Matches must be a positive integer');
      return;
    }
    if (isNaN(booyahsVal) || booyahsVal < 0) {
      toast.error('Booyahs must be a positive integer');
      return;
    }
    if (booyahsVal > matchesVal) {
      toast.error('Booyahs cannot be greater than matches');
      return;
    }
    if (isNaN(damageVal) || damageVal < 0) {
      toast.error('Damage must be a positive integer');
      return;
    }
    if (isNaN(walletVal) || walletVal < 0) {
      toast.error('Wallet balance must be a valid positive number');
      return;
    }
    if (isNaN(salaryVal) || salaryVal < 0) {
      toast.error('Base salary must be a valid positive number');
      return;
    }

    let computedKd = 0;
    if (matchesVal > 0) {
      const deaths = matchesVal - booyahsVal;
      const divisorVal = Math.max(1, deaths);
      computedKd = killsVal / divisorVal;
    }

    setLoading(true);
    try {
      await onSave({
        name,
        role,
        kd: Number(computedKd.toFixed(2)),
        kills: killsVal,
        damage: damageVal,
        wallet: walletVal,
        matches: matchesVal,
        booyahs: booyahsVal,
        salary: salaryVal,
        lineup: lineup
      });
      toast.success(player ? 'Player updated successfully!' : 'Player added successfully!');
      onClose();
    } catch (error: any) {
      toast.error('Error saving player: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass panel-cut max-w-md w-full rounded-2xl border border-purple-500/30 p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-display font-bold text-white mb-6 flex items-center space-x-2">
          {player ? <Settings className="w-5 h-5 text-purple-400" /> : <Plus className="w-5 h-5 text-purple-400" />}
          <span>{player ? 'EDIT PLAYER STATS' : 'ADD NEW ROSTER PLAYER'}</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Player Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. LWE Xpecter"
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">In-Game Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#0d0720] border border-purple-500/20 focus:border-purple-500 rounded py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
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

          {/* Matches, Booyahs & Auto-calculated KD */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block text-center">Matches</label>
              <input
                type="number"
                value={matches}
                onChange={(e) => setMatches(e.target.value)}
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block text-center">Booyahs</label>
              <input
                type="number"
                value={booyahs}
                onChange={(e) => setBooyahs(e.target.value)}
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block text-center">Kills</label>
              <input
                type="number"
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block text-center">K/D Ratio</label>
              <div className="w-full bg-purple-950/30 border border-purple-500/35 rounded py-2 px-2 text-xs text-purple-300 font-mono text-center font-bold">
                {displayKd}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Damage</label>
              <input
                type="number"
                value={damage}
                onChange={(e) => setDamage(e.target.value)}
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Monthly Salary (USD)</label>
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Wallet Balance (USD)</label>
              <input
                type="number"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0"
                className="w-full bg-purple-950/10 border border-purple-500/20 focus:border-purple-500 rounded py-2 px-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Player Lineup</label>
              <select
                value={lineup}
                onChange={(e) => setLineup(e.target.value as any)}
                className="w-full bg-[#0d0720] border border-purple-500/20 focus:border-purple-500 rounded py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
              >
                <option value="1st Lineup">1st Lineup</option>
                <option value="second lineup">second lineup</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'SAVING DATA...' : 'SAVE RECORD'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
