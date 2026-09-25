import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, ArrowLeft, KeyRound, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { adminLogin } from '../services/api';
import { AdminUser } from '../types';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authStage, setAuthStage] = useState<'idle' | 'checking' | 'authorizing'>('idle');
  const [showPrankModal, setShowPrankModal] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both your administrator username and password.');
      return;
    }

    setIsLoading(true);
    setAuthStage('checking');

    // Simulate authentic security handshake
    await new Promise((r) => setTimeout(r, 900));
    setAuthStage('authorizing');
    await new Promise((r) => setTimeout(r, 900));

    try {
      const result = await adminLogin(username, password, rememberMe);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
        return;
      } else {
        // Wrong password / unauthorized access attempt -> trigger prank!
        setFailCount((prev) => prev + 1);
        setShowPrankModal(true);
      }
    } catch {
      // Network/auth error on wrong password -> trigger prank!
      setFailCount((prev) => prev + 1);
      setShowPrankModal(true);
    } finally {
      setIsLoading(false);
      setAuthStage('idle');
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 sm:my-10 px-4">
      {/* Return to Public Registration button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Public Student Registration</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* Header Header Gradient */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center h-13 w-13 rounded-2xl bg-white/10 text-indigo-300 border border-white/15 mb-3 shadow-inner">
              <Shield className="h-6 w-6 text-indigo-300" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Administrator Login
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
              Secure access for transit coordinators to view student data and roll number gap audits.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username (e.g. admin)"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me & default info hint */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Remember session</span>
            </label>

            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Protected portal</span>
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>
                  {authStage === 'authorizing'
                    ? 'Accessing administrator portal...'
                    : 'Verifying credentials...'}
                </span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Log In to Admin Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Card Footer */}
        <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500">
            Protected area. Unauthenticated direct access to the admin dashboard is restricted.
          </p>
        </div>
      </div>

      {/* Prank Modal for Unauthorized / Wrong Password Attempts */}
      {showPrankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          {/* Ambient dynamic background glows */}
          <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-rose-600/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none animate-pulse delay-700" />

          {/* Outer glowing border card */}
          <div className="relative max-w-xs sm:max-w-sm w-full rounded-3xl p-[2px] bg-gradient-to-b from-rose-500 via-pink-500 to-purple-600 shadow-[0_0_60px_rgba(244,63,94,0.45)] animate-in zoom-in-95 duration-200">
            {/* Inner Dark Glass Container */}
            <div className="bg-slate-950/95 backdrop-blur-2xl rounded-[22px] p-5 sm:p-6 text-center space-y-4 relative overflow-hidden border border-white/10">
              {/* Top ambient highlight line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent" />

              {/* Status Badge */}
              <div className="flex justify-center">
                {failCount >= 3 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-extrabold tracking-wider uppercase shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                    </span>
                    <span>GOOD BYE — YOU ARE GUY 💀</span>
                  </div>
                ) : failCount === 2 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-extrabold tracking-wider uppercase shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
                    </span>
                    <span>ATTEMPT #2 — YOU ARE GUY</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-extrabold tracking-wider uppercase shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    <span>UNAUTHORIZED — YOU ARE GUY</span>
                  </div>
                )}
              </div>

              {/* Prank Media Framed in Sleek Cyber Frame */}
              <div className="flex justify-center">
                <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(244,63,94,0.2)] ring-1 ring-white/10 max-w-[230px] w-full p-2 group/img">
                  <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    <img
                      src={failCount >= 2 ? "/prank2.gif" : "/prank.png"}
                      alt={failCount >= 2 ? "Thinking About You" : "Access Denied"}
                      className="w-full h-auto object-contain max-h-64 rounded-lg transform group-hover/img:scale-105 transition-transform duration-300"
                    />
                  </div>
                  {/* Cyberpunk corner brackets */}
                  <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-rose-400 rounded-tl-sm pointer-events-none" />
                  <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-rose-400 rounded-tr-sm pointer-events-none" />
                  <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-rose-400 rounded-bl-sm pointer-events-none" />
                  <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-rose-400 rounded-br-sm pointer-events-none" />
                </div>
              </div>

              {/* Punchy Text Content */}
              <div className="space-y-2">
                {failCount >= 3 ? (
                  <>
                    <h3 className="text-xl font-black bg-gradient-to-r from-purple-400 via-pink-300 to-amber-300 bg-clip-text text-transparent tracking-tight uppercase drop-shadow">
                      🛑 GOOD BYE!
                    </h3>
                    <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-950/70 via-rose-950/60 to-pink-950/70 border border-purple-500/30 shadow-inner">
                      <p className="text-base sm:text-lg font-black text-rose-100 tracking-wide font-mono">
                        "i cant fuck you any more good bye"
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-rose-500/20 px-2.5 py-1.5">
                      <p className="text-xs font-bold text-rose-300">
                        Attempt #{failCount}: If you try next attempt you are gay! (You are gay)
                      </p>
                    </div>
                  </>
                ) : failCount === 2 ? (
                  <>
                    <h3 className="text-xl font-black bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 bg-clip-text text-transparent tracking-tight uppercase drop-shadow">
                      🥱 STILL TRYING?
                    </h3>
                    <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-950/70 via-purple-950/60 to-pink-950/70 border border-rose-500/30 shadow-inner space-y-1">
                      <p className="text-base sm:text-lg font-black text-rose-100 tracking-wide font-mono">
                        "i am so tired of fucking you"
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-pink-300 font-mono">
                        "i cant fuck you any more good bye"
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-rose-500/20 px-2.5 py-1.5">
                      <p className="text-xs font-bold text-rose-300">
                        Attempt #2: If you try next attempt you are gay! 
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-black bg-gradient-to-r from-rose-400 via-red-300 to-amber-300 bg-clip-text text-transparent tracking-tight uppercase drop-shadow">
                      🚨 ACCESS DENIED
                    </h3>
                    <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-950/70 via-purple-950/60 to-pink-950/70 border border-rose-500/30 shadow-inner">
                      <p className="text-base sm:text-lg font-black text-rose-100 tracking-wide font-mono">
                        "I fucked up"
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-rose-500/20 px-2.5 py-1.5">
                      <p className="text-xs font-bold text-rose-300">
                        Attempt #1: If you try next attempt you are gay! (You are gay)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Catchy Action Button */}
              <button
                type="button"
                id="prank-done-btn"
                onClick={() => {
                  setShowPrankModal(false);
                  setPassword('');
                  setErrorMessage(
                    failCount >= 3
                      ? `Attempt #${failCount} failed: i cant fuck you any more good bye! (You are gay)`
                      : failCount === 2
                      ? `Attempt #2 failed: You are gay! If you try next attempt you are gay.`
                      : 'Attempt #1 failed: Unauthorized access. If you try next attempt you are gay!'
                  );
                }}
                className="relative w-full py-3.5 px-6 rounded-xl font-black text-sm tracking-wide text-white bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:via-pink-500 hover:to-purple-500 shadow-[0_0_25px_rgba(244,63,94,0.45)] hover:shadow-[0_0_35px_rgba(244,63,94,0.7)] active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {failCount >= 3 ? (
                    <>
                      <span>Done — i cant fuck you any more good bye</span>
                      <span className="text-base">💀</span>
                    </>
                  ) : failCount === 2 ? (
                    <>
                      <span>Done — I am so tired of this (You are gay)</span>
                      <span className="text-base">💀</span>
                    </>
                  ) : (
                    <>
                      <span>Done — I fucked up (You are gay)</span>
                      <span className="text-base">🤦‍♂️</span>
                    </>
                  )}
                </span>
                {/* Shimmer sweep animation on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out pointer-events-none" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
