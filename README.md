# Mycelium

Outil personnel de knowledge management pour un projet créatif (manga /
worldbuilding). Voir le cahier des charges complet pour la vision produit et
les règles métier.

## État actuel (étapes 1 et 2 du plan)

- ✅ Étape 1 — Setup : projet React + TypeScript + Vite + Tailwind v4,
  auth Supabase, routing, schéma SQL complet (`supabase/schema.sql`)
- ✅ Étape 2 — CRUD Elements : créer, lister, ouvrir, éditer (nom, famille,
  contenu texte simple), supprimer (corbeille / soft delete)
- ⬜ Étape 3 — Hiérarchie (parent/enfant, arborescence, drag & drop)
- ⬜ Étape 4 — Éditeur riche Tiptap + système `/`
- ⬜ Étape 5 et suivantes — voir le cahier des charges

Le contenu d'un Element est stocké en `jsonb` en base mais traité comme une
simple chaîne de texte pour l'instant ; l'étape 4 introduira l'éditeur riche
sans nécessiter de migration de schéma.

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
- Suppression → l'Element disparaît de la liste (soft delete, restauration
  prévue à l'étape 15)
- `npm run build` passe sans erreur TypeScript

## Prochaine étape

Étape 3 : hiérarchie libre (parent/enfant, profondeur illimitée, familles
mélangeables), avec la garde anti-cycle décrite dans le cahier des charges.
