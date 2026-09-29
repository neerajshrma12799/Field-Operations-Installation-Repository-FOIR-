import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Database,
  Search,
} from 'lucide-react';
import { WorkRecord } from '../types';
import { exportRecordsToCSV, triggerHaptic, playFeedbackSound } from '../utils/storage';
import { isDateInRange } from '../utils/timestamp';

interface TechnicianDataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string | null;
  history: WorkRecord[];
  queue: WorkRecord[];
}

export const TechnicianDataExportModal: React.FC<TechnicianDataExportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  history,
  queue,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workType, setWorkType] = useState<'all' | 'meter' | 'infra'>('all');
  const [includeQueue, setIncludeQueue] = useState(true);
  const [activePreset, setActivePreset] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month'>('all');

  const pad = (n: number) => String(n).padStart(2, '0');
  const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const setPreset = (preset: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month') => {
    triggerHaptic(20);
    setActivePreset(preset);
    const today = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const ymd = toYMD(today);
      setStartDate(ymd);
      setEndDate(ymd);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const ymd = toYMD(y);
      setStartDate(ymd);
      setEndDate(ymd);
    } else if (preset === 'this_week') {
      const weekStart = new Date(today);
      const day = weekStart.getDay() || 7;
      weekStart.setDate(weekStart.getDate() - (day - 1));
      setStartDate(toYMD(weekStart));
      setEndDate(toYMD(today));
    } else if (preset === 'this_month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toYMD(monthStart));
      setEndDate(toYMD(today));
    }
  };

  // Combine history + optionally unsynced queue items
  const combinedRecords = useMemo(() => {
    const list: WorkRecord[] = [...history];
    if (includeQueue && queue.length > 0) {
      list.push(...queue);
    }
    return list;
  }, [history, queue, includeQueue]);

  // Filter records strictly for the current logged-in technician
  const filteredRecords = useMemo(() => {
    return combinedRecords.filter((rec) => {
      // 1. Current technician filter
      if (currentUser) {
        if (rec.technicianName?.trim().toLowerCase() !== currentUser.trim().toLowerCase()) {
          return false;
        }
      }

      // 2. Type filter
      if (workType === 'meter' && rec.type !== 'MeterInstallation') return false;
      if (workType === 'infra' && rec.type !== 'InfraInstallation') return false;

      // 3. Date range filter
      const timestamp = rec.installationDate || rec.timestamp;
      if (!isDateInRange(timestamp, startDate, endDate)) {
        return false;
      }

      return true;
    });
  }, [combinedRecords, currentUser, workType, startDate, endDate]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (filteredRecords.length === 0) {
      alert('No records found for the selected date range.');
      return;
    }

    triggerHaptic([30, 50, 30]);
    playFeedbackSound('success');

    const csvContent = exportRecordsToCSV(filteredRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const safeName = (currentUser || 'technician').replace(/\s+/g, '_');
    const rangeName = startDate || endDate ? `_${startDate || 'start'}_to_${endDate || 'now'}` : '_all_dates';
    link.setAttribute('download', `${safeName}_work_data${rangeName}_${Date.now()}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Download My Work Data (CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Technician: <strong className="text-slate-800">{currentUser || 'Current Technician'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Date Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Date Range (Indian IST)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'all', label: 'All Dates' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 border ${
                  activePreset === p.id && (p.id === 'all' ? !startDate && !endDate : true)
                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Start & End Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Start Date (From)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('all');
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              End Date (To)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('all');
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Work Type Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" /> Work Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'All Work' },
              { id: 'meter', label: 'Meter Work' },
              { id: 'infra', label: 'Infra Work' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setWorkType(t.id as any);
                }}
                className={`py-2 text-xs font-semibold rounded-xl border transition active:scale-95 ${
                  workType === t.id
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Include Pending Offline Queue checkbox */}
        <div className="pt-1">
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              checked={includeQueue}
              onChange={(e) => setIncludeQueue(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span>Include pending offline work records waiting to sync</span>
          </label>
        </div>

        {/* Summary Card */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-indigo-950">
              Found {filteredRecords.length} records
            </div>
            <div className="text-[11px] text-indigo-700">
              {startDate || endDate
                ? `${startDate || 'Beginning'} → ${endDate || 'Today'}`
                : 'All available work history'}
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            CSV Ready
          </span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download CSV ({filteredRecords.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
