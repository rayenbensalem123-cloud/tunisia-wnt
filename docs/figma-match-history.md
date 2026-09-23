# Figma — « Centre de commandement — historique »

> Pulled live from Figma file `Uuxv5ZZc3AHz517Ua0aV3y` — "Tunisia WNT — UI Redesign" (2026-09-23).
> Implemented in `app/page.tsx` (HISTORIQUE / match-history board, ~line 2630+).

## Board layout

```
Centre de commandement — historique (1440×1060)
├── Barre de navigation (1440×88)
│   ├── Identité / Emblème "T" / Marque "TACTICAL FEED · ÉQUIPE NATIONALE · TUNISIE"
│   ├── Navigation: TABLEAU DE BORD · CALENDRIER · HISTORIQUE · STATISTIQUES
│   └── Diffusion "SYSTÈMES EN LIGNE" + chevron
└── Contenu (1440×919)
    ├── Historique des matchs (916×811)
    │   ├── En-tête (916×102): "ARCHIVES DE MATCH" / "Historique des matchs" / "Analyse des résultats…"
    │   │   └── Compteur: "24" / "MATCHS ARCHIVÉS"
    │   ├── Filtres (916×49): TOUS LES MATCHS · COMPÉTITION˅ · ADVERSAIRE˅ · SAISON 25/26˅
    │   └── Liste (916×612)
    │       └── Match (916×198)
    │           ├── Résumé (916×126)
    │           │   ├── Métadonnées (185×56): Statut VICTOIRE | "27 JUIL. 2026 · 20:45" | "COUPE D'AFRIQUE · FINALE"
    │           │   ├── Affiche (616×72): "TUNISIE" 🇹🇳 | Score "2 — 1" | TERMINÉ | "ALGÉRIE" 🇩🇿
    │           │   └── chevron-up
    │           └── Détails du match (916×72)
    │               ├── Statistique: "POSSESSION" 54% | "TIRS / CADRÉS" 14 / 6
    │               └── Moments clés: "34' · But find · But" | "78' · Jaziri · But"
    └── [second card] Match — Statut "NUL" · "08 JUIN 2026 · 18:00"
```

## UI tokens

**Colors (most-used → least):**
| Hex | Role | Uses |
|---|---|---|
| `#8290A5` | muted text/icons | 33 |
| `#F3F6FA` | card/surface | 32 |
| `#F7D34A` | gold accent (WIN) | 14 |
| `#E30613` | red accent (LOSS) | 13 |
| `#101D31` | dark navy text | 9 |
| `#43D39E` | success/age green | 7 |
| `#1f2937`-ish | dim lines | — |

**Fonts:** Roboto Mono 700 @44 (hero), Roboto Mono 400 @21, Inter 800/700/600/400.
**Sizes:** 46px hero, 25/24px, 18px, 14/12px, 9px micro-labels (25×).
**Radii:** 6px (15×), 4px (10×), 10px, pill 999 | **Auto-gaps:** H12 / H32 / H28 / V24.

## In-app state

- Live `filteredMatches.length` = "24 MATCHS ARCHIVÉS" counter.
- `opponentFilter` + competition filters → preserves list.
- Result parse `2-1` → WIN (gold `#f6c744`) / DRAW / LOSS (red).
- Expandable row (`selMatch`) → possession, shots, key moments.
- `CountryFlag` per opponent (TUN / ALG).
