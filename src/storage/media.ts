const MAX_DIM = 2048
const THUMB_DIM = 256
const WEBP_QUALITY = 0.8

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob)
}

async function resizeToCanvas(
  source: ImageBitmap,
  maxDim: number,
): Promise<OffscreenCanvas> {
  let w = source.width
  let h = source.height
  if (Math.max(w, h) > maxDim) {
    const ratio = maxDim / Math.max(w, h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, w, h)
  return canvas
}

export async function compressImage(blob: Blob): Promise<Blob> {
  const source = await blobToImageBitmap(blob)
  const canvas = await resizeToCanvas(source, MAX_DIM)
  source.close()
  return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
}

export async function generateThumbnail(blob: Blob): Promise<Blob> {
  const source = await blobToImageBitmap(blob)
  const canvas = await resizeToCanvas(source, THUMB_DIM)
  source.close()
  return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
}
