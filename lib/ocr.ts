/**
 * Server-side OCR for roster lists that are photos or scanned pages.
 *
 * tesseract.js is loaded dynamically so its worker/core are not pulled into
 * the main route graph. It needs no API key, which matters here: the roster
 * list is sensitive federation data and must not be uploaded to a third-party
 * document-AI service just to read names off it.
 */
export type OcrResult = { lines: string[]; failed: number }

export async function ocrImages(images: Uint8Array[], langs = 'eng+fra+ara'): Promise<OcrResult> {
  if (!images.length) return { lines: [], failed: 0 }
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(langs, 1, { logger: () => {} })
  const lines: string[] = []
  let failed = 0

  try {
    for (const image of images) {
      try {
        const { data } = await worker.recognize(Buffer.from(image))
        for (const line of String(data?.text || '').split(/\r?\n/)) {
          const text = line.trim()
          if (text) lines.push(text)
        }
      } catch {
        failed++
      }
    }
  } finally {
    await worker.terminate()
  }

  return { lines, failed }
}
