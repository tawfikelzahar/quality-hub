// Client-side avatar compression.
//
// Phone photos are often 3–15 MB, but a profile picture is only ever shown
// small (26–56px in this app). Before uploading, we resize to a sensible
// max dimension and re-encode as JPEG — this keeps Supabase Storage usage
// and monthly egress far below what raw uploads would cost, while the
// photo still looks sharp anywhere we display it.
const MAX_DIMENSION = 400
const JPEG_QUALITY = 0.82

export async function compressAvatar(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file // canvas unavailable — fall back to the original file

    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) return file

    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } catch {
    // Any failure (corrupt image, unsupported format, etc.) — just upload
    // the original rather than blocking the user.
    return file
  }
}
