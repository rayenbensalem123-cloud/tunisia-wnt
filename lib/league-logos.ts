// Default crests for well-known Tunisian clubs, used when a club has not uploaded
// its own logo. A club that uploads a real logo always wins — this is only a fallback.

const BASE = '/league-logos'

// Slugs are the keys; each entry lists the words that identify that club in a
// team name, so "Club Sportif Sfaxien", "CS Sfaxien" and "Sfaxien" all match.
const MATCHERS: { slug: string; keys: string[] }[] = [
  { slug: 'as-soliman', keys: ['soliman'] },
  { slug: 'avenir-sportif-de-gabes', keys: ['gabes', 'gabès'] },
  { slug: 'avenir-sportif-de-la-marsa', keys: ['marsa'] },
  { slug: 'club-africain', keys: ['africain'] },
  { slug: 'club-athletique-bizertin', keys: ['bizertin', 'bizertine'] },
  { slug: 'cs-sfaxien', keys: ['sfaxien', 'sfaxienne', 'sfax'] },
  { slug: 'es-zarzis', keys: ['zarzis'] },
  { slug: 'esperance-sportive-de-tunis', keys: ['esperance', 'espérance'] },
  { slug: 'etoile-sportive-de-metlaoui', keys: ['metlaoui', 'métlaoui'] },
  { slug: 'etoile-sportive-du-sahel', keys: ['sahel', 'etoile', 'étoile'] },
  { slug: 'jeunesse-sportive-d-el-omrane', keys: ['omrane', 'omran'] },
  { slug: 'js-kairouanaise', keys: ['kairouan'] },
  { slug: 'olympique-beja', keys: ['beja', 'béja'] },
  { slug: 'stade-tunisien', keys: ['stade'] },
  { slug: 'us-ben-guerdane', keys: ['guerdane'] },
  { slug: 'us-monastir', keys: ['monastir'] },
]

/** Lower-case, strip accents and punctuation so name variants collapse to one form. */
function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Path of the default crest for a club name, or '' when nothing matches.
 * Longest key wins, so "etoile" cannot steal a club whose name also says "sahel".
 */
export function defaultLeagueLogo(name: string): string {
  const n = normalize(name || '')
  if (!n) return ''
  let best: { slug: string; len: number } | null = null
  for (const m of MATCHERS) {
    for (const key of m.keys) {
      if (n.includes(key) && (!best || key.length > best.len)) best = { slug: m.slug, len: key.length }
    }
  }
  if (best) return `${BASE}/${best.slug}.webp`
  // No name matched: give the box a crest anyway, chosen deterministically from the
  // name so a club keeps the same one on every reload. Set MATCH_ONLY to true to
  // leave unmatched clubs on the generated initials crest instead.
  if (MATCH_ONLY) return ''
  let h = 0
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `${BASE}/${MATCHERS[h % MATCHERS.length].slug}.webp`
}

// Temporary: fill every box so the league grid can be seen with crests on it.
const MATCH_ONLY = false
