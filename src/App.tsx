/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Activity,
  Wifi,
  WifiOff,
  Gauge,
  RadioTower,
  Server,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  UserCheck,
  Download,
  Sparkles,
} from 'lucide-react';
import { WorkRecord, MeterInstallationRecord, InfraInstallationRecord } from './types';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { MeterInstallationForm } from './components/MeterInstallationForm';
import { InfraInstallationForm } from './components/InfraInstallationForm';
import { QueueManager } from './components/QueueManager';
import { HistoryManager } from './components/HistoryManager';
import { SettingsModal } from './components/SettingsModal';
import { PhotoModal } from './components/PhotoModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GoogleAppsScriptModal } from './components/GoogleAppsScriptModal';
import { TechnicianLogin } from './components/TechnicianLogin';
import { TechnicianDataExportModal } from './components/TechnicianDataExportModal';
import { AdminPortal } from './components/AdminPortal';
import { AdminAuthModal } from './components/AdminAuthModal';
import {
  getStoredQueue,
  saveStoredQueue,
  getStoredHistory,
  addToHistory,
  updateStoredHistoryItem,
  deleteStoredHistoryItem,
  clearStoredHistory,
  setStoredHistory,
  getStoredSettings,
  saveStoredSettings,
  getLoggedInTechnician,
  setLoggedInTechnician,
  triggerHaptic,
  playFeedbackSound,
} from './utils/storage';

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<'meter' | 'infra' | 'queue' | 'history'>('meter');
  const [queue, setQueue] = useState<WorkRecord[]>([]);
  const [history, setHistory] = useState<WorkRecord[]>([]);
  const [settings, setSettings] = useState(getStoredSettings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRefreshingSheet, setIsRefreshingSheet] = useState(false);
  const [hasColumnCData, setHasColumnCData] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(
    null
  );
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<string | null>(getLoggedInTechnician);
  const [lastSiteName, setLastSiteName] = useState('');
  const [lastTechnician, setLastTechnician] = useState(() => getLoggedInTechnician() || '');

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  }, []);

  const handleLogout = () => {
    triggerHaptic(30);
    setLoggedInTechnician(null);
    setCurrentUser(null);
    showToast('Logged out of technician session', 'info');
  };

  // Initialize data on mount
  useEffect(() => {
    const loadedQueue = getStoredQueue();
    const loadedHistory = getStoredHistory();
    setQueue(loadedQueue);
    setHistory(loadedHistory);

    // Fetch technicians from Google Apps Script if online
    fetchRemoteTechnicians();

    // Check if shared link was loaded
    if (typeof window !== 'undefined' && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedScript = urlParams.get('scriptUrl') || urlParams.get('script') || urlParams.get('api');
        if (sharedScript && sharedScript.trim().startsWith('http')) {
          showToast('Google Sheet link auto-connected from shared link!', 'success');
        }
      } catch {}
    }
  }, []);

  // Save queue changes to localStorage
  const updateQueue = (newQueue: WorkRecord[]) => {
    setQueue(newQueue);
    saveStoredQueue(newQueue);
  };

  const fetchRemoteTechnicians = async (isManual = false) => {
    if (!navigator.onLine) {
      if (isManual) showToast('Device is offline. Using cached data.', 'warning');
      return;
    }
    try {
      setIsRefreshingSheet(true);
      const currentUrl = settings.scriptUrl;
      const res = await fetch(`${currentUrl}?action=getTechnicians`, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'success') {
        const remoteMakes = data.meterMakes || data.makes || data.newMeterMakes || data.columnC;
        const hasMakes = Array.isArray(remoteMakes) && remoteMakes.length > 0;
        setHasColumnCData(hasMakes);

        const remoteCompanies = data.companies || data.company || data.columnD;
        const hasCompanies = Array.isArray(remoteCompanies) && remoteCompanies.length > 0;

        const remoteVerticals = data.verticals || data.vertical || data.columnE;
        const hasVerticals = Array.isArray(remoteVerticals) && remoteVerticals.length > 0;

        setSettings((prev) => {
          const updated = { ...prev };
          if (Array.isArray(data.technicians) && data.technicians.length > 0) {
            updated.technicians = data.technicians;
          }
          // Only use what exists in Google Sheet
          const legacyMakes = ['Genus', 'Secure', 'L&T', 'HPL', 'Schneider', 'Avon'];
          if (hasMakes) {
            updated.meterMakes = remoteMakes;
          } else if (data.hasOwnProperty('meterMakes') || data.hasOwnProperty('columnC') || data.hasOwnProperty('makes') || (updated.meterMakes && updated.meterMakes.every((m: string) => legacyMakes.includes(m)))) {
            updated.meterMakes = [];
          }

          const legacyCompanies = ['Genus Power Infrastructures', 'Tata Power', 'BSES Rajdhani', 'BSES Yamuna', 'Secure Meters', 'Adani Electricity'];
          if (hasCompanies) {
            updated.companies = remoteCompanies;
          } else if (data.hasOwnProperty('companies') || data.hasOwnProperty('columnD') || data.hasOwnProperty('company') || (updated.companies && updated.companies.every((c: string) => legacyCompanies.includes(c)))) {
            updated.companies = [];
          }

          const legacyVerticals = ['PPM', 'PVVNL', 'PuVVNL', 'MVVNL', 'DVVNL', 'NPCL', 'BB', 'ATL'];
          if (hasVerticals) {
            updated.verticals = remoteVerticals;
          } else if (data.hasOwnProperty('verticals') || data.hasOwnProperty('columnE') || data.hasOwnProperty('vertical') || (updated.verticals && updated.verticals.every((v: string) => legacyVerticals.includes(v)))) {
            updated.verticals = [];
          }

          if (Array.isArray(data.existingMeterNos)) {
            updated.existingMeterNos = data.existingMeterNos;
          }
          if (Array.isArray(data.existingDeviceNos)) {
            updated.existingDeviceNos = data.existingDeviceNos;
          }
          if (data.sheetStats && typeof data.sheetStats === 'object') {
            updated.sheetStats = {
              totalMeterInstall: Number(data.sheetStats.totalMeterInstall) || 0,
              todayMeterInstall: Number(data.sheetStats.todayMeterInstall) || 0,
              totalInfraInstall: Number(data.sheetStats.totalInfraInstall) || 0,
              todayInfraInstall: Number(data.sheetStats.todayInfraInstall) || 0,
            };
          }

          // Column B: Passwords
          const remotePasswords = data.technicianPasswords || data.passwords;
          const passMap: Record<string, string> = {};
          if (remotePasswords && typeof remotePasswords === 'object') {
            Object.assign(passMap, remotePasswords);
          }
          if (Array.isArray(data.technicianAccounts)) {
            data.technicianAccounts.forEach((acc: { name: string; password?: string }) => {
              if (acc && acc.name && acc.password) {
                passMap[acc.name] = String(acc.password).trim();
              }
            });
          }
          // Fallback to existing passwords only if remote returned nothing
          if (Object.keys(passMap).length === 0 && prev.technicianPasswords) {
            updated.technicianPasswords = prev.technicianPasswords;
          } else {
            updated.technicianPasswords = passMap;
          }

          saveStoredSettings(updated);
          return updated;
        });

        // Merge remote records from Google Sheets into local history
        if (Array.isArray(data.sheetRecords) && data.sheetRecords.length > 0) {
          const currentHist = getStoredHistory();
          const histMap = new Map<string, WorkRecord>();
          // Existing local records
          currentHist.forEach((r) => {
            const key = r.id || `${r.type}_${r.timestamp}_${(r as any).newMeterNo || (r as any).deviceNo || ''}`;
            histMap.set(key, r);
          });
          // Merge remote records from Google Sheets
          data.sheetRecords.forEach((remoteRec: WorkRecord) => {
            const key = remoteRec.id || `${remoteRec.type}_${remoteRec.timestamp}_${(remoteRec as any).newMeterNo || (remoteRec as any).deviceNo || ''}`;
            histMap.set(key, remoteRec);
          });
          const merged = Array.from(histMap.values());
          setStoredHistory(merged);
          setHistory(merged);
        }

        if (isManual) {
          playFeedbackSound('success');
          triggerHaptic([30, 40]);
          const techCount = data.technicians?.length || 0;
          const compCount = hasCompanies ? remoteCompanies.length : 0;
          const vertCount = hasVerticals ? remoteVerticals.length : 0;
          const makeCount = hasMakes ? remoteMakes.length : 0;
          const recCount = Array.isArray(data.sheetRecords) ? data.sheetRecords.length : 0;
          showToast(`Synced! ${techCount} techs, ${compCount} companies, ${vertCount} verticals, ${makeCount} makes${recCount > 0 ? `, ${recCount} sheet records` : ''}`, 'success');
        }
      } else {
        if (isManual) {
          showToast(data?.message || 'Unexpected response from Google Sheet', 'warning');
        }
      }
    } catch {
      if (isManual) showToast('Could not reach Google Apps Script. Check network or URL.', 'warning');
    } finally {
      setIsRefreshingSheet(false);
    }
  };

  // Sync Queue to Google Apps Script
  const triggerSync = async () => {
    if (queue.length === 0 || !isOnline || isSyncing) return;

    setIsSyncing(true);
    triggerHaptic([30, 50, 30]);

    try {
      // POST using no-cors mode for Google Apps Script redirects
      await fetch(settings.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue),
      });

      // Successful sync
      const syncedCount = queue.length;
      addToHistory(queue);
      setHistory(getStoredHistory());
      updateQueue([]);

      playFeedbackSound('success');
      triggerHaptic([50, 80, 50, 100]);
      
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.8 },
      });

      showToast(`Synced ${syncedCount} record${syncedCount > 1 ? 's' : ''} to Google Sheets!`, 'success');
    } catch (error) {
      console.error('Sync failed', error);
      playFeedbackSound('error');
      showToast('Sync failed. Please check your internet connection.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatic background sync only when transitioning from offline to online
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline && queue.length > 0 && settings.autoSync) {
      const timer = setTimeout(() => {
        triggerSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, queue.length, settings.autoSync]);

  // Auto-sync dropdowns from Google Sheet in background when opening meter or infra form
  useEffect(() => {
    if (activeTab === 'meter' || activeTab === 'infra') {
      fetchRemoteTechnicians(false);
    }
  }, [activeTab]);

  // Periodic background auto-sync every 45s and on window visibility/focus
  useEffect(() => {
    if (!settings.scriptUrl) return;

    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetchRemoteTechnicians(false);
      }
    }, 45000);

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchRemoteTechnicians(false);
      }
    };
    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('focus', onFocusOrVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('focus', onFocusOrVisible);
    };
  }, [settings.scriptUrl]);

  // Handle Form Submission (Meter or Infra) - Ultra-Fast Instant Save
  const handleFormSubmit = async (
    data: Omit<MeterInstallationRecord, 'id'> | Omit<InfraInstallationRecord, 'id'>
  ) => {
    setIsSubmitting(true);
    const finalTech = currentUser || data.technicianName;
    const newRecord: WorkRecord = {
      ...data,
      technicianName: finalTech,
      ...(data.type === 'InfraInstallation' ? { deviceLocation: data.towerNo } : {}),
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: isOnline ? 'synced' : 'pending',
    } as WorkRecord;

    // 1. Immediately save field memory
    setLastSiteName(data.siteName);
    setLastTechnician(finalTech);

    // 2. Immediately save to local history (Zero data loss guarantee)
    addToHistory([newRecord]);
    setHistory(getStoredHistory());

    // 3. Instant tactile & audio feedback in ~40ms
    playFeedbackSound('success');
    triggerHaptic(40);
    showToast(isOnline ? 'Saved! Syncing to Google Sheet... ⚡' : 'Saved offline successfully! ⚡', 'success');

    // 4. Release UI lock instantly so form resets and technician can enter next flat immediately
    setIsSubmitting(false);

    // 5. Background sync to Google Apps Script (Non-blocking)
    if (isOnline && settings.scriptUrl) {
      fetch(settings.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newRecord]),
      })
        .then(() => {
          showToast('Google Sheet updated successfully! ✓', 'success');
        })
        .catch((err) => {
          console.warn('Background sync failed, moving to offline queue', err);
          newRecord.status = 'pending';
          const currentQueue = getStoredQueue();
          updateQueue([...currentQueue, newRecord]);
          showToast('Network unstable: saved to queue, will auto-sync', 'info');
        });
    } else {
      // Offline mode: store in sync queue
      newRecord.status = 'pending';
      const currentQueue = getStoredQueue();
      updateQueue([...currentQueue, newRecord]);
    }
  };

  const handleDeleteQueueItem = (id: string) => {
    triggerHaptic(30);
    const updated = queue.filter((item) => item.id !== id);
    updateQueue(updated);
    showToast('Record removed from queue', 'info');
  };

  const handleClearQueue = () => {
    triggerHaptic(40);
    updateQueue([]);
    showToast('Queue cleared', 'info');
  };

  const handleClearHistory = () => {
    triggerHaptic(40);
    clearStoredHistory();
    setHistory([]);
    showToast('Local history cleared', 'info');
  };

  const handleUpdateHistoryItem = async (updatedItem: WorkRecord) => {
    triggerHaptic(30);
    updateStoredHistoryItem(updatedItem);
    setHistory((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));

    if (navigator.onLine && settings.scriptUrl) {
      try {
        const payload = {
          action: 'updateRecord',
          record: updatedItem,
        };
        // Dual-channel sync: POST text/plain + GET query
        await fetch(settings.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        try {
          const getUrl = `${settings.scriptUrl}?action=updateRecord&payload=${encodeURIComponent(JSON.stringify(payload))}`;
          await fetch(getUrl, { method: 'GET', mode: 'no-cors' });
        } catch {
          // ignore get fallback error
        }

        playFeedbackSound('success');
        showToast('Updated in Google Sheet & History!', 'success');
      } catch (err) {
        console.warn('Google Sheet update error', err);
        showToast('Updated locally in History', 'info');
      }
    } else {
      showToast('Record updated in local history', 'success');
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    triggerHaptic(30);
    const itemToDelete = history.find((item) => item.id === id);
    deleteStoredHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));

    if (navigator.onLine && settings.scriptUrl && itemToDelete) {
      try {
        const payload = {
          action: 'deleteRecord',
          recordId: id,
          type: itemToDelete.type,
          newMeterNo: (itemToDelete as any).newMeterNo || '',
          deviceNo: (itemToDelete as any).deviceNo || '',
          timestamp: itemToDelete.installationDate || itemToDelete.timestamp || '',
          technicianName: itemToDelete.technicianName || '',
        };
        // Dual-channel sync: POST text/plain + GET query
        await fetch(settings.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        try {
          const getUrl = `${settings.scriptUrl}?action=deleteRecord&payload=${encodeURIComponent(JSON.stringify(payload))}`;
          await fetch(getUrl, { method: 'GET', mode: 'no-cors' });
        } catch {
          // ignore get fallback error
        }

        playFeedbackSound('click');
        showToast('Deleted from Google Sheet & History!', 'success');
      } catch (err) {
        console.warn('Google Sheet delete error', err);
        showToast('Deleted from local history', 'info');
      }
    } else {
      showToast('Record deleted from local history', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col items-center w-full overflow-x-hidden">
      {/* Responsive Auto-Resizing Container: Fluid 100% on phone, spacious multi-column dashboard on tablet & laptop */}
      <div className="w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl min-h-screen bg-slate-50 flex flex-col shadow-2xl relative border-x border-slate-200/60 pb-12 transition-all duration-300">
        {!currentUser ? (
          <div className="flex-1 flex flex-col w-full">
            {/* Header in Login Mode */}
            <header className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 text-white pt-3.5 pb-2.5 px-3 sm:px-5 shadow-md w-full">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="p-1.5 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight truncate">
                      Meter &amp; Infra
                    </h1>
                    <p className="text-[10px] text-indigo-100/90 font-medium truncate">Field Work Tracker</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide transition-colors ${
                      isOnline
                        ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40'
                        : 'bg-rose-500/25 text-rose-100 border border-rose-400/40'
                    }`}
                  >
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3 text-emerald-300" />
                        <span className="hidden sm:inline">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-300" />
                        <span className="hidden sm:inline">Offline</span>
                      </>
                    )}
                  </div>

                  <PWAInstallButton />

                  {/* Sync Google Sheet Dropdowns & Passwords */}
                  <button
                    type="button"
                    onClick={() => fetchRemoteTechnicians(true)}
                    disabled={isRefreshingSheet || !isOnline}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 disabled:opacity-40 shrink-0 cursor-pointer"
                    title="Sync Technicians, Passwords & Meter Makes from Google Sheet"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshingSheet ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setIsAdminAuthModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Open Admin Portal (Password Protected)"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-2 sm:p-5 w-full">
              <TechnicianLogin
                settings={settings}
                onLoginSuccess={(techName) => {
                  setLoggedInTechnician(techName);
                  setCurrentUser(techName);
                  setLastTechnician(techName);
                  setActiveTab('meter');
                  showToast(`Welcome, ${techName}!`, 'success');
                }}
                onRefreshTechnicians={() => fetchRemoteTechnicians(true)}
                isRefreshing={isRefreshingSheet}
                isOnline={isOnline}
                onOpenAdminPortal={() => setIsAdminAuthModalOpen(true)}
              />
            </main>
          </div>
        ) : (
          <>
            {/* App Header with Active Technician Session */}
            <header className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 text-white pt-3 pb-2.5 px-3 sm:px-5 sticky top-0 z-30 shadow-md w-full">
              {/* Top Bar: Title & Connectivity Badge & Controls */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="p-1.5 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight truncate">
                      Meter &amp; Infra
                    </h1>
                    <p className="text-[10px] text-indigo-100/90 font-medium truncate">Field Work Tracker</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Online / Offline Status Badge */}
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide transition-colors ${
                      isOnline
                        ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40'
                        : 'bg-rose-500/25 text-rose-100 border border-rose-400/40'
                    }`}
                  >
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3 text-emerald-300" />
                        <span className="hidden sm:inline">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-300" />
                        <span className="hidden sm:inline">Offline</span>
                      </>
                    )}
                  </div>

                  {/* Install PWA Button if prompt available */}
                  <PWAInstallButton />

                  {/* Sync Google Sheet Dropdowns & Passwords */}
                  <button
                    type="button"
                    onClick={() => fetchRemoteTechnicians(true)}
                    disabled={isRefreshingSheet || !isOnline}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 disabled:opacity-40 shrink-0 cursor-pointer"
                    title="Sync Technicians, Passwords & Meter Makes from Google Sheet"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshingSheet ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Admin Portal Button - Password Protected */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setIsAdminAuthModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Open Admin Portal (Password Protected)"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              {/* Technician Session Pill */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 bg-black/20 border border-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl mb-2 text-xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="w-5 h-5 rounded-full bg-white text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs">
                    {currentUser.charAt(0)}
                  </span>
                  <div className="truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-indigo-200 text-[10px] uppercase font-semibold shrink-0">Technician:</span>
                    <span className="font-bold text-white text-xs truncate">{currentUser}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setIsExportModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-[10px] sm:text-[11px] font-bold text-white shadow-xs transition cursor-pointer"
                    title="Date Range Wise Download My CSV Data"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-rose-600/80 active:scale-95 text-[10px] sm:text-[11px] font-semibold text-white transition cursor-pointer"
                    title="Logout / Switch technician"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="flex items-center gap-1 bg-indigo-800/40 p-1 rounded-xl backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTab('meter');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'meter'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Meter</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTab('infra');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'infra'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <RadioTower className="w-3.5 h-3.5" />
                  <span>Infra</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTab('queue');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all relative ${
                    activeTab === 'queue'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Queue</span>
                  {queue.length > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        activeTab === 'queue'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-amber-400 text-slate-900'
                      }`}
                    >
                      {queue.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTab('history');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'history'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>
              </nav>
            </header>

            {/* Sync Status Banner if queue has pending items */}
            {queue.length > 0 && activeTab !== 'queue' && (
              <div
                onClick={() => setActiveTab('queue')}
                className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-900 cursor-pointer hover:bg-amber-500/25 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span className="font-semibold">
                    {queue.length} item{queue.length > 1 ? 's' : ''} stored offline
                  </span>
                </div>
                <span className="text-amber-800 font-bold underline text-[11px]">
                  {isOnline ? 'Tap to Sync' : 'View Queue'} &rarr;
                </span>
              </div>
            )}

            {/* Main Body Content */}
            <main className="flex-1 p-3.5 sm:p-4 space-y-4 overflow-y-auto">
              {activeTab === 'meter' && (
                <MeterInstallationForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isSubmitting}
                  isOnline={isOnline}
                  technicians={settings.technicians}
                  meterMakes={settings.meterMakes || []}
                  companies={settings.companies || []}
                  verticals={settings.verticals}
                  defaultTechnician={currentUser || ''}
                  defaultSiteName={lastSiteName}
                  onSiteNameChange={setLastSiteName}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                  onRefreshSheet={() => fetchRemoteTechnicians(true)}
                  isRefreshingSheet={isRefreshingSheet}
                  onOpenScriptModal={() => setIsScriptModalOpen(true)}
                  hasColumnCData={hasColumnCData}
                  existingRecords={[...history, ...queue].filter(
                    (r): r is MeterInstallationRecord => r.type === 'MeterInstallation'
                  )}
                  sheetExistingMeterNos={settings.existingMeterNos || []}
                />
              )}

              {activeTab === 'infra' && (
                <InfraInstallationForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isSubmitting}
                  isOnline={isOnline}
                  technicians={settings.technicians}
                  companies={settings.companies || []}
                  verticals={settings.verticals}
                  defaultTechnician={currentUser || ''}
                  defaultSiteName={lastSiteName}
                  onSiteNameChange={setLastSiteName}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                  existingRecords={[...history, ...queue].filter(
                    (r): r is InfraInstallationRecord => r.type === 'InfraInstallation'
                  )}
                  sheetExistingDeviceNos={settings.existingDeviceNos || []}
                />
              )}

              {activeTab === 'queue' && (
                <QueueManager
                  queue={queue}
                  isSyncing={isSyncing}
                  isOnline={isOnline}
                  onSync={triggerSync}
                  onDeleteItem={handleDeleteQueueItem}
                  onClearQueue={handleClearQueue}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                />
              )}

              {activeTab === 'history' && (
                <HistoryManager
                  history={history}
                  currentUser={currentUser}
                  onClearHistory={handleClearHistory}
                  onUpdateItem={handleUpdateHistoryItem}
                  onDeleteItem={handleDeleteHistoryItem}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                />
              )}
            </main>
          </>
        )}

        {/* Global Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-xs w-full px-4 animate-in slide-in-from-bottom duration-300">
            <div
              className={`p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold text-white ${
                toast.type === 'success'
                  ? 'bg-slate-900 border border-slate-700'
                  : toast.type === 'warning'
                  ? 'bg-amber-600 border border-amber-500'
                  : 'bg-indigo-600 border border-indigo-500'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : toast.type === 'warning' ? (
                <AlertCircle className="w-4 h-4 text-white shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-indigo-200 shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Admin Password Authentication Lock Modal */}
        <AdminAuthModal
          isOpen={isAdminAuthModalOpen}
          onClose={() => setIsAdminAuthModalOpen(false)}
          configuredPassword={settings.adminPassword || 'admin'}
          onSuccess={() => {
            setIsAdminAuthModalOpen(false);
            setIsAdminPortalOpen(true);
            showToast('Admin Portal Unlocked', 'success');
          }}
        />

        {/* Admin Portal Modal */}
        <AdminPortal
          isOpen={isAdminPortalOpen}
          onClose={() => setIsAdminPortalOpen(false)}
          settings={settings}
          onSaveSettings={(newSettings) => {
            setSettings(newSettings);
            saveStoredSettings(newSettings);
            showToast('Admin configuration saved', 'success');
          }}
          history={history}
          isOnline={isOnline}
          onRefreshData={() => fetchRemoteTechnicians(true)}
          isRefreshing={isRefreshingSheet}
          onOpenScriptGuide={() => setIsScriptModalOpen(true)}
          onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
        />

        {/* Photo Lightbox Modal */}
        <PhotoModal
          isOpen={!!previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          imageUrl={previewPhoto?.url || null}
          title={previewPhoto?.title || 'Photo Inspection'}
        />

        {/* Google Apps Script Setup & Code Modal */}
        <GoogleAppsScriptModal
          isOpen={isScriptModalOpen}
          onClose={() => setIsScriptModalOpen(false)}
          scriptUrl={settings.scriptUrl}
        />

        {/* Technician Self-Download Date Range CSV Modal */}
        <TechnicianDataExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          currentUser={currentUser}
          history={history}
          queue={queue}
        />
      </div>
    </div>
  );
}
