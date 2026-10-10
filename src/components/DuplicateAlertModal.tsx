import React from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, X } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

export interface DuplicateNoticeData {
  title: string;
  serialNumber?: string;
  recordId?: string;
  technicianName?: string;
  siteName?: string;
  reason: string;
  actionTaken: string;
  source: 'form' | 'sync' | 'online_save' | 'script';
}

interface DuplicateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DuplicateNoticeData | null;
}

export const DuplicateAlertModal: React.FC<DuplicateAlertModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  const handleClose = () => {
    triggerHaptic(20);
    onClose();
  };

  const isSyncSource = data.source === 'sync';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden transform transition-all scale-100 animate-scaleUp">
        {/* Header with warning styling */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide">
                {data.title || 'Duplicate Record Blocked'}
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                {isSyncSource ? 'Auto-Sync Duplicate Verification' : 'Google Sheet & Local Duplicate Check'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Key Identifiers */}
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 space-y-2">
            {data.serialNumber && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Meter / Device Serial No:</span>
                <span className="font-mono font-bold text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded-md">
                  #{data.serialNumber}
                </span>
              </div>
            )}
            {data.recordId && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Record ID:</span>
                <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-amber-200 text-[11px] truncate max-w-[200px]">
                  {data.recordId}
                </span>
              </div>
            )}
            {data.technicianName && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Entered By:</span>
                <span className="font-bold text-slate-800">{data.technicianName}</span>
              </div>
            )}
            {data.siteName && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Site Name:</span>
                <span className="font-bold text-slate-800">{data.siteName}</span>
              </div>
            )}
          </div>

          {/* Detailed Message in Hindi + English */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-medium text-slate-800">
                {data.reason}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Queue Status:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {data.actionTaken}
              </span>
            </div>
          </div>

          {/* Clarification Note */}
          <p className="text-[11px] text-slate-500 italic text-center">
            Google Sheets me double entry hone se bachane ke liye is record ko block ya queue se remove kar diya gaya hai.
          </p>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
          >
            Got It / Theek Hai
          </button>
        </div>
      </div>
    </div>
  );
};
