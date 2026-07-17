import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Trophy, Shield, Sparkles, Eye, EyeOff, Key } from 'lucide-react';
import { watchSiteSettings } from '../lib/settings';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import emailjs from '@emailjs/browser';

export const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStage, setForgotStage] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [oobCode, setOobCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inGameRole, setInGameRole] = useState('Fragger');
  const [lineup, setLineup] = useState<'1st Lineup' | 'second lineup'>('1st Lineup');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  const { login, signup, firebaseUser } = useAuth();
  const navigate = useNavigate();

  // Auto-fill OTP, resetEmail, and oobCode from URL query parameters (Direct Reset Link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetEmailParam = params.get('resetEmail');
    const otpParam = params.get('otp');
    const oobCodeParam = params.get('oobCode');

    if (resetEmailParam && otpParam) {
      setForgotEmail(resetEmailParam);
      setOtpCode(otpParam);
      if (oobCodeParam) {
        setOobCode(oobCodeParam);
      }
      setIsForgot(true);
      setForgotStage('verify');
      toast.success('Successfully loaded secure credentials from reset link!', { duration: 5000 });
    }
  }, []);

  useEffect(() => {
    const unsub = watchSiteSettings((data) => {
      setLogoUrl(data.logoUrl || '');
    });
    return () => unsub();
  }, []);

  // If already logged in, redirect
  useEffect(() => {
    if (firebaseUser) {
      navigate('/home');
    }
  }, [firebaseUser, navigate]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Generating secure recovery OTP and reset link...');

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: forgotEmail.toLowerCase().trim(),
          otp: otp
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server error sending email');
      }

      const resData = await response.json().catch(() => ({}));
      if (resData.mode === 'firebase') {
        toast.success('Firebase has sent an official password reset link directly to your email! Please follow that link to reset your password, then return here to log in.', { id: toastId, duration: 12000 });
        setIsForgot(false);
        setForgotStage('request');
        setForgotEmail('');
      } else {
        toast.success('A secure verification OTP and password reset link have been sent to your email! Please check your inbox.', { id: toastId, duration: 8000 });
        setForgotStage('verify');
      }
    } catch (err: any) {
      toast.error('Failed to send verification OTP: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTPAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword || !confirmNewPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Verifying secure OTP and updating password...');

    try {
      const serverVerifyResponse = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: forgotEmail.toLowerCase().trim(),
          otp: otpCode.trim(),
          newPassword: newPassword
        })
      });

      if (!serverVerifyResponse.ok) {
        const serverErr = await serverVerifyResponse.json().catch(() => ({}));
        throw new Error(serverErr.error || 'Verification and update failed');
      }

      toast.success('Password successfully reset! You can now log in immediately.', { id: toastId, duration: 8000 });
      setIsForgot(false);
      setForgotStage('request');
      setForgotEmail('');
      setOtpCode('');
      setOobCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      toast.error('Password reset failed: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isSignUp) {
      if (!name) {
        toast.error('Please enter your name');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    const toastId = toast.loading(isSignUp ? 'Creating your LWE profile...' : 'Authenticating LWE credentials...');

    try {
      if (isSignUp) {
        await signup(name, email, password, inGameRole, lineup);
        toast.success('Registration successful! Waiting for Admin approval.', { id: toastId });
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        await login(email, password);
        toast.success('Access Granted. Welcome to LWE Command Center!', { id: toastId });
        navigate('/players');
      }
    } catch (err: any) {
      let errorMessage = 'Authentication failed. Please check details.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered. Try logging in!';
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050507] relative overflow-hidden select-none">
      {/* Background design accents */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-[#0c0c14] rounded-2xl border border-white/5 mb-3 shadow-[0_0_30px_rgba(168,85,247,0.15)] overflow-hidden w-[72px] h-[72px]">
            {logoUrl ? (
              <img src={logoUrl} alt="LWE Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Trophy className="w-9 h-9 text-purple-400" />
            )}
          </div>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
            LWE <span className="text-purple-500">Esports</span>
          </h1>
          <p className="text-xs font-mono text-purple-400 uppercase tracking-[0.3em] mt-1 font-bold">Management Hub</p>
        </div>

        {/* Card Panel */}
        <div className="bg-[#0c0c14] border border-white/5 rounded-3xl p-8 relative shadow-2xl">
          <div className="absolute top-3 right-4 flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-mono text-purple-400 tracking-wider">SECURE LINK</span>
          </div>

          <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>
              {isForgot ? 'PASSWORD RECOVERY' : (isSignUp ? 'PLAYER SIGNUP' : 'COMMAND CENTER LOGIN')}
            </span>
          </h2>

          {isForgot ? (
            forgotStage === 'request' ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed font-sans">
                  Enter your registered email address below. We will send you a secure 6-digit OTP code and a direct, secure password reset link.
                </p>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@lwe-esports.com"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
                  disabled={loading}
                >
                  <span>SEND SECURITY OTP & LINK</span>
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(false);
                      setForgotStage('request');
                      toast.dismiss();
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-mono tracking-wide underline focus:outline-none cursor-pointer bg-transparent border-0"
                    disabled={loading}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTPAndReset} className="space-y-4">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-2">
                  <p className="text-[11px] text-purple-300 font-mono leading-relaxed text-center">
                    A secure verification code and direct reset link have been sent to <strong className="text-white">{forgotEmail}</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">6-Digit Security OTP</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-center font-mono text-purple-400 tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-bold"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">New Security Key (Password)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-400 hover:text-purple-300 focus:outline-none cursor-pointer bg-transparent border-0"
                      disabled={loading}
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Confirm New Security Key</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showForgotConfirmPassword ? "text" : "password"}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-400 hover:text-purple-300 focus:outline-none cursor-pointer bg-transparent border-0"
                      disabled={loading}
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer font-mono"
                  disabled={loading}
                >
                  <span>VERIFY OTP & UPDATE PASSWORD</span>
                </button>

                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    onClick={() => setForgotStage('request')}
                    className="text-xs text-gray-400 hover:text-white font-mono tracking-wide underline focus:outline-none cursor-pointer bg-transparent border-0"
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(false);
                      setForgotStage('request');
                      toast.dismiss();
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-mono tracking-wide underline focus:outline-none cursor-pointer bg-transparent border-0"
                    disabled={loading}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Full Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Requested In-Game Role</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                        <Trophy className="w-4 h-4" />
                      </span>
                      <select
                        value={inGameRole}
                        onChange={(e) => setInGameRole(e.target.value)}
                        className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                        disabled={loading}
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
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Choose Lineup</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                        <Trophy className="w-4 h-4" />
                      </span>
                      <select
                        value={lineup}
                        onChange={(e) => setLineup(e.target.value as any)}
                        className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                        disabled={loading}
                      >
                        <option value="1st Lineup">1st Lineup</option>
                        <option value="second lineup">second lineup</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@lwe-esports.com"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Security Key (Password)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-400 hover:text-purple-300 focus:outline-none cursor-pointer bg-transparent border-0"
                    disabled={loading}
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block font-bold">Confirm Security Key</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-purple-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#050507] border border-white/10 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-400 hover:text-purple-300 focus:outline-none cursor-pointer bg-transparent border-0"
                      disabled={loading}
                      title={showConfirmPassword ? "Hide Password" : "Show Password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {!isSignUp && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(true);
                      setIsResetSent(false);
                      setForgotEmail(email);
                      toast.dismiss();
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-mono tracking-wide underline focus:outline-none cursor-pointer bg-transparent border-0"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center space-x-2 border border-purple-400/20 cursor-pointer"
                disabled={loading}
              >
                <span>{isSignUp ? 'CREATE LWE ACCOUNT' : 'ENTER COMMAND CENTER'}</span>
              </button>
            </form>
          )}

          {/* Toggle */}
          {!isForgot && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  toast.dismiss();
                }}
                className="text-xs text-purple-400 hover:text-purple-300 font-mono tracking-wide underline focus:outline-none cursor-pointer bg-transparent border-0"
                disabled={loading}
              >
                {isSignUp ? 'Already registered? Log in here' : 'New Player? Register self-signup'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
