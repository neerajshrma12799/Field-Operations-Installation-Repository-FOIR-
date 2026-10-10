import React from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
}) => {
  const [zoom, setZoom] = React.useState(1);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
          <div className="font-medium text-sm truncate pr-2">{title}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.25))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(4.0, z + 0.35))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
              title="Zoom In (Inspect Numbers)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <a
              href={imageUrl}
              download={`${title.replace(/\s+/g, '_')}.${imageUrl.includes('image/webp') || imageUrl.includes('.webp') ? 'webp' : 'jpg'}`}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px] bg-slate-950">
          <img
            src={imageUrl}
            alt={title}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
            className="max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};
