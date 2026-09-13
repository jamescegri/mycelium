# Mycelium

Outil personnel de knowledge management pour un projet créatif (manga /
worldbuilding). Voir le cahier des charges complet pour la vision produit et
les règles métier.

## Philosophie

Il n'existe qu'un seul objet : **Element**. L'application n'impose jamais de
types narratifs prédéfinis (pas de Character, Chapter, Scene, Arc…).
L'utilisateur donne du sens à ses Elements par leur contenu, leurs relations,
leurs tags et leur position temporelle — et par leur rangement, qui n'est
**jamais figé** : un Element peut appartenir à plusieurs Groupes à la fois.
Les familles TIME / ELEMENTS ne servent qu'à étiqueter (Temps prépare la
future timeline) — elles n'imposent aucune structure.

La boucle centrale est : **créer → écrire → relier → organiser → explorer**,
et chaque étape doit rester quasi-instantanée. Voir le cahier des charges
pour le détail des principes et des non-objectifs.

## v2 : rangement multi-parent (Groupes)

Le rangement d'un Element n'est plus un arbre à parent unique — c'est un
graphe : un Element peut avoir **plusieurs parents et plusieurs enfants** en
même temps (table `element_links`, remplace `elements.parent_id` et les
anciennes tables `collections`/`collection_elements`). Un **Groupe** n'est
rien d'autre qu'un Element qui a au moins un enfant ; "Collections" et
"Groupes" sont donc devenus le même mécanisme.

- Sur la page d'un Element : deux sections toujours visibles sous
  l'éditeur — **Parents** et **Enfants** — jamais dans le texte.
- Dans l'éditeur, trois déclencheurs distincts :
  - `/` cherche/crée un Element et insère un lien cliquable dans le texte
    (inchangé)
  - `@` rattache l'Element courant comme enfant de celui choisi (celui-ci
    devient un parent) — **n'insère rien** dans le texte
  - `+` rattache l'Element choisi comme enfant de l'Element courant — même
    principe, aucune insertion
  - Les trois refusent silencieusement un choix qui créerait une boucle
    (ancêtre ↔ descendant)
- Dashboard : barre "Écrire / Rechercher / + Nouvel Element" en haut, puis
  un onglet **Groupes** (cartes avec aperçu des premiers enfants, clic pour
  plonger d'un niveau), en plus des onglets Temporel et Connexions déjà
  existants (inchangés, indépendants de la hiérarchie).
- Familles réduites à **TIME** et **ELEMENTS** — "Lieu" (SPACE) n'est plus
  une famille séparée, c'est redevenu un Element ordinaire.
- Refonte visuelle (thème blanc, typographie) volontairement **différée** :
  cette version ne change que le modèle de données et les interactions, pas
  encore l'habillage.
- Base Supabase repartie de zéro (schéma changé, pas de migration — accepté
  par l'utilisateur, aucune donnée de prod à conserver à ce stade).

## État actuel (V1, avant la v2 ci-dessus)

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

## Refonte navigation/UX

Après validation du produit V1, la navigation a été entièrement repensée
puis implémentée dans l'application réelle, en gardant `Element +
parent_id + relations + tags + collections + temporal_relations` comme
seul modèle de données — aucun nouveau type introduit, aucune donnée
perdue.

- ✅ Fondations :
  - `sort_order` réellement utilisé : ordre stable entre frères et sœurs
    (au lieu de `updated_at`), réorganisable via ↑↓, calculé au même
    endroit pour toute création (`createElement`) afin qu'un nouvel
    Element s'ajoute toujours en dernière position
  - Création contextuelle : "+ Créer" à la volée dans tous les pickers
    (parent, relations, position temporelle, collections), pas seulement
    depuis `/`
- ✅ Dashboard multi-vues (`/dashboard`) : un seul espace à onglets légers
  (Arborescence / Temporel / Connexions / Collections) plutôt que des
  pages séparées — aucune de ces vues ne porte de donnée propre, tout est
  dérivé de `parent_id`, `relations`, `temporal_relations` et
  `collections`
- ✅ Navigation par niveaux façon Notion : `/space/:family` (racines d'une
  famille) puis la page d'un Element n'affiche jamais que ses enfants
  directs (`ChildrenList`), jamais l'arbre complet ; "+ Nouvelle
  sous-page" crée l'enfant immédiatement (nom "Sans titre", pas de
  formulaire) et amène dessus avec le titre déjà sélectionné, prêt à être
  renommé
- ✅ Panneau latéral (peek) : cliquer une mention, un backlink ou une
  relation ouvre l'Element visé dans un panneau à droite (`PeekPanel` +
  `usePeek`) sans quitter la page ni perdre son scroll ; on peut
  rebondir de connexion en connexion depuis le panneau lui-même
  (`pushPeek`) et "Ouvrir en pleine page" bascule en navigation normale
- ✅ Recherche globale Cmd/Ctrl+K (`CommandPalette`) : cherche, ouvre en
  aperçu ou navigue, et propose "+ Créer" si l'Element n'existe pas
  encore — utilisable comme méthode d'exploration à part entière
- ✅ Connexions discrètes : repliées par défaut sur la page d'un Element
  ("N connexions"), un seul clic les déplie (relations, référencé par,
  position temporelle) ; le Dashboard (onglet Connexions) ne montre
  qu'un classement simple des Elements les plus connectés + les
  orphelins, jamais un graphe
- ✅ Page d'un Element réorganisée dans l'ordre demandé : titre (sans
  cadre) → ligne de contexte discrète (famille + chemin hiérarchique) →
  éditeur → connexions repliables → sous-pages ; famille / parent / tags
  / collections sont rangés sous un repli "Propriétés" pour ne jamais
  rivaliser avec le contenu écrit

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
- Créer 3 Elements racine → `sort_order` 0, 1, 2 assignés automatiquement ;
  réorganiser via ↑↓ renumérote toute la fratrie et l'ordre affiché suit
  immédiatement
- Le fil d'Ariane d'un Element créé comme enfant affiche bien
  "Elements / Parent / Enfant" et chaque segment navigue correctement
- Créer un Element depuis le picker "Relations" (option "+ Créer") le crée
  à la racine et l'insère aussitôt comme relation, sans passer par `/` ni
  par le Dashboard
- Dashboard → clic sur SPACE → seuls les Elements racine de cette famille
  apparaissent (jamais leurs petits-enfants) ; clic sur un Element → seuls
  ses enfants directs apparaissent, niveau par niveau
- "+ Nouvelle sous-page" crée l'enfant immédiatement et amène dessus avec
  le titre déjà sélectionné, sans qu'aucun formulaire n'ait été affiché
- Taper `/` puis choisir un Element existant l'insère comme mention sans
  en faire un enfant hiérarchique — la mention ne crée qu'une relation
  (`origin='mention'`), jamais un lien `parent_id`
- Cliquer une mention ouvre l'Element dans un panneau latéral ; fermer le
  panneau (Échap ou clic hors du panneau) laisse la page d'origine et son
  scroll strictement inchangés
- Cmd/Ctrl+K ouvre la recherche globale depuis n'importe quelle page ;
  taper un nom absent propose "+ Créer" et navigue directement sur le
  nouvel Element
- `npm run build` et `npm run lint` passent sans erreur ; vérifié de bout
  en bout avec Playwright contre une API Supabase simulée (32
  vérifications sur la navigation par niveaux, la création de sous-pages,
  le panneau latéral, les connexions repliables, la palette globale et
  les onglets du Dashboard)

## Note technique : Vite 8

Le projet importé utilisait Vite 8.3.0 (nouveau bundler Rolldown) + 
`@vitejs/plugin-react` 6.x. Dans cet environnement, `vite build` produisait
silencieusement un bundle de production **sans le code de l'application**
(aucune erreur, juste un bundle ne contenant que les dépendances) — un bug
sérieux vu la nouveauté de cette combinaison. Le projet a été repointé sur
Vite 7.3.6 + `@vitejs/plugin-react` 5.2.0 (pipeline Rollup classique,
éprouvé), avec lequel le build inclut correctement tout le code. À garder
en tête avant de retenter Vite 8 plus tard.

## Décision à valider : Elements créés depuis `/`

Le cahier des charges de la refonte demande qu'un Element créé depuis `/`
devienne enfant de la page courante "lorsque c'est pertinent", tout en
répétant ailleurs que hiérarchie et connexions doivent rester totalement
indépendantes (une mention ne doit jamais ranger quoi que ce soit). Ces
deux demandes se contredisent dans le cas général. Choix fait ici : un
Element créé depuis `/` reste toujours à la racine (comme avant), et seule
la relation (`origin='mention'`) le lie à la page qui l'a créé — jamais un
`parent_id`. À ranger ensuite manuellement si besoin (glisser sous un
parent, ou "Propriétés → Parent"). À revoir si ce n'est pas le
comportement voulu.

## Prochaine étape

Le tri par glisser-déposer (mentionné comme piste dans le cahier des
charges) n'est pas fait : la réorganisation reste au clic (↑↓). Le reste
de la refonte demandée (Dashboard multi-vues, navigation par niveaux,
panneau latéral, recherche globale, connexions discrètes) est implémenté.
