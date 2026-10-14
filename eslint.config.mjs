// eslint-config-next 16.x ships a native ESLint 9 flat config (no FlatCompat
// bridge needed - that bridge was tried first and crashed with a circular
// JSON error from double-loading the react plugin, which is a known
// incompatibility when wrapping this package's config through the legacy
// compat layer instead of importing its flat export directly).
import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'scripts/**', // plain-node test/maintenance scripts, not app code
      'migrations/**',
    ],
  },
  {
    // This config was wired up for the first time in this commit - lint had
    // never actually run on this codebase before (the "lint" script existed
    // but eslint itself wasn't even installed). eslint-config-next's
    // react-hooks ruleset includes several newer, stricter "React Compiler
    // readiness" rules (set-state-in-effect, static-components, purity,
    // immutability, refs) that flag long-standing, idiomatic patterns
    // throughout this codebase (e.g. reading localStorage and syncing state
    // in a mount effect in lib/theme-context.tsx, lib/language-context.tsx,
    // lib/players-context.tsx). None of that is new breakage - it's existing
    // behavior being seen by a linter for the first time. Rewriting dozens
    // of call sites across core app state to satisfy these rules is a real,
    // behavior-touching refactor that deserves its own reviewed change, not
    // something to do silently while wiring up CI. Downgraded to warnings
    // (so they stay visible and don't silently disappear) rather than left
    // as errors (which would block every future PR on unrelated code).
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]

export default eslintConfig
