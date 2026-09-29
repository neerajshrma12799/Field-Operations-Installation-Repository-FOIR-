import React, { useState } from 'react';
import {
  X,
  Settings,
  Link,
  Users,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Volume2,
  Vibrate,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AppSettings } from '../types';
import {
  DEFAULT_SCRIPT_URL,
  DEFAULT_SETTINGS,
  triggerHaptic,
  playFeedbackSound,
} from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onOpenScriptGuide?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onOpenScriptGuide,
}) => {
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
  const [newTech, setNewTech] = useState('');
  const [newTechPass, setNewTechPass] = useState('');
  const [editingTech, setEditingTech] = useState<string | null>(null);
  const [techPasswordInput, setTechPasswordInput] = useState('');
  const [newMake, setNewMake] = useState('');
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleAddTechnician = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTech.trim()) return;
    const name = newTech.trim();
    if (currentSettings.technicians.includes(name)) {
      alert('Technician already exists');
      return;
    }
    const updatedPass = { ...(currentSettings.technicianPasswords || {}) };
    if (newTechPass.trim()) {
      updatedPass[name] = newTechPass.trim();
    }
    setCurrentSettings((prev) => ({
      ...prev,
      technicians: [...prev.technicians, name],
      technicianPasswords: updatedPass,
    }));
    setNewTech('');
    setNewTechPass('');
  };

  const handleSetTechnicianPassword = (techName: string, pass: string) => {
    setCurrentSettings((prev) => ({
      ...prev,
      technicianPasswords: {
        ...(prev.technicianPasswords || {}),
        [techName]: pass.trim(),
      },
    }));
    setEditingTech(null);
    setTechPasswordInput('');
  };

  const handleRemoveTechnician = (tech: string) => {
    if (currentSettings.technicians.length <= 1) {
      alert('Must have at least one technician');
      return;
    }
    const updatedPass = { ...(currentSettings.technicianPasswords || {}) };
    delete updatedPass[tech];
    setCurrentSettings((prev) => ({
      ...prev,
      technicians: prev.technicians.filter((t) => t !== tech),
      technicianPasswords: updatedPass,
    }));
  };

  const handleAddMeterMake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMake.trim()) return;
    const trimmed = newMake.trim();
    if (currentSettings.meterMakes?.includes(trimmed)) {
      alert('Meter make already exists');
      return;
    }
    setCurrentSettings((prev) => ({
      ...prev,
      meterMakes: [...(prev.meterMakes || []), trimmed],
    }));
    setNewMake('');
  };

  const handleRemoveMeterMake = (make: string) => {
    if ((currentSettings.meterMakes || []).length <= 1) {
      alert('Must have at least one meter make');
      return;
    }
    setCurrentSettings((prev) => ({
      ...prev,
      meterMakes: (prev.meterMakes || []).filter((m) => m !== make),
    }));
  };

  const handleTestEndpoint = async () => {
    try {
      setIsTestingEndpoint(true);
      setTestResult(null);
      triggerHaptic(20);

      const response = await fetch(`${currentSettings.scriptUrl}?action=getTechnicians`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'success' || data.technicians) {
        setTestResult({
          success: true,
          msg: `Connected successfully! Found ${
            data.technicians ? data.technicians.length : 0
          } remote technicians.`,
        });
        playFeedbackSound('success');
      } else {
        setTestResult({
          success: true,
          msg: 'Google Apps Script responded, but returned unknown format.',
        });
      }
    } catch (err: unknown) {
      console.warn('Apps script test error', err);
      setTestResult({
        success: false,
        msg: 'Connection test completed. (Note: Google Apps Script may require no-cors POST mode for data saving)',
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  const handleSave = () => {
    triggerHaptic(40);
    playFeedbackSound('click');
    onSaveSettings(currentSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all settings to default configuration?')) {
      setCurrentSettings(DEFAULT_SETTINGS);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">App Settings</h3>
              <p className="text-xs text-slate-500">Configure backend & field preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Apps Script Endpoint */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5 text-indigo-600" /> Google Apps Script URL
          </label>
          <div className="space-y-2">
            <input
              type="url"
              value={currentSettings.scriptUrl}
              onChange={(e) =>
                setCurrentSettings((prev) => ({ ...prev, scriptUrl: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestEndpoint}
                disabled={isTestingEndpoint || !currentSettings.scriptUrl}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                {isTestingEndpoint ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Test Connection
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentSettings((prev) => ({ ...prev, scriptUrl: DEFAULT_SCRIPT_URL }))
                }
                className="text-xs text-indigo-600 hover:underline"
              >
                Reset Default URL
              </button>
            </div>

            {onOpenScriptGuide && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onOpenScriptGuide();
                }}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <span>📜 View &amp; Copy Google Sheet Apps Script (Code.gs)</span>
              </button>
            )}
            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Technician Management & Password Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" /> Field Technicians & Passwords
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Sheet "Technicians" Col A & B</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap gap-2">
              {currentSettings.technicians.map((tech) => {
                const pass = currentSettings.technicianPasswords?.[tech];
                const isEditing = editingTech === tech;

                return (
                  <div
                    key={tech}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 shadow-xs"
                  >
                    <span className="font-semibold">{tech}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingTech(null);
                        } else {
                          setEditingTech(tech);
                          setTechPasswordInput(pass || currentSettings.defaultPassword || '1234');
                        }
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        pass
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={pass ? `Password: ${pass}` : 'Using default PIN (Click to change)'}
                    >
                      🔑 {pass ? pass : 'PIN: 1234'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTechnician(tech)}
                      className="text-slate-400 hover:text-rose-500 transition ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick edit password bar if selected */}
            {editingTech && (
              <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 flex items-center gap-2 text-xs">
                <span className="font-bold text-indigo-900 shrink-0">
                  Password for {editingTech}:
                </span>
                <input
                  type="text"
                  value={techPasswordInput}
                  onChange={(e) => setTechPasswordInput(e.target.value)}
                  placeholder="Enter custom PIN/password..."
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-indigo-300 rounded font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleSetTechnicianPassword(editingTech, techPasswordInput)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition"
                >
                  Save PIN
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTech(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            <form onSubmit={handleAddTechnician} className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                placeholder="New technician name..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={newTechPass}
                onChange={(e) => setNewTechPass(e.target.value)}
                placeholder="Password (Default 1234)"
                className="w-full sm:w-36 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <span>Default fallback PIN if sheet Col B empty:</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={currentSettings.defaultPassword || '1234'}
                  onChange={(e) =>
                    setCurrentSettings((prev) => ({ ...prev, defaultPassword: e.target.value }))
                  }
                  className="w-16 px-1.5 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* New Meter Makes (Linked to Google Sheets 'Technicians' Column C) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" /> New Meter Makes
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Sheet "Technicians" Col C</span>
          </div>
          <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2.5">
            <div className="flex flex-wrap gap-2">
              {(currentSettings.meterMakes || []).map((make) => (
                <span
                  key={make}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-xs font-semibold text-emerald-900 shadow-xs"
                >
                  {make}
                  <button
                    type="button"
                    onClick={() => handleRemoveMeterMake(make)}
                    className="text-slate-400 hover:text-rose-500 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddMeterMake} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newMake}
                onChange={(e) => setNewMake(e.target.value)}
                placeholder="Add meter manufacturer (e.g. Genus)..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Add Make
              </button>
            </form>
          </div>
        </div>

        {/* Verticals List */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" /> Verticals / Divisions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {currentSettings.verticals.map((vert) => (
              <span
                key={vert}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
              >
                {vert}
              </span>
            ))}
          </div>
        </div>

        {/* Toggles (Sound, Haptic, AutoSync) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <label className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-slate-500" />
              Haptic Feedback (Vibration)
            </span>
            <input
              type="checkbox"
              checked={currentSettings.hapticFeedback}
              onChange={(e) =>
                setCurrentSettings((prev) => ({ ...prev, hapticFeedback: e.target.checked }))
              }
              className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-500" />
              Audio Chimes
            </span>
            <input
              type="checkbox"
              checked={currentSettings.soundEnabled}
              onChange={(e) =>
                setCurrentSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))
              }
              className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Bottom actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm active:scale-95"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
