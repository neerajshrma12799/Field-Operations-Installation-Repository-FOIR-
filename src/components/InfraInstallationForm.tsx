import React, { useState, useEffect } from 'react';
import { CloudUpload, Save, Loader2, RadioTower, AlertCircle, Sparkles, Lock } from 'lucide-react';
import { InfraInstallationRecord, VerticalType } from '../types';
import { PhotoUploader } from './PhotoUploader';
import { getIndianTimestamp, areSerialsEqual } from '../utils/timestamp';
import { triggerHaptic, getInfraFormDraft, saveInfraFormDraft, clearInfraFormDraft } from '../utils/storage';

interface InfraInstallationFormProps {
  onSubmit: (data: Omit<InfraInstallationRecord, 'id'>) => Promise<void>;
  isSubmitting: boolean;
  isOnline: boolean;
  technicians: string[];
  companies?: string[];
  verticals: VerticalType[];
  onPreviewPhoto: (url: string, title: string) => void;
  defaultTechnician?: string;
  defaultSiteName?: string;
  onSiteNameChange?: (name: string) => void;
  existingRecords?: InfraInstallationRecord[];
  sheetExistingDeviceNos?: string[];
  onDuplicateAttempt?: (serial: string, reason: string) => void;
}

export const InfraInstallationForm: React.FC<InfraInstallationFormProps> = ({
  onSubmit,
  isSubmitting,
  isOnline,
  technicians,
  companies = [],
  verticals,
  onPreviewPhoto,
  defaultTechnician = '',
  defaultSiteName = '',
  onSiteNameChange,
  existingRecords = [],
  sheetExistingDeviceNos = [],
  onDuplicateAttempt,
}) => {
  const [formData, setFormData] = useState(() => {
    const draft = getInfraFormDraft();
    if (draft && typeof draft === 'object') {
      return {
        technicianName: defaultTechnician || draft.technicianName || '',
        company: draft.company || '',
        vertical: (draft.vertical || '') as VerticalType,
        siteName: draft.siteName || defaultSiteName || '',
        towerNo: draft.towerNo || '',
        deviceNo: draft.deviceNo || '',
        infraQty: draft.infraQty || '1',
        devicePhoto: draft.devicePhoto || null,
        remark: draft.remark || '',
      };
    }
    return {
      technicianName: defaultTechnician || '',
      company: '',
      vertical: '' as VerticalType,
      siteName: defaultSiteName || '',
      towerNo: '',
      deviceNo: '',
      infraQty: '1',
      devicePhoto: null as string | null,
      remark: '',
    };
  });

  // Auto-save draft on change (debounced 250ms to prevent main-thread freeze during typing or photo uploads)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveInfraFormDraft(formData);
    }, 250);
    return () => clearTimeout(timer);
  }, [formData]);

  // Flush draft immediately on unmount or beforeunload (e.g. when opening native camera)
  useEffect(() => {
    return () => {
      saveInfraFormDraft(formData);
    };
  }, [formData]);

  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [customCompanyText, setCustomCompanyText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (defaultTechnician) {
      setFormData((prev) => ({ ...prev, technicianName: defaultTechnician }));
    }
  }, [defaultTechnician]);

  // Robust check for device serial / number duplicates (alphanumeric, numeric, or alphabetic)
  const rawDeviceNo = formData.deviceNo;
  const existingDeviceDuplicate = rawDeviceNo && String(rawDeviceNo).trim()
    ? (existingRecords || []).find((r) => r && areSerialsEqual(r.deviceNo, rawDeviceNo))
    : undefined;

  const existsInGoogleSheet =
    rawDeviceNo && String(rawDeviceNo).trim() && !existingDeviceDuplicate
      ? (sheetExistingDeviceNos || []).some((no) => areSerialsEqual(no, rawDeviceNo))
      : false;

  const isDuplicateDevice = Boolean(existingDeviceDuplicate || existsInGoogleSheet);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.technicianName) newErrors.technicianName = 'Please select a technician';
    if (!formData.vertical) newErrors.vertical = 'Vertical is required';
    if (!formData.siteName.trim()) newErrors.siteName = 'Site name is required';
    if (!formData.towerNo.trim()) newErrors.towerNo = 'Device location is required';

    if (!formData.deviceNo.trim()) {
      newErrors.deviceNo = 'Device number is required';
    } else if (existingDeviceDuplicate) {
      newErrors.deviceNo = `Duplicate Entry: Device #${formData.deviceNo} already exists! (Entered by ${existingDeviceDuplicate.technicianName || 'tech'} on ${existingDeviceDuplicate.siteName || 'site'})`;
    } else if (existsInGoogleSheet) {
      newErrors.deviceNo = `Duplicate Entry: Device #${formData.deviceNo} already exists in Google Sheet!`;
    }

    if (!formData.devicePhoto) newErrors.devicePhoto = 'Device photo is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (name === 'siteName' && onSiteNameChange) {
      onSiteNameChange(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isDuplicateDevice) {
      triggerHaptic([40, 60, 40]);
      if (isDuplicateDevice) {
        const reason = existsInGoogleSheet
          ? `Device #${formData.deviceNo} pehle se Google Sheet me darj hai!`
          : `Device #${formData.deviceNo} pehle se local system / history me darj hai!`;
        if (onDuplicateAttempt) {
          onDuplicateAttempt(formData.deviceNo, reason);
        }
        const deviceInput = document.getElementsByName('deviceNo')[0];
        if (deviceInput) deviceInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const finalCompany = isCustomCompany ? customCompanyText.trim() : formData.company;
    const preciseIndianTimestamp = getIndianTimestamp();

    try {
      triggerHaptic(40);
      await onSubmit({
        ...formData,
        company: finalCompany,
        installationDate: preciseIndianTimestamp,
        timestamp: preciseIndianTimestamp,
        type: 'InfraInstallation',
        createdAt: Date.now(),
      });

      // Clear saved draft on successful save
      clearInfraFormDraft();

      // Reset inputs to clean blank state (technician stays locked if logged in)
      setFormData((prev) => ({
        technicianName: defaultTechnician || '',
        company: '',
        vertical: '' as VerticalType,
        siteName: prev.siteName,
        towerNo: '',
        deviceNo: '',
        infraQty: '1',
        devicePhoto: null,
        remark: '',
      }));
      setCustomCompanyText('');
      setErrors({});
    } catch (err) {
      console.error('Error submitting infra installation:', err);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent accidental form submit when pressing "Enter" on virtual mobile keyboard or barcode scanners
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5"
    >
      {/* Clean Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <RadioTower className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Infra Installation
            </h2>
            <p className="text-xs text-slate-500">Record router, gateway, repeater or DCU</p>
          </div>
        </div>
      </div>

      {/* Technician & Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Technician Name <span className="text-rose-500">*</span>
          </label>
          {defaultTechnician ? (
            <div className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                  {(formData.technicianName || defaultTechnician).charAt(0)}
                </span>
                <span>{formData.technicianName || defaultTechnician}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Locked</span>
              </div>
            </div>
          ) : (
            <select
              name="technicianName"
              value={formData.technicianName}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.technicianName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
              }`}
            >
              <option value="">Select Technician</option>
              {technicians.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          )}
          {errors.technicianName && (
            <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.technicianName}
            </p>
          )}
        </div>

        {/* Company (Column D in Sheet) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Company (Col D)
            </label>
            <button
              type="button"
              onClick={() => setIsCustomCompany(!isCustomCompany)}
              className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              {isCustomCompany ? 'Choose list' : '+ Custom'}
            </button>
          </div>
          {isCustomCompany || companies.length === 0 ? (
            <input
              type="text"
              value={isCustomCompany ? customCompanyText : formData.company}
              onChange={(e) => {
                if (isCustomCompany) setCustomCompanyText(e.target.value);
                setFormData((prev) => ({ ...prev, company: e.target.value }));
              }}
              placeholder={companies.length === 0 ? "Enter company name..." : "Enter custom company name..."}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          ) : (
            <select
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="">Select Company</option>
              {companies.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Vertical (Column E - Mandatory) & Site Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>
              Vertical (Col E) <span className="text-rose-500">*</span>
            </span>
          </label>
          {verticals.length === 0 ? (
            <input
              type="text"
              name="vertical"
              value={formData.vertical}
              onChange={handleChange}
              placeholder="Enter vertical name..."
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.vertical ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
              }`}
            />
          ) : (
            <select
              name="vertical"
              value={formData.vertical}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.vertical ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
              }`}
            >
              <option value="">Select Vertical</option>
              {verticals.map((vert) => (
                <option key={vert} value={vert}>
                  {vert}
                </option>
              ))}
            </select>
          )}
          {errors.vertical && (
            <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.vertical}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Site Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="siteName"
            value={formData.siteName}
            onChange={handleChange}
            placeholder="e.g. Paras Tiara / Supertech"
            className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
              errors.siteName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
            }`}
          />
          {errors.siteName && (
            <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.siteName}
            </p>
          )}
        </div>
      </div>

      {/* Device location */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Device location <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          name="towerNo"
          value={formData.towerNo}
          onChange={handleChange}
          placeholder="e.g. Tower 4 / Terrace / Panel Room / Ground Pole"
          className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
            errors.towerNo ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
          }`}
        />
        {errors.towerNo && (
          <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.towerNo}
          </p>
        )}
      </div>

      {/* Device Number & Infra Quantity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Device Number / Serial <span className="text-rose-500">*</span>
            </label>
            {isDuplicateDevice && (
              <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3" /> Already Exists
              </span>
            )}
          </div>
          <input
            type="text"
            name="deviceNo"
            value={formData.deviceNo}
            onChange={handleChange}
            placeholder="e.g. DCU-40912 / GW-991"
            className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition ${
              isDuplicateDevice || errors.deviceNo
                ? 'border-rose-500 bg-rose-50/40 text-rose-950 focus:ring-rose-500 ring-2 ring-rose-200'
                : 'border-slate-200 focus:ring-indigo-500'
            }`}
          />
          {existingDeviceDuplicate ? (
            <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-0.5">
              <div className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Duplicate Device / Serial!
              </div>
              <p className="text-[11px] text-rose-700">
                Yeh device number already exist karta hai!
                {existingDeviceDuplicate.technicianName && (
                  <span> Entered by <strong>{existingDeviceDuplicate.technicianName}</strong></span>
                )}
                {existingDeviceDuplicate.siteName && (
                  <span> on site <strong>{existingDeviceDuplicate.siteName}</strong></span>
                )}
                {existingDeviceDuplicate.towerNo && (
                  <span> (Location: {existingDeviceDuplicate.towerNo})</span>
                )}.
              </p>
            </div>
          ) : existsInGoogleSheet ? (
            <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-0.5">
              <div className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Already In Google Sheet!
              </div>
              <p className="text-[11px] text-rose-700">
                Yeh device / serial number already Google Sheet ke "Infra" tab mein record ho chuka hai! Duplicate entry allow nahi hai.
              </p>
            </div>
          ) : errors.deviceNo ? (
            <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.deviceNo}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Infra Quantity
          </label>
          <input
            type="number"
            min="1"
            max="100"
            name="infraQty"
            value={formData.infraQty}
            onChange={handleChange}
            placeholder="1"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Device Photo */}
      <div className="bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 space-y-2">
        <PhotoUploader
          label="Device Photo"
          required
          value={formData.devicePhoto}
          onChange={(val) => {
            setFormData((prev) => ({ ...prev, devicePhoto: val }));
            if (errors.devicePhoto) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.devicePhoto;
                return next;
              });
            }
          }}
          onPreview={onPreviewPhoto}
        />
        {errors.devicePhoto && (
          <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.devicePhoto}
          </p>
        )}
      </div>

      {/* Remark */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Remark / Mounting Details
        </label>
        <textarea
          name="remark"
          value={formData.remark}
          onChange={handleChange}
          rows={2}
          placeholder="e.g. Mounted on mast pole with weather-proof casing"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
        />
      </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || isDuplicateDevice}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2.5 transition duration-200 active:scale-[0.99] disabled:opacity-70 cursor-pointer ${
            isDuplicateDevice
              ? 'bg-rose-600 cursor-not-allowed shadow-rose-200'
              : isOnline
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 focus:ring-4 focus:ring-indigo-300'
              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 focus:ring-4 focus:ring-amber-300'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Record...</span>
            </>
          ) : isDuplicateDevice ? (
            <>
              <AlertCircle className="w-5 h-5" />
              <span>Duplicate Device - Cannot Submit</span>
            </>
          ) : isOnline ? (
            <>
              <CloudUpload className="w-5 h-5" />
              <span>Save Online to Google Sheets</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Offline to Queue</span>
            </>
          )}
        </button>
    </form>
  );
};
