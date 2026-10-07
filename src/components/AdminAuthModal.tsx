import React, { useState, useEffect, useRef } from 'react';
import { Shield, Key, Eye, EyeOff, Lock, X, AlertCircle } from 'lucide-react';
import { triggerHaptic, playFeedbackSound } from '../utils/storage';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configuredPassword?: string;
  onResetPassword?: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  configuredPassword = 'admin',
  onResetPassword,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setIsShaking(false);
      setShowForgotHelp(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedInput = password.trim();
    const targetPassword = (configuredPassword || 'admin').trim();
    const isDefault = !targetPassword || targetPassword === 'admin';

    // Emergency Master Key to reset if forgotten
    if (trimmedInput.toUpperCase() === 'RESET9999' || trimmedInput === 'admin9999') {
      triggerHaptic([30, 50, 40]);
      playFeedbackSound('success');
      if (onResetPassword) {
        onResetPassword();
      }
      setPassword('');
      setError(null);
      onSuccess();
      return;
    }

    // Verify password: If custom password is set, only allow targetPassword.
    // If still default 'admin', allow 'admin' or 'admin123'.
    const isAuthorized = isDefault
      ? trimmedInput === 'admin' || trimmedInput === 'admin123'
      : trimmedInput === targetPassword;

    if (isAuthorized) {
      triggerHaptic([30, 50, 40]);
      playFeedbackSound('success');
      setPassword('');
      setError(null);
      onSuccess();
    } else {
      triggerHaptic([60, 80, 60, 100]);
      playFeedbackSound('error');
      setError('Incorrect admin password. (Forgot password? Use link below)');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200 ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-xs">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm leading-tight">
                Admin Security Lock
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Password protected management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-semibold animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Enter Admin Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Admin password..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-inner"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
              <span>
                {configuredPassword && configuredPassword !== 'admin' ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Custom Password Protected
                  </span>
                ) : (
                  <span>
                    Default password: <code className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded">admin</code>
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Protected 🔒</span>
            </p>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowForgotHelp(!showForgotHelp)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Forgot password? (पासवर्ड भूल गए?)</span>
              </button>
            </div>

            {showForgotHelp && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-2 animate-in fade-in">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Master Password Recovery:</span>
                </div>
                <p className="leading-relaxed">
                  Enter Emergency Master Code: <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">RESET9999</code> in the password field to reset back to <code className="font-bold">admin</code>.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([30, 50]);
                      playFeedbackSound('success');
                      if (onResetPassword) {
                        onResetPassword();
                      }
                      setPassword('');
                      setShowForgotHelp(false);
                      onSuccess();
                    }}
                    className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-center transition cursor-pointer shadow-xs active:scale-95"
                  >
                    Reset Password to "admin" &amp; Unlock
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock Admin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
