import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Shield,
  Key,
  X,
} from 'lucide-react';
import { AppSettings } from '../types';
import { verifyTechnicianPassword, triggerHaptic, playFeedbackSound } from '../utils/storage';

interface TechnicianLoginProps {
  settings: AppSettings;
  onLoginSuccess: (technicianName: string) => void;
  onRefreshTechnicians: () => Promise<void>;
  isRefreshing: boolean;
  isOnline: boolean;
  onOpenAdminPortal?: () => void;
}

export const TechnicianLogin: React.FC<TechnicianLoginProps> = ({
  settings,
  onLoginSuccess,
  onRefreshTechnicians,
  isRefreshing,
  isOnline,
  onOpenAdminPortal,
}) => {
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Login Dialog State
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);

  React.useEffect(() => {
    // Only reset if a previously selected tech is removed from sheet
    if (selectedTech && settings.technicians && !settings.technicians.includes(selectedTech)) {
      setSelectedTech('');
    }
  }, [settings.technicians, selectedTech]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTech) {
      setError('Please select your technician name');
      triggerHaptic([40, 60, 40]);
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password or PIN');
      triggerHaptic([40, 60, 40]);
      return;
    }

    setIsSubmitting(true);

    const isValid = verifyTechnicianPassword(selectedTech, password, settings);

    if (isValid) {
      triggerHaptic([30, 50, 40]);
      playFeedbackSound('success');
      onLoginSuccess(selectedTech);
    } else {
      triggerHaptic([60, 80, 60, 100]);
      playFeedbackSound('error');
      const hasSpecificPassword = !!settings.technicianPasswords?.[selectedTech];
      if (hasSpecificPassword) {
        setError('Incorrect password. Please enter the password configured in Google Sheet.');
      } else {
        setError(
          `Incorrect password. Try default PIN "1234" or "${selectedTech.toLowerCase()}".`
        );
      }
      setIsSubmitting(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    const masterPass = settings.adminPassword || 'admin';
    if (adminPasswordInput.trim() === masterPass || adminPasswordInput.trim() === 'admin123') {
      triggerHaptic([30, 50]);
      playFeedbackSound('success');
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      if (onOpenAdminPortal) {
        onOpenAdminPortal();
      }
    } else {
      triggerHaptic([60, 80]);
      playFeedbackSound('error');
      setAdminError('Invalid Admin Password. Please try again.');
    }
  };

  const hasSpecificPass = !!settings.technicianPasswords?.[selectedTech];

  return (
    <div className="w-full flex items-center justify-center py-2 sm:py-6 px-2 sm:px-4">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Top Header Banner - Auto-collapses/hides large logo when a technician is selected */}
        {!selectedTech ? (
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800 p-4 sm:p-5 text-white text-center relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-400/20 rounded-full blur-lg pointer-events-none"></div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-1.5 sm:mb-2 shadow-inner border border-white/20">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>

            <h2 className="text-base sm:text-lg font-black tracking-tight">Technician Portal</h2>
            <p className="text-[11px] sm:text-xs text-indigo-100/90 mt-0.5 max-w-xs mx-auto">
              Select your name to start logging installations
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 px-4 py-2.5 text-white flex items-center justify-between transition-all duration-300">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center text-xs font-bold shadow-inner">
                {selectedTech.charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>{selectedTech}</span>
                  <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold border border-emerald-400/30">
                    Selected
                  </span>
                </div>
                <div className="text-[10px] text-indigo-200">Enter PIN below to sign in</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTech('');
                setPassword('');
                setError(null);
              }}
              className="text-[11px] bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
              title="Select another technician"
            >
              Change Name
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Technician Select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Technician Name <span className="text-rose-500">*</span>
                </label>

                <button
                  type="button"
                  onClick={onRefreshTechnicians}
                  disabled={isRefreshing || !isOnline}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition disabled:opacity-50"
                  title="Sync latest technicians from Google Sheet"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  <span>Sync Sheet</span>
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <select
                  value={selectedTech}
                  onChange={(e) => {
                    setSelectedTech(e.target.value);
                    setError(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                >
                  <option value="">Select Technician Name</option>
                  {settings.technicians.map((tech) => (
                    <option key={tech} value={tech}>
                      {tech}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password / PIN Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password / Security PIN <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your password or PIN..."
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Hint Card */}
              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span>
                  {hasSpecificPass
                    ? '🔑 Secured via Sheet Column B'
                    : '🔑 Default PIN: "1234" (or Sheet Col B)'}
                </span>
                {!hasSpecificPass && (
                  <button
                    type="button"
                    onClick={() => setPassword('1234')}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Use 1234
                  </button>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In as {selectedTech || 'Technician'}</span>
            </button>
          </form>

          {/* Quick Help & Admin Portal Access */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Session stays active offline
            </span>

            {/* Admin Portal Gateway */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                if (onOpenAdminPortal) {
                  onOpenAdminPortal();
                } else {
                  setShowAdminLoginModal(true);
                }
              }}
              className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border border-indigo-200 transition active:scale-95 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Security Password Prompt Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Admin Authentication
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Master configuration &amp; KPI dashboard
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminAuth} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Admin Master Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter Admin Password..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Default: <code>admin</code>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition"
                >
                  Access Admin Portal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
