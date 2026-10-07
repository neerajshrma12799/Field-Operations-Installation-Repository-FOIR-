import { AppSettings, WorkRecord } from '../types';

export const DEFAULT_SCRIPT_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL)
    ? String((import.meta as any).env.VITE_GOOGLE_SCRIPT_URL).trim()
    : 'https://script.google.com/macros/s/AKfycbx6kcq_E5ipl-rfNp08YfY8HhdSJChQt3v4fzHzG7F7FZcLfXeL0jDQhi-Le-yYoadB/exec';

const PREVIOUS_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycbxNezil-kHx7kZq8mOZHItEd5Jp2X63WiUdK023cQTrgSjEO2RVtacKHXbP3ZHY0lGI/exec',
  'https://script.google.com/macros/s/AKfycbwtBZfxm9TB4qAdhdA5VCTzpYq9VoFhrPUNykcmStSyytmCU0PXSaoC7cBbXaw8pjvC/exec',
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

export const fetchServerConfig = async (): Promise<{ scriptUrl?: string; adminPassword?: string } | null> => {
  try {
    const res = await fetch('/api/config', { method: 'GET' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const out: { scriptUrl?: string; adminPassword?: string } = {};
        if (data.scriptUrl && typeof data.scriptUrl === 'string' && data.scriptUrl.startsWith('http')) {
          out.scriptUrl = data.scriptUrl.trim();
        }
        if (data.adminPassword && typeof data.adminPassword === 'string' && data.adminPassword.trim().length > 0) {
          out.adminPassword = data.adminPassword.trim();
        }
        return out;
      }
    }
  } catch {
    // Backend endpoint not reachable (e.g. static hosting like Netlify)
  }
  return null;
};

export const saveServerConfig = async (
  scriptUrl: string,
  adminPassword: string,
  newAdminPassword?: string
): Promise<{ success: boolean; message: string; adminPassword?: string }> => {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: scriptUrl ? scriptUrl.trim() : '',
        adminPassword: adminPassword ? adminPassword.trim() : 'admin',
        newAdminPassword: newAdminPassword ? newAdminPassword.trim() : undefined,
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        message: 'Static hosting (Netlify) detected. Saved in your local browser storage.',
      };
    }
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Configuration permanently saved on server backend!',
        adminPassword: data.adminPassword,
      };
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
    const fromLocal = localStorage.getItem(LOGGED_IN_TECH_KEY);
    if (fromLocal && fromLocal.trim()) return fromLocal.trim();
  } catch {}
  try {
    const fromSession = sessionStorage.getItem(LOGGED_IN_TECH_KEY);
    if (fromSession && fromSession.trim()) return fromSession.trim();
  } catch {}
  return null;
};

export const setLoggedInTechnician = (techName: string | null): void => {
  const clean = techName && typeof techName === 'string' ? techName.trim() : null;
  try {
    if (clean) {
      localStorage.setItem(LOGGED_IN_TECH_KEY, clean);
    } else {
      localStorage.removeItem(LOGGED_IN_TECH_KEY);
    }
  } catch (e) {
    console.error('Error saving logged in tech to localStorage', e);
  }
  try {
    if (clean) {
      sessionStorage.setItem(LOGGED_IN_TECH_KEY, clean);
    } else {
      sessionStorage.removeItem(LOGGED_IN_TECH_KEY);
    }
  } catch {}
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
      adminPassword:
        parsed.adminPassword && String(parsed.adminPassword).trim().length > 0
          ? String(parsed.adminPassword).trim()
          : DEFAULT_ADMIN_PASSWORD,
      scriptUrl: resolvedScriptUrl,
      sheetStats: parsed.sheetStats,
      technicianPasswords: parsed.technicianPasswords || {},
      defaultPassword: parsed.defaultPassword || '1234',
      meterMakes: sanitizedMakes,
      companies: sanitizedCompanies,
      verticals: sanitizedVerticals,
      existingMeterNos: Array.isArray(parsed.existingMeterNos) ? parsed.existingMeterNos : [],
      existingDeviceNos: Array.isArray(parsed.existingDeviceNos) ? parsed.existingDeviceNos : [],
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

const METER_DRAFT_KEY = 'meter_form_draft_v1';
const INFRA_DRAFT_KEY = 'infra_form_draft_v1';

export const getMeterFormDraft = (): any => {
  try {
    const raw = localStorage.getItem(METER_DRAFT_KEY) || sessionStorage.getItem(METER_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveMeterFormDraft = (data: any): void => {
  if (!data) {
    clearMeterFormDraft();
    return;
  }
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(METER_DRAFT_KEY, serialized);
    sessionStorage.setItem(METER_DRAFT_KEY, serialized);
  } catch {
    // QuotaExceededError handling: if storage is constrained (e.g. large base64 photos),
    // strip large photo strings and securely persist all text fields (siteName, flatNo,
    // meter numbers, company, etc.) so text data is NEVER lost!
    try {
      const textOnly = {
        ...data,
        oldMeterPhoto: null,
        newMeterPhoto: null,
      };
      const fallbackStr = JSON.stringify(textOnly);
      localStorage.setItem(METER_DRAFT_KEY, fallbackStr);
      sessionStorage.setItem(METER_DRAFT_KEY, fallbackStr);
    } catch {}
  }
};

export const clearMeterFormDraft = (): void => {
  try { localStorage.removeItem(METER_DRAFT_KEY); } catch {}
  try { sessionStorage.removeItem(METER_DRAFT_KEY); } catch {}
};

export const getInfraFormDraft = (): any => {
  try {
    const raw = localStorage.getItem(INFRA_DRAFT_KEY) || sessionStorage.getItem(INFRA_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveInfraFormDraft = (data: any): void => {
  if (!data) {
    clearInfraFormDraft();
    return;
  }
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(INFRA_DRAFT_KEY, serialized);
    sessionStorage.setItem(INFRA_DRAFT_KEY, serialized);
  } catch {
    try {
      const textOnly = {
        ...data,
        devicePhoto: null,
      };
      const fallbackStr = JSON.stringify(textOnly);
      localStorage.setItem(INFRA_DRAFT_KEY, fallbackStr);
      sessionStorage.setItem(INFRA_DRAFT_KEY, fallbackStr);
    } catch {}
  }
};

export const clearInfraFormDraft = (): void => {
  try { localStorage.removeItem(INFRA_DRAFT_KEY); } catch {}
  try { sessionStorage.removeItem(INFRA_DRAFT_KEY); } catch {}
};
