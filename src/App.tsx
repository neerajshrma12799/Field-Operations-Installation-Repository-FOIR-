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
import { ErrorBoundary } from './components/ErrorBoundary';
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
  getMeterFormDraft,
  clearMeterFormDraft,
  getInfraFormDraft,
  clearInfraFormDraft,
  fetchServerConfig,
  saveServerConfig,
  triggerHaptic,
  playFeedbackSound,
} from './utils/storage';
import { areSerialsEqual } from './utils/timestamp';

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

  const syncLockRef = useRef(false);
  const lastFormTabRef = useRef<'meter' | 'infra'>('meter');
  useEffect(() => {
    if (activeTab === 'meter' || activeTab === 'infra') {
      lastFormTabRef.current = activeTab;
    }
  }, [activeTab]);

  const handleLogout = () => {
    triggerHaptic(30);
    const meterDraft = getMeterFormDraft();
    const infraDraft = getInfraFormDraft();
    const hasUnsavedData = Boolean(
      (meterDraft && (meterDraft.flatNo || meterDraft.newMeterNo || meterDraft.oldMeterNo)) ||
      (infraDraft && (infraDraft.towerNo || infraDraft.deviceNo))
    );

    if (hasUnsavedData) {
      const confirmLogout = window.confirm(
        'Warning: You have unsubmitted entries in your form. Are you sure you want to log out?'
      );
      if (!confirmLogout) return;
    }

    clearMeterFormDraft();
    clearInfraFormDraft();
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

    // Check if shared link was loaded
    let sharedScriptUrl: string | null = null;
    if (typeof window !== 'undefined' && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedScript = urlParams.get('scriptUrl') || urlParams.get('script') || urlParams.get('api');
        if (sharedScript && sharedScript.trim().startsWith('http')) {
          sharedScriptUrl = sharedScript.trim();
          showToast('Google Sheet link auto-connected! Syncing live data...', 'success');
        }
      } catch {}
    }

    const scriptToFetch = sharedScriptUrl || settings.scriptUrl;
    if (scriptToFetch && scriptToFetch.startsWith('http')) {
      fetchRemoteTechnicians(scriptToFetch, false);
    }

    // Check backend server for globally saved Google Sheet URL & Admin Master Password
    fetchServerConfig().then((serverCfg) => {
      if (serverCfg) {
        setSettings((prev) => {
          let hasChanges = false;
          const upd = { ...prev };
          if (serverCfg.scriptUrl && serverCfg.scriptUrl.startsWith('http') && prev.scriptUrl !== serverCfg.scriptUrl) {
            upd.scriptUrl = serverCfg.scriptUrl;
            hasChanges = true;
          }
          if (serverCfg.adminPassword && serverCfg.adminPassword.trim().length > 0 && prev.adminPassword !== serverCfg.adminPassword.trim()) {
            upd.adminPassword = serverCfg.adminPassword.trim();
            hasChanges = true;
          }
          if (hasChanges) {
            saveStoredSettings(upd);
            return upd;
          }
          return prev;
        });
        if (serverCfg.scriptUrl && serverCfg.scriptUrl.startsWith('http')) {
          fetchRemoteTechnicians(serverCfg.scriptUrl, false);
        }
      }
    });
  }, []);

  // Save queue changes to localStorage
  const updateQueue = (newQueue: WorkRecord[]) => {
    setQueue(newQueue);
    saveStoredQueue(newQueue);
  };

  const fetchRemoteTechnicians = async (
    urlOrManual?: string | boolean,
    maybeManual = false
  ) => {
    const isManual = typeof urlOrManual === 'boolean' ? urlOrManual : maybeManual;
    const urlOverride = typeof urlOrManual === 'string' ? urlOrManual : undefined;
    const currentUrl = (urlOverride && urlOverride.trim().startsWith('http'))
      ? urlOverride.trim()
      : settings.scriptUrl;

    if (!currentUrl || !currentUrl.startsWith('http')) {
      return;
    }

    try {
      setIsRefreshingSheet(true);
      const cacheBuster = `&_t=${Date.now()}`;
      const fetchUrl = currentUrl.includes('?')
        ? `${currentUrl}&action=getTechnicians${cacheBuster}`
        : `${currentUrl}?action=getTechnicians${cacheBuster}`;
      const res = await fetch(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
          if (isManual) {
            showToast('Google Sign-in page received! Make sure "Who has access: Anyone" is selected in Apps Script Deploy.', 'warning');
          }
          return;
        }
        throw new Error('Invalid JSON received');
      }
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
          updated.scriptUrl = currentUrl;

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

          if (data.adminPassword && typeof data.adminPassword === 'string' && data.adminPassword.trim().length > 0) {
            updated.adminPassword = data.adminPassword.trim();
          } else {
            updated.adminPassword = prev.adminPassword || 'admin';
          }

          saveStoredSettings(updated);
          return updated;
        });

        // Sync remote records from Google Sheets into local history (Google Sheet is source of truth)
        if (Array.isArray(data.sheetRecords)) {
          const currentHist = getStoredHistory();
          // Keep only local records that are still pending sync (offline)
          const pendingLocalRecords = currentHist.filter((r) => r.status === 'pending');

          const histMap = new Map<string, WorkRecord>();

          const getRecKey = (r: any) => {
            if (r.id && String(r.id).trim()) {
              return String(r.id).trim();
            }
            const type = r.type || 'rec';
            const num = r.newMeterNo || r.deviceNo || '';
            const ts = r.timestamp || r.installationDate || '';
            const site = r.siteName || '';
            const tech = r.technicianName || '';
            const loc = r.flatNo || r.towerNo || r.deviceLocation || '';
            return `${type}___${num}___${ts}___${site}___${tech}___${loc}`;
          };

          // 1. Live records from Google Sheet
          data.sheetRecords.forEach((remoteRec: WorkRecord) => {
            histMap.set(getRecKey(remoteRec), { ...remoteRec, status: 'synced' });
          });

          // 2. Add local offline un-synced records
          pendingLocalRecords.forEach((r) => {
            histMap.set(getRecKey(r), r);
          });

          const syncedHistory = Array.from(histMap.values());
          setStoredHistory(syncedHistory);
          setHistory(syncedHistory);

          // 3. Auto-reconcile local offline queue against freshly fetched Google Sheet data
          const currentQueue = getStoredQueue();
          if (currentQueue.length > 0) {
            const remoteRecords = Array.isArray(data.sheetRecords) ? data.sheetRecords : [];
            const remoteMeters = Array.isArray(data.existingMeterNos) ? data.existingMeterNos : [];
            const remoteDevices = Array.isArray(data.existingDeviceNos) ? data.existingDeviceNos : [];
            const remoteIds = new Set(
              remoteRecords.map((r: any) => (r.id ? String(r.id).trim() : ''))
            );

            const reconciledIds = new Set<string>();

            const unSyncedQueue = currentQueue.filter((qItem) => {
              // Check by permanent ID
              if (qItem.id && remoteIds.has(String(qItem.id).trim())) {
                reconciledIds.add(qItem.id);
                return false;
              }
              // Check by Meter serial
              if (qItem.type === 'MeterInstallation' && (qItem as any).newMeterNo) {
                const mNo = (qItem as any).newMeterNo;
                if (remoteMeters.some((n: string) => areSerialsEqual(n, mNo))) {
                  reconciledIds.add(qItem.id);
                  return false;
                }
                if (remoteRecords.some((r: any) => r.type === 'MeterInstallation' && areSerialsEqual(r.newMeterNo, mNo))) {
                  reconciledIds.add(qItem.id);
                  return false;
                }
              }
              // Check by Infra device number
              if (qItem.type === 'InfraInstallation' && (qItem as any).deviceNo) {
                const dNo = (qItem as any).deviceNo;
                if (remoteDevices.some((n: string) => areSerialsEqual(n, dNo))) {
                  reconciledIds.add(qItem.id);
                  return false;
                }
                if (remoteRecords.some((r: any) => r.type === 'InfraInstallation' && areSerialsEqual(r.deviceNo, dNo))) {
                  reconciledIds.add(qItem.id);
                  return false;
                }
              }
              return true;
            });

            if (unSyncedQueue.length !== currentQueue.length) {
              updateQueue(unSyncedQueue);
              // Also update local history items so their status changes to 'synced'
              const curHist = getStoredHistory();
              const updHist = curHist.map((h) =>
                reconciledIds.has(h.id) ? { ...h, status: 'synced' as const } : h
              );
              setStoredHistory(updHist);
              setHistory(updHist);

              const clearedCount = currentQueue.length - unSyncedQueue.length;
              showToast(
                `Reconciled: ${clearedCount} queue record${clearedCount > 1 ? 's' : ''} confirmed in Google Sheet & cleared from queue ✓`,
                'success'
              );
            }
          }
        } else if (data.sheetStats && Number(data.sheetStats.totalMeterInstall) === 0 && Number(data.sheetStats.totalInfraInstall) === 0) {
          // If sheet stats explicitly say 0 for both, purge synced records from local history
          const currentHist = getStoredHistory();
          const pendingOnly = currentHist.filter((r) => r.status === 'pending');
          setStoredHistory(pendingOnly);
          setHistory(pendingOnly);
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

  // Sync Queue to Google Apps Script with Sequential Item-by-Item Safe Execution & Strict Deduplication
  const triggerSync = async () => {
    if (syncLockRef.current) return;
    const currentQueue = getStoredQueue();
    if (currentQueue.length === 0 || !navigator.onLine || !settings.scriptUrl) return;

    syncLockRef.current = true;
    setIsSyncing(true);
    triggerHaptic([30, 50, 30]);

    let syncedCount = 0;
    let reconciledCount = 0;

    try {
      // Loop sequentially item-by-item:
      // This prevents giant payloads from timing out on slow 2G/3G connections,
      // and ensures that once an item is synced, it is IMMEDIATELY removed from the queue!
      for (let i = 0; i < currentQueue.length; i++) {
        const item = currentQueue[i];
        if (!item) continue;

        // 1. Strict Duplicate Check: Has this record ALREADY been recorded in Google Sheet or Synced History?
        const isMeter = item.type === 'MeterInstallation';
        const isInfra = item.type === 'InfraInstallation';
        const mNo = isMeter ? (item as any).newMeterNo : undefined;
        const dNo = isInfra ? (item as any).deviceNo : undefined;

        const currentSettings = getStoredSettings();
        const currentHist = getStoredHistory();

        const alreadyInSheet =
          (isMeter && mNo && (currentSettings.existingMeterNos || []).some((no) => areSerialsEqual(no, mNo))) ||
          (isInfra && dNo && (currentSettings.existingDeviceNos || []).some((no) => areSerialsEqual(no, dNo))) ||
          (isMeter && mNo && currentHist.some((h) => h.status === 'synced' && h.type === 'MeterInstallation' && areSerialsEqual((h as any).newMeterNo, mNo))) ||
          (isInfra && dNo && currentHist.some((h) => h.status === 'synced' && h.type === 'InfraInstallation' && areSerialsEqual((h as any).deviceNo, dNo))) ||
          currentHist.some((h) => h.status === 'synced' && h.id && item.id && String(h.id).trim() === String(item.id).trim());

        if (alreadyInSheet) {
          // Record is already safely recorded in Google Sheet! Reconcile immediately without re-sending.
          reconciledCount++;
          // Mark status 'synced' in history
          const updatedHist = currentHist.map((h) => (h.id === item.id ? { ...h, status: 'synced' as const } : h));
          setStoredHistory(updatedHist);
          setHistory(updatedHist);

          // Remove immediately from queue
          const remainingQueue = getStoredQueue().filter((q) => q.id !== item.id);
          updateQueue(remainingQueue);
          continue;
        }

        // 2. Transmit single record with AbortController timeout (35s)
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 35000);

        try {
          await fetch(settings.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify([item]),
            signal: controller.signal,
          });
          clearTimeout(timeoutTimer);

          // Success: Immediately mark synced in History & remove from Queue!
          syncedCount++;
          const freshHist = getStoredHistory();
          const itemExistsInHist = freshHist.some((h) => h.id === item.id);
          const updatedHist = itemExistsInHist
            ? freshHist.map((h) => (h.id === item.id ? { ...h, status: 'synced' as const } : h))
            : [{ ...item, status: 'synced' as const }, ...freshHist];
          setStoredHistory(updatedHist);
          setHistory(updatedHist);

          // Remove from local queue
          const remainingQueue = getStoredQueue().filter((q) => q.id !== item.id);
          updateQueue(remainingQueue);

          // Register serial in settings so no subsequent entry can duplicate it
          if (isMeter && mNo) {
            setSettings((prev) => {
              const list = prev.existingMeterNos || [];
              if (!list.some((no) => areSerialsEqual(no, mNo))) {
                const upd = { ...prev, existingMeterNos: [...list, String(mNo).trim()] };
                saveStoredSettings(upd);
                return upd;
              }
              return prev;
            });
          } else if (isInfra && dNo) {
            setSettings((prev) => {
              const list = prev.existingDeviceNos || [];
              if (!list.some((no) => areSerialsEqual(no, dNo))) {
                const upd = { ...prev, existingDeviceNos: [...list, String(dNo).trim()] };
                saveStoredSettings(upd);
                return upd;
              }
              return prev;
            });
          }
        } catch (itemErr) {
          clearTimeout(timeoutTimer);
          console.warn('Network issue during item sync:', itemErr);
          // Network dropped or timed out on this item; break loop so we don't spam failed attempts
          break;
        }
      }

      if (syncedCount > 0 || reconciledCount > 0) {
        playFeedbackSound('success');
        triggerHaptic([50, 80, 50, 100]);
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.8 },
        });

        const messages: string[] = [];
        if (syncedCount > 0) messages.push(`Synced ${syncedCount} record${syncedCount > 1 ? 's' : ''}`);
        if (reconciledCount > 0) messages.push(`${reconciledCount} duplicate(s) reconciled & cleared`);
        showToast(messages.join(', ') + ' ✓', 'success');

        // Refresh remote technicians & serials in background after sync
        setTimeout(() => {
          fetchRemoteTechnicians(false);
        }, 1200);
      } else {
        const remaining = getStoredQueue();
        if (remaining.length > 0 && !navigator.onLine) {
          showToast('Device is offline. Queued items will sync when online.', 'info');
        }
      }
    } catch (error) {
      console.error('Sync queue loop error', error);
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
    }
  };

  // Automatic background sync when transitioning from offline to online OR periodically every 25s when queue is pending
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    // 1. When connection is restored
    if (!prevOnlineRef.current && isOnline && queue.length > 0 && settings.autoSync) {
      const timer = setTimeout(() => {
        triggerSync();
      }, 1500);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, queue.length, settings.autoSync]);

  // 2. Periodic sync check every 25s if queue has items and device is online
  useEffect(() => {
    if (!settings.scriptUrl) return;

    const interval = setInterval(() => {
      const q = getStoredQueue();
      if (q.length > 0 && navigator.onLine && settings.autoSync && !syncLockRef.current) {
        triggerSync();
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [settings.scriptUrl, settings.autoSync]);

  // 3. Auto-sync and reconcile when user switches to Queue tab
  useEffect(() => {
    if (activeTab === 'queue' && navigator.onLine) {
      fetchRemoteTechnicians(false);
      const q = getStoredQueue();
      if (q.length > 0 && !syncLockRef.current) {
        triggerSync();
      }
    }
  }, [activeTab]);

  // Periodic background auto-sync throttled every 45s so camera switching doesn't flicker or re-sync
  const lastFetchTimeRef = useRef(Date.now());
  useEffect(() => {
    if (!settings.scriptUrl) return;

    const interval = setInterval(() => {
      if (navigator.onLine) {
        lastFetchTimeRef.current = Date.now();
        fetchRemoteTechnicians(false);
      }
    }, 45000);

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const now = Date.now();
        // Only fetch if more than 45 seconds have passed since last fetch
        if (now - lastFetchTimeRef.current > 45000) {
          lastFetchTimeRef.current = now;
          fetchRemoteTechnicians(false);
        }
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

  // Synchronized ref for PopState handler so a single listener is attached without thrashing pushState
  const uiStateRef = useRef({
    previewPhoto,
    isAdminPortalOpen,
    isAdminAuthModalOpen,
    isScriptModalOpen,
    isExportModalOpen,
    activeTab,
  });

  useEffect(() => {
    uiStateRef.current = {
      previewPhoto,
      isAdminPortalOpen,
      isAdminAuthModalOpen,
      isScriptModalOpen,
      isExportModalOpen,
      activeTab,
    };
  }, [
    previewPhoto,
    isAdminPortalOpen,
    isAdminAuthModalOpen,
    isScriptModalOpen,
    isExportModalOpen,
    activeTab,
  ]);

  // Android Hardware / Swipe "Back" Button Guard: Prevents accidental browser exit or session loss while filling forms
  useEffect(() => {
    if (!currentUser) return;

    // Push initial protected history state once per session
    window.history.pushState({ app: 'technician_session' }, '');

    const handlePopState = () => {
      const currentUi = uiStateRef.current;

      // 1. If photo preview modal is open, close photo preview
      if (currentUi.previewPhoto) {
        setPreviewPhoto(null);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }
      // 2. If any admin or export modal is open, close modal
      if (currentUi.isAdminPortalOpen) {
        setIsAdminPortalOpen(false);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }
      if (currentUi.isAdminAuthModalOpen) {
        setIsAdminAuthModalOpen(false);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }
      if (currentUi.isScriptModalOpen) {
        setIsScriptModalOpen(false);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }
      if (currentUi.isExportModalOpen) {
        setIsExportModalOpen(false);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }

      // 3. If on Queue or History tab, switch back to the technician's active form (Meter or Infra)
      if (currentUi.activeTab === 'queue' || currentUi.activeTab === 'history') {
        const returnTab = lastFormTabRef.current || 'meter';
        setActiveTab(returnTab);
        window.history.pushState({ app: 'technician_session' }, '');
        return;
      }

      // 4. Technician is already on active form (Meter or Infra): Keep technician inside form, don't exit app or switch tab
      window.history.pushState({ app: 'technician_session' }, '');
      showToast('Form protected: Unsaved entries are safe. Tap "Logout" at top to end session.', 'info');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentUser, showToast]);

  // Beforeunload Guard: Prevents accidental browser refresh or page close when technician has unsaved form entries
  useEffect(() => {
    if (!currentUser) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const meterDraft = getMeterFormDraft();
      const infraDraft = getInfraFormDraft();
      const hasUnsavedMeter = Boolean(
        meterDraft &&
          (meterDraft.flatNo ||
            meterDraft.newMeterNo ||
            meterDraft.oldMeterNo ||
            meterDraft.siteName)
      );
      const hasUnsavedInfra = Boolean(
        infraDraft &&
          (infraDraft.towerNo ||
            infraDraft.deviceNo ||
            infraDraft.siteName)
      );

      if (hasUnsavedMeter || hasUnsavedInfra) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // Handle Form Submission (Meter or Infra) - Ultra-Fast Instant Save
  const handleFormSubmit = async (
    data: Omit<MeterInstallationRecord, 'id'> | Omit<InfraInstallationRecord, 'id'>
  ) => {
    setIsSubmitting(true);
    // Strict Duplicate Serial Validation across Memory, LocalStorage, Queue, and Google Sheet Serials
    const storedHistory = getStoredHistory();
    const storedQueue = getStoredQueue();
    const storedSettings = getStoredSettings();
    const allKnownMeters = [
      ...(settings.existingMeterNos || []),
      ...(storedSettings.existingMeterNos || []),
    ];
    const allKnownDevices = [
      ...(settings.existingDeviceNos || []),
      ...(storedSettings.existingDeviceNos || []),
    ];

    if (data.type === 'MeterInstallation' && (data as any).newMeterNo) {
      const meterNo = (data as any).newMeterNo;
      const isMeterDup =
        history.some((r) => r.type === 'MeterInstallation' && areSerialsEqual(r.newMeterNo, meterNo)) ||
        storedHistory.some((r) => r.type === 'MeterInstallation' && areSerialsEqual(r.newMeterNo, meterNo)) ||
        queue.some((r) => r.type === 'MeterInstallation' && areSerialsEqual((r as any).newMeterNo, meterNo)) ||
        storedQueue.some((r) => r.type === 'MeterInstallation' && areSerialsEqual((r as any).newMeterNo, meterNo)) ||
        allKnownMeters.some((no) => areSerialsEqual(no, meterNo));

      if (isMeterDup) {
        setIsSubmitting(false);
        triggerHaptic([50, 100, 50]);
        showToast(`Duplicate: Meter #${meterNo} already registered in Google Sheet or history! Cannot re-submit.`, 'warning');
        return;
      }
    } else if (data.type === 'InfraInstallation' && (data as any).deviceNo) {
      const devNo = (data as any).deviceNo;
      const isDeviceDup =
        history.some((r) => r.type === 'InfraInstallation' && areSerialsEqual(r.deviceNo, devNo)) ||
        storedHistory.some((r) => r.type === 'InfraInstallation' && areSerialsEqual(r.deviceNo, devNo)) ||
        queue.some((r) => r.type === 'InfraInstallation' && areSerialsEqual((r as any).deviceNo, devNo)) ||
        storedQueue.some((r) => r.type === 'InfraInstallation' && areSerialsEqual((r as any).deviceNo, devNo)) ||
        allKnownDevices.some((no) => areSerialsEqual(no, devNo));

      if (isDeviceDup) {
        setIsSubmitting(false);
        triggerHaptic([50, 100, 50]);
        showToast(`Duplicate: Device #${devNo} already registered in Google Sheet or history! Cannot re-submit.`, 'warning');
        return;
      }
    }

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

    // 2. Immediately register serial in settings to block any duplicate re-submission instantly
    if (data.type === 'MeterInstallation' && (data as any).newMeterNo) {
      const cleanMeterNo = String((data as any).newMeterNo).trim();
      setSettings((prev) => {
        const list = prev.existingMeterNos || [];
        if (!list.some((no) => areSerialsEqual(no, cleanMeterNo))) {
          const upd = { ...prev, existingMeterNos: [...list, cleanMeterNo] };
          saveStoredSettings(upd);
          return upd;
        }
        return prev;
      });
    } else if (data.type === 'InfraInstallation' && (data as any).deviceNo) {
      const cleanDevNo = String((data as any).deviceNo).trim();
      setSettings((prev) => {
        const list = prev.existingDeviceNos || [];
        if (!list.some((no) => areSerialsEqual(no, cleanDevNo))) {
          const upd = { ...prev, existingDeviceNos: [...list, cleanDevNo] };
          saveStoredSettings(upd);
          return upd;
        }
        return prev;
      });
    }

    // 3. Immediately save to local history (Zero data loss guarantee)
    addToHistory([newRecord]);
    setHistory(getStoredHistory());

    // 4. Instant tactile & audio feedback in ~40ms
    playFeedbackSound('success');
    triggerHaptic(40);
    showToast(isOnline ? 'Saved! Syncing to Google Sheet... ⚡' : 'Saved offline successfully! ⚡', 'success');

    // 5. Release UI lock instantly so form resets and technician can enter next flat immediately
    setIsSubmitting(false);

    // 6. Safe Queue-First Architecture:
    // Always store in sync queue with status 'pending' as the single coordinated source of truth
    newRecord.status = 'pending';
    const currentQueue = getStoredQueue();
    if (!currentQueue.some((q) => q.id === newRecord.id)) {
      updateQueue([...currentQueue, newRecord]);
    }

    // 7. If online, immediately invoke the safe sequential sync pipeline
    if (isOnline && settings.scriptUrl) {
      setTimeout(() => {
        triggerSync();
      }, 150);
    }
  };

  const handleImportQueue = (importedRecords: WorkRecord[]) => {
    if (!Array.isArray(importedRecords) || importedRecords.length === 0) return;
    const currentQ = getStoredQueue();
    const existingIds = new Set(currentQ.map((q) => q.id));
    const newItems = importedRecords.filter((r) => r && r.id && !existingIds.has(r.id));
    if (newItems.length === 0) {
      showToast('All imported records are already in queue.', 'info');
      return;
    }
    const combined = [...currentQ, ...newItems];
    updateQueue(combined);
    // Also save to history so never lost
    addToHistory(newItems);
    setHistory(getStoredHistory());
    showToast(`Imported ${newItems.length} record${newItems.length > 1 ? 's' : ''} into queue!`, 'success');
    if (navigator.onLine && settings.scriptUrl) {
      setTimeout(() => triggerSync(), 200);
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
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-100/90 flex flex-col items-center w-full overflow-x-hidden">
      {/* Responsive Auto-Resizing Container: Fluid 100% on phone, spacious multi-column dashboard on tablet & laptop */}
      <div className="w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl min-h-screen bg-slate-50 flex flex-col shadow-2xl relative border-x border-slate-200/60 pb-12 transition-all duration-300">
        {!currentUser ? (
          <div className="flex-1 flex flex-col w-full">
            {/* Header in Login Mode */}
            <header className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 text-white pt-3.5 pb-2.5 px-3 sm:px-5 shadow-md w-full">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-white/50 shrink-0 shadow-sm flex items-center justify-center p-0.5">
                    <img src="/icon.svg" alt="RR Enterprise" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight truncate">
                      RR Enterprise
                    </h1>
                    <p className="text-[10px] text-indigo-100/90 font-medium truncate">Smart Meter &amp; Electrical</p>
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
                onResetAdminPassword={() => {
                  const updated = { ...settings, adminPassword: 'admin' };
                  setSettings(updated);
                  saveStoredSettings(updated);
                  saveServerConfig(updated.scriptUrl || '', 'admin', 'admin').catch(() => {});
                  showToast('Admin Master Password reset back to default "admin"!', 'info');
                }}
              />
            </main>
          </div>
        ) : (
          <>
            {/* App Header with Active Technician Session */}
            <header className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 text-white pt-3 pb-2.5 px-3 sm:px-5 sticky top-0 z-30 shadow-md w-full">
              {/* Top Bar: Title & Connectivity Badge & Controls */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-white/50 shrink-0 shadow-sm flex items-center justify-center p-0.5">
                    <img src="/icon.svg" alt="RR Enterprise" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight truncate">
                      RR Enterprise
                    </h1>
                    <p className="text-[10px] text-indigo-100/90 font-medium truncate">Smart Meter &amp; Infra Tracker</p>
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

            {/* Main Body Content - Forms kept mounted in DOM so tab switching or camera never wipes data */}
            <main className="flex-1 p-3.5 sm:p-4 space-y-4 overflow-y-auto">
              <div className={activeTab === 'meter' ? 'block' : 'hidden'}>
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
                    (r): r is MeterInstallationRecord => Boolean(r && r.type === 'MeterInstallation')
                  )}
                  sheetExistingMeterNos={settings.existingMeterNos || []}
                />
              </div>

              <div className={activeTab === 'infra' ? 'block' : 'hidden'}>
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
                    (r): r is InfraInstallationRecord => Boolean(r && r.type === 'InfraInstallation')
                  )}
                  sheetExistingDeviceNos={settings.existingDeviceNos || []}
                />
              </div>

              <div className={activeTab === 'queue' ? 'block' : 'hidden'}>
                <QueueManager
                  queue={queue}
                  isSyncing={isSyncing}
                  isOnline={isOnline}
                  onSync={triggerSync}
                  onReconcile={() => fetchRemoteTechnicians(true)}
                  onImportQueue={handleImportQueue}
                  onDeleteItem={handleDeleteQueueItem}
                  onClearQueue={handleClearQueue}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                />
              </div>

              <div className={activeTab === 'history' ? 'block' : 'hidden'}>
                <HistoryManager
                  history={history}
                  currentUser={currentUser}
                  onClearHistory={handleClearHistory}
                  onUpdateItem={handleUpdateHistoryItem}
                  onDeleteItem={handleDeleteHistoryItem}
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                />
              </div>
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
          onResetPassword={() => {
            const updated = { ...settings, adminPassword: 'admin' };
            setSettings(updated);
            saveStoredSettings(updated);
            saveServerConfig(updated.scriptUrl || '', 'admin', 'admin').catch(() => {});
            showToast('Admin Master Password reset back to default "admin"!', 'info');
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
    </ErrorBoundary>
  );
}
