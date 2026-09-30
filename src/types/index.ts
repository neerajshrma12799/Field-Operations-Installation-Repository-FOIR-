export type VerticalType = 'PPM' | 'Pvvnl' | 'BB' | 'PUVVNL' | 'NPCL' | 'ATL' | string;

export interface MeterInstallationRecord {
  id: string;
  type: 'MeterInstallation';
  installationDate: string; // Precise auto-captured timestamp (e.g. 28/09/2026, 05:15:30 pm)
  timestamp: string;
  technicianName: string;
  company?: string;
  vertical?: VerticalType;
  siteName: string;
  flatNo: string;
  oldMeterNo: string;
  oldMeterMake: string;
  oldMeterPhoto: string | null;
  newMeterNo: string;
  newMeterMake: string;
  newMeterPhoto: string | null;
  remark: string;
  status?: 'pending' | 'syncing' | 'failed' | 'synced';
  createdAt?: number;
}

export interface InfraInstallationRecord {
  id: string;
  type: 'InfraInstallation';
  installationDate: string; // Precise auto-captured timestamp (e.g. 28/09/2026, 05:15:30 pm)
  timestamp: string;
  technicianName: string;
  company?: string;
  vertical?: VerticalType;
  siteName: string;
  towerNo: string; // Device location
  deviceLocation?: string;
  deviceNo: string;
  infraQty: string;
  devicePhoto: string | null;
  remark: string;
  status?: 'pending' | 'syncing' | 'failed' | 'synced';
  createdAt?: number;
}

export type WorkRecord = MeterInstallationRecord | InfraInstallationRecord;

export interface TechnicianAccount {
  name: string;
  password?: string;
}

export interface SheetStats {
  totalMeterInstall: number;
  todayMeterInstall: number;
  totalInfraInstall: number;
  todayInfraInstall: number;
}

export interface AppSettings {
  scriptUrl: string;
  technicians: string[];
  technicianPasswords?: Record<string, string>;
  defaultPassword?: string;
  meterMakes: string[];
  companies?: string[];
  verticals: string[];
  existingMeterNos?: string[];
  existingDeviceNos?: string[];
  sheetStats?: SheetStats;
  autoSync: true | boolean;
  hapticFeedback: boolean;
  soundEnabled: boolean;
  adminPassword?: string;
}

