import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addFinanceTransaction, watchFinanceTransactions, deleteFinanceTransaction } from '../lib/finance';
import { watchInvestmentCampaigns, addInvestmentCampaign, resolveInvestmentCampaign, deleteInvestmentCampaign } from '../lib/investments';
import { watchSalaryRequests, approveSalaryRequest, rejectSalaryRequest } from '../lib/salaryRequests';
import { FinanceTransaction, InvestmentCampaign, SalaryRequest } from '../types';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Plus, 
  ListOrdered, 
  Percent, 
  Activity,
  PlusCircle,
  HelpCircle,
  Clock,
  Calendar,
  Check,
  X,
  CheckCircle,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import toast from 'react-hot-toast';

export const Finance: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick form input states
  const [showLogModal, setShowLogModal] = useState(false);
  const [logType, setLogType] = useState<'invest' | 'withdraw'>('invest');
  const [amount, setAmount] = useState('500');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Salary Requests State
  const [salaryRequests, setSalaryRequests] = useState<SalaryRequest[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [approvalMethod, setApprovalMethod] = useState<'bKash' | 'Nagad'>('bKash');
  const [confirmingApproval, setConfirmingApproval] = useState(false);

  // Investment Campaign states
  const [campaigns, setCampaigns] = useState<InvestmentCampaign[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignCategory, setCampaignCategory] = useState<'champion rush' | 'scrim' | 'paid'>('champion rush');
  const [campaignAmount, setCampaignAmount] = useState('100');
  const [campaignDate, setCampaignDate] = useState(new Date().toISOString().split('T')[0]);
  const [campaignLineup, setCampaignLineup] = useState<'1st Lineup' | 'second lineup'>('1st Lineup');
  const [addingCampaign, setAddingCampaign] = useState(false);

  // Resolving campaign states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [prizeInput, setPrizeInput] = useState('');

  useEffect(() => {
    const unsubscribeTx = watchFinanceTransactions((data) => {
      setTransactions(data);
    });

    const unsubscribeCampaigns = watchInvestmentCampaigns((data) => {
      setCampaigns(data);
      setLoading(false);
    });

    const unsubscribeRequests = watchSalaryRequests((data) => {
      setSalaryRequests(data);
    });

    return () => {
      unsubscribeTx();
      unsubscribeCampaigns();
      unsubscribeRequests();
    };
  }, []);

  const handleLogTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    if (!description.trim()) {
      toast.error('Please specify details or transaction reference');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Recording financial transaction...');
    try {
      await addFinanceTransaction(logType, amountNum, description.trim(), user.name, user.uid);
      toast.success(`Successfully logged $${amountNum} ${logType === 'invest' ? 'Deposit' : 'Withdrawal'}`, { id: toastId });
      setDescription('');
      setAmount('500');
      setShowLogModal(false);
    } catch (err: any) {
      toast.error('Transaction logging failed: ' + err.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!campaignTitle.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    const amountNum = parseFloat(campaignAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid investment amount');
      return;
    }

    if (!campaignDate) {
      toast.error('Please specify a date');
      return;
    }

    setAddingCampaign(true);
    const toastId = toast.loading('Initiating investment campaign...');
    try {
      await addInvestmentCampaign(
        campaignTitle.trim(),
        campaignCategory,
        amountNum,
        campaignDate,
        user.name,
        campaignLineup,
        user.uid
      );
      toast.success(`Started ${campaignCategory} campaign for ${campaignLineup} with $${amountNum} investment!`, { id: toastId });
      setCampaignTitle('');
      setCampaignAmount('100');
      setShowCampaignModal(false);
    } catch (err: any) {
      toast.error('Campaign creation failed: ' + err.message, { id: toastId });
    } finally {
      setAddingCampaign(false);
    }
  };

  const handleResolveCampaign = async (campaignId: string, status: 'win' | 'lose') => {
    let prizeNum: number | undefined = undefined;
    if (status === 'win') {
      prizeNum = parseFloat(prizeInput);
      if (isNaN(prizeNum) || prizeNum < 0) {
        toast.error('Please enter a valid prize amount');
        return;
      }
    }

    const toastId = toast.loading(`Resolving campaign as ${status.toUpperCase()}...`);
    try {
      await resolveInvestmentCampaign(campaignId, status, prizeNum, user.uid);
      toast.success(`Campaign resolved successfully!`, { id: toastId });
      setResolvingId(null);
      setPrizeInput('');
    } catch (err: any) {
      toast.error('Failed to resolve campaign: ' + err.message, { id: toastId });
    }
  };

  const handleApproveRequest = async (request: SalaryRequest) => {
    if (!user) return;
    try {
      const toastId = toast.loading(`Processing salary request approval...`);
      await approveSalaryRequest(
        request.id,
        request.playerId,
        request.playerName,
        request.amount,
        user.uid,
        user.name,
        approvalMethod
      );
      toast.success(`Approved salary request of $${request.amount} for ${request.playerName}!`, { id: toastId });
      setApprovingRequestId(null);
      setConfirmingApproval(false);
    } catch (err: any) {
      toast.error('Failed to approve request: ' + err.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user) return;
    try {
      const toastId = toast.loading(`Rejecting salary request...`);
      await rejectSalaryRequest(requestId, user.name);
      toast.success(`Rejected salary request!`, { id: toastId });
    } catch (err: any) {
      toast.error('Failed to reject request: ' + err.message);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to delete this investment campaign? This is irreversible and will not alter any historical balance records already calculated.')) {
      return;
    }
    const toastId = toast.loading('Deleting investment campaign...');
    try {
      await deleteInvestmentCampaign(campaignId);
      toast.success('Investment campaign deleted successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to delete campaign: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('Are you sure you want to delete this ledger entry? This is irreversible and will not alter any historical player wallet balances already processed.')) {
      return;
    }
    const toastId = toast.loading('Deleting ledger entry...');
    try {
      await deleteFinanceTransaction(txId);
      toast.success('Ledger transaction deleted successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to delete transaction: ' + err.message, { id: toastId });
    }
  };

  // Summary Math calculations
  const totalInvest = transactions
    .filter(t => t.type === 'invest')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalProfit = transactions
    .filter(t => t.type === 'tournament_profit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSalary = transactions
    .filter(t => t.type === 'salary_payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdraw = transactions
    .filter(t => t.type === 'withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCampaignOutlay = campaigns.reduce((sum, c) => sum + c.amount, 0);
  const totalCampaignWinnings = campaigns
    .filter(c => c.status === 'win')
    .reduce((sum, c) => sum + (c.prizeAmount || 0), 0);

  const netHisab = totalProfit + totalInvest - totalSalary - totalWithdraw + totalCampaignWinnings - totalCampaignOutlay;

  // Chart data mapping (reverse to show chronological order)
  const chartData = [...transactions].reverse().map((t, idx) => ({
    name: `Tx #${idx + 1}`,
    amount: t.amount,
    type: t.type === 'salary_payment' ? 'Payout' : 'Incoming',
    date: new Date(t.date).toLocaleDateString()
  }));

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar Layout Navigation */}
      <Sidebar />

      {/* Main Finance Container */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Admin <span className="text-purple-500">Finance</span> Hub
            </h2>
            <p className="text-gray-400 text-sm mt-1">Overview of organization liquidity and payroll</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BalanceIndicator />
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all cursor-pointer font-mono"
                >
                  <span>Log Income / Investment</span>
                </button>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer font-mono"
                >
                  <span>Log Campaign</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-purple-400 font-mono text-xs">RECONCILING ACCOUNTS...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Investments */}
              <div className="bg-[#11111a] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Capital Injection</span>
                    <h3 className="text-2xl font-black text-white font-mono">${totalInvest.toLocaleString()}</h3>
                  </div>
                  <Briefcase className="w-5 h-5 text-purple-400" />
                </div>
              </div>

              {/* Tournament Profit */}
              <div className="bg-[#11111a] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Tournament Prizes</span>
                    <h3 className="text-2xl font-black text-green-400 font-mono">${(totalProfit + totalCampaignWinnings).toLocaleString()}</h3>
                    <span className="text-[8px] text-gray-500 font-mono block mt-1">Direct: ${totalProfit.toLocaleString()} | Campaigns: ${totalCampaignWinnings.toLocaleString()}</span>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
              </div>

              {/* Salaries Paid */}
              <div className="bg-[#11111a] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Salaries & Debits</span>
                    <h3 className="text-2xl font-black text-red-400 font-mono">${(totalSalary + totalCampaignOutlay).toLocaleString()}</h3>
                    <span className="text-[8px] text-gray-500 font-mono block mt-1">Salary: ${totalSalary.toLocaleString()} | Campaigns: ${totalCampaignOutlay.toLocaleString()}</span>
                  </div>
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
              </div>

              {/* Net Balance (Net Hisab) */}
              <div className="bg-purple-600 shadow-[0_0_40px_rgba(147,51,234,0.2)] border border-purple-400/30 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/20 blur-xl rounded-full"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-purple-100 uppercase font-bold tracking-widest mb-1 block">Net Treasury Flow</span>
                    <h3 className="text-2xl font-black text-white font-mono">
                      ${netHisab.toLocaleString()}
                    </h3>
                  </div>
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            {/* Financial Recharts Visualization Card */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Financial Trends History</span>
              </h3>

              {chartData.length === 0 ? (
                <div className="h-72 flex items-center justify-center border border-white/5 rounded-xl">
                  <div className="text-center text-gray-500 font-mono text-xs">
                    <HelpCircle className="w-10 h-10 mx-auto mb-2 text-purple-500/20" />
                    No financial transactions logged yet.
                  </div>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1837" />
                      <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0c081e', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px' }}
                        labelStyle={{ color: '#a855f7', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }}
                        itemStyle={{ color: '#ffffff', fontSize: '12px', fontFamily: 'sans-serif' }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#a855f7" fillOpacity={1} fill="url(#colorAmount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Pending Salary Requests Section (visible to Admins) */}
            {isAdmin && (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                  <span>Pending Player Salary Requests ({salaryRequests.filter(r => r.status === 'pending').length})</span>
                </h3>

                {salaryRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="py-6 flex items-center justify-center border border-white/5 border-dashed rounded-2xl text-center text-gray-500 font-mono text-xs">
                    No pending player salary requests in the queue.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {salaryRequests.filter(r => r.status === 'pending').map((req) => (
                      <div key={req.id} className="bg-[#050507] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-mono text-xs">
                        <div>
                          <div className="flex items-center space-x-2 mb-1.5">
                            <span className="text-white font-bold text-sm font-sans">{req.playerName}</span>
                            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">STIPEND REQUEST</span>
                          </div>
                          <p className="text-gray-400 text-xs mb-1 font-sans">{req.reason}</p>
                          <span className="text-[10px] text-gray-500 font-sans">Submitted: {new Date(req.date).toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col sm:items-end gap-2">
                          <div className="text-right mb-1">
                            <span className="text-xs text-gray-500 block uppercase">Requested Amount</span>
                            <span className="text-lg font-black text-white">${req.amount}</span>
                          </div>

                          {approvingRequestId === req.id && confirmingApproval ? (
                            <div className="bg-[#0c0c14] border border-purple-500/20 rounded-xl p-3 space-y-2 max-w-xs">
                              <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Are you sure you want to approve?</p>
                              
                              <div className="space-y-1">
                                <span className="text-[9px] text-gray-400 uppercase">Payout via:</span>
                                <select 
                                  value={approvalMethod}
                                  onChange={(e) => setApprovalMethod(e.target.value as 'bKash' | 'Nagad')}
                                  className="w-full bg-[#050507] border border-white/10 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                                >
                                  <option value="bKash">bKash (Dropdown)</option>
                                  <option value="Nagad">Nagad (Dropdown)</option>
                                </select>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleApproveRequest(req)}
                                  className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase rounded-lg"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => {
                                    setApprovingRequestId(null);
                                    setConfirmingApproval(false);
                                  }}
                                  className="px-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setApprovingRequestId(req.id);
                                  setConfirmingApproval(true);
                                  setApprovalMethod('bKash');
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase transition-all"
                              >
                                Approve Payout
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                className="px-3 py-2 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-xl text-xs border border-white/5 hover:border-red-500/20 transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Esports Tournament Campaigns Section */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Tournament & Scrim Campaigns</span>
                  </h3>
                  <p className="text-gray-500 text-[10px] mt-1 font-mono">Live tracking of champion rush, scrim, and paid matches</p>
                </div>
              </div>

              {campaigns.length === 0 ? (
                <div className="py-12 flex items-center justify-center border border-white/5 border-dashed rounded-2xl">
                  <div className="text-center text-gray-500 font-mono text-xs">
                    No active tournament or scrim campaigns recorded yet.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {campaigns.map((c) => {
                    const isWin = c.status === 'win';
                    const isLose = c.status === 'lose';
                    const isActive = c.status === 'active';
                    const netIncome = isWin ? (c.prizeAmount || 0) - c.amount : -c.amount;

                    return (
                      <div 
                        key={c.id} 
                        className={`border rounded-2xl p-5 relative overflow-hidden transition-all ${
                          isWin 
                            ? 'bg-emerald-950/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.02)]' 
                            : isLose 
                            ? 'bg-red-950/5 border-red-500/10' 
                            : 'bg-purple-950/5 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.02)] animate-pulse'
                        }`}
                      >
                        {/* Status Glow bar */}
                        <div className={`absolute top-0 inset-x-0 h-[2px] ${
                          isWin ? 'bg-emerald-500' : isLose ? 'bg-red-500' : 'bg-purple-500 animate-pulse'
                        }`} />

                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className={`text-[8px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                                c.category === 'champion rush' 
                                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' 
                                  : c.category === 'scrim' 
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' 
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                              }`}>
                                {c.category}
                              </span>
                              <span className="text-[8px] bg-white/5 border border-white/10 text-gray-300 font-bold font-mono uppercase px-2 py-0.5 rounded">
                                {c.lineup || '1st Lineup'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wide mt-2 font-display">{c.title}</h4>
                            <span className="text-[9px] font-mono text-gray-500 block mt-1">Date: {new Date(c.date).toLocaleDateString()}</span>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <span className="text-[9px] font-mono text-gray-500 block uppercase">Invested</span>
                            <span className="text-sm font-bold text-white font-mono">${c.amount.toLocaleString()}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteCampaign(c.id)}
                                className="mt-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold"
                                title="Delete Campaign History"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Outcomes & Resolve Controls */}
                        <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                          {isActive && (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between text-[10px] font-mono text-purple-400">
                                <span className="flex items-center gap-1 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                                  ACTIVE INVESTMENT
                                </span>
                              </div>

                              {isAdmin && (
                                <div className="mt-1">
                                  {resolvingId === c.id ? (
                                    <div className="space-y-2 bg-[#050507] border border-white/10 rounded-xl p-3">
                                      <span className="text-[9px] uppercase font-mono text-emerald-400 font-bold block">Enter Prize Won ($)</span>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          placeholder="e.g. 500"
                                          value={prizeInput}
                                          onChange={(e) => setPrizeInput(e.target.value)}
                                          className="flex-1 bg-[#0c0c14] border border-white/10 focus:border-emerald-500 rounded-lg p-1.5 text-xs text-white font-mono focus:outline-none"
                                        />
                                        <button
                                          onClick={() => handleResolveCampaign(c.id, 'win')}
                                          className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => setResolvingId(null)}
                                          className="px-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => {
                                          setResolvingId(c.id);
                                          setPrizeInput('');
                                        }}
                                        className="py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Check className="w-3 h-3" /> Win Match
                                      </button>
                                      <button
                                        onClick={() => handleResolveCampaign(c.id, 'lose')}
                                        className="py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" /> Lose Match
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isWin && (
                            <div className="flex items-center justify-between font-mono">
                              <span className="text-[10px] text-emerald-400 font-bold uppercase">🏆 Campaign Won</span>
                              <div className="text-right">
                                <span className="text-[9px] text-gray-500 block">Prize Received</span>
                                <span className="text-sm font-black text-emerald-400">${c.prizeAmount?.toLocaleString()}</span>
                                <span className={`text-[8px] font-bold block ${netIncome >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                  Net ROI: {netIncome >= 0 ? '+' : ''}${netIncome.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )}

                          {isLose && (
                            <div className="flex items-center justify-between font-mono">
                              <span className="text-[10px] text-red-400 font-bold uppercase">💀 Campaign Lost</span>
                              <div className="text-right">
                                <span className="text-[9px] text-gray-500 block">Capital Loss</span>
                                <span className="text-xs font-bold text-red-400">-${c.amount.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Complete Transaction Table List */}
            <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center space-x-2">
                <ListOrdered className="w-4 h-4 text-purple-400" />
                <span>Recent Ledger Entries</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-gray-500 uppercase font-mono tracking-widest text-[9px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Authorized By</th>
                      <th className="py-3 px-4 text-right">Amount (USD)</th>
                      {isAdmin && <th className="py-3 px-4 text-right w-16">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 text-gray-400">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-500/50" />
                            <span>{new Date(tx.date).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded border ${
                            tx.type === 'tournament_profit' 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' 
                              : tx.type === 'invest' 
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/25' 
                              : 'bg-red-500/15 text-red-400 border-red-500/25'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-200 font-sans">{tx.description}</td>
                        <td className="py-4 px-4 text-purple-300">{tx.addedBy}</td>
                        <td className={`py-4 px-4 text-right font-bold ${
                          tx.type === 'salary_payment' ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {tx.type === 'salary_payment' ? '-' : '+'}${tx.amount.toLocaleString()}
                        </td>
                        {isAdmin && (
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleDeleteTransaction(tx.id || '')}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                              title="Delete Ledger Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Start Investment Campaign Modal */}
        {showCampaignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0c0c14] max-w-md w-full rounded-3xl border border-purple-500/20 p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer text-lg"
              >
                ✕
              </button>

              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-300 mb-6 flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>Start Investment Campaign</span>
              </h3>

              <form onSubmit={handleCreateCampaign} className="space-y-4 font-mono text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Campaign Title / Match Name</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="e.g. Pubg Champion Rush Cup"
                    className="w-full bg-[#050507] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-600 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Campaign Category</label>
                  <select
                    value={campaignCategory}
                    onChange={(e) => setCampaignCategory(e.target.value as any)}
                    className="w-full bg-[#050507] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none"
                  >
                    <option value="champion rush">Champion Rush</option>
                    <option value="scrim">Scrim</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Target Lineup</label>
                  <select
                    value={campaignLineup}
                    onChange={(e) => setCampaignLineup(e.target.value as any)}
                    className="w-full bg-[#050507] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none"
                  >
                    <option value="1st Lineup">1st Lineup</option>
                    <option value="second lineup">second lineup</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Investment Outlay (USD)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={campaignAmount}
                      onChange={(e) => setCampaignAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-[#050507] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-10 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Campaign Date</label>
                  <input
                    type="date"
                    value={campaignDate}
                    onChange={(e) => setCampaignDate(e.target.value)}
                    className="w-full bg-[#050507] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingCampaign}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center space-x-2 border border-emerald-400/20 cursor-pointer"
                >
                  <span>{addingCampaign ? 'COMMITTING CAPITAL...' : 'INITIATE CAMPAIGN'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Manual log Income modal (Admin only) */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0c0c14] max-w-md w-full rounded-3xl border border-white/10 p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowLogModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer text-lg"
              >
                ✕
              </button>

              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-300 mb-6 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-purple-400" />
                <span>Log Income / Investment</span>
              </h3>

              <form onSubmit={handleLogTransaction} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Transaction Type</label>
                  <select
                    value={logType}
                    onChange={(e) => setLogType(e.target.value as any)}
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  >
                    <option value="invest">Deposit (Capital Injection)</option>
                    <option value="withdraw">Withdraw (Capital Outflow)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block">Details / Reference</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Series A seed round, PMCO Spring prize"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
                >
                  <span>{submitting ? 'RECORDING...' : 'COMMIT TRANSACTION'}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
