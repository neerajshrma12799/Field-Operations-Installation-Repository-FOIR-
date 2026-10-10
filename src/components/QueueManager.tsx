import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Trash2,
  Download,
  AlertTriangle,
  Loader2,
  Eye,
  FileSpreadsheet,
  FileCode,
  Gauge,
  RadioTower,
  Clock,
  MapPin,
  User,
  ShieldCheck,
} from 'lucide-react';
import { WorkRecord } from '../types';
import { exportRecordsToCSV, triggerHaptic } from '../utils/storage';

interface QueueManagerProps {
  queue: WorkRecord[];
  isSyncing: boolean;
  isOnline: boolean;
  onSync: () => Promise<void>;
  onReconcile?: () => Promise<void> | void;
  onImportQueue?: (records: WorkRecord[]) => void;
  onDeleteItem: (id: string) => Promise<void> | void;
  onClearQueue: () => Promise<void> | void;
  onPreviewPhoto: (url: string, title: string) => void;
  processingItemId?: string | null;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  queue,
  isSyncing,
  isOnline,
  onSync,
  onReconcile,
  onImportQueue,
  onDeleteItem,
  onClearQueue,
  onPreviewPhoto,
  processingItemId = null,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleDownloadCSV = () => {
    triggerHaptic(30);
    const csv = exportRecordsToCSV(queue);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `work_queue_backup_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    triggerHaptic(30);
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `work_queue_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyQueue = () => {
    triggerHaptic(30);
    navigator.clipboard.writeText(JSON.stringify(queue, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleManualReconcile = async () => {
    if (!onReconcile) return;
    setIsReconciling(true);
    triggerHaptic(30);
    try {
      await onReconcile();
    } finally {
      setIsReconciling(false);
    }
  };

  const handleExecuteImport = () => {
    setImportError('');
    if (!importText.trim()) {
      setImportError('Please paste queue JSON data first.');
      return;
    }
    try {
      const parsed = JSON.parse(importText.trim());
      const records = Array.isArray(parsed) ? parsed : [parsed];
      if (records.length === 0 || !records[0].type) {
        setImportError('Invalid queue format. Expecting an array of records.');
        return;
      }
      if (onImportQueue) {
        onImportQueue(records);
        setImportText('');
        setIsTransferModalOpen(false);
      }
    } catch (e: any) {
      setImportError('Invalid JSON: ' + (e?.message || 'Parse error'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Pending Queue ({queue.length})
              </h2>
              {queue.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Awaiting Sync
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Entries are safely stored on this phone and ready to sync to Google Sheets
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {onReconcile && isOnline && (
              <button
                type="button"
                onClick={handleManualReconcile}
                disabled={isReconciling || isSyncing}
                className="px-3.5 py-2.5 rounded-xl font-medium text-xs border border-indigo-200 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                title="Google Sheet me check kare ki kya ID ya Serial pehle se save ho chuka hai, aur double entry se bachne ke liye queue se clear kare"
              >
                {isReconciling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>{isReconciling ? 'Checking Sheet...' : 'Check Sheet (Anti-Duplicate)'}</span>
              </button>
            )}

            <button
              onClick={onSync}
              disabled={isSyncing || queue.length === 0 || !isOnline}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer ${
                isOnline && queue.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Sync Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Offline Warning Notice if offline */}
        {!isOnline && queue.length > 0 && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Device is currently offline.</span> You can
              continue saving installations. Once you reconnect to Wi-Fi or cellular network,
              tap <strong>Sync Now</strong> or the app will sync automatically.
            </div>
          </div>
        )}

        {/* Device Local Storage Notice */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-600">
          <span className="text-base leading-none">📱</span>
          <div className="leading-relaxed">
            <strong className="text-slate-800">Phone-Local Offline Queue:</strong> Pending entries are saved on this phone until synced. Once synced, they appear on all phones in the <strong>History</strong> tab.
          </div>
        </div>

        {/* Action toolbar for Exporting / Transferring */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              title="Share or transfer queue between phones"
            >
              🔄 Transfer / Import Queue
            </button>

            {queue.length > 0 && (
              <>
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Backup:
                </span>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  title="Download CSV Backup"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  title="Download JSON Backup"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                  JSON
                </button>
              </>
            )}
          </div>

          {queue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to discard all pending queue records?')) {
                  onClearQueue();
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Queue
            </button>
          )}
        </div>
      </div>

      {/* Queue items list */}
      {queue.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            No records pending synchronization. All submitted meter and infra installations
            have been sent to Google Sheets.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item, index) => {
            const isMeter = item.type === 'MeterInstallation';
            return (
              <div
                key={item.id || index}
                className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isMeter
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {isMeter ? (
                      <Gauge className="w-5 h-5" />
                    ) : (
                      <RadioTower className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {isMeter ? 'Meter Work' : 'Infra Work'}
                      </span>
                      {item.company && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {item.company}
                        </span>
                      )}
                      {item.vertical && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                          {item.vertical}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.siteName}</span>
                      <span className="text-slate-300">•</span>
                      <span>{isMeter ? item.flatNo : item.towerNo}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {item.technicianName}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {item.installationDate || item.timestamp}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    Pending
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(item)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                      title="Inspect record & photos"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      disabled={processingItemId === item.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                      title="Google Sheet me check karke delete ya save karein"
                    >
                      {processingItemId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900">
                  {selectedRecord.type === 'MeterInstallation'
                    ? 'Meter Record Details'
                    : 'Infra Record Details'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                  {selectedRecord.vertical}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50">
                <div>
                  <span className="text-slate-400 block text-xs">Technician</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRecord.technicianName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Installation Date</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRecord.installationDate || selectedRecord.timestamp}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Site Name</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRecord.siteName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">
                    {selectedRecord.type === 'MeterInstallation' ? 'Flat No.' : 'Device Location'}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedRecord.type === 'MeterInstallation'
                      ? selectedRecord.flatNo
                      : (selectedRecord.deviceLocation || selectedRecord.towerNo)}
                  </span>
                </div>
              </div>

              {selectedRecord.type === 'MeterInstallation' ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-xs uppercase text-slate-500">
                      Meter Details
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500">New Meter:</span>{' '}
                      <strong className="text-emerald-700">
                        {selectedRecord.newMeterNo}
                      </strong>
                      {selectedRecord.newMeterMake && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 font-semibold">
                          Make: {selectedRecord.newMeterMake}
                        </span>
                      )}
                    </div>
                    {selectedRecord.oldMeterNo && (
                      <div>
                        <span className="text-slate-500">Old Meter:</span>{' '}
                        <span>
                          {selectedRecord.oldMeterNo} ({selectedRecord.oldMeterMake || 'N/A'})
                        </span>
                      </div>
                    )}
                    {selectedRecord.remark && (
                      <div>
                        <span className="text-slate-500">Remarks:</span>{' '}
                        <span>{selectedRecord.remark}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {selectedRecord.newMeterPhoto && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">
                          New Meter Photo
                        </div>
                        <img
                          src={selectedRecord.newMeterPhoto}
                          alt="New Meter"
                          onClick={() =>
                            onPreviewPhoto(selectedRecord.newMeterPhoto!, 'New Meter Photo')
                          }
                          className="w-full h-32 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90"
                        />
                      </div>
                    )}

                    {selectedRecord.oldMeterPhoto && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">
                          Old Meter Photo
                        </div>
                        <img
                          src={selectedRecord.oldMeterPhoto}
                          alt="Old Meter"
                          onClick={() =>
                            onPreviewPhoto(selectedRecord.oldMeterPhoto!, 'Old Meter Photo')
                          }
                          className="w-full h-32 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-xs uppercase text-slate-500">
                      Infra Hardware
                    </div>
                    <div>
                      <span className="text-slate-500">Device No:</span>{' '}
                      <strong className="text-indigo-700">
                        {selectedRecord.deviceNo}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Quantity:</span>{' '}
                      <span>{selectedRecord.infraQty}</span>
                    </div>
                    {selectedRecord.remark && (
                      <div>
                        <span className="text-slate-500">Remarks:</span>{' '}
                        <span>{selectedRecord.remark}</span>
                      </div>
                    )}
                  </div>

                  {selectedRecord.devicePhoto && (
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-1">
                        Device Photo
                      </div>
                      <img
                        src={selectedRecord.devicePhoto}
                        alt="Device"
                        onClick={() =>
                          onPreviewPhoto(selectedRecord.devicePhoto!, 'Device Photo')
                        }
                        className="w-full h-40 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Device Queue Transfer & Import Modal */}
      {isTransferModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsTransferModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Cross-Device Queue Transfer
                  </h3>
                  <p className="text-xs text-slate-500">
                    Move or copy pending records between phones
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Export from this phone */}
            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-indigo-900 flex items-center gap-1.5">
                  <span>1.</span> Share Queue from this Phone ({queue.length} items)
                </span>
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyQueue}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    {copySuccess ? '✓ Copied!' : 'Copy Queue Data'}
                  </button>
                )}
              </div>
              <p className="text-xs text-indigo-950/80 leading-relaxed">
                Copy this phone's pending queue data to paste it on another phone (via WhatsApp, email, or Bluetooth).
              </p>
            </div>

            {/* Step 2: Import from another phone */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <span className="font-bold text-xs uppercase text-slate-700 flex items-center gap-1.5">
                <span>2.</span> Import Queue from Another Phone
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Paste queue data copied from the first phone here to load it onto this device for syncing:
              </p>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError('');
                }}
                placeholder="Paste queue JSON data here..."
                rows={4}
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
              {importError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {importError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!importText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Import Records into Queue
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
