import type { AttachmentPayload } from '../types/study';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 3200;
const MAX_PIXELS = 3_800_000;
const TARGET_MAX_BYTES = 450 * 1024;

export async function fileToOptimizedImageAttachment(
  file: File,
  customName?: string
): Promise<AttachmentPayload> {
  const fileName = customName || file.name;

  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });

  if (file.size <= TARGET_MAX_BYTES) {
    return {
      name: fileName,
      mimeType: file.type || 'image/png',
      dataBase64: originalDataUrl.split(',')[1] || '',
      previewUrl: originalDataUrl,
      sizeBytes: file.size,
    };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지 디코딩 실패'));
      el.src = originalDataUrl;
    });

    const pixelScale = Math.sqrt(MAX_PIXELS / Math.max(1, img.width * img.height));
    const scale = Math.min(1, MAX_WIDTH / img.width, MAX_HEIGHT / img.height, pixelScale);
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        name: fileName,
        mimeType: file.type || 'image/png',
        dataBase64: originalDataUrl.split(',')[1] || '',
        previewUrl: originalDataUrl,
        sizeBytes: file.size,
      };
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const compressedBase64 = compressedDataUrl.split(',')[1] || '';
    const estimatedBytes = Math.round((compressedBase64.length * 3) / 4);

    if (estimatedBytes < file.size) {
      return {
        name: fileName,
        mimeType: 'image/jpeg',
        dataBase64: compressedBase64,
        previewUrl: compressedDataUrl,
        sizeBytes: estimatedBytes,
      };
    }
  } catch {
    // Fallback to original image if canvas compression is unavailable
  }

  return {
    name: fileName,
    mimeType: file.type || 'image/png',
    dataBase64: originalDataUrl.split(',')[1] || '',
    previewUrl: originalDataUrl,
    sizeBytes: file.size,
  };
}
