/**
 * Compresses an image file on an HTML5 canvas to Max 800x800 at 0.6 JPEG quality.
 * Preserves meter serial readability while maintaining light file sizes suitable
 * for mobile transmission and Google Apps Script payloads.
 */
export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  width: number;
  height: number;
}

export const compressImage = (
  file: File,
  maxDimension = 1280,
  quality = 0.80
): Promise<CompressionResult> => {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        // High-definition clarity optimization:
        // 1280px max dimension & 0.80 JPEG quality ensures meter numbers, LCD readings,
        // revolving dials, barcodes and serial numbers are razor-sharp and clearly readable.
        const MAX_WIDTH = maxDimension;
        const MAX_HEIGHT = maxDimension;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not supported'));
          return;
        }

        // Fill background with white to handle transparent PNGs converting to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // High quality bicubic image smoothing for crisp text, dial numbers and barcodes
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // 0.80 JPEG quality ensures sharp, readable numbers without DCT compression blur
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const approxBase64Bytes = (dataUrl.length * 3) / 4;
        const compressedSizeKb = Math.round(approxBase64Bytes / 1024);

        resolve({
          dataUrl,
          originalSizeKb,
          compressedSizeKb,
          width,
          height,
        });
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };

    reader.readAsDataURL(file);
  });
};
