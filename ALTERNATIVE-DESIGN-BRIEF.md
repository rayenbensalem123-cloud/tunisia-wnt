# Brief — Design system candidat B

Prototype de revoisement visuel pour **Tunisia WNT · Elite Squad Manager**, a comparer
avec le design actuel. Statut : **candidat**, non fusionne. Ne rien modifier dans l'app
existante tant que le choix n'est pas fait.

---

## 1. Pourquoi ce brief existe

Le design actuel n'a pas de design system : il a un empilement de valeurs arbitraires.
Constat mesure sur la base de code :

| Fichier | Hex en dur |
| --- | --- |
| `app/page.tsx` (238 Ko) | 504 |
| `components/stages-manager.tsx` | 153 |
| autres composants `.tsx` | 4 a 10 chacun |
| `app/globals.css` (1 282 lignes) | 379 |

Consequences mesurees :

1. Les deux themes sontmediocres parce que le mode clair est un pansement pose sur
   ~80 tokens `--c-*`, et ~700 valeurs hex en dur ne lui obeissent pas.
2. Les vars shadcn/oklch (`--background`, `--primary`, `--card`...) ne sont definies
   qu'en clair dans `:root` et ne sont jamais rethemees : en mode sombre elles restent
   claires.
3. `theme-color` est fige a `#E30613` dans `app/layout.tsx` alors que le fond sombre
   est `#0b111e`.
4. Deux systemes visuels se percutent : tokens maison (navy / or / rouge) coexistent
   avec du Tailwind par defaut qui fuit (`text-zinc-500` sur les onglets,
   `app/page.tsx:1220`).
5. `text-[9px] font-black uppercase tracking-widest` revient en boucle : signature
   "dashboard IA", illisible sur mobile.

**Objectif de ce candidat : etre visuellement maximalement eloigne de l'existant**, pour
que la comparaison soit équitable. Deux directions proches ne se comparent pas.

---

## 2. Direction retenue

**« Document institutionnel »** — base papier creme, encre, rouge utilise avec
parcimonie, titres en serif, mise en page aeree. Les fiches joueurs deviennent des
feuilles de selection imprimees. **Clair d'abord**, un seul theme.

Justification : c'est l'ecart maximal avec le rendu « diffuseur TV » bleu nuit / or
actuel, ca supprime le theme sombre casse au lieu de le reparer, et ca correspond a un
outil de staff plus qu'a une vitrine.

### Alternatives classees (pivot peu coûteux si rejet)

2. **« Tunisie assumee »** — le rouge devient la couleur dominante au lieu du bleu nuit,
   blanc creme au sol, or strictement reserve au statut et aux recompenses.
3. **« Sombre cinematique »** — quasi-noir chaud, rouge uniquement pour l'alerte, un
   seul theme bien fait.
4. **« Centre de donnees »** — graphite neutre, densite, mono pour les chiffres.

---

## 3. Livrable attendu

**Un seul fichier HTML autonome : `design-system-b.html`.**

Il contient :

1. **La feuille de tokens** — une Couche de variables CSS unique, sans nom shadcn
   herite. Convention : `--surface-*`, `--ink-*`, `--accent-*`, `--rule-*`, `--space-*`,
   `--type-*`.
2. **Les composants** — boutons, inputs, tuiles joueur, fiches equipe, modale match,
   onglets, badges de discipline, chips de filtre, tableau de stats.
3. **Quatre ecrans de reference**, en francais (le domain est bilingue EN/FR/AR, mais ce
   prototype est FR) :
   - **Selection de categorie** (entree).
   - **Joueurs** — liste + filtres + fiche joueur ouverte.
   - **Stats** — tableau dense, chiffres alignes en mono.
   - **Staff** — entraineurs, delegue, categorie senior (cf. `app/coaches/page.tsx`).

Interface AR : prevoir `dir="rtl"` sur une variante ou au moins un test de reflow, le
domain existe deja (`lib/translations.ts` : `en` / `fr` / `ar`).

### Ecarts explicites par rapport a l'existant

- Corps de texte a **13 px minimum**, les 9 px sont interdits.
- Chiffres, numeros de maillot, totaux : **chasse fixe / tabulaire**, alignes a droite.
- **Un seul accent**, utilise au maximum deux fois par ecran.
- Aucune ombre portee molle. Separation par **filet** (regle), pas par profondeur.
- Coins sobres : rayon 2 a 4 px max, pas 12 px.
- Aucun degrade, sauf une seule surface de heroeventuellement.
- Chaque composant doit exister en **etat focus visible** (`:focus-visible`, jamais
  `outline: none` sans remplacement) et en etat vide.

---

## 4. Contraintes techniques

- **Un seul fichier HTML**, autonome, zero dependance reseau : pas de CDN de police,
  pas de police externe, pas d'image distante. Police de secours systeme
  (`ui-serif, Georgia, serif` pour le display, `ui-sans-serif, system-ui` pour le corps,
  `ui-monospace, SFMono-Regular, monospace` pour les chiffres).
- Les images passent par des **blocs de substitution en CSS** (`.ph` avec gradient
  sobre), jamais par des URLs.
- Reflow mobile : un seul point de rupture cible a **720 px**, pas de largeur fixe.
- `prefers-reduced-motion` et `prefers-color-scheme` geres.
- Chaque section porte un `data-od-id` pour le mode commentaire.
- **Aucun fichier de l'application existante ne doit etre modifie** par ce candidat.

---

## 5. Reference metier (pour un prototype credible)

Source : `lib/translations.ts` et `app/page.tsx`.

- Categories d'equipe : **Seniors**, **U-20**, **U-17**.
- Onglets : **Joueurs**, **Staff**, **Stats**. Le header affiche
  « WOMEN'S FOOTBALL DEPARTMENT ».
- Postes joueurs : Gardien, Defenseur, Milieu, Attaquant. Postes staff : entraineur,
  adjoint, etc.
- Champs joueur : nom complet, club, date de naissance, poste, numero de maillot,
  taille, selections, buts, passes decisives, discipline, club, langue, contrat.
- **Regle CAF : 2 cartons jaunes = 1 match de suspension. Carton rouge = 1 match
  immediat.** C'est une regle structurante de l'UI, pas une mention en bas de page.
- Non selectionnes pour un match = carton jaune automatique.
- Joueuse non selectionnable = bandeau « SUSPENDED » ou « ONE MORE = SUSPENDED ».

---

## 6. Critere de sortie

Le candidat est livre quand :

- [ ] Un seul fichier HTML autonome, aucun asset externe.
- [ ] Aucun texte sous 13 px, aucun `font-black uppercase` en 9 px.
- [ ] Les quatre ecrans sont presents et Utilisables au clavier.
- [ ] Un accent, deux usages maximum par ecran.
- [ ] Focus visible partout, etat vide dessine.
- [ ] Reflow a 360 px verifie.
- [ ] Le contraste du texte de corps passe 4.5:1 sur fond creme.
- [ ] La comparaison avec le design actuel est possible sans changer d'outil.

---

## 7. Apres le choix

Si le candidat B est retenu, le report se fait **en dernier**, jamais avant :

1. Porter les tokens gagnants dans `app/globals.css` (un seul `:root`, supprimer la
   famille shadcn/oklch orpheline).
2. Migrer les 504 hex de `app/page.tsx` vers les variables, par lots, avec un audit de
   contraste a chaque lot.
3. Corriger `theme-color` dans `app/layout.tsx` pour suivre le theme actif.
4. Decider si `app/page.tsx` (238 Ko, un seul composant) est scinde — il ne devrait pas
   rester un fichier de cette taille.