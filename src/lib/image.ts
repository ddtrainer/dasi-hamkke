import { LIMITS } from './types'
/** Phone photos are often 5–12 MB; the picked file is re-encoded to <= 800px JPEG (~100 KB) anyway. */
const MAX_INPUT = 25 * 1024 * 1024

/** Validates and re-encodes a user photo: strips EXIF/metadata, caps size to 800px, outputs JPEG. */
export async function sanitizePhoto(file: File): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.')
  if (file.size > MAX_INPUT) throw new Error('사진 용량이 너무 커요. 25MB 이하 사진을 골라 주세요.')
  // decode already scaled down where supported: a 12 MP phone photo as a full bitmap can exhaust a mobile webview's memory
  const bmp = await createImageBitmap(file, { resizeWidth: 1000, resizeQuality: 'medium' } as ImageBitmapOptions)
    .catch(() => createImageBitmap(file))
    .catch(() => { throw new Error('이 사진 형식은 읽을 수 없어요. JPG·PNG 사진으로 골라 주세요.') })
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('변환 실패'))), 'image/jpeg', 0.82))
}
export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b) })

/** Soft procedural portrait used when a memorial has no photo. */
export function defaultPortrait(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 256, 256)
  bg.addColorStop(0, `hsl(${hue},70%,88%)`); bg.addColorStop(1, `hsl(${(hue + 40) % 360},70%,80%)`)
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256)
  g.fillStyle = `hsl(${30 + (h % 20)},60%,62%)`
  g.beginPath(); g.ellipse(128, 140, 70, 64, 0, 0, 7); g.fill()
  g.beginPath(); g.ellipse(70, 100, 24, 44, -0.4, 0, 7); g.ellipse(186, 100, 24, 44, 0.4, 0, 7); g.fill()
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(128, 165, 34, 26, 0, 0, 7); g.fill()
  g.fillStyle = '#3b2b25'
  g.beginPath(); g.arc(104, 128, 7, 0, 7); g.arc(152, 128, 7, 0, 7); g.fill()
  g.beginPath(); g.ellipse(128, 154, 12, 8, 0, 0, 7); g.fill()
  return c.toDataURL('image/jpeg', 0.8)
}
