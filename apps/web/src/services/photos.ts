import type { Photo } from '../data/models';

export async function preparePhoto(file: File): Promise<Photo> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('请选择 JPEG、PNG 或 WebP 图片。');
  if (file.size > 10 * 1024 * 1024) throw new Error('原图不能超过 10MB。');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('图片无法解码，请换一张照片。');
  }
  try {
    const ratio = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法处理图片。');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4, 0.25]) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('图片压缩失败。'))),
          'image/jpeg',
          quality,
        ),
      );
      if (blob.size <= 1024 * 1024)
        return { id: crypto.randomUUID(), blob, size: blob.size, mimeType: blob.type };
    }
    throw new Error('无法压缩到 1MB 内，请选择更简单的图片，或移除图片继续。');
  } finally {
    bitmap.close();
  }
}
