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
export const parseRecordDate = (timestampStr?: string): Date | null => {
  if (!timestampStr) return null;
  const str = timestampStr.trim();
  
  // Try DD/MM/YYYY format (e.g. 28/09/2026, 12:45:30 PM)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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
 * Check if a date string falls between startDateStr and endDateStr (YYYY-MM-DD)
 */
export const isDateInRange = (
  timestampStr: string | undefined,
  startDateStr: string,
  endDateStr: string
): boolean => {
  if (!startDateStr && !endDateStr) return true;
  const recordDate = parseRecordDate(timestampStr);
  if (!recordDate) return true; // Keep if cannot parse

  if (startDateStr) {
    const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    if (recordDate < start) return false;
  }

  if (endDateStr) {
    const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    if (recordDate > end) return false;
  }

  return true;
};

