import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Settings,
  Users,
  Building,
  Layers,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  TrendingDown,
  RadioTower,
  Gauge,
  Plus,
  Trash2,
  Edit2,
  Key,
  Lock,
  Save,
  RefreshCw,
  ExternalLink,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  Search,
  BarChart3,
  ChevronDown,
  UploadCloud,
  FileCode,
  AlertTriangle,
  Share2,
  Copy,
  Send,
  Link,
} from 'lucide-react';
import { AppSettings, WorkRecord } from '../types';
import { triggerHaptic, playFeedbackSound, exportRecordsToCSV, saveServerConfig } from '../utils/storage';
import {
  isDateInRange,
  isRecordToday,
  isRecordYesterday,
  isMeterRecord,
  isInfraRecord,
  parseInfraQty,
  getTodayYMD,
  getYesterdayYMD,
} from '../utils/timestamp';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  history: WorkRecord[];
  isOnline: boolean;
  onRefreshData?: () => Promise<void>;
  isRefreshing?: boolean;
  onOpenScriptGuide?: () => void;
  onPreviewPhoto?: (url: string, title: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  history,
  isOnline,
  onRefreshData,
  isRefreshing = false,
  onOpenScriptGuide,
  onPreviewPhoto,
}) => {
  // Navigation tabs in Admin Portal
  const [activeTab, setActiveTab] = useState<'dashboard' | 'technicians' | 'dropdowns' | 'system'>('dashboard');

  // Dashboard Filters
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterVertical, setFilterVertical] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'meter' | 'infra'>('all');
  
  // Date Range (default: all time or current month)
  const getTodayYMD = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  };

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(true);
  const [aggregationViewMode, setAggregationViewMode] = useState<'today' | 'all'>('today');

  // Dropdown & Technician Management state
  const [techList, setTechList] = useState<string[]>(settings.technicians || []);
  const [techPasswords, setTechPasswords] = useState<Record<string, string>>(settings.technicianPasswords || {});
  const [companyList, setCompanyList] = useState<string[]>(settings.companies || []);
  const [verticalList, setVerticalList] = useState<string[]>(settings.verticals || []);
  const [makeList, setMakeList] = useState<string[]>(settings.meterMakes || []);
  const [scriptUrl, setScriptUrl] = useState<string>(settings.scriptUrl || '');
  const [adminPassword, setAdminPassword] = useState<string>(settings.adminPassword || 'admin');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [passwordSaveMsg, setPasswordSaveMsg] = useState<string | null>(null);

  // Input states for adding new items
  const [newTechName, setNewTechName] = useState('');
  const [newTechPass, setNewTechPass] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newVertical, setNewVertical] = useState('');
  const [newMake, setNewMake] = useState('');

  // Editing existing items
  const [editingTech, setEditingTech] = useState<string | null>(null);
  const [editTechPasswordInput, setEditTechPasswordInput] = useState('');
  const [isSyncingWithSheet, setIsSyncingWithSheet] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Modals for Add & Delete User Confirmations
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'technician' | 'company' | 'vertical' | 'make';
    title: string;
    name: string;
  } | null>(null);

  const [actionSuccessModal, setActionSuccessModal] = useState<{
    action: 'added' | 'removed';
    type: string;
    name: string;
  } | null>(null);

  const [isSettingsSavedModalOpen, setIsSettingsSavedModalOpen] = useState(false);
  const [copiedLinkSuccess, setCopiedLinkSuccess] = useState(false);
  const [shortUrl, setShortUrl] = useState<string>('');
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);
  const [isSavingBackend, setIsSavingBackend] = useState(false);
  const [backendSaveMsg, setBackendSaveMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Auto-refresh live data from Google Sheet whenever Admin Portal opens
  React.useEffect(() => {
    if (isOpen && onRefreshData) {
      onRefreshData();
    }
  }, [isOpen]);

  // Sync state whenever settings change
  React.useEffect(() => {
    setTechList(settings.technicians || []);
    setTechPasswords(settings.technicianPasswords || {});
    setCompanyList(settings.companies || []);
    setVerticalList(settings.verticals || []);
    setMakeList(settings.meterMakes || []);
    setScriptUrl(settings.scriptUrl || '');
    setAdminPassword(settings.adminPassword || 'admin');
  }, [settings]);

  // Extract distinct lists from History and Settings for dynamic filters
  const allSites = useMemo(() => {
    const sites = new Set<string>();
    history.forEach((h) => {
      if (h.siteName && h.siteName.trim()) sites.add(h.siteName.trim());
    });
    return Array.from(sites).sort();
  }, [history]);

  const allTechnicians = useMemo(() => {
    const techs = new Set<string>(techList);
    history.forEach((h) => {
      if (h.technicianName && h.technicianName.trim()) techs.add(h.technicianName.trim());
    });
    return Array.from(techs).sort();
  }, [techList, history]);

  const allCompanies = useMemo(() => {
    const comps = new Set<string>(companyList);
    history.forEach((h) => {
      if (h.company && h.company.trim()) comps.add(h.company.trim());
    });
    return Array.from(comps).sort();
  }, [companyList, history]);

  const allVerticals = useMemo(() => {
    const verts = new Set<string>(verticalList);
    history.forEach((h) => {
      if (h.vertical && h.vertical.trim()) verts.add(h.vertical.trim());
    });
    return Array.from(verts).sort();
  }, [verticalList, history]);

  // Filtered History for Dashboard
  const filteredRecords = useMemo(() => {
    return history.filter((item) => {
      // 1. Team / Technician filter
      if (filterTeam !== 'all' && item.technicianName?.trim().toLowerCase() !== filterTeam.toLowerCase()) {
        return false;
      }
      // 2. Vertical filter
      if (filterVertical !== 'all' && item.vertical?.trim().toLowerCase() !== filterVertical.toLowerCase()) {
        return false;
      }
      // 3. Company filter
      if (filterCompany !== 'all' && item.company?.trim().toLowerCase() !== filterCompany.toLowerCase()) {
        return false;
      }
      // 4. Site filter
      if (filterSite !== 'all' && item.siteName?.trim().toLowerCase() !== filterSite.toLowerCase()) {
        return false;
      }
      // 5. Work type filter
      if (filterType === 'meter' && !isMeterRecord(item)) return false;
      if (filterType === 'infra' && !isInfraRecord(item)) return false;

      // 6. Date Range filter
      const dateToCheck = item.installationDate || item.timestamp;
      if (!isDateInRange(dateToCheck, startDate, endDate)) {
        return false;
      }

      // 7. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.siteName?.toLowerCase().includes(q) ||
          item.technicianName?.toLowerCase().includes(q) ||
          (item.company && item.company.toLowerCase().includes(q)) ||
          (item.vertical && item.vertical.toLowerCase().includes(q)) ||
          (isMeterRecord(item) && (item.newMeterNo?.toLowerCase().includes(q) || item.flatNo?.toLowerCase().includes(q))) ||
          (isInfraRecord(item) && (item.deviceNo?.toLowerCase().includes(q) || item.towerNo?.toLowerCase().includes(q)));
        if (!matches) return false;
      }

      return true;
    });
  }, [history, filterTeam, filterVertical, filterCompany, filterSite, filterType, startDate, endDate, searchQuery]);

  // Exact KPIs Requested by User:
  // 1. Total Meter Installation: count of meter records (new meter or site name)
  // 2. Total Infra Installation: sum (infra Qty Col H)
  // 3. Today Meter Installation: date extracted from timestamp, count today's meters
  // Exact KPIs Requested by User:
  // 1. Total Meter Installation: count of meter records (new meter or site name)
  // 2. Total Infra Installation: sum (infra Qty Col H) - mirrors Google Sheet live sum
  // 3. Today Meter Installation: date extracted from timestamp, count today's meters
  // 4. Today Infra Installation: date extracted from timestamp, sum of infra Qty (Col H)
  const kpis = useMemo(() => {
    const isAllFiltersDefault =
      filterTeam === 'all' &&
      filterVertical === 'all' &&
      filterCompany === 'all' &&
      filterSite === 'all' &&
      filterType === 'all' &&
      !startDate &&
      !endDate &&
      !searchQuery.trim();

    // 1. Total Meter Installation count
    const localMeter = filteredRecords.filter((r) => isMeterRecord(r)).length;
    const totalMeter = isAllFiltersDefault && settings.sheetStats?.totalMeterInstall !== undefined
      ? settings.sheetStats.totalMeterInstall
      : localMeter;

    // 2. Total Infra Installation: sum (infra Qty Col H)
    const localInfraQty = filteredRecords.reduce((sum, r) => {
      if (isInfraRecord(r)) {
        return sum + parseInfraQty(r.infraQty);
      }
      return sum;
    }, 0);

    // If unfiltered, use live Google Sheet total
    const totalInfraQty = isAllFiltersDefault && settings.sheetStats?.totalInfraInstall !== undefined
      ? settings.sheetStats.totalInfraInstall
      : localInfraQty;

    // Filter scope for today & yesterday based on selected team/vertical/company/site
    const matchBaseFilters = (r: WorkRecord) => {
      if (filterTeam !== 'all' && r.technicianName?.trim().toLowerCase() !== filterTeam.toLowerCase()) return false;
      if (filterVertical !== 'all' && r.vertical?.trim().toLowerCase() !== filterVertical.toLowerCase()) return false;
      if (filterCompany !== 'all' && r.company?.trim().toLowerCase() !== filterCompany.toLowerCase()) return false;
      if (filterSite !== 'all' && r.siteName?.trim().toLowerCase() !== filterSite.toLowerCase()) return false;
      return true;
    };

    // 3. Today Meter count (Units)
    const localTodayMeter = history.filter((r) => {
      return matchBaseFilters(r) && isMeterRecord(r) && isRecordToday(r);
    }).length;

    const todayMeterCount = isAllFiltersDefault && settings.sheetStats?.todayMeterInstall !== undefined
      ? settings.sheetStats.todayMeterInstall
      : localTodayMeter;

    // Yesterday Meter count (Units)
    const yesterdayMeterCount = history.filter((r) => {
      return matchBaseFilters(r) && isMeterRecord(r) && isRecordYesterday(r);
    }).length;

    const meterDiffNumber = todayMeterCount - yesterdayMeterCount;
    let meterDiffPercent = 0;
    if (yesterdayMeterCount > 0) {
      meterDiffPercent = Math.round(((todayMeterCount - yesterdayMeterCount) / yesterdayMeterCount) * 100);
    } else if (todayMeterCount > 0) {
      meterDiffPercent = 100;
    }

    // 4. Today Infra Qty (sum of Col H)
    const localTodayInfra = history.reduce((sum, r) => {
      if (matchBaseFilters(r) && isInfraRecord(r) && isRecordToday(r)) {
        return sum + parseInfraQty(r.infraQty);
      }
      return sum;
    }, 0);

    const todayInfraQty = isAllFiltersDefault && settings.sheetStats?.todayInfraInstall !== undefined
      ? settings.sheetStats.todayInfraInstall
      : localTodayInfra;

    // Yesterday Infra Qty (sum of Col H)
    const yesterdayInfraQty = history.reduce((sum, r) => {
      if (matchBaseFilters(r) && isInfraRecord(r) && isRecordYesterday(r)) {
        return sum + parseInfraQty(r.infraQty);
      }
      return sum;
    }, 0);

    const infraDiffNumber = todayInfraQty - yesterdayInfraQty;
    let infraDiffPercent = 0;
    if (yesterdayInfraQty > 0) {
      infraDiffPercent = Math.round(((todayInfraQty - yesterdayInfraQty) / yesterdayInfraQty) * 100);
    } else if (todayInfraQty > 0) {
      infraDiffPercent = 100;
    }

    // Combined Today & Total Work
    const combinedTodayWork = todayMeterCount + todayInfraQty;
    const combinedTotalWork = totalMeter + totalInfraQty;

    return {
      totalMeter,
      totalInfraQty,
      todayMeterCount,
      yesterdayMeterCount,
      meterDiffNumber,
      meterDiffPercent,
      todayInfraQty,
      yesterdayInfraQty,
      infraDiffNumber,
      infraDiffPercent,
      combinedTodayWork,
      combinedTotalWork,
      localInfraQty,
    };
  }, [filteredRecords, history, filterTeam, filterVertical, filterCompany, filterSite, settings.sheetStats, startDate, endDate, searchQuery, filterType]);

  // Team Wise Cluster Graph Data:
  // For each technician: (meter installation count) & (sum Qty infra)
  const teamClusterData = useMemo(() => {
    const techStatsMap: Record<string, { meterCount: number; infraQty: number }> = {};

    filteredRecords.forEach((r) => {
      const tech = r.technicianName?.trim() || 'Unknown';
      if (!techStatsMap[tech]) {
        techStatsMap[tech] = { meterCount: 0, infraQty: 0 };
      }

      if (isMeterRecord(r)) {
        techStatsMap[tech].meterCount += 1;
      } else if (isInfraRecord(r)) {
        techStatsMap[tech].infraQty += parseInfraQty(r.infraQty);
      }
    });

    const entries = Object.entries(techStatsMap).map(([techName, stats]) => ({
      techName,
      meterCount: stats.meterCount,
      infraQty: stats.infraQty,
      totalActivity: stats.meterCount + stats.infraQty,
    }));

    // Sort by highest total activity
    entries.sort((a, b) => b.totalActivity - a.totalActivity);

    // Calculate max value for graph bar scale
    const maxVal = Math.max(...entries.map((e) => Math.max(e.meterCount, e.infraQty)), 1);

    return {
      entries,
      maxVal,
    };
  }, [filteredRecords]);

  // Aggregated Table View matching User Requirement:
  // Sl. no. | Tech name | Company Name / vertical name | site Name | Meter installation Qty | Infra Qty | Remark | Photo
  // Site name unique match with meter & infra Qty
  interface AggregatedRow {
    key: string;
    technicianName: string;
    company: string;
    vertical: string;
    siteName: string;
    todayMeterCount: number;
    meterCount: number;
    todayInfraQty: number;
    infraQty: number;
    remarks: string[];
    samplePhotos: { url: string; title: string }[];
  }

  // Live Today vs Total Stats for Header
  const masterAggregationStats = useMemo(() => {
    let todayMeters = 0;
    let todayInfra = 0;
    let allMeters = 0;
    let allInfra = 0;

    filteredRecords.forEach((r) => {
      const isToday = isRecordToday(r);
      if (isMeterRecord(r)) {
        allMeters += 1;
        if (isToday) todayMeters += 1;
      } else if (isInfraRecord(r)) {
        const q = parseInfraQty(r.infraQty);
        allInfra += q;
        if (isToday) todayInfra += q;
      }
    });

    return { todayMeters, todayInfra, allMeters, allInfra };
  }, [filteredRecords]);

  const aggregatedTableData = useMemo(() => {
    const map = new Map<string, AggregatedRow>();

    filteredRecords.forEach((r) => {
      const tech = r.technicianName?.trim() || '-';
      const comp = r.company?.trim() || '-';
      const vert = r.vertical?.trim() || '-';
      const site = r.siteName?.trim() || '-';

      // Unique combination key: Tech + Company + Vertical + Site Name
      const rowKey = `${tech}___${comp}___${vert}___${site}`;

      if (!map.has(rowKey)) {
        map.set(rowKey, {
          key: rowKey,
          technicianName: tech,
          company: comp,
          vertical: vert,
          siteName: site,
          todayMeterCount: 0,
          meterCount: 0,
          todayInfraQty: 0,
          infraQty: 0,
          remarks: [],
          samplePhotos: [],
        });
      }

      const row = map.get(rowKey)!;
      const isToday = isRecordToday(r);

      if (isMeterRecord(r)) {
        row.meterCount += 1;
        if (isToday) {
          row.todayMeterCount += 1;
        }
        if (r.newMeterPhoto && row.samplePhotos.length < 3) {
          row.samplePhotos.push({ url: r.newMeterPhoto, title: `Meter: ${r.newMeterNo || ''}` });
        }
      } else if (isInfraRecord(r)) {
        const qty = parseInfraQty(r.infraQty);
        row.infraQty += qty;
        if (isToday) {
          row.todayInfraQty += qty;
        }
        if (r.devicePhoto && row.samplePhotos.length < 3) {
          row.samplePhotos.push({ url: r.devicePhoto, title: `Device: ${r.deviceNo || ''}` });
        }
      }

      if (r.remark && r.remark.trim() && !row.remarks.includes(r.remark.trim())) {
        row.remarks.push(r.remark.trim());
      }
    });

    const allRows = Array.from(map.values());
    if (aggregationViewMode === 'today') {
      return allRows
        .filter((r) => r.todayMeterCount > 0 || r.todayInfraQty > 0)
        .sort((a, b) => (b.todayMeterCount + b.todayInfraQty) - (a.todayMeterCount + a.todayInfraQty));
    }
    return allRows.sort((a, b) => (b.meterCount + b.infraQty) - (a.meterCount + a.infraQty));
  }, [filteredRecords, aggregationViewMode]);

  // Quick Date presets
  const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'this_month') => {
    triggerHaptic(20);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
    } else if (preset === 'this_month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toYMD(monthStart));
      setEndDate(toYMD(today));
    }
  };

  // Helper to persist updated configuration to AppSettings & Remote Google Sheet
  const persistChanges = async (
    newConfig: Partial<AppSettings>,
    syncRemote: boolean = true
  ) => {
    const updated: AppSettings = {
      ...settings,
      technicians: newConfig.technicians !== undefined ? newConfig.technicians : techList,
      technicianPasswords: newConfig.technicianPasswords !== undefined ? newConfig.technicianPasswords : techPasswords,
      companies: newConfig.companies !== undefined ? newConfig.companies : companyList,
      verticals: newConfig.verticals !== undefined ? newConfig.verticals : verticalList,
      meterMakes: newConfig.meterMakes !== undefined ? newConfig.meterMakes : makeList,
      scriptUrl: newConfig.scriptUrl !== undefined ? newConfig.scriptUrl : scriptUrl,
      adminPassword: newConfig.adminPassword !== undefined ? newConfig.adminPassword : adminPassword,
    };

    onSaveSettings(updated);

    // Automatically persist scriptUrl & adminPassword permanently to backend server
    saveServerConfig(
      updated.scriptUrl || '',
      settings.adminPassword || 'admin',
      updated.adminPassword || 'admin'
    ).catch(() => {});

    if (syncRemote && isOnline && updated.scriptUrl) {
      setIsSyncingWithSheet(true);
      setSyncStatusMsg(null);
      try {
        const payload = {
          action: 'updateConfig',
          technicians: updated.technicians,
          technicianPasswords: updated.technicianPasswords,
          companies: updated.companies,
          verticals: updated.verticals,
          meterMakes: updated.meterMakes,
          adminPassword: updated.adminPassword,
          replaceCompanies: newConfig.companies !== undefined,
          replaceVerticals: newConfig.verticals !== undefined,
          replaceMeterMakes: newConfig.meterMakes !== undefined,
          replaceTechnicians: newConfig.technicians !== undefined,
        };

        // Dual-channel sync to ensure Google Apps Script catches it regardless of mode:
        // 1. POST with text/plain (CORS safelisted for no-cors, body delivered intact)
        await fetch(updated.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        // 2. Parallel GET query so Google Apps Script handles it either way
        try {
          const getUrl = `${updated.scriptUrl}?action=updateConfig&payload=${encodeURIComponent(JSON.stringify(payload))}`;
          await fetch(getUrl, { method: 'GET', mode: 'no-cors' });
        } catch {
          // ignore get fallback error
        }

        setSyncStatusMsg({
          type: 'success',
          msg: 'Updated in app & pushed to Google Sheet (Technicians, Passwords & Dropdowns)!',
        });
        playFeedbackSound('success');
      } catch (e) {
        console.warn('Google Sheet update push notice', e);
        setSyncStatusMsg({
          type: 'success',
          msg: 'Saved locally in app. Ensure latest Apps Script is deployed in your Sheet.',
        });
      } finally {
        setIsSyncingWithSheet(false);
      }
    } else {
      setSyncStatusMsg({
        type: 'success',
        msg: 'Saved successfully in app settings.',
      });
      playFeedbackSound('success');
    }
  };

  const handleSaveSystemSettings = async () => {
    triggerHaptic(35);
    const cleanPass = adminPassword.trim() || 'admin';
    setAdminPassword(cleanPass);
    await persistChanges({ scriptUrl: scriptUrl.trim(), adminPassword: cleanPass }, true);
    setPasswordSaveMsg('Admin Master Password successfully updated and saved!');
    setTimeout(() => setPasswordSaveMsg(null), 4000);
    setIsSettingsSavedModalOpen(true);
    playFeedbackSound('success');
  };

  const handleForceSyncToSheet = () => {
    triggerHaptic(40);
    persistChanges({
      technicians: techList,
      technicianPasswords: techPasswords,
      companies: companyList,
      verticals: verticalList,
      meterMakes: makeList,
      scriptUrl: scriptUrl,
    }, true);
  };

  const handleTestApi = async () => {
    triggerHaptic(30);
    const targetUrl = scriptUrl.trim();
    if (!targetUrl) {
      setApiTestResult({ success: false, msg: 'Please enter a valid Google Apps Script Web App URL.' });
      return;
    }
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await fetch(`${targetUrl}?action=getTechnicians`);
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
          setApiTestResult({
            success: false,
            msg: 'Google Sign-in page received instead of data! Please check in Google Apps Script: 1) Deploy > Who has access must be set to "Anyone", 2) Click Run > doGet to accept permissions.',
          });
          playFeedbackSound('error');
          return;
        }
        throw new Error('Invalid JSON received from Google Sheet');
      }
      if (data && data.status === 'success') {
        const tCount = data.technicians?.length || 0;
        const mCount = (data.meterMakes || data.makes || []).length;
        const cCount = (data.companies || []).length;
        const vCount = (data.verticals || []).length;
        setApiTestResult({
          success: true,
          msg: `Connected successfully! Found ${tCount} technicians, ${mCount} makes, ${cCount} companies, ${vCount} verticals in Google Sheet.`,
        });
        playFeedbackSound('success');
      } else {
        setApiTestResult({
          success: false,
          msg: `Connected, but received response: ${JSON.stringify(data)}`,
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        msg: `Connection test failed (${err.message || err}). Ensure script is deployed as Web App with "Who has access: Anyone".`,
      });
      playFeedbackSound('error');
    } finally {
      setIsTestingApi(false);
    }
  };

  // Add Technician
  const handleAddTechnician = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTechName.trim();
    if (!name) return;
    if (techList.includes(name)) {
      setSyncStatusMsg({ type: 'error', msg: `Technician "${name}" already exists!` });
      playFeedbackSound('error');
      return;
    }
    const updatedTechs = [...techList, name];
    const updatedPass = { ...techPasswords };
    if (newTechPass.trim()) {
      updatedPass[name] = newTechPass.trim();
    }
    setTechList(updatedTechs);
    setTechPasswords(updatedPass);
    setNewTechName('');
    setNewTechPass('');
    triggerHaptic(30);
    playFeedbackSound('success');
    persistChanges({ technicians: updatedTechs, technicianPasswords: updatedPass });
    setActionSuccessModal({ action: 'added', type: 'Technician', name });
  };

  // Trigger Remove Technician confirmation (Yes / No)
  const handlePromptRemoveTechnician = (tech: string) => {
    triggerHaptic(20);
    setDeleteConfirmTarget({ type: 'technician', title: 'Technician', name: tech });
  };

  // Update Technician Password
  const handleSaveTechPassword = (tech: string) => {
    const updatedPass = { ...techPasswords, [tech]: editTechPasswordInput.trim() };
    setTechPasswords(updatedPass);
    setEditingTech(null);
    setEditTechPasswordInput('');
    triggerHaptic(30);
    playFeedbackSound('success');
    persistChanges({ technicianPasswords: updatedPass });
    setActionSuccessModal({ action: 'added', type: 'Technician Password for', name: tech });
  };

  // Add Company
  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newCompany.trim();
    if (!val || companyList.includes(val)) return;
    const updated = [...companyList, val];
    setCompanyList(updated);
    setNewCompany('');
    triggerHaptic(30);
    playFeedbackSound('success');
    persistChanges({ companies: updated });
    setActionSuccessModal({ action: 'added', type: 'Company', name: val });
  };

  // Trigger Remove Company confirmation (Yes / No)
  const handlePromptRemoveCompany = (item: string) => {
    triggerHaptic(20);
    setDeleteConfirmTarget({ type: 'company', title: 'Company', name: item });
  };

  // Add Vertical
  const handleAddVertical = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newVertical.trim();
    if (!val || verticalList.includes(val)) return;
    const updated = [...verticalList, val];
    setVerticalList(updated);
    setNewVertical('');
    triggerHaptic(30);
    playFeedbackSound('success');
    persistChanges({ verticals: updated });
    setActionSuccessModal({ action: 'added', type: 'Vertical', name: val });
  };

  // Trigger Remove Vertical confirmation (Yes / No)
  const handlePromptRemoveVertical = (item: string) => {
    triggerHaptic(20);
    setDeleteConfirmTarget({ type: 'vertical', title: 'Vertical', name: item });
  };

  // Add Meter Make
  const handleAddMake = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newMake.trim();
    if (!val || makeList.includes(val)) return;
    const updated = [...makeList, val];
    setMakeList(updated);
    setNewMake('');
    triggerHaptic(30);
    playFeedbackSound('success');
    persistChanges({ meterMakes: updated });
    setActionSuccessModal({ action: 'added', type: 'Meter Make', name: val });
  };

  // Trigger Remove Meter Make confirmation (Yes / No)
  const handlePromptRemoveMake = (item: string) => {
    triggerHaptic(20);
    setDeleteConfirmTarget({ type: 'make', title: 'Meter Make', name: item });
  };

  // Execute actual deletion when user confirms "YES"
  const handleExecuteDelete = () => {
    if (!deleteConfirmTarget) return;
    const { type, title, name } = deleteConfirmTarget;

    if (type === 'technician') {
      const updatedTechs = techList.filter((t) => t !== name);
      const updatedPass = { ...techPasswords };
      delete updatedPass[name];
      setTechList(updatedTechs);
      setTechPasswords(updatedPass);
      persistChanges({ technicians: updatedTechs, technicianPasswords: updatedPass });
    } else if (type === 'company') {
      const updated = companyList.filter((c) => c !== name);
      setCompanyList(updated);
      persistChanges({ companies: updated });
    } else if (type === 'vertical') {
      const updated = verticalList.filter((v) => v !== name);
      setVerticalList(updated);
      persistChanges({ verticals: updated });
    } else if (type === 'make') {
      const updated = makeList.filter((m) => m !== name);
      setMakeList(updated);
      persistChanges({ meterMakes: updated });
    }

    setDeleteConfirmTarget(null);
    triggerHaptic([30, 40]);
    playFeedbackSound('click');
    setActionSuccessModal({ action: 'removed', type: title, name });
  };

  // Export filtered CSV
  const handleExportCSV = () => {
    triggerHaptic(30);
    const csv = exportRecordsToCSV(filteredRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Admin_Report_${startDate || 'all'}_to_${endDate || 'all'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 md:p-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-100 w-full h-full sm:h-[97vh] sm:rounded-3xl shadow-2xl max-w-7xl flex flex-col overflow-hidden border-0 sm:border border-slate-300 animate-in zoom-in-95 duration-200">
        
        {/* ======================================================== */}
        {/* 1. TOP HEADER & NAVBAR */}
        {/* ======================================================== */}
        <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border-b border-white/10 shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl sm:rounded-2xl border border-indigo-400/30 shrink-0">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-white leading-tight">
                  Admin Analytics &amp; Control Center
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Google Sheet Connected
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-1">
                KPIs, Clustered Graphs, Master Dropdowns &amp; Unique Site Rollups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isRefreshing}
                className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold rounded-xl text-white flex items-center gap-1.5 transition"
                title="Refresh latest data from Google Sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="hidden md:inline">Sync Sheet</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                onClose();
              }}
              className="px-2.5 sm:px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 active:scale-95 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="Lock Admin Portal & Exit"
            >
              <Lock className="w-3.5 h-3.5 text-rose-300" />
              <span className="hidden sm:inline">Lock &amp; Exit</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Close Admin Portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 2. SUB-NAV TABS */}
        {/* ======================================================== */}
        <div className="bg-white px-4 sm:px-6 py-2 border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto shrink-0 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Live KPIs &amp; Team Cluster</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('technicians')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'technicians'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Technicians &amp; Passwords ({techList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dropdowns')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'dropdowns'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Companies, Verticals &amp; Makes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Google Sheet URL &amp; PIN</span>
            </button>
          </div>

          {syncStatusMsg && (
            <div className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{syncStatusMsg.msg}</span>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. STICKY / FREEZE FILTER BAR (RESPONSIVE & COLLAPSIBLE) */}
        {/* ======================================================== */}
        {activeTab === 'dashboard' && (
          <div className="bg-white/95 backdrop-blur-md px-3 sm:px-6 py-2.5 border-b border-indigo-100/90 shadow-xs shrink-0 z-20 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Filter className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Filters &amp; Range
                </span>
                <button
                  type="button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-600 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{isFilterExpanded ? 'Hide Controls' : 'Show Controls'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Quick Date Shortcuts + Export Button */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyDatePreset('all')}
                    className={`px-2 py-1 text-[11px] rounded-lg font-bold transition ${
                      !startDate && !endDate ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('today')}
                    className="px-2 py-1 text-[11px] rounded-lg font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('yesterday')}
                    className="px-2 py-1 text-[11px] rounded-lg font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    Yday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('this_month')}
                    className="px-2 py-1 text-[11px] rounded-lg font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    Month
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={filteredRecords.length === 0}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs transition disabled:opacity-50"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV ({filteredRecords.length})</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdown Controls (Collapsible) */}
            {isFilterExpanded && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100 animate-in fade-in duration-200">
                {/* Team Wise Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    Team (Tech)
                  </label>
                  <select
                    value={filterTeam}
                    onChange={(e) => setFilterTeam(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Team ({allTechnicians.length})</option>
                    {allTechnicians.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vertical Wise Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    Vertical
                  </label>
                  <select
                    value={filterVertical}
                    onChange={(e) => setFilterVertical(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Verticals ({allVerticals.length})</option>
                    {allVerticals.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Company Wise Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    Company
                  </label>
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Companies ({allCompanies.length})</option>
                    {allCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Site Wise Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    Site Name
                  </label>
                  <select
                    value={filterSite}
                    onChange={(e) => setFilterSite(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Sites ({allSites.length})</option>
                    {allSites.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. SCROLLABLE CONTENT BODY */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {/* Notice if Google Apps Script deployed version is missing sheetStats */}
              {!settings.sheetStats && (
                <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">Google Sheet se Meter &amp; Infra Counts Live Sync Karein</p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Aapke Google Sheet me purana Apps Script code chal raha hai jisme sheet summary count shamil nahi hai. Niche button se updated code copy karein aur Apps Script me <strong>Deploy ➡️ Manage Deployments ➡️ Edit ➡️ New version</strong> karke save karein!
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        onOpenScriptGuide?.();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Updated Code</span>
                    </button>
                    {onRefreshData && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(20);
                          onRefreshData?.();
                        }}
                        disabled={isRefreshing}
                        className="px-2.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Sync Now</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                
                {/* KPI 1: Total Meter Installation */}
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                        Total Meter Install
                      </span>
                      {onRefreshData && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(20);
                            onRefreshData?.();
                          }}
                          className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1 py-0.2 rounded flex items-center gap-0.5 cursor-pointer"
                          title="Refresh live from Google Sheet"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span>sync</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-900 leading-none">
                        {kpis.totalMeter}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">units</span>
                      {settings.sheetStats?.totalMeterInstall !== undefined && (
                        <span className="text-[9px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded ml-1">
                          Sheet: {settings.sheetStats.totalMeterInstall}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Gauge className="w-4 h-4" />
                  </div>
                </div>

                {/* KPI 2: Total Infra Installation (sum infra Qty Col H) */}
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                        Total Infra Install
                      </span>
                      {onRefreshData && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(20);
                            onRefreshData();
                          }}
                          className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-1 py-0.2 rounded flex items-center gap-0.5 cursor-pointer"
                          title="Refresh live from Google Sheet"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span>sync</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-900 leading-none">
                        {kpis.totalInfraQty}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                        sum (Qty)
                      </span>
                      {settings.sheetStats?.totalInfraInstall !== undefined && (
                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                          Sheet: {settings.sheetStats.totalInfraInstall}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <RadioTower className="w-4 h-4" />
                  </div>
                </div>

                {/* KPI 3: Today Meter Installation (Count of Today's Meters) */}
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-100 shadow-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block truncate">
                      Today Meter Install
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xl font-black text-slate-900 leading-none">
                        {kpis.todayMeterCount}
                      </span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
                          kpis.meterDiffNumber >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {kpis.meterDiffNumber >= 0 ? `+${kpis.meterDiffNumber}` : kpis.meterDiffNumber}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 block truncate">
                      Vs Yday: {kpis.yesterdayMeterCount} ({kpis.meterDiffPercent >= 0 ? `+${kpis.meterDiffPercent}%` : `${kpis.meterDiffPercent}%`})
                    </span>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                {/* KPI 4: Today Infra Installation (Sum of Col H Infra Qty) */}
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-sky-100 shadow-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block truncate">
                      Today Infra Install
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xl font-black text-slate-900 leading-none">
                        {kpis.todayInfraQty}
                      </span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
                          kpis.infraDiffNumber >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {kpis.infraDiffNumber >= 0 ? `+${kpis.infraDiffNumber}` : kpis.infraDiffNumber}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 block truncate">
                      Vs Yday: {kpis.yesterdayInfraQty} (sum Qty)
                    </span>
                  </div>
                  <div className="p-2 bg-sky-50 text-sky-600 rounded-lg shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>

                {/* Combined Work Output Banner */}
                <div className="col-span-2 lg:col-span-4 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/80 px-3.5 py-2 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold text-slate-700">Combined Work Summary:</span>
                    <span className="font-bold text-indigo-700">Today: {kpis.combinedTodayWork}</span>
                    <span className="text-slate-500 text-[11px]">(Meters: {kpis.todayMeterCount} + Infra: {kpis.todayInfraQty})</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>Total All-Time Work:</span>
                    <strong className="text-slate-900 font-extrabold">{kpis.combinedTotalWork}</strong>
                    <span className="text-slate-500 text-[11px]">(Meters: {kpis.totalMeter} + Infra: {kpis.totalInfraQty})</span>
                  </div>
                </div>

              </div>

              {/* ======================================================== */}
              {/* 4B. CLUSTERED COMBO CHART (CLUSTERED BARS + TREND LINE) */}
              {/* ======================================================== */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">
                          Team Performance: Clustered Combo Chart
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Combo View
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Dual Clustered Columns (Meter Count &amp; Infra Qty) with Total Work Output Trend
                      </p>
                    </div>
                  </div>

                  {/* Chart Legend & Toggle */}
                  <div className="flex items-center gap-3 text-xs font-bold flex-wrap ml-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
                      <span className="text-slate-700 text-[11px]">Meter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                      <span className="text-slate-700 text-[11px]">Infra</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-amber-500"></span>
                      <span className="text-slate-700 text-[11px]">Output</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChartExpanded(!isChartExpanded)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-600 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isChartExpanded ? 'Collapse' : 'Expand'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isChartExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isChartExpanded && (
                  teamClusterData.entries.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No technician logs found for the selected filter combination.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* SVG Clustered Combo Chart Canvas (Compact 160px) */}
                      {(() => {
                        const data = teamClusterData.entries;
                        const maxBarVal = Math.max(...data.map(d => Math.max(d.meterCount, d.infraQty, 1)));
                        const maxLineVal = Math.max(...data.map(d => d.totalActivity), 1);
                        // Use max scale with 20% breathing headroom
                        const yMax = Math.ceil(Math.max(maxBarVal, maxLineVal * 0.8) * 1.25);

                        const svgHeight = 160;
                        const groupWidth = 60;
                        const barWidth = 16;
                        const paddingLeft = 35;
                        const paddingBottom = 30;
                        const paddingTop = 15;
                        const chartAreaHeight = svgHeight - paddingBottom - paddingTop;
                        const totalSvgWidth = Math.max(data.length * groupWidth + paddingLeft + 20, 420);

                      // Calculate points for the Combo Trend Line
                      const linePoints = data.map((d, i) => {
                        const groupCenterX = paddingLeft + (i * groupWidth) + (groupWidth / 2);
                        const yRatio = d.totalActivity / (yMax * 1.35);
                        const pointY = paddingTop + chartAreaHeight - Math.min(yRatio * chartAreaHeight, chartAreaHeight);
                        return { x: groupCenterX, y: pointY, val: d.totalActivity, tech: d.techName };
                      });

                      const polylineStr = linePoints.map(p => `${p.x},${p.y}`).join(' ');

                      return (
                        <div className="overflow-x-auto w-full pb-2">
                          <svg
                            viewBox={`0 0 ${totalSvgWidth} ${svgHeight}`}
                            className="w-full min-w-[520px] h-60 select-none overflow-visible"
                          >
                            <defs>
                              {/* Gradients */}
                              <linearGradient id="meterColGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4f46e5" />
                                <stop offset="100%" stopColor="#6366f1" />
                              </linearGradient>
                              <linearGradient id="infraColGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#059669" />
                                <stop offset="100%" stopColor="#10b981" />
                              </linearGradient>
                            </defs>

                            {/* Background Grid Lines (Horizontal) */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, gIdx) => {
                              const yPos = paddingTop + chartAreaHeight * (1 - ratio);
                              const labelVal = Math.round(yMax * ratio);
                              return (
                                <g key={gIdx}>
                                  <line
                                    x1={paddingLeft - 10}
                                    y1={yPos}
                                    x2={totalSvgWidth}
                                    y2={yPos}
                                    stroke="#e2e8f0"
                                    strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                                    strokeWidth={ratio === 0 ? '1.5' : '1'}
                                  />
                                  <text
                                    x={paddingLeft - 15}
                                    y={yPos + 3.5}
                                    textAnchor="end"
                                    className="text-[10px] font-bold fill-slate-400 font-mono"
                                  >
                                    {labelVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Clustered Bars for Each Technician */}
                            {data.map((d, i) => {
                              const groupX = paddingLeft + (i * groupWidth);
                              const meterH = Math.min((d.meterCount / yMax) * chartAreaHeight, chartAreaHeight);
                              const infraH = Math.min((d.infraQty / yMax) * chartAreaHeight, chartAreaHeight);

                              const meterX = groupX + (groupWidth / 2) - barWidth - 2;
                              const infraX = groupX + (groupWidth / 2) + 2;

                              const meterY = paddingTop + chartAreaHeight - meterH;
                              const infraY = paddingTop + chartAreaHeight - infraH;

                              return (
                                <g key={d.techName} className="group cursor-pointer">
                                  {/* Bar 1: Meter Installation */}
                                  <rect
                                    x={meterX}
                                    y={meterY}
                                    width={barWidth}
                                    height={Math.max(meterH, 2)}
                                    rx="3"
                                    fill="url(#meterColGrad)"
                                    className="hover:opacity-85 transition-all"
                                  >
                                    <title>{`${d.techName}: ${d.meterCount} Meters`}</title>
                                  </rect>
                                  {d.meterCount > 0 && (
                                    <text
                                      x={meterX + barWidth / 2}
                                      y={meterY - 4}
                                      textAnchor="middle"
                                      className="text-[9px] font-black fill-indigo-800"
                                    >
                                      {d.meterCount}
                                    </text>
                                  )}

                                  {/* Bar 2: Infra Quantity */}
                                  <rect
                                    x={infraX}
                                    y={infraY}
                                    width={barWidth}
                                    height={Math.max(infraH, 2)}
                                    rx="3"
                                    fill="url(#infraColGrad)"
                                    className="hover:opacity-85 transition-all"
                                  >
                                    <title>{`${d.techName}: ${d.infraQty} Infra Qty`}</title>
                                  </rect>
                                  {d.infraQty > 0 && (
                                    <text
                                      x={infraX + barWidth / 2}
                                      y={infraY - 4}
                                      textAnchor="middle"
                                      className="text-[9px] font-black fill-emerald-800"
                                    >
                                      {d.infraQty}
                                    </text>
                                  )}

                                  {/* X-Axis Technician Name */}
                                  <text
                                    x={groupX + groupWidth / 2}
                                    y={svgHeight - 15}
                                    textAnchor="middle"
                                    className="text-[10px] font-bold fill-slate-700 max-w-[65px] truncate"
                                  >
                                    {d.techName.length > 9 ? `${d.techName.substring(0, 8)}…` : d.techName}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Combo Trend Line: Total Activity (Meter + Infra) */}
                            {linePoints.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={polylineStr}
                                className="drop-shadow-xs"
                              />
                            )}

                            {/* Line Point Dots */}
                            {linePoints.map((p, pIdx) => (
                              <g key={pIdx} className="group">
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  fill="#f59e0b"
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="transition-transform group-hover:scale-125"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 8}
                                  textAnchor="middle"
                                  className="text-[9px] font-extrabold fill-amber-700 opacity-90"
                                >
                                  {p.val}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      );
                    })()}

                    {/* Summary Badges below the combo chart */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Field Teams</span>
                        <span className="text-base font-black text-slate-800">{teamClusterData.entries.length} Technicians</span>
                      </div>
                      <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 text-center">
                        <span className="text-[10px] text-indigo-600 font-bold uppercase block">Total Meters</span>
                        <span className="text-base font-black text-indigo-700">
                          {teamClusterData.entries.reduce((acc, c) => acc + c.meterCount, 0)} Units
                        </span>
                      </div>
                      <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 text-center">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase block">Sum Infra Qty</span>
                        <span className="text-base font-black text-emerald-700">
                          {teamClusterData.entries.reduce((acc, c) => acc + c.infraQty, 0)} Devices
                        </span>
                      </div>
                      <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 text-center">
                        <span className="text-[10px] text-amber-700 font-bold uppercase block">Combined Output</span>
                        <span className="text-base font-black text-amber-800">
                          {teamClusterData.entries.reduce((acc, c) => acc + c.totalActivity, 0)} Total
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

              {/* ======================================================== */}
              {/* ======================================================== */}
              {/* 4C. AGGREGATED TABLE VIEW AT BOTTOM (PRIMARY PROMINENT LARGE VIEW) */}
              {/* Sl. no. | Tech name | Company Name / vertical name | site Name | Meter installation Qty | Infra Qty | Remark | Photo */}
              {/* Site name unique match with meter & infra Qty */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden space-y-0">
                <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col gap-3 bg-gradient-to-r from-slate-100 via-indigo-50/30 to-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        Master Aggregation Table View
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                          {aggregatedTableData.length} unique site rollups
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Unique match: Technician + Company / Vertical + Site Name (Live Meter &amp; Infra Qty rollups)
                      </p>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tech, site, company..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Mode Selector & Quick Counters */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        View Focus:
                      </span>
                      <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(20);
                            setAggregationViewMode('today');
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            aggregationViewMode === 'today'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          <span>⚡ Current Day (Today)</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              aggregationViewMode === 'today'
                                ? 'bg-indigo-500/80 text-white'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            M:{masterAggregationStats.todayMeters} | I:{masterAggregationStats.todayInfra}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(20);
                            setAggregationViewMode('all');
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            aggregationViewMode === 'all'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          <span>📅 All Records</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              aggregationViewMode === 'all'
                                ? 'bg-indigo-500/80 text-white'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            M:{masterAggregationStats.allMeters} | I:{masterAggregationStats.allInfra}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
                        Today: <strong>{masterAggregationStats.todayMeters}</strong> Meters + <strong>{masterAggregationStats.todayInfra}</strong> Infra
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                        Overall: <strong>{masterAggregationStats.allMeters}</strong> Meters + <strong>{masterAggregationStats.allInfra}</strong> Infra
                      </span>
                    </div>
                  </div>
                </div>

                {aggregatedTableData.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-slate-500 text-xs font-medium">
                      {aggregationViewMode === 'today'
                        ? 'No meter or infra installations recorded for the current day (today) yet.'
                        : 'No matching records found in this view.'}
                    </p>
                    {aggregationViewMode === 'today' && masterAggregationStats.allMeters + masterAggregationStats.allInfra > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(20);
                          setAggregationViewMode('all');
                        }}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        View All-Time Aggregation ({masterAggregationStats.allMeters} Meters, {masterAggregationStats.allInfra} Infra)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[950px] text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-800 font-extrabold sticky top-0 border-b border-slate-200 z-10 shadow-xs">
                        <tr>
                          <th className="p-3 w-12 whitespace-nowrap">#</th>
                          <th className="p-3 whitespace-nowrap">Tech Name</th>
                          <th className="p-3 whitespace-nowrap">Company / Vertical</th>
                          <th className="p-3 whitespace-nowrap">Site Name</th>
                          <th className="p-3 text-center bg-amber-100/70 text-amber-950 font-black whitespace-nowrap border-x border-amber-200/60">
                            Today Meter (Current Day)
                          </th>
                          <th className="p-3 text-center bg-indigo-100/60 text-indigo-950 font-black whitespace-nowrap">
                            Total Meter
                          </th>
                          <th className="p-3 text-center bg-emerald-100/70 text-emerald-950 font-black whitespace-nowrap border-x border-emerald-200/60">
                            Today Infra Qty (Current Day)
                          </th>
                          <th className="p-3 text-center bg-teal-100/60 text-teal-950 font-black whitespace-nowrap">
                            Total Infra Qty
                          </th>
                          <th className="p-3 whitespace-nowrap">Remark</th>
                          <th className="p-3 text-center whitespace-nowrap">Photo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80">
                        {aggregatedTableData.map((row, idx) => (
                          <tr key={row.key} className="hover:bg-indigo-50/20 transition">
                            {/* Sl. no. */}
                            <td className="p-3 font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Tech name */}
                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[9px] flex items-center justify-center">
                                  {row.technicianName.charAt(0)}
                                </span>
                                {row.technicianName}
                              </span>
                            </td>

                            {/* Company Name / vertical name */}
                            <td className="p-3 text-slate-700 whitespace-nowrap">
                              <span className="font-semibold text-slate-900">{row.company}</span>
                              <span className="text-slate-300 mx-1.5">/</span>
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                                {row.vertical}
                              </span>
                            </td>

                            {/* Site Name (Unique match) */}
                            <td className="p-3 font-extrabold text-indigo-950 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{row.siteName}</span>
                              </div>
                            </td>

                            {/* Today Meter Installation (Current Day) */}
                            <td className="p-3 text-center font-black text-sm text-amber-900 bg-amber-50/40 border-x border-amber-100/80">
                              {row.todayMeterCount > 0 ? (
                                <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 font-extrabold shadow-2xs">
                                  {row.todayMeterCount}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">0</span>
                              )}
                            </td>

                            {/* Total Meter Installation Qty */}
                            <td className="p-3 text-center font-black text-sm text-indigo-700 bg-indigo-50/20">
                              {row.meterCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                                  {row.meterCount}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">0</span>
                              )}
                            </td>

                            {/* Today Infra Qty (Current Day) */}
                            <td className="p-3 text-center font-black text-sm text-emerald-900 bg-emerald-50/40 border-x border-emerald-100/80">
                              {row.todayInfraQty > 0 ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 font-extrabold shadow-2xs">
                                  {row.todayInfraQty}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">0</span>
                              )}
                            </td>

                            {/* Total Infra Qty */}
                            <td className="p-3 text-center font-black text-sm text-teal-700 bg-teal-50/20">
                              {row.infraQty > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
                                  {row.infraQty}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">0</span>
                              )}
                            </td>

                            {/* Remark */}
                            <td className="p-3 text-slate-500 max-w-xs truncate">
                              {row.remarks.length > 0 ? row.remarks.join(', ') : '-'}
                            </td>

                            {/* Photo */}
                            <td className="p-3 text-center">
                              {row.samplePhotos.length > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  {row.samplePhotos.map((photo, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() => onPreviewPhoto && onPreviewPhoto(photo.url, photo.title)}
                                      className="w-7 h-7 rounded-lg border border-slate-200 overflow-hidden hover:opacity-80 transition cursor-pointer"
                                      title={photo.title}
                                    >
                                      <img src={photo.url} alt="Thumbnail" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: TECHNICIANS & PASSWORDS */}
          {activeTab === 'technicians' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Field Technicians &amp; Password Management
                    </h3>
                    <p className="text-xs text-slate-500">
                      Changes here directly update app login permissions and sync to Google Sheet (Tab "Technicians" Col A &amp; B).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleForceSyncToSheet}
                      disabled={isSyncingWithSheet}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      {isSyncingWithSheet ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing to Sheet...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Sync to Google Sheet Now</span>
                        </>
                      )}
                    </button>
                    {onOpenScriptGuide && (
                      <button
                        type="button"
                        onClick={onOpenScriptGuide}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Apps Script Setup</span>
                      </button>
                    )}
                  </div>
                </div>


                {/* Add Technician Form */}
                <form
                  onSubmit={handleAddTechnician}
                  className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Technician Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                      placeholder="e.g. Mohit Sharma"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Password / Security PIN
                    </label>
                    <input
                      type="text"
                      value={newTechPass}
                      onChange={(e) => setNewTechPass(e.target.value)}
                      placeholder="PIN or Password (default: 1234)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add Technician
                    </button>
                  </div>
                </form>

                {/* Mobile Cards View (Phones < 640px) - Guarantees Delete is 100% visible and tap-friendly */}
                <div className="sm:hidden space-y-2.5">
                  {techList.map((tech, idx) => {
                    const pass = techPasswords[tech] || '1234';
                    const isEditing = editingTech === tech;

                    return (
                      <div
                        key={tech}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                              {tech.charAt(0)}
                            </span>
                            <div>
                              <div className="font-bold text-xs text-slate-900">{tech}</div>
                              <div className="text-[10px] text-slate-400 font-mono">#{idx + 1} Technician</div>
                            </div>
                          </div>

                          {/* Mobile Delete Button - Big, Clear & Tap-Friendly */}
                          <button
                            type="button"
                            onClick={() => handlePromptRemoveTechnician(tech)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                            title="Remove technician"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>

                        {/* PIN / Password row */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">PIN / Password:</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editTechPasswordInput}
                                onChange={(e) => setEditTechPasswordInput(e.target.value)}
                                placeholder="New PIN"
                                className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-mono font-bold w-24 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveTechPassword(tech)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-0.5"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTech(null)}
                                className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-800">
                                {pass}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTech(tech);
                                  setEditTechPasswordInput(pass);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" /> Change
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop / Tablet Table View (Hidden on Mobile) */}
                <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Technician Name</th>
                        <th className="p-3">Current Password / PIN</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {techList.map((tech, idx) => {
                        const pass = techPasswords[tech] || '1234';
                        const isEditing = editingTech === tech;

                        return (
                          <tr key={tech} className="hover:bg-slate-50/60 transition">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px]">
                                {tech.charAt(0)}
                              </span>
                              {tech}
                            </td>
                            <td className="p-3">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editTechPasswordInput}
                                    onChange={(e) => setEditTechPasswordInput(e.target.value)}
                                    placeholder="Enter new PIN"
                                    className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-mono font-bold w-32 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTechPassword(tech)}
                                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" /> Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTech(null)}
                                    className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-800">
                                    {pass}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTech(tech);
                                      setEditTechPasswordInput(pass);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold flex items-center gap-0.5"
                                  >
                                    <Edit2 className="w-3 h-3" /> Change
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handlePromptRemoveTechnician(tech)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Remove technician"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DROPDOWNS (COMPANY, VERTICAL, METER MAKES) */}
          {activeTab === 'dropdowns' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-600" />
                    Companies, Verticals &amp; Meter Makes Dropdowns
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add, edit, or remove dropdown options. Updates push directly to Google Sheet (Cols C, D, E).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleForceSyncToSheet}
                    disabled={isSyncingWithSheet}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    {isSyncingWithSheet ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Syncing to Sheet...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Sync Dropdowns to Google Sheet Now</span>
                      </>
                    )}
                  </button>
                  {onOpenScriptGuide && (
                    <button
                      type="button"
                      onClick={onOpenScriptGuide}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Apps Script Setup</span>
                    </button>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Companies */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-600" />
                    Companies ({companyList.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Sheet Col D</span>
                </div>

                <form onSubmit={handleAddCompany} className="flex gap-2">
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="e.g. Genus, Tata..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {companyList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No companies in Sheet (Col D). Add above or update Google Sheet.
                    </div>
                  ) : (
                    companyList.map((c) => (
                      <div
                        key={c}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 transition"
                      >
                        <span>{c}</span>
                        <button
                          type="button"
                          onClick={() => handlePromptRemoveCompany(c)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Verticals */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Verticals ({verticalList.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Sheet Col E</span>
                </div>

                <form onSubmit={handleAddVertical} className="flex gap-2">
                  <input
                    type="text"
                    value={newVertical}
                    onChange={(e) => setNewVertical(e.target.value)}
                    placeholder="e.g. PPM, Pvvnl, BB..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {verticalList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-emerald-50/30 rounded-xl border border-dashed border-emerald-200">
                      No verticals in Sheet (Col E). Add above or update Google Sheet.
                    </div>
                  ) : (
                    verticalList.map((v) => (
                      <div
                        key={v}
                        className="flex items-center justify-between p-2.5 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-950 transition"
                      >
                        <span>{v}</span>
                        <button
                          type="button"
                          onClick={() => handlePromptRemoveVertical(v)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. New Meter Makes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-amber-600" />
                    New Meter Makes ({makeList.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Sheet Col C</span>
                </div>

                <form onSubmit={handleAddMake} className="flex gap-2">
                  <input
                    type="text"
                    value={newMake}
                    onChange={(e) => setNewMake(e.target.value)}
                    placeholder="e.g. Secure, L&T..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {makeList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-amber-50/30 rounded-xl border border-dashed border-amber-200">
                      No meter makes in Sheet (Col C). Add above or update Google Sheet.
                    </div>
                  ) : (
                    makeList.map((m) => (
                      <div
                        key={m}
                        className="flex items-center justify-between p-2.5 bg-amber-50/50 hover:bg-amber-50 rounded-xl border border-amber-200 text-xs font-semibold text-amber-950 transition"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => handlePromptRemoveMake(m)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

          {/* TAB 4: SYSTEM SETTINGS & GOOGLE SHEET URL */}
          {activeTab === 'system' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" />
                    Google Sheet API Endpoint &amp; Security
                  </h3>
                  <button
                    type="button"
                    onClick={handleForceSyncToSheet}
                    disabled={isSyncingWithSheet}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Sync All Configuration to Sheet
                  </button>
                </div>

                {/* API URL and Test Connection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Google Apps Script Web App URL (API Endpoint)
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Must end in /exec</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={scriptUrl}
                      onChange={(e) => setScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestApi}
                      disabled={isTestingApi}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
                    >
                      {isTestingApi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Test API</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const clean = scriptUrl.trim();
                        if (!clean.startsWith('http')) {
                          setBackendSaveMsg({ success: false, text: 'Please enter a valid Google Apps Script URL starting with https:// and ending in /exec' });
                          return;
                        }
                        setIsSavingBackend(true);
                        triggerHaptic(25);
                        const res = await saveServerConfig(clean, settings.adminPassword || 'admin', adminPassword || 'admin');
                        setIsSavingBackend(false);
                        if (res.success) {
                          playFeedbackSound('success');
                          setBackendSaveMsg({
                            success: true,
                            text: '✅ Google Sheet URL Permanently Saved in Backend! Ab kisi bhi link ya Netlify se open karne par sabhi devices me yahi Google Sheet automatically connect hogi.'
                          });
                          persistChanges({ scriptUrl: clean }, true);
                        } else {
                          setBackendSaveMsg({ success: false, text: res.message });
                        }
                      }}
                      disabled={isSavingBackend}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingBackend ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Backend...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save to Backend (Permanent)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Backend Save Feedback */}
                  {backendSaveMsg && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        backendSaveMsg.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {backendSaveMsg.success ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{backendSaveMsg.text}</span>
                    </div>
                  )}

                  {/* API Test Feedback */}
                  {apiTestResult && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        apiTestResult.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {apiTestResult.success ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{apiTestResult.msg}</span>
                    </div>
                  )}
                </div>

                {/* Guide: How to Change API URL */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5">
                  <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                    How to Change / Update Google Sheet API:
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>In your Google Sheet, open <strong>Extensions &gt; Apps Script</strong>.</li>
                    <li>Paste the latest Code.gs (click <strong>View Google Sheet Code.gs</strong> below).</li>
                    <li>Click <strong>Deploy &gt; Manage deployments</strong> (or <strong>New deployment</strong>).</li>
                    <li>Set: Type: <strong>Web app</strong>, Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>.</li>
                    <li>Copy the Web app URL ending in <code>/exec</code> and paste it above, then click <strong>Save System Settings</strong>.</li>
                  </ol>
                </div>

                {/* Share App Link to Technicians (Netlify / Mobile / WhatsApp) */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-200 rounded-xl space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                      Share App Link to Technicians (Short &amp; WhatsApp):
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Short Link Ready</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Aapka Google Sheet URL app link me embedded hai! Is link ko technicians ke saath share karein, unke phone me <strong>same Google Sheet connect ho jayegi aur exact Total Meter &amp; Total Infra Sum match karega</strong>:
                  </p>

                  {/* Clean Direct Link display (Always includes Google Sheet connection) */}
                  {(() => {
                    const activeScriptToShare = scriptUrl.trim() || settings.scriptUrl || '';
                    const fullConfigUrl = activeScriptToShare
                      ? `${window.location.origin}${window.location.pathname}?scriptUrl=${encodeURIComponent(activeScriptToShare)}`
                      : `${window.location.origin}${window.location.pathname}`;
                    const currentShareLink = shortUrl || fullConfigUrl;

                    return (
                      <>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-indigo-900 flex items-center justify-between break-all">
                          <span className="truncate max-w-[80%]">{currentShareLink}</span>
                          <span className="text-[10px] font-sans font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 ml-2">
                            {shortUrl ? 'TinyURL' : 'Full Link'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {/* Copy Direct Link */}
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(20);
                              navigator.clipboard.writeText(currentShareLink);
                              setCopiedLinkSuccess(true);
                              setTimeout(() => setCopiedLinkSuccess(false), 3000);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                          >
                            {copiedLinkSuccess ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Link Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Connected App Link</span>
                              </>
                            )}
                          </button>

                          {/* 1-Click TinyURL Shortener */}
                          <button
                            type="button"
                            disabled={isGeneratingShortUrl}
                            onClick={async () => {
                              try {
                                setIsGeneratingShortUrl(true);
                                triggerHaptic(25);
                                const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullConfigUrl)}`);
                                if (res.ok) {
                                  const tiny = await res.text();
                                  if (tiny && tiny.startsWith('http')) {
                                    setShortUrl(tiny.trim());
                                    navigator.clipboard.writeText(tiny.trim());
                                    setCopiedLinkSuccess(true);
                                    setTimeout(() => setCopiedLinkSuccess(false), 3000);
                                  }
                                }
                              } catch (e) {
                                console.warn('TinyURL generate error', e);
                              } finally {
                                setIsGeneratingShortUrl(false);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isGeneratingShortUrl ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Creating TinyURL...</span>
                              </>
                            ) : (
                              <>
                                <Link className="w-3.5 h-3.5 text-amber-300" />
                                <span>{shortUrl ? 'Re-create TinyURL' : 'Make TinyURL (1-Click)'}</span>
                              </>
                            )}
                          </button>

                          {/* WhatsApp share */}
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `Meter & Infra Field Work Tracker App Link:\n${currentShareLink}\n\n(Is link ko phone me kholein, Google Sheet automatically connect ho jayegi aur Live Data sync ho jayega)`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer no-underline"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Share on WhatsApp</span>
                          </a>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="p-4 bg-slate-50/75 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Admin Portal Master Password
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Technicians cannot access this Admin Portal without this master password.
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        settings.adminPassword && settings.adminPassword !== 'admin'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {settings.adminPassword && settings.adminPassword !== 'admin'
                        ? 'Custom Password Active'
                        : 'Default (admin)'}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter new master password..."
                      className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showAdminPass ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {passwordSaveMsg && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{passwordSaveMsg}</span>
                    </div>
                  )}

                  {adminPassword !== (settings.adminPassword || 'admin') && (
                    <p className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                      Unsaved password change: Click "Save System Settings" below to permanently apply.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  {onOpenScriptGuide && (
                    <button
                      type="button"
                      onClick={onOpenScriptGuide}
                      className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Google Sheet Code.gs
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveSystemSettings}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save System Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ======================================================== */}
        {/* CONFIRM DELETE MODAL (YES / NO) */}
        {/* ======================================================== */}
        {deleteConfirmTarget && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setDeleteConfirmTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900">
                  Confirm Delete
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete {deleteConfirmTarget.title}{' '}
                  <strong className="text-slate-900 font-bold">"{deleteConfirmTarget.name}"</strong> from the database?
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-600/20"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ACTION SUCCESS POPUP (ADDED / REMOVED IN DATABASE) */}
        {/* ======================================================== */}
        {actionSuccessModal && (
          <div
            className="fixed inset-0 z-[75] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setActionSuccessModal(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                  actionSuccessModal.action === 'added'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4
                  className={`text-base font-black ${
                    actionSuccessModal.action === 'added'
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  }`}
                >
                  {actionSuccessModal.action === 'added'
                    ? 'Added Successfully in Database!'
                    : 'Successfully Removed from Database!'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {actionSuccessModal.type}{' '}
                  <strong className="text-slate-900 font-bold">"{actionSuccessModal.name}"</strong>{' '}
                  {actionSuccessModal.action === 'added'
                    ? 'has been added and saved in the database.'
                    : 'has been permanently removed from the database.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActionSuccessModal(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-md"
                >
                  OK, Got it!
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ======================================================== */}
        {/* GOOGLE SHEET LINK & SYSTEM SETTINGS SAVED POPUP */}
        {/* ======================================================== */}
        {isSettingsSavedModalOpen && (
          <div
            className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsSettingsSavedModalOpen(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900">
                  Settings &amp; Google Sheet Link Saved!
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your Google Sheet Web App link and master settings have been saved successfully. Dropdowns will now auto-sync across Meter and Infra forms.
                </p>
                {scriptUrl && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 break-all text-left">
                    <strong>API URL:</strong> {scriptUrl.substring(0, 48)}...
                  </div>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsSavedModalOpen(false)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                >
                  OK, Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
