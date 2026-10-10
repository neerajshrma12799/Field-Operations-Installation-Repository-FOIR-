import { MeterInstallationRecord, InfraInstallationRecord } from '../types';

/**
 * Formats date and time strictly in Indian Standard Time (IST - Asia/Kolkata)
 * Standard Indian format: DD/MM/YYYY, hh:mm:ss AM/PM
 * Example: 28/09/2026, 12:45:30 PM
 */
export const getIndianTimestamp = (date: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const day = partMap.day || '01';
    const month = partMap.month || '01';
    const year = partMap.year || String(date.getFullYear());
    const hour = partMap.hour || '12';
    const minute = partMap.minute || '00';
    const second = partMap.second || '00';
    const dayPeriod = (partMap.dayPeriod || '').toUpperCase() || (date.getHours() >= 12 ? 'PM' : 'AM');

    return `${day}/${month}/${year}, ${hour}:${minute}:${second} ${dayPeriod}`;
  } catch {
    // Robust manual fallback with UTC+5:30 IST offset
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const d = String(ist.getDate()).padStart(2, '0');
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const y = ist.getFullYear();
    let hours = ist.getHours();
    const minutes = String(ist.getMinutes()).padStart(2, '0');
    const seconds = String(ist.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = String(hours).padStart(2, '0');
    return `${d}/${m}/${y}, ${h}:${minutes}:${seconds} ${ampm}`;
  }
};

/**
 * Parse standard timestamp (DD/MM/YYYY or YYYY-MM-DD or ISO) into Date object
 */
export const parseRecordDate = (timestampStr?: any): Date | null => {
  if (!timestampStr) return null;
  if (timestampStr instanceof Date) {
    return isNaN(timestampStr.getTime()) ? null : timestampStr;
  }
  const str = String(timestampStr).trim();
  if (!str) return null;
  
  // Try DD/MM/YYYY or DD-MM-YYYY format (e.g. 28/09/2026, 12:45:30 PM or 28-09-2026)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);

    // Check time if present
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const meridiem = timeMatch[4] ? timeMatch[4].toLowerCase() : null;
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to standard Date parser
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Extract clean YYYY-MM-DD string from any date-time stamp string or Date object
 */
export const extractDateYMD = (timestampStr?: any): string | null => {
  if (!timestampStr) return null;
  if (timestampStr instanceof Date) {
    if (isNaN(timestampStr.getTime())) return null;
    const y = timestampStr.getFullYear();
    const m = String(timestampStr.getMonth() + 1).padStart(2, '0');
    const d = String(timestampStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(timestampStr).trim();
  if (!str) return null;

  // 1. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 2. Check YYYY-MM-DD or YYYY/MM/DD
  const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, '0');
    const day = yyyymmddMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback to parseRecordDate
  const parsed = parseRecordDate(str);
  if (parsed && !isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};

/**
 * Get Today's YYYY-MM-DD strictly aligned with Indian Standard Time (IST)
 */
export const getTodayYMD = (): string => {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  } catch {}
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Get Yesterday's YYYY-MM-DD strictly aligned with Indian Standard Time (IST)
 */
export const getYesterdayYMD = (): string => {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Check if a date string falls between startDateStr and endDateStr (YYYY-MM-DD)
 */
export const isDateInRange = (
  timestampStr: any,
  startDateStr: string,
  endDateStr: string
): boolean => {
  if (!startDateStr && !endDateStr) return true;
  const recordYMD = extractDateYMD(timestampStr);
  if (!recordYMD) return true; // Keep if cannot parse

  if (startDateStr && recordYMD < startDateStr) return false;
  if (endDateStr && recordYMD > endDateStr) return false;

  return true;
};

/**
 * Check if a record was installed Today (extracts date from timestamp)
 */
export const isRecordToday = (timestampOrRecord: any): boolean => {
  const dateStr = typeof timestampOrRecord === 'object' && timestampOrRecord !== null
    ? (timestampOrRecord.installationDate || timestampOrRecord.timestamp)
    : timestampOrRecord;
  const recordYMD = extractDateYMD(dateStr);
  return !!recordYMD && recordYMD === getTodayYMD();
};

/**
 * Check if a record was installed Yesterday (extracts date from timestamp)
 */
export const isRecordYesterday = (timestampOrRecord: any): boolean => {
  const dateStr = typeof timestampOrRecord === 'object' && timestampOrRecord !== null
    ? (timestampOrRecord.installationDate || timestampOrRecord.timestamp)
    : timestampOrRecord;
  const recordYMD = extractDateYMD(dateStr);
  return !!recordYMD && recordYMD === getYesterdayYMD();
};

/**
 * Check if a record is a Meter Installation (Meter sheet: new meter count or site name)
 */
export const isMeterRecord = (r: any): r is MeterInstallationRecord => {
  if (!r) return false;
  if (r.type === 'MeterInstallation') return true;
  if (r.type === 'InfraInstallation') return false;
  if (r.newMeterNo && String(r.newMeterNo).trim()) return true;
  if (r.oldMeterNo && String(r.oldMeterNo).trim()) return true;
  if (r.flatNo && String(r.flatNo).trim()) return true;
  if (r.siteName && !r.deviceNo && !r.infraQty && !r.towerNo) return true;
  return false;
};

/**
 * Check if a record is an Infra Installation (Infra sheet)
 */
export const isInfraRecord = (r: any): r is InfraInstallationRecord => {
  if (!r) return false;
  if (r.type === 'InfraInstallation') return true;
  if (r.type === 'MeterInstallation') return false;
  if (r.deviceNo && String(r.deviceNo).trim()) return true;
  if (r.towerNo && String(r.towerNo).trim()) return true;
  if (r.infraQty !== undefined && r.infraQty !== null && r.infraQty !== '') return true;
  return false;
};

/**
 * Safely parse numeric Infra Qty (Column H in Infra sheet)
 * Correctly handles numbers, strings with units (e.g. "10 Nos"), and preserves 0
 */
export const parseInfraQty = (val: any): number => {
  if (val === undefined || val === null || val === '') return 1;
  const str = String(val).trim();
  if (str === '0') return 0;
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 1 : Math.max(0, num);
};

/**
 * Universal serial / number normalizer:
 * Safely cleans strings, numbers, alphanumerics, removes whitespace.
 */
export const normalizeSerial = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase();
};

/**
 * Deep equality check for meter & device serials:
 * Works across pure numbers ("483903" vs 483903),
 * pure alphabetic ("UT" vs "ut"),
 * and alphanumeric ("A-379" vs "A379" vs "a 379").
 */
export const areSerialsEqual = (a: any, b: any): boolean => {
  const normA = normalizeSerial(a);
  const normB = normalizeSerial(b);
  if (!normA || !normB) return false;

  // 1. Direct match (case-insensitive & trimmed)
  if (normA === normB) return true;

  // 2. Alphanumeric match ignoring hyphens (-, –, —), underscores, dots, slashes, and spaces
  // e.g. "A-379" matches "A379", "a 379", "A–379"
  const cleanA = normA.replace(/[^A-Z0-9]/g, '');
  const cleanB = normB.replace(/[^A-Z0-9]/g, '');
  if (cleanA && cleanB && cleanA === cleanB) return true;

  // 3. Numeric match with leading zeroes if both are pure numbers
  // e.g. "012345" matches "12345" or "00012345"
  if (/^\d+$/.test(cleanA) && /^\d+$/.test(cleanB)) {
    const numA = cleanA.replace(/^0+/, '') || '0';
    const numB = cleanB.replace(/^0+/, '') || '0';
    if (numA === numB) return true;
  }

  // 4. Alphanumeric prefix + number zero-padding match
  // e.g. "M-00123" matches "M-123" or "m123"
  const alphaA = cleanA.replace(/[0-9]/g, '');
  const alphaB = cleanB.replace(/[0-9]/g, '');
  const digitsA = (cleanA.replace(/[^0-9]/g, '')).replace(/^0+/, '') || '0';
  const digitsB = (cleanB.replace(/[^0-9]/g, '')).replace(/^0+/, '') || '0';
  if (alphaA && alphaB && alphaA === alphaB && digitsA === digitsB) {
    return true;
  }

  return false;
};

