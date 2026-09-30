import { AppSettings, WorkRecord } from '../types';

export const DEFAULT_SCRIPT_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL)
    ? String((import.meta as any).env.VITE_GOOGLE_SCRIPT_URL).trim()
    : 'https://script.google.com/macros/s/AKfycbwtBZfxm9TB4qAdhdA5VCTzpYq9VoFhrPUNykcmStSyytmCU0PXSaoC7cBbXaw8pjvC/exec';

const PREVIOUS_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycbxjHS9zW3s8uJHqgCKx4jXIHetqCUv3pApMgIlGPEDbMuYPbAWxBp_nYsLDSLeFxxd0/exec',
  'https://script.google.com/macros/s/AKfycbzP-lgydlMTyTYTuvpyymUfRfD0YWa8BSMHBOAgZ6B5bFXAQd1Xw7CVaAF_WmykE9TB/exec',
];

export const DEFAULT_TECHNICIANS: string[] = ['Mohit', 'Rahul Sharma', 'Amit Kumar', 'Vikas Singh'];

// Only show what exists in Google Sheet (no hardcoded dummy companies, verticals, or makes)
export const DEFAULT_METER_MAKES: string[] = [];
export const DEFAULT_COMPANIES: string[] = [];
export const DEFAULT_VERTICALS: string[] = [];

export const DEFAULT_ADMIN_PASSWORD = 'admin';

export const DEFAULT_SETTINGS: AppSettings = {
  scriptUrl: DEFAULT_SCRIPT_URL,
  technicians: DEFAULT_TECHNICIANS,
  meterMakes: [],
  companies: [],
  verticals: [],
  adminPassword: DEFAULT_ADMIN_PASSWORD,
  autoSync: true,
  hapticFeedback: true,
  soundEnabled: true,
};

export const fetchServerConfig = async (): Promise<{ scriptUrl?: string } | null> => {
  try {
    const res = await fetch('/api/config', { method: 'GET' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.status === 'success' && data.scriptUrl && data.scriptUrl.startsWith('http')) {
        return { scriptUrl: data.scriptUrl.trim() };
      }
    }
  } catch {
    // Backend endpoint not reachable (e.g. static hosting like Netlify)
  }
  return null;
};

export const saveServerConfig = async (
  scriptUrl: string,
  adminPassword: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl: scriptUrl.trim(), adminPassword: adminPassword.trim() }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        message: 'Static hosting (Netlify) detected. Server backend is not available on static hosting.',
      };
    }
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      return { success: true, message: data.message || 'URL permanently saved on server backend!' };
    }
    return { success: false, message: data.message || 'Server returned error' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not connect to backend server' };
  }
};

const QUEUE_KEY = 'syncQueue';
const HISTORY_KEY = 'syncHistory';
const SETTINGS_KEY = 'meter_infra_settings';
const LOGGED_IN_TECH_KEY = 'meter_logged_in_tech';

export const getLoggedInTechnician = (): string | null => {
  try {
    return localStorage.getItem(LOGGED_IN_TECH_KEY);
  } catch {
    return null;
  }
};

export const setLoggedInTechnician = (techName: string | null): void => {
  try {
    if (techName) {
      localStorage.setItem(LOGGED_IN_TECH_KEY, techName);
    } else {
      localStorage.removeItem(LOGGED_IN_TECH_KEY);
    }
  } catch (e) {
    console.error('Error saving logged in tech', e);
  }
};

export const verifyTechnicianPassword = (
  techName: string,
  passwordAttempt: string,
  settings: AppSettings
): boolean => {
  const cleanAttempt = passwordAttempt.trim();
  if (!cleanAttempt) return false;

  const configuredPass = settings.technicianPasswords?.[techName];
  if (configuredPass && String(configuredPass).trim() !== '') {
    return String(configuredPass).trim() === cleanAttempt;
  }

  // Fallback defaults if Column B is empty in sheet
  const defaultPass = settings.defaultPassword || '1234';
  if (cleanAttempt === defaultPass) return true;

  // Also accept technician name in lowercase as friendly fallback (e.g. "mohit")
  const lowerName = techName.toLowerCase().replace(/\s+/g, '');
  if (cleanAttempt.toLowerCase() === lowerName) return true;

  return false;
};

export const getStoredQueue = (): WorkRecord[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading queue from localStorage', e);
    return [];
  }
};

export const saveStoredQueue = (queue: WorkRecord[]): void => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving queue to localStorage', e);
  }
};

export const getStoredHistory = (): WorkRecord[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading history', e);
    return [];
  }
};

export const addToHistory = (records: WorkRecord[]): void => {
  try {
    const existing = getStoredHistory();
    // Keep up to 200 most recent items to avoid quota issues
    const updated = [...records, ...existing].slice(0, 200);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error updating history', e);
  }
};

export const updateStoredHistoryItem = (updatedRecord: WorkRecord): void => {
  try {
    const existing = getStoredHistory();
    const updated = existing.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error updating history item', e);
  }
};

export const deleteStoredHistoryItem = (id: string): void => {
  try {
    const existing = getStoredHistory();
    const updated = existing.filter((r) => r.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting history item', e);
  }
};

export const setStoredHistory = (records: WorkRecord[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 500)));
  } catch (e) {
    console.error('Error saving history', e);
  }
};

export const clearStoredHistory = (): void => {
  localStorage.removeItem(HISTORY_KEY);
};

export const getStoredSettings = (): AppSettings => {
  try {
    // 1. Auto-detect shared script URL from query parameter (e.g. ?scriptUrl=... or ?script=...)
    let queryScriptUrl = '';
    if (typeof window !== 'undefined' && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paramUrl = urlParams.get('scriptUrl') || urlParams.get('script') || urlParams.get('api');
        if (paramUrl && paramUrl.trim().startsWith('http')) {
          queryScriptUrl = paramUrl.trim();
        }
      } catch (e) {
        console.warn('Could not parse URL query', e);
      }
    }

    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    const isPreviousUrl = parsed.scriptUrl && PREVIOUS_SCRIPT_URLS.includes(parsed.scriptUrl);
    const resolvedScriptUrl =
      queryScriptUrl ||
      (!parsed.scriptUrl || isPreviousUrl
        ? DEFAULT_SCRIPT_URL
        : parsed.scriptUrl);

    // Purge legacy dummy companies/verticals/makes if previously cached in localStorage
    const legacyCompanies = ['Genus Power Infrastructures', 'Tata Power', 'BSES Rajdhani', 'BSES Yamuna', 'Secure Meters', 'Adani Electricity'];
    const hasLegacyCompany = Array.isArray(parsed.companies) && 
      parsed.companies.some((c: string) => legacyCompanies.includes(c));

    const legacyMakes = ['Genus', 'Secure', 'L&T', 'HPL', 'Schneider', 'Avon'];
    const hasLegacyMake = Array.isArray(parsed.meterMakes) &&
      parsed.meterMakes.some((m: string) => ['Schneider', 'Avon', 'HPL'].includes(m));

    const legacyVerticals = ['PPM', 'PVVNL', 'PuVVNL', 'MVVNL', 'DVVNL', 'NPCL', 'BB', 'ATL'];
    const hasLegacyVertical = Array.isArray(parsed.verticals) &&
      parsed.verticals.some((v: string) => ['PVVNL', 'PuVVNL', 'MVVNL', 'DVVNL'].includes(v));

    const sanitizedCompanies: string[] = hasLegacyCompany ? [] : (Array.isArray(parsed.companies) ? parsed.companies : []);
    const sanitizedMakes: string[] = hasLegacyMake ? [] : (Array.isArray(parsed.meterMakes) ? parsed.meterMakes : []);
    const sanitizedVerticals: string[] = hasLegacyVertical ? [] : (Array.isArray(parsed.verticals) ? parsed.verticals : []);

    const mergedSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      scriptUrl: resolvedScriptUrl,
      sheetStats: parsed.sheetStats,
      technicianPasswords: parsed.technicianPasswords || {},
      defaultPassword: parsed.defaultPassword || '1234',
      meterMakes: sanitizedMakes,
      companies: sanitizedCompanies,
      verticals: sanitizedVerticals,
      technicians:
        Array.isArray(parsed.technicians) && parsed.technicians.length > 0
          ? parsed.technicians
          : DEFAULT_TECHNICIANS,
    };

    // If queryScriptUrl was found, persist it into localStorage immediately
    if (queryScriptUrl) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
      } catch {}
    }

    return mergedSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveStoredSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings', e);
  }
};

/**
 * Trigger mobile haptic vibration if supported
 */
export const triggerHaptic = (pattern: number | number[] = 40): void => {
  try {
    const settings = getStoredSettings();
    if (settings.hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported
  }
};

/**
 * Play a pleasant audio chime on action
 */
export const playFeedbackSound = (type: 'success' | 'click' | 'error' = 'success'): void => {
  try {
    const settings = getStoredSettings();
    if (!settings.soundEnabled || typeof window === 'undefined') return;

    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Ignore audio context errors
  }
};

/**
 * Export records as CSV string
 */
export const exportRecordsToCSV = (records: WorkRecord[]): string => {
  const headers = [
    'ID',
    'Type',
    'Installation Date',
    'Technician',
    'Company',
    'Vertical',
    'Site Name',
    'Flat / Device Location',
    'Old Meter No',
    'Old Meter Make',
    'New Meter No',
    'New Meter Make',
    'Device No',
    'Infra Qty',
    'Remark',
    'Has Photo 1',
    'Has Photo 2',
  ];

  const rows = records.map((r) => {
    if (r.type === 'MeterInstallation') {
      return [
        `"${r.id}"`,
        `"${r.type}"`,
        `"${r.installationDate || r.timestamp}"`,
        `"${r.technicianName}"`,
        `"${r.company || ''}"`,
        `"${r.vertical || ''}"`,
        `"${r.siteName}"`,
        `"${r.flatNo}"`,
        `"${r.oldMeterNo || ''}"`,
        `"${r.oldMeterMake || ''}"`,
        `"${r.newMeterNo}"`,
        `"${r.newMeterMake || ''}"`,
        '""',
        '""',
        `"${(r.remark || '').replace(/"/g, '""')}"`,
        r.oldMeterPhoto ? 'Yes' : 'No',
        r.newMeterPhoto ? 'Yes' : 'No',
      ];
    } else {
      return [
        `"${r.id}"`,
        `"${r.type}"`,
        `"${r.installationDate || r.timestamp}"`,
        `"${r.technicianName}"`,
        `"${r.company || ''}"`,
        `"${r.vertical || ''}"`,
        `"${r.siteName}"`,
        `"${r.deviceLocation || r.towerNo}"`,
        '""',
        '""',
        '""',
        '""',
        `"${r.deviceNo}"`,
        `"${r.infraQty || ''}"`,
        `"${(r.remark || '').replace(/"/g, '""')}"`,
        r.devicePhoto ? 'Yes' : 'No',
        'No',
      ];
    }
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
