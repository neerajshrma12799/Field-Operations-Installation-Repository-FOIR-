import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { triggerHaptic } from '../utils/storage';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside standalone PWA mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    triggerHaptic(30);
    await install();
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-xs transition active:scale-95 shadow-xs shrink-0 cursor-pointer"
        title="Install app on your phone"
      >
        <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        <span className="hidden xs:inline sm:inline">Install App</span>
        <span className="xs:hidden sm:hidden">Install</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => {
            triggerHaptic(20);
            setShowIOSGuide(true);
          }}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-xs transition active:scale-95 shadow-xs shrink-0 cursor-pointer"
          title="Install on iPhone / iPad"
        >
          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden xs:inline sm:inline">Install iOS</span>
          <span className="xs:hidden sm:hidden">iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-800 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">
                  Install on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-600">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 block">Step 1</span>
                    Tap the <strong>Share</strong> button in Safari's bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 block">Step 2</span>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
