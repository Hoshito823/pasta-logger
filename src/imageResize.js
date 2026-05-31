// アップロード前に長辺2048pxまで縮小しJPEG再エンコードする。
// 既に十分小さい画像はそのまま返す（再エンコードによる劣化を避けるため）。

const MAX_EDGE = 2048
const JPEG_QUALITY = 0.90
const SKIP_THRESHOLD_BYTES = 500 * 1024 // 500KB未満はそのまま

export async function resizeImageFile(file) {
  if (!file) return file
  if (!file.type.startsWith('image/')) return file
  // PNGは透過を保ちたいケースがあるので触らない
  if (file.type === 'image/png') return file
  if (file.size < SKIP_THRESHOLD_BYTES) return file

  const bitmap = await loadBitmap(file)
  const { width, height } = bitmap
  const longEdge = Math.max(width, height)

  if (longEdge <= MAX_EDGE) {
    bitmap.close?.()
    return file
  }

  const scale = MAX_EDGE / longEdge
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close?.()

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  if (!blob) return file

  const baseName = file.name?.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // フォールバックへ
    }
  }
  return await loadViaImage(file)
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
