import React, { useRef, useState } from 'react';
import { Camera, Trash2, Eye, RefreshCw, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { triggerHaptic } from '../utils/storage';

interface PhotoUploaderProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  onPreview?: (imageUrl: string, title: string) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  label,
  value,
  onChange,
  required = false,
  onPreview,
}) => {
  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [stats, setStats] = useState<{ orig: number; comp: number } | null>(null);

  const processFile = async (file: File) => {
    try {
      setIsCompressing(true);
      triggerHaptic(20);
      const result = await compressImage(file);
      onChange(result.dataUrl);
      setStats({ orig: result.originalSizeKb, comp: result.compressedSizeKb });
      triggerHaptic([30, 40, 30]);
    } catch (err) {
      console.error('Image compression failed', err);
      alert('Could not compress photo. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // reset input so the same photo can be reselected if desired
    e.target.value = '';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {stats && value && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            HD Clear ({stats.comp} KB - WebP HD)
          </span>
        )}
      </div>

      <input
        type="file"
        accept="image/*,image/webp,image/jpeg,image/png,image/heic,image/heif"
        capture="environment"
        className="hidden"
        ref={fileInputCameraRef}
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept="image/*,image/webp,image/jpeg,image/png,image/heic,image/heif"
        className="hidden"
        ref={fileInputGalleryRef}
        onChange={handleFileChange}
      />

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-900 shadow-sm aspect-video max-h-52">
          <img
            src={value}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 flex items-end justify-between p-3">
            <span className="text-xs font-semibold text-white/90 drop-shadow-md">
              Photo captured
            </span>

            <div className="flex items-center gap-2">
              {onPreview && (
                <button
                  type="button"
                  onClick={() => onPreview(value, label)}
                  className="px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 shadow transition active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  fileInputCameraRef.current?.click();
                }}
                className="px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 shadow transition active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onChange(null);
                  setStats(null);
                }}
                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow transition active:scale-95"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isCompressing}
            onClick={() => fileInputCameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-500 transition-all text-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isCompressing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            ) : (
              <Camera className="w-6 h-6 text-indigo-600" />
            )}
            <span className="text-xs font-bold">
              {isCompressing ? 'Optimizing...' : 'Take Photo'}
            </span>
          </button>

          <button
            type="button"
            disabled={isCompressing}
            onClick={() => fileInputGalleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all text-slate-700 active:scale-[0.98] disabled:opacity-50"
          >
            <ImageIcon className="w-6 h-6 text-slate-500" />
            <span className="text-xs font-semibold">Choose Gallery</span>
          </button>
        </div>
      )}
    </div>
  );
};
