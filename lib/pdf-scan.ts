/**
 * Pulls embedded page images out of a scanned PDF so they can be handed to
 * OCR. Text PDFs are handled by lib/pdf-text.ts instead; this is only for the
 * pages that have no text layer (a scanner's output is usually one big image
 * per page).
 *
 * pdfjs exposes decoded page images as raw pixels. Tesseract needs an image
 * file, so raw RGB/RGBA buffers are wrapped in a minimal PNG here using only
 * Node's zlib — no native canvas dependency is required (none is installed in
 * this project). JPEG/PNG images are passed straight through.
 */
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_IMAGES = 12
const MAX_PIXELS = 20_000_000

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** CRC32 table, used by the tiny PNG writer below. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Encodes a raw RGB (3 bytes/px) or RGBA (4 bytes/px) buffer as an 8-bit PNG. */
export function rawToPng(data: Uint8Array, width: number, height: number, bytesPerPixel: number): Buffer {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * bytesPerPixel
      const dst = row + 1 + x * 3
      raw[dst] = data[src]
      raw[dst + 1] = data[src + 1]
      raw[dst + 2] = data[src + 2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * @param buf PDF bytes
 * @param pageNumbers 1-based pages known to have no text layer
 * @returns image buffers suitable for ocrImages()
 */
export async function extractPdfImages(buf: Buffer, pageNumbers: number[]): Promise<Uint8Array[]> {
  if (!pageNumbers.length) return []
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false }).promise
  const images: Uint8Array[] = []

  try {
    for (const n of pageNumbers) {
      if (images.length >= MAX_IMAGES) break
      if (n < 1 || n > doc.numPages) continue

      const page = await doc.getPage(n)
      const ops = await page.getOperatorList()
      for (let i = 0; i < ops.fnArray.length && images.length < MAX_IMAGES; i++) {
        const fn = ops.fnArray[i]
        if (fn !== pdfjs.OPS.paintImageXObject) continue
        const objId = ops.argsArray[i]?.[0]
        if (!objId) continue

        let img: any
        try {
          // pdfjs resolves image objects after the operator list is parsed;
          // the timeout keeps one broken object from stalling the whole import.
          img = await Promise.race([
            new Promise((resolve) => page.objs.get(objId, resolve)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('image timeout')), 5000)),
          ])
        } catch {
          continue
        }
        if (!img?.data || !img.width || !img.height) continue
        if (img.width * img.height > MAX_PIXELS) continue

        const bytes = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength)
        // Already an encoded image — Tesseract reads it directly.
        if (bytes[0] === 0xff && bytes[1] === 0xd8) { images.push(bytes); continue }
        if (Buffer.from(bytes.subarray(0, 8)).equals(PNG_SIG)) { images.push(bytes); continue }

        // pdfjs image kinds: 1 = 1-bit gray, 2 = RGB, 3 = RGBA.
        const bpp = img.kind === 2 ? 3 : img.kind === 3 ? 4 : 0
        if (!bpp || img.data.length < img.width * img.height * bpp) continue
        images.push(rawToPng(bytes, img.width, img.height, bpp))
      }
    }
  } finally {
    await doc.cleanup()
  }

  return images
}
