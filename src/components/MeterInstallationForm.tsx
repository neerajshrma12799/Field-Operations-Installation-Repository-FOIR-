import React, { useState } from 'react';
import { CloudUpload, Save, Loader2, Gauge, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { MeterInstallationRecord, VerticalType } from '../types';
import { PhotoUploader } from './PhotoUploader';
import { getIndianTimestamp } from '../utils/timestamp';
import { triggerHaptic } from '../utils/storage';

interface MeterInstallationFormProps {
  onSubmit: (data: Omit<MeterInstallationRecord, 'id'>) => Promise<void>;
  isSubmitting: boolean;
  isOnline: boolean;
  technicians: string[];
  meterMakes: string[];
  companies?: string[];
  verticals: VerticalType[];
  onPreviewPhoto: (url: string, title: string) => void;
  defaultTechnician?: string;
  defaultSiteName?: string;
  onSiteNameChange?: (name: string) => void;
  onRefreshSheet?: () => Promise<void>;
  isRefreshingSheet?: boolean;
  onOpenScriptModal?: () => void;
  hasColumnCData?: boolean;
  existingRecords?: MeterInstallationRecord[];
  sheetExistingMeterNos?: string[];
}

export const MeterInstallationForm: React.FC<MeterInstallationFormProps> = ({
  onSubmit,
  isSubmitting,
  isOnline,
  technicians,
  meterMakes,
  companies = [],
  verticals,
  onPreviewPhoto,
  defaultTechnician = '',
  defaultSiteName = '',
  onSiteNameChange,
  onRefreshSheet,
  isRefreshingSheet = false,
  onOpenScriptModal,
  hasColumnCData = false,
  existingRecords = [],
  sheetExistingMeterNos = [],
}) => {
  const [formData, setFormData] = useState({
    technicianName: '',
    company: '',
    vertical: '' as VerticalType,
    siteName: defaultSiteName || '',
    flatNo: '',
    oldMeterNo: '',
    oldMeterMake: '',
    oldMeterPhoto: null as string | null,
    newMeterNo: '',
    newMeterMake: '',
    newMeterPhoto: null as string | null,
    remark: '',
  });

  const [isCustomMake, setIsCustomMake] = useState(false);
  const [customMakeText, setCustomMakeText] = useState('');
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [customCompanyText, setCustomCompanyText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if current newMeterNo already exists in local history/queue OR directly in Google Sheet
  const trimmedNewMeter = formData.newMeterNo.trim().toUpperCase();
  const existingMeterDuplicate = trimmedNewMeter
    ? existingRecords.find(
        (r) => r.newMeterNo && r.newMeterNo.trim().toUpperCase() === trimmedNewMeter
      )
    : undefined;

  const existsInGoogleSheet =
    trimmedNewMeter && !existingMeterDuplicate
      ? sheetExistingMeterNos.some((no) => no.trim().toUpperCase() === trimmedNewMeter)
      : false;

  const isDuplicateMeter = Boolean(existingMeterDuplicate || existsInGoogleSheet);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.technicianName) newErrors.technicianName = 'Please select a technician';
    if (!formData.vertical) newErrors.vertical = 'Vertical is required';
    if (!formData.siteName.trim()) newErrors.siteName = 'Site name is required';
    if (!formData.flatNo.trim()) newErrors.flatNo = 'Flat / Tower number is required';
    
    if (!formData.newMeterNo.trim()) {
      newErrors.newMeterNo = 'New meter number is required';
    } else if (existingMeterDuplicate) {
      newErrors.newMeterNo = `Duplicate Entry: This meter number already exists! (Entered by ${existingMeterDuplicate.technicianName} on ${existingMeterDuplicate.siteName || 'site'})`;
    } else if (existsInGoogleSheet) {
      newErrors.newMeterNo = 'Duplicate Entry: This meter number already exists in Google Sheet!';
    }

    const finalMake = isCustomMake ? customMakeText.trim() : formData.newMeterMake.trim();
    if (!finalMake) newErrors.newMeterMake = 'New meter make is required';
    if (!formData.newMeterPhoto) newErrors.newMeterPhoto = 'New meter photo is required';

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
    if (!validate()) {
      triggerHaptic([40, 60, 40]);
      return;
    }

    const finalMake = isCustomMake ? customMakeText.trim() : formData.newMeterMake.trim();
    const finalCompany = isCustomCompany ? customCompanyText.trim() : formData.company;
    const preciseIndianTimestamp = getIndianTimestamp();

    triggerHaptic(40);
    await onSubmit({
      ...formData,
      company: finalCompany,
      newMeterMake: finalMake,
      installationDate: preciseIndianTimestamp,
      timestamp: preciseIndianTimestamp,
      type: 'MeterInstallation',
      createdAt: Date.now(),
    });

    // Reset inputs to clean blank state
    setFormData((prev) => ({
      technicianName: '',
      company: '',
      vertical: '' as VerticalType,
      siteName: prev.siteName,
      flatNo: '',
      oldMeterNo: '',
      oldMeterMake: '',
      oldMeterPhoto: null,
      newMeterNo: '',
      newMeterMake: '',
      newMeterPhoto: null,
      remark: '',
    }));
    setCustomMakeText('');
    setCustomCompanyText('');
    setIsCustomMake(false);
    setErrors({});
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5"
    >
      {/* Clean Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Meter Installation
            </h2>
            <p className="text-xs text-slate-500">Record replacement or new connection</p>
          </div>
        </div>
      </div>

      {/* Technician & Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Technician Name <span className="text-rose-500">*</span>
          </label>
          <select
            name="technicianName"
            value={formData.technicianName}
            onChange={handleChange}
            className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
              errors.technicianName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
            }`}
          >
            <option value="">-- Select Technician --</option>
            {technicians.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
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
              <option value="">-- Select Company --</option>
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
              <option value="">-- Select Vertical --</option>
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
            placeholder="e.g. ATS Greens / Express View"
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

      {/* Flat / Tower No */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Flat / Tower No. <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          name="flatNo"
          value={formData.flatNo}
          onChange={handleChange}
          placeholder="e.g. Tower B - 402"
          className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
            errors.flatNo ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
          }`}
        />
        {errors.flatNo && (
          <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.flatNo}
          </p>
        )}
      </div>

      {/* Old Meter Details Card */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Old Meter Details (Optional)
          </h3>
          <span className="text-xs text-slate-500">If replacing existing</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Old Meter Number
            </label>
            <input
              type="text"
              name="oldMeterNo"
              value={formData.oldMeterNo}
              onChange={handleChange}
              placeholder="e.g. MTR-98214"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Old Meter Make
            </label>
            <input
              type="text"
              name="oldMeterMake"
              value={formData.oldMeterMake}
              onChange={handleChange}
              placeholder="e.g. Schneider / L&T / Secure"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <PhotoUploader
          label="Old Meter Photo"
          value={formData.oldMeterPhoto}
          onChange={(val) => setFormData((prev) => ({ ...prev, oldMeterPhoto: val }))}
          onPreview={onPreviewPhoto}
        />
      </div>

      {/* New Meter Details Card */}
      <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            New Meter Details (Required)
          </h3>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>

        {/* New Meter Number & New Meter Make (Column C) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                New Meter Number <span className="text-rose-500">*</span>
              </label>
              {isDuplicateMeter && (
                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3" /> Already Exists
                </span>
              )}
            </div>
            <input
              type="text"
              name="newMeterNo"
              value={formData.newMeterNo}
              onChange={handleChange}
              placeholder="e.g. GEN-8839201"
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 transition ${
                isDuplicateMeter || errors.newMeterNo
                  ? 'border-rose-500 bg-rose-50/40 text-rose-950 focus:ring-rose-500 ring-2 ring-rose-200'
                  : 'border-emerald-300 focus:ring-emerald-500'
              }`}
            />
            {existingMeterDuplicate ? (
              <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Duplicate Meter Number!
                </div>
                <p className="text-[11px] text-rose-700">
                  Yeh meter number already exist karta hai!
                  {existingMeterDuplicate.technicianName && (
                    <span> Entered by <strong>{existingMeterDuplicate.technicianName}</strong></span>
                  )}
                  {existingMeterDuplicate.siteName && (
                    <span> on site <strong>{existingMeterDuplicate.siteName}</strong></span>
                  )}
                  {existingMeterDuplicate.flatNo && (
                    <span> (Flat: {existingMeterDuplicate.flatNo})</span>
                  )}.
                </p>
              </div>
            ) : existsInGoogleSheet ? (
              <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Already In Google Sheet!
                </div>
                <p className="text-[11px] text-rose-700">
                  Yeh new meter number already Google Sheet ke "Meter" tab mein record ho chuka hai! Duplicate entry allow nahi hai.
                </p>
              </div>
            ) : errors.newMeterNo ? (
              <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.newMeterNo}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <div className="flex items-center gap-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  New Meter Make <span className="text-rose-500">*</span>
                </label>
                {onRefreshSheet && (
                  <button
                    type="button"
                    onClick={onRefreshSheet}
                    disabled={isRefreshingSheet || !isOnline}
                    className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100/60 transition disabled:opacity-40"
                    title="Google Sheet 'Technicians' Column C se re-sync karein"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSheet ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMake(!isCustomMake);
                    if (errors.newMeterMake) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.newMeterMake;
                        return next;
                      });
                    }
                  }}
                  className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                >
                  {isCustomMake ? 'Select list' : '+ Custom make'}
                </button>
              </div>
            </div>

            {isCustomMake || meterMakes.length === 0 ? (
              <input
                type="text"
                value={isCustomMake ? customMakeText : formData.newMeterMake}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isCustomMake) {
                    setCustomMakeText(val);
                  }
                  setFormData((prev) => ({ ...prev, newMeterMake: val }));
                  if (errors.newMeterMake) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.newMeterMake;
                      return next;
                    });
                  }
                }}
                placeholder={meterMakes.length === 0 ? "Enter meter manufacturer (e.g. Genus, Secure)..." : "Enter custom meter manufacturer..."}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                  errors.newMeterMake ? 'border-rose-400 bg-rose-50/30' : 'border-emerald-300'
                }`}
              />
            ) : (
              <select
                name="newMeterMake"
                value={formData.newMeterMake}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.newMeterMake) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.newMeterMake;
                      return next;
                    });
                  }
                }}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                  errors.newMeterMake ? 'border-rose-400 bg-rose-50/30' : 'border-emerald-300'
                }`}
              >
                <option value="">-- Select Meter Make --</option>
                {meterMakes.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
            )}
            {errors.newMeterMake && (
              <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.newMeterMake}
              </p>
            )}
          </div>
        </div>

        <div>
          <PhotoUploader
            label="New Meter Photo"
            required
            value={formData.newMeterPhoto}
            onChange={(val) => {
              setFormData((prev) => ({ ...prev, newMeterPhoto: val }));
              if (errors.newMeterPhoto) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.newMeterPhoto;
                  return next;
                });
              }
            }}
            onPreview={onPreviewPhoto}
          />
          {errors.newMeterPhoto && (
            <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.newMeterPhoto}
            </p>
          )}
        </div>
      </div>

      {/* Remark */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Remark / Field Notes
        </label>
        <textarea
          name="remark"
          value={formData.remark}
          onChange={handleChange}
          rows={2}
          placeholder="e.g. CT connected, seal verified, meter placed on board"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
        />
      </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2.5 transition duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer ${
            isOnline
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 focus:ring-4 focus:ring-indigo-300'
              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 focus:ring-4 focus:ring-amber-300'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Record...</span>
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
