# Mycelium

Outil personnel de knowledge management pour un projet créatif (manga /
worldbuilding). Voir le cahier des charges complet pour la vision produit et
les règles métier.

## Philosophie

Il n'existe qu'un seul objet : **Element**. L'application n'impose jamais de
types narratifs prédéfinis (pas de Character, Chapter, Scene, Arc…).
L'utilisateur donne du sens à ses Elements par leur contenu, leur hiérarchie,
leurs relations, leurs tags, leurs collections et leur position temporelle.
Les familles TIME / SPACE / ELEMENTS ne servent qu'à organiser les grandes
vues — elles n'imposent aucune structure interne aux Elements.

La boucle centrale est : **créer → écrire → relier → organiser → explorer**,
et chaque étape doit rester quasi-instantanée. Voir le cahier des charges
pour le détail des principes et des non-objectifs.

## État actuel

- ✅ Étape 1 — Setup : projet React + TypeScript + Vite + Tailwind v4,
  auth Supabase, routing, schéma SQL complet (`supabase/schema.sql`)
- ✅ Étape 2 — CRUD Elements : créer, lister, ouvrir, éditer (nom, famille,
  contenu texte simple), supprimer (corbeille / soft delete)
- ✅ Étape 3 — Éditeur riche (Tiptap) + mentions `/` : rechercher un Element
  existant ou en créer un à la volée depuis `/`, insertion d'un lien
  cliquable qui navigue vers la page de l'Element mentionné. Les mentions
  sont resynchronisées vers la table `relations` (origin='mention') à
  chaque sauvegarde.
- ✅ Étape 4 — Backlinks : chaque page d'Element affiche la liste des
  Elements qui le référencent, dérivée de la table `relations`
- ✅ Étape 5 — Relations libres : relier deux Elements sans passer par une
  mention (recherche + label optionnel), affichage symétrique des deux
  côtés, suppression à tout moment
- ✅ Étape 6 — Hiérarchie : vue arborescente (pliable/dépliable) sur la liste
  des Elements ; page d'un Element affiche son parent et ses enfants, avec
  un sélecteur pour changer/retirer le parent (déplacement facile) et une
  garde anti-cycle (un Element ne peut pas devenir le parent d'un de ses
  propres descendants)
- ✅ Étape 7 — Timeline : vue dérivée (aucune donnée propre) qui trie tous
  les Elements pris dans au moins une relation BEFORE/AFTER par ordre
  chronologique (tri topologique) ; la position temporelle se modifie
  depuis la page de l'Element ("avant"/"après" un autre Element)
- ✅ Étape 8 — Corbeille, tags, collections : page `/trash` pour restaurer un
  Element supprimé ; tags libres par Element (création à la volée,
  déduplication insensible à la casse) ; collections nommées avec leur
  propre page listant leurs Elements

Le contenu d'un Element est un document Tiptap (JSON) stocké tel quel dans
la colonne `jsonb` ; les Elements créés à l'étape 2 (contenu texte brut)
restent lisibles sans migration.

## Démarrer

### 1. Créer le projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, colle et exécute le contenu de `supabase/schema.sql`
3. Dans **Authentication > Users**, crée manuellement ton utilisateur
   (email + mot de passe) — l'application est mono-utilisateur, pas
   d'inscription en self-service
4. Récupère `Project URL` et `anon public key` dans **Settings > API**

### 2. Configurer l'environnement local

```bash
cp .env.example .env.local
# puis édite .env.local avec les valeurs de ton projet Supabase
```

### 3. Lancer l'application

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5173`, connecte-toi avec l'utilisateur créé à
l'étape 1.

## Tests effectués à cette étape

- Création d'un Element (nom + famille) → apparaît immédiatement dans la
  liste et sa page existe (aucune étape de configuration intermédiaire)
- Édition du nom, de la famille et du contenu → persistance en base au clic
  sur "Enregistrer"
- Suppression → l'Element disparaît de la liste, apparaît dans `/trash`,
  et "Restaurer" le remet dans la liste sans rien perdre
- Taper `/` dans l'éditeur ouvre une recherche d'Elements existants ; en
  sélectionner un insère un lien cliquable vers sa page
- Taper `/` suivi d'un nom qui n'existe pas propose "+ Créer" : valider crée
  l'Element (avec un nom contenant des espaces) et insère le lien vers sa
  page, déjà vide et prête à être éditée
- Cliquer sur un lien de mention navigue vers l'Element référencé, sans
  fuite du contenu de la page précédente
- Sauvegarder synchronise les mentions du texte vers `relations`
  (`origin='mention'`)
- La page d'un Element mentionné affiche l'Element mentionnant dans sa
  section "Référencé par", avec lien cliquable vers sa page
- Depuis la section "Relations", chercher et choisir un Element crée une
  relation manuelle visible immédiatement des deux côtés (avec ou sans
  label) ; la supprimer d'un côté la fait disparaître de l'autre aussi
- "Référencé par" (mentions automatiques) et "Relations" (manuelles) ne se
  chevauchent jamais, même si elles pointent vers le même Element
- La liste des Elements s'affiche en arbre (A > B > C), pliable/dépliable
  par nœud
- Depuis la page d'un Element, choisir un parent le déplace dans
  l'arborescence ; un Element et ses propres descendants sont exclus du
  choix (impossible de créer une boucle)
- Depuis la section "Position temporelle", relier un Element "avant" ou
  "après" un autre le fait apparaître dans /timeline, dans le bon ordre
  chronologique ; l'autre Element affiche automatiquement la relation
  réciproque ("après" / "avant")
- Taper un tag et appuyer sur Entrée l'ajoute comme pastille ; le retaper
  avec une casse différente réutilise le même tag plutôt que d'en créer un
  doublon
- Taper un nom de collection dans "+ collection" la crée si besoin et y
  ajoute l'Element ; la collection a sa propre page (`/collections/:id`)
  listant tous ses Elements, avec un picker pour en ajouter d'autres
- `npm run build` passe sans erreur TypeScript et produit un bundle
  fonctionnel (vérifié avec Playwright contre une API Supabase simulée)

## Note technique : Vite 8

Le projet importé utilisait Vite 8.3.0 (nouveau bundler Rolldown) + 
`@vitejs/plugin-react` 6.x. Dans cet environnement, `vite build` produisait
silencieusement un bundle de production **sans le code de l'application**
(aucune erreur, juste un bundle ne contenant que les dépendances) — un bug
sérieux vu la nouveauté de cette combinaison. Le projet a été repointé sur
Vite 7.3.6 + `@vitejs/plugin-react` 5.2.0 (pipeline Rollup classique,
éprouvé), avec lequel le build inclut correctement tout le code. À garder
en tête avant de retenter Vite 8 plus tard.

## Prochaine étape

Tout ce qui était identifié dans le cahier des charges (les 10 priorités
V1, la timeline, les tags, les collections, la corbeille) est maintenant en
place. La suite dépend de l'usage réel : à voir ensemble ce qui manque le
plus une fois testé en conditions réelles.
