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
} from 'lucide-react';
import { WorkRecord } from '../types';
import { exportRecordsToCSV, triggerHaptic } from '../utils/storage';

interface QueueManagerProps {
  queue: WorkRecord[];
  isSyncing: boolean;
  isOnline: boolean;
  onSync: () => Promise<void>;
  onDeleteItem: (id: string) => void;
  onClearQueue: () => void;
  onPreviewPhoto: (url: string, title: string) => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  queue,
  isSyncing,
  isOnline,
  onSync,
  onDeleteItem,
  onClearQueue,
  onPreviewPhoto,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null);

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
              Entries are safely stored on device and ready to sync to Google Sheets
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
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

        {/* Action toolbar for Exporting Backup */}
        {queue.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Backup:
              </span>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                title="Download CSV Backup"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadJSON}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                title="Download JSON Backup"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                JSON
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to discard all pending queue records?')) {
                  onClearQueue();
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Queue
            </button>
          </div>
        )}
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete from queue"
                    >
                      <Trash2 className="w-4 h-4" />
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
    </div>
  );
};
