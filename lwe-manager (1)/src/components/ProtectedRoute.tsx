import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Hourglass, Ban, LogOut, CheckCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { user, firebaseUser, loading, logout, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090514]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-purple-400 font-mono tracking-wider animate-pulse">LOADING LWE SYSTEMS...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  // If account is pending, banned, or rejected, show beautiful overlay screens
  if (user && !isAdmin) {
    if (user.status === 'pending') {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#090514]">
          <div className="glass max-w-md w-full p-8 text-center rounded-xl border border-purple-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-purple-500/10 rounded-full border border-purple-500/30 animate-pulse">
                <Hourglass className="w-12 h-12 text-purple-400" />
              </div>
            </div>
            
            <h1 className="text-2xl font-display font-bold text-white mb-2 tracking-wide">WAITING FOR APPROVAL</h1>
            <p className="text-purple-300 text-sm font-mono mb-4">USER: {user.name}</p>
            
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your registration is complete! An LWE Administrator needs to approve your account before you can access the team dashboard.
            </p>
            
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }

    if (user.status === 'banned') {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#090514]">
          <div className="glass max-w-md w-full p-8 text-center rounded-xl border border-red-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/10 rounded-full border border-red-500/30">
                <Ban className="w-12 h-12 text-red-400 animate-bounce" />
              </div>
            </div>
            
            <h1 className="text-2xl font-display font-bold text-white mb-2 tracking-wide">ACCOUNT BANNED</h1>
            <p className="text-red-300 text-sm font-mono mb-4">ACCESS RESTRICTED</p>
            
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your account has been banned from the LWE Esports management system due to a violation of team policies. Contact management for inquiries.
            </p>
            
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }

    if (user.status === 'rejected') {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#090514]">
          <div className="glass max-w-md w-full p-8 text-center rounded-xl border border-orange-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-600/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-orange-500/10 rounded-full border border-orange-500/30">
                <ShieldAlert className="w-12 h-12 text-orange-400" />
              </div>
            </div>
            
            <h1 className="text-2xl font-display font-bold text-white mb-2 tracking-wide">REGISTRATION REJECTED</h1>
            <p className="text-orange-300 text-sm font-mono mb-4">REQUEST REJECTED</p>
            
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your signup request was rejected by the team administration. If you believe this is a mistake, please reach out to your coach or manager.
            </p>
            
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] transition-all text-white font-mono text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }
  }

  // If route is adminOnly but user is not admin, redirect to players dashboard
  if (adminOnly && !isAdmin) {
    return <Navigate to="/players" replace />;
  }

  return <>{children}</>;
};
