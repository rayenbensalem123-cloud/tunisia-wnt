/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pdfjs-dist"],
  // Tesseract spawns a worker thread from a file inside its own package.
  // Vercel's file tracing does not follow that dynamic path, so the deployed
  // function silently misses it and every OCR request hangs until timeout.
  outputFileTracingIncludes: {
    "/api/import-players": [
      "./node_modules/tesseract.js/src/worker-script/node/**",
      "./node_modules/tesseract.js-core/**",
    ],
  },
}

export default nextConfig
