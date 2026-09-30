import React, { useState, useMemo } from 'react';
import {
  History,
  CheckCircle2,
  Trash2,
  Gauge,
  RadioTower,
  Clock,
  MapPin,
  Search,
  FileSpreadsheet,
  Calendar,
  Filter,
  Edit3,
  X,
  Save,
  Check,
  Building2,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { WorkRecord, MeterInstallationRecord, InfraInstallationRecord } from '../types';
import { exportRecordsToCSV, triggerHaptic } from '../utils/storage';
import {
  isDateInRange,
  isMeterRecord,
  isInfraRecord,
  isRecordToday,
  parseInfraQty,
  getTodayYMD,
  getYesterdayYMD,
} from '../utils/timestamp';

interface HistoryManagerProps {
  history: WorkRecord[];
  currentUser?: string | null;
  onClearHistory: () => void;
  onUpdateItem?: (record: WorkRecord) => void;
  onDeleteItem?: (id: string) => void;
  onPreviewPhoto: (url: string, title: string) => void;
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  history,
  currentUser,
  onClearHistory,
  onUpdateItem,
  onDeleteItem,
  onPreviewPhoto,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'meter' | 'infra'>('all');

  // Initialize dates strictly to Today (Current Day)
  const getTodayYMD = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  };

  const [startDate, setStartDate] = useState<string>(() => getTodayYMD());
  const [endDate, setEndDate] = useState<string>(() => getTodayYMD());
  const [showDateRangeFilter, setShowDateRangeFilter] = useState(false);

  // Edit / Modify Modal State
  const [editingItem, setEditingItem] = useState<WorkRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<WorkRecord | null>(null);

  // Quick Date Range Shortcuts
  const setDatePreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all') => {
    triggerHaptic(20);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setShowDateRangeFilter(false);
    } else if (preset === 'today') {
      const formatted = toYMD(today);
      setStartDate(formatted);
      setEndDate(formatted);
      setShowDateRangeFilter(false);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const formatted = toYMD(y);
      setStartDate(formatted);
      setEndDate(formatted);
      setShowDateRangeFilter(false);
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

  const filteredHistory = history.filter((item) => {
    // 1. Strictly show logged-in technician's records (match if present)
    if (currentUser) {
      const itemTech = item.technicianName?.trim().toLowerCase();
      const currentTech = currentUser.trim().toLowerCase();
      if (itemTech && itemTech !== currentTech) {
        return false;
      }
    }

    // 2. Work Type Filter
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'meter' && item.type === 'MeterInstallation') ||
      (filterType === 'infra' && item.type === 'InfraInstallation');

    if (!matchesFilter) return false;

    // 3. Current Day / Date Filter (Defaults strictly to Today)
    const timestampToCheck = item.installationDate || item.timestamp;
    if (!isDateInRange(timestampToCheck, startDate, endDate)) {
      return false;
    }

    // 4. Search Filter
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const commonMatch =
      item.siteName?.toLowerCase().includes(term) ||
      (item.company && item.company.toLowerCase().includes(term)) ||
      (item.vertical && item.vertical.toLowerCase().includes(term)) ||
      item.timestamp?.toLowerCase().includes(term) ||
      (item.installationDate && item.installationDate.toLowerCase().includes(term));

    if (commonMatch) return true;

    if (item.type === 'MeterInstallation') {
      return (
        item.newMeterNo?.toLowerCase().includes(term) ||
        item.flatNo?.toLowerCase().includes(term) ||
        (item.oldMeterNo && item.oldMeterNo.toLowerCase().includes(term)) ||
        (item.newMeterMake && item.newMeterMake.toLowerCase().includes(term)) ||
        (item.remark && item.remark.toLowerCase().includes(term))
      );
    } else {
      return (
        item.deviceNo?.toLowerCase().includes(term) ||
        (item.deviceLocation && item.deviceLocation.toLowerCase().includes(term)) ||
        item.towerNo?.toLowerCase().includes(term) ||
        (item.remark && item.remark.toLowerCase().includes(term))
      );
    }
  });

  const handleExportCSV = () => {
    triggerHaptic(30);
    const csv = exportRecordsToCSV(filteredHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const techPrefix = currentUser ? `${currentUser.replace(/\s+/g, '_')}_` : '';
    const dateRangeSuffix = startDate || endDate ? `_${startDate || 'start'}_to_${endDate || 'now'}` : '';
    link.setAttribute('download', `${techPrefix}work_records${dateRangeSuffix}_${Date.now()}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStartEdit = (item: WorkRecord) => {
    triggerHaptic(25);
    setEditingItem(item);
    if (item.type === 'MeterInstallation') {
      setEditFormData({
        siteName: item.siteName || '',
        flatNo: item.flatNo || '',
        oldMeterNo: item.oldMeterNo || '',
        oldMeterMake: item.oldMeterMake || '',
        newMeterNo: item.newMeterNo || '',
        newMeterMake: item.newMeterMake || '',
        company: item.company || '',
        vertical: item.vertical || '',
        remark: item.remark || '',
      });
    } else {
      setEditFormData({
        siteName: item.siteName || '',
        towerNo: item.towerNo || item.deviceLocation || '',
        deviceNo: item.deviceNo || '',
        infraQty: item.infraQty || '1',
        company: item.company || '',
        vertical: item.vertical || '',
        remark: item.remark || '',
      });
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !onUpdateItem) return;

    if (editingItem.type === 'MeterInstallation') {
      const updated: MeterInstallationRecord = {
        ...(editingItem as MeterInstallationRecord),
        siteName: editFormData.siteName || editingItem.siteName,
        flatNo: editFormData.flatNo || (editingItem as MeterInstallationRecord).flatNo,
        oldMeterNo: editFormData.oldMeterNo || (editingItem as MeterInstallationRecord).oldMeterNo,
        oldMeterMake: editFormData.oldMeterMake || (editingItem as MeterInstallationRecord).oldMeterMake,
        newMeterNo: editFormData.newMeterNo || (editingItem as MeterInstallationRecord).newMeterNo,
        newMeterMake: editFormData.newMeterMake || (editingItem as MeterInstallationRecord).newMeterMake,
        company: editFormData.company || editingItem.company,
        vertical: editFormData.vertical || editingItem.vertical,
        remark: editFormData.remark !== undefined ? editFormData.remark : editingItem.remark,
      };
      (updated as any).originalNewMeterNo = (editingItem as MeterInstallationRecord).newMeterNo;
      onUpdateItem(updated);
    } else {
      const updated: InfraInstallationRecord = {
        ...(editingItem as InfraInstallationRecord),
        siteName: editFormData.siteName || editingItem.siteName,
        towerNo: editFormData.towerNo || (editingItem as InfraInstallationRecord).towerNo,
        deviceLocation: editFormData.towerNo || (editingItem as InfraInstallationRecord).deviceLocation,
        deviceNo: editFormData.deviceNo || (editingItem as InfraInstallationRecord).deviceNo,
        infraQty: editFormData.infraQty || (editingItem as InfraInstallationRecord).infraQty,
        company: editFormData.company || editingItem.company,
        vertical: editFormData.vertical || editingItem.vertical,
        remark: editFormData.remark !== undefined ? editFormData.remark : editingItem.remark,
      };
      (updated as any).originalDeviceNo = (editingItem as InfraInstallationRecord).deviceNo;
      onUpdateItem(updated);
    }

    setEditingItem(null);
  };

  const confirmDelete = () => {
    if (itemToDelete && onDeleteItem) {
      triggerHaptic(30);
      onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const isTodayActive = !showDateRangeFilter && startDate === getTodayYMD() && endDate === getTodayYMD();
  const isYesterdayActive = !showDateRangeFilter && startDate === getYesterdayYMD() && endDate === getYesterdayYMD();
  const isAllDaysActive = !showDateRangeFilter && !startDate && !endDate;
  const isCustomActive = showDateRangeFilter || (Boolean(startDate || endDate) && !isTodayActive && !isYesterdayActive);

  // Accurate Meter count & Infra sum (Col H)
  const stats = useMemo(() => {
    let meters = 0;
    let infraQtySum = 0;
    let todayMeters = 0;
    let todayInfraQtySum = 0;

    filteredHistory.forEach((r) => {
      const isToday = isRecordToday(r);
      if (isMeterRecord(r)) {
        meters += 1;
        if (isToday) todayMeters += 1;
      } else if (isInfraRecord(r)) {
        const q = parseInfraQty((r as any).infraQty);
        infraQtySum += q;
        if (isToday) todayInfraQtySum += q;
      }
    });

    return {
      meters,
      infraQtySum,
      todayMeters,
      todayInfraQtySum,
      totalCombined: meters + infraQtySum,
      todayCombined: todayMeters + todayInfraQtySum,
    };
  }, [filteredHistory]);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  My Work History
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    {filteredHistory.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Logged in as <strong className="text-indigo-700">{currentUser || 'Technician'}</strong>
                  {isTodayActive ? " • Today's Verified Work Log" : ' • Filtered Records'}
                </p>
              </div>
            </div>

            {/* Quick Metrics Bar: Meter Count & Infra Qty Sum */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                Meters: <strong>{stats.meters}</strong>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                Infra Qty: <strong>{stats.infraQtySum}</strong> (sum)
              </span>
              {stats.todayCombined > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  Today: <strong>{stats.todayMeters}</strong> M + <strong>{stats.todayInfraQtySum}</strong> I
                </span>
              )}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                Total Output: <strong>{stats.totalCombined}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {filteredHistory.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export CSV
              </button>
            )}

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all local history logs? (Online Google Sheet data will not be affected)')) {
                    onClearHistory();
                  }
                }}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                title="Clear all local history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by site, meter/device no, location, remark..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  filterType === 'all' ? 'bg-white text-indigo-600 font-bold shadow-xs' : ''
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('meter')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  filterType === 'meter' ? 'bg-white text-indigo-600 font-bold shadow-xs' : ''
                }`}
              >
                Meter
              </button>
              <button
                type="button"
                onClick={() => setFilterType('infra')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  filterType === 'infra' ? 'bg-white text-indigo-600 font-bold shadow-xs' : ''
                }`}
              >
                Infra
              </button>
            </div>
          </div>

          {/* Quick Date Filters (Today is Default) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Date:
              </span>
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  isTodayActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Today (Current Day)
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('yesterday')}
                className={`px-2.5 py-1.5 rounded-xl font-medium transition border ${
                  isYesterdayActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('all')}
                className={`px-2.5 py-1.5 rounded-xl font-medium transition border ${
                  isAllDaysActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Days
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setShowDateRangeFilter(!showDateRangeFilter);
              }}
              className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition border ${
                isCustomActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 ${isCustomActive ? 'text-white' : 'text-indigo-600'}`} />
              <span>Custom Date</span>
            </button>
          </div>

          {/* Custom Date Pickers Drawer */}
          {showDateRangeFilter && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-600" /> Custom Date Range
                </span>
                <button
                  type="button"
                  onClick={() => setDatePreset('today')}
                  className="text-[11px] text-indigo-600 hover:underline font-bold"
                >
                  Reset to Today
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                    From Date (Start)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                    To Date (End)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-sm space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isTodayActive ? "No Work Records for Today Yet" : "No Records Found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isTodayActive
              ? "Aaj aapne jo installations verify kiye hain woh yahan show honge. Purana data dekhne ke liye 'All Days' ya 'Custom Date' select karein."
              : "Selected date range ya filter ke sath koi record match nahi hua."}
          </p>
          {history.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDatePreset('all')}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <span>Show All Days ({history.length} Total Records)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHistory.map((item, index) => {
            const isMeter = item.type === 'MeterInstallation';
            return (
              <div
                key={item.id || index}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* 1. Header Bar: Type, Badges & Action Buttons */}
                <div className="bg-slate-50/80 border-b border-slate-100 px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isMeter ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isMeter ? <Gauge className="w-4 h-4" /> : <RadioTower className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      {isMeter ? 'Meter Installation' : 'Infra Installation'}
                    </span>
                    {item.company && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.company}
                      </span>
                    )}
                    {item.vertical && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200/70 text-slate-700">
                        {item.vertical}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                    </span>
                  </div>

                  {/* Top Right Action Buttons: Modify & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onUpdateItem && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200/90 flex items-center gap-1 shadow-2xs transition active:scale-95"
                        title="Modify / Edit this entry"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modify</span>
                      </button>
                    )}

                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(20);
                          setItemToDelete(item);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition active:scale-95"
                        title="Delete this record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Body: Tabular Structured Data Display + Photo */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Clean Tabular / Grid Matrix */}
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {/* Site */}
                      <div className="bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Site
                        </span>
                        <span className="font-semibold text-slate-800 line-clamp-1">
                          {item.siteName}
                        </span>
                      </div>

                      {/* Location / Flat */}
                      <div className="bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          {isMeter ? 'Flat / Tower' : 'Device Location'}
                        </span>
                        <span className="font-semibold text-slate-800 line-clamp-1">
                          {isMeter ? item.flatNo : (item.deviceLocation || item.towerNo)}
                        </span>
                      </div>

                      {/* Main Identifier: Meter No / Device No */}
                      <div className="bg-indigo-50/50 rounded-xl p-2 border border-indigo-100/80 col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-700 block tracking-wider">
                          {isMeter ? 'New Meter No' : 'Device / Serial No'}
                        </span>
                        <span className="font-extrabold text-indigo-950 font-mono">
                          {isMeter ? item.newMeterNo : item.deviceNo}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Row Details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-0.5">
                      {isMeter && item.newMeterMake && (
                        <div>
                          <span className="text-slate-400 text-[11px]">Make:</span>{' '}
                          <span className="font-semibold text-slate-700">{item.newMeterMake}</span>
                        </div>
                      )}

                      {isMeter && item.oldMeterNo && (
                        <div>
                          <span className="text-slate-400 text-[11px]">Old Meter:</span>{' '}
                          <span className="font-medium text-slate-700">{item.oldMeterNo}</span>
                          {item.oldMeterMake && ` (${item.oldMeterMake})`}
                        </div>
                      )}

                      {!isMeter && item.infraQty && (
                        <div>
                          <span className="text-slate-400 text-[11px]">Qty:</span>{' '}
                          <span className="font-bold text-slate-800">{item.infraQty}</span>
                        </div>
                      )}

                      {item.remark && (
                        <div className="text-[11px] text-slate-600 bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 rounded-md">
                          <span className="font-semibold text-amber-800">Remark:</span> {item.remark}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{item.installationDate || item.timestamp}</span>
                    </div>
                  </div>

                  {/* Photo Preview Thumbnail */}
                  <div className="shrink-0 flex sm:flex-col items-center gap-1.5 self-start sm:self-center">
                    {isMeter ? (
                      <div className="flex items-center gap-1.5">
                        {item.newMeterPhoto && (
                          <div
                            onClick={() => onPreviewPhoto(item.newMeterPhoto!, 'New Meter Photo')}
                            className="group relative cursor-pointer"
                          >
                            <img
                              src={item.newMeterPhoto}
                              alt="New Meter"
                              className="w-14 h-14 object-cover rounded-xl border-2 border-indigo-200 group-hover:border-indigo-500 transition shadow-2xs"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center py-0.5 rounded-b-lg font-bold">
                              New
                            </span>
                          </div>
                        )}
                        {item.oldMeterPhoto && (
                          <div
                            onClick={() => onPreviewPhoto(item.oldMeterPhoto!, 'Old Meter Photo')}
                            className="group relative cursor-pointer"
                          >
                            <img
                              src={item.oldMeterPhoto}
                              alt="Old Meter"
                              className="w-14 h-14 object-cover rounded-xl border border-slate-200 group-hover:border-indigo-500 transition shadow-2xs"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center py-0.5 rounded-b-lg font-bold">
                              Old
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      item.devicePhoto && (
                        <div
                          onClick={() => onPreviewPhoto(item.devicePhoto!, 'Device Photo')}
                          className="group relative cursor-pointer"
                        >
                          <img
                            src={item.devicePhoto}
                            alt="Device Photo"
                            className="w-14 h-14 object-cover rounded-xl border-2 border-emerald-200 group-hover:border-emerald-500 transition shadow-2xs"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center py-0.5 rounded-b-lg font-bold">
                            Device
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-100 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Delete Record from Google Sheet &amp; History?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete this record? It will be permanently removed from <strong>Google Sheet (on same ID)</strong> and local history.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 text-left space-y-1">
              <div>
                <strong>Site:</strong> {itemToDelete.siteName}
              </div>
              <div>
                <strong>{itemToDelete.type === 'MeterInstallation' ? 'Meter No:' : 'Device No:'}</strong>{' '}
                <span className="font-mono font-bold text-indigo-700">
                  {itemToDelete.type === 'MeterInstallation' ? itemToDelete.newMeterNo : itemToDelete.deviceNo}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition active:scale-95 shadow-sm"
              >
                Yes, Delete Everywhere
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modify / Edit Record Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Modify Work Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes will update in Google Sheet &amp; History on same ID
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-5 space-y-3.5">
              {/* Site Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  value={editFormData.siteName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, siteName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {editingItem.type === 'MeterInstallation' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Flat / Tower No
                      </label>
                      <input
                        type="text"
                        value={editFormData.flatNo || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, flatNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        New Meter Number
                      </label>
                      <input
                        type="text"
                        value={editFormData.newMeterNo || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, newMeterNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        New Meter Make
                      </label>
                      <input
                        type="text"
                        value={editFormData.newMeterMake || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, newMeterMake: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Old Meter Number
                      </label>
                      <input
                        type="text"
                        value={editFormData.oldMeterNo || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, oldMeterNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Device Location / Tower
                      </label>
                      <input
                        type="text"
                        value={editFormData.towerNo || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, towerNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Device Number / Serial
                      </label>
                      <input
                        type="text"
                        value={editFormData.deviceNo || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, deviceNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Infra Quantity
                    </label>
                    <input
                      type="text"
                      value={editFormData.infraQty || '1'}
                      onChange={(e) => setEditFormData({ ...editFormData, infraQty: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {/* Company & Vertical */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={editFormData.company || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vertical
                  </label>
                  <input
                    type="text"
                    value={editFormData.vertical || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, vertical: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Remark */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Remark / Note
                </label>
                <textarea
                  value={editFormData.remark || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, remark: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional remarks..."
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
