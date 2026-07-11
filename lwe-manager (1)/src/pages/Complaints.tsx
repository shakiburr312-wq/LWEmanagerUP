import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addComplaint, replyToComplaint, watchComplaints, watchPlayerComplaints } from '../lib/complaints';
import { Complaint } from '../types';
import { Sidebar } from '../components/Sidebar';
import { BalanceIndicator } from '../components/BalanceIndicator';
import { MessageSquare, Send, CheckCircle, Clock, Reply, HelpCircle, CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const Complaints: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');

  useEffect(() => {
    if (!user) return;

    let unsubscribe;
    if (isAdmin) {
      // Admin sees everything
      unsubscribe = watchComplaints((data) => {
        setComplaints(data);
      });
    } else {
      // Player sees only their complaints
      unsubscribe = watchPlayerComplaints(user.uid, (data) => {
        setComplaints(data);
      });
    }

    return () => unsubscribe?.();
  }, [user, isAdmin]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message details are required');
      return;
    }

    setSubmitting(true);
    try {
      await addComplaint(user.uid, user.name, subject.trim(), message.trim());
      toast.success('Your complaint has been logged successfully');
      setSubject('');
      setMessage('');
    } catch (error: any) {
      toast.error('Could not submit complaint: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyChange = (id: string, text: string) => {
    setReplyText((prev) => ({ ...prev, [id]: text }));
  };

  const handleSendReply = async (complaintId: string) => {
    const text = replyText[complaintId];
    if (!text || !text.trim() || !user) {
      toast.error('Please enter a response reply');
      return;
    }

    const toastId = toast.loading('Sending response reply...');
    try {
      await replyToComplaint(complaintId, text.trim(), user.name);
      toast.success('Reply submitted and complaint resolved!', { id: toastId });
      setReplyText((prev) => {
        const copy = { ...prev };
        delete copy[complaintId];
        return copy;
      });
    } catch (err: any) {
      toast.error('Failed to submit reply: ' + err.message, { id: toastId });
    }
  };

  // Filter complaints based on activeTab
  const filteredComplaints = complaints.filter(c => c.status === activeTab);

  return (
    <div className="flex min-h-screen bg-[#050507]">
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Panel Content */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              Support <span className="text-purple-500">Tickets</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">LWE Player Complaint & Feedback Desk</p>
          </div>
          <BalanceIndicator />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left panel (Submit Form if Player, Admin views stats) */}
          <div className="lg:col-span-4 space-y-6">
            {!isAdmin ? (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6 relative">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center space-x-2">
                  <Send className="w-4 h-4 text-purple-400" />
                  <span>Submit A Ticket</span>
                </h3>
                <form onSubmit={handleCreateComplaint} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block font-bold">Subject Topic</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Ping Issues in Boot Camp"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block font-bold">Message details</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue or grievance..."
                      rows={5}
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-sans resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
                  >
                    <span>{submitting ? 'SENDING TICKET...' : 'SEND MESSAGE'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300 mb-3">ADMIN OVERVIEW</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Manage team complaints, requests, and grievances. Direct communication ensures healthy roster synchronization and moral support.
                </p>
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-gray-500">Total Open Tickets:</span>
                    <span className="text-amber-400 font-bold">{complaints.filter(c => c.status === 'pending').length}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Total Resolved:</span>
                    <span className="text-emerald-400 font-bold">{complaints.filter(c => c.status === 'resolved').length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel (Complaints List) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tabs */}
            <div className="flex space-x-2 border-b border-white/5 pb-px">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-2 px-4 font-mono text-xs tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'border-purple-500 text-purple-400 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-400'
                }`}
              >
                Open Tickets ({complaints.filter(c => c.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveTab('resolved')}
                className={`py-2 px-4 font-mono text-xs tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                  activeTab === 'resolved'
                    ? 'border-purple-500 text-purple-400 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-400'
                }`}
              >
                Resolved Tickets ({complaints.filter(c => c.status === 'resolved').length})
              </button>
            </div>

            {/* Complaints Loop */}
            {filteredComplaints.length === 0 ? (
              <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-12 text-center">
                <HelpCircle className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
                <h4 className="text-white font-bold text-sm">No complaints found</h4>
                <p className="text-gray-500 text-xs mt-1">This category is currently empty.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredComplaints.map((comp) => (
                  <div 
                    key={comp.id} 
                    className={`bg-[#0c0c14] border rounded-3xl p-6 relative ${
                      comp.status === 'resolved' 
                        ? 'border-emerald-500/20' 
                        : 'border-white/5'
                    }`}
                  >
                    {/* Header line info */}
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <h4 className="font-display font-bold text-white text-base uppercase">{comp.subject}</h4>
                        <div className="flex items-center space-x-2 mt-1 font-mono text-[10px]">
                          <span className="text-purple-400">By {comp.playerName}</span>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-500">{new Date(comp.date).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        {comp.status === 'pending' ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-mono uppercase px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/25">
                            <Clock className="w-3 h-3" />
                            <span>OPEN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-mono uppercase px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                            <CheckCircle className="w-3 h-3" />
                            <span>RESOLVED</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Complaint Message Body */}
                    <p className="text-gray-300 text-xs leading-relaxed bg-[#050507]/60 border border-white/5 p-3.5 rounded-2xl font-sans mb-4">
                      {comp.message}
                    </p>

                    {/* Replies if any */}
                    {comp.reply && (
                      <div className="mt-4 border-t border-white/5 pt-4 pl-4 relative">
                        <div className="absolute top-4 left-0 text-purple-400">
                          <CornerDownRight className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-[#050507]/80 border border-white/5 p-3.5 rounded-2xl">
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 text-purple-400 font-bold">
                            <span>Manager Response: {comp.replyBy}</span>
                            {comp.repliedAt && (
                              <span className="text-gray-500">{new Date(comp.repliedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                          <p className="text-gray-300 text-xs leading-relaxed italic">{comp.reply}</p>
                        </div>
                      </div>
                    )}

                    {/* Form to submit response (Admin only, pending state only) */}
                    {isAdmin && comp.status === 'pending' && (
                      <div className="mt-4 border-t border-white/5 pt-4 flex gap-3">
                        <input
                          type="text"
                          value={replyText[comp.id] || ''}
                          onChange={(e) => handleReplyChange(comp.id, e.target.value)}
                          placeholder="Type response to resolve ticket..."
                          className="flex-1 bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none transition-all font-sans"
                        />
                        <button
                          onClick={() => handleSendReply(comp.id)}
                          className="py-1.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center space-x-1.5 border border-purple-400/20 cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          <span>Reply</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
