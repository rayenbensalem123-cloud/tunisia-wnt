// Checks that lib/translations.ts carries the same set of nested keys in all
// three language blocks (en/fr/ar). A key added to one language with no
// counterpart in the others would otherwise fail silently at runtime.
//
// Run with:  node scripts/check-translations.mjs
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const translationsPath = path.join(here, "..", "lib", "translations.ts")

const mod = await import(translationsPath)
const translations = mod.default

if (!translations || typeof translations !== "object") {
  console.error("Could not find a default export object in lib/translations.ts")
  process.exit(1)
}

const LANGS = ["en", "fr", "ar"]
for (const lang of LANGS) {
  if (!translations[lang] || typeof translations[lang] !== "object") {
    console.error(`Missing or invalid "${lang}" block in lib/translations.ts`)
    process.exit(1)
  }
}

/** Recursively collect dotted key paths for all leaf (non-object) values. */
function collectKeys(obj, prefix = "") {
  const keys = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of collectKeys(v, path)) keys.add(nested)
    } else {
      keys.add(path)
    }
  }
  return keys
}

const keysByLang = Object.fromEntries(LANGS.map((lang) => [lang, collectKeys(translations[lang])]))

let hasMismatch = false
for (const lang of LANGS) {
  for (const other of LANGS) {
    if (lang === other) continue
    const missing = [...keysByLang[other]].filter((k) => !keysByLang[lang].has(k)).sort()
    if (missing.length > 0) {
      hasMismatch = true
      console.error(`\n"${lang}" is missing ${missing.length} key(s) present in "${other}":`)
      for (const k of missing) console.error(`  - ${k}`)
    }
  }
}

if (hasMismatch) {
  console.error("\nTranslation parity check FAILED.")
  process.exit(1)
}

const total = keysByLang.en.size
console.log(`Translation parity check passed: en/fr/ar all share the same ${total} keys.`)
process.exit(0)
