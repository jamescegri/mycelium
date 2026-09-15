import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, SlidersHorizontal, X } from 'lucide-react';
import { createElement } from '../../lib/elements';
import { createManualRelation, syncMentionRelations } from '../../lib/relations';
import { displayName } from '../../lib/display';
import { pastelFor } from '../../lib/palette';
import { reportError } from '../../lib/errors';
import { linkCitation } from '../../lib/connectionWrites';
import {
  DEFAULT_SHOW,
  firstSentence,
  isGroup,
  neighbourhood,
  normalize,
  parcoursContent,
  unlinkedCitations,
  type ConnectionFilters,
  type ConnectionsIndex,
  type ShowKey,
} from '../../lib/connections';
import { usePeek } from '../PeekPanel';
import { useConnectionsData } from './useConnectionsData';
import { ElementPicker } from '../ElementPicker';
import { ConnectionsGraph } from './ConnectionsGraph';
import { ConnectionsDetails } from './ConnectionsDetails';
import { KIND_STYLE, reasonText, truncate } from './kinds';
import type { Element } from '../../types';

const SHOW_OPTIONS: [ShowKey, string][] = [
  ['rangement', 'Rangement'],
  ['named', 'Liens nommés'],
  ['mentions', 'Mentionne'],
  ['mentionedBy', 'Mentionné par'],
  ['manual', 'Reliés à la main'],
  ['tag', 'Tags en commun'],
];
const TIME_OPTIONS: [ConnectionFilters['time'], string][] = [
  ['all', 'Tout'],
  ['in', 'Dans la chronologie'],
  ['out', 'Hors chronologie'],
];

const quietButton =
  'inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[14px] text-ink-2 transition hover:bg-surface-2 hover:text-ink active:scale-[0.97] disabled:opacity-50';

// La recherche met le nom exact devant, puis ce qui commence par la saisie.
function byExactness(found: Element[], q: string): Element[] {
  const rank = (e: Element) => {
    const n = normalize(displayName(e));
    return n === q ? 0 : n.startsWith(q) ? 1 : 2;
  };
  return [...found].sort((a, b) => rank(a) - rank(b));
}

// ─────────────────────────────────────────────────────────────────────
// Connexions : un Element au centre, ses voisins directs en visuel, et
// l'exploration de voisin en voisin sans changer de page.
//
// Le centre et le filtre vivent dans l'adresse (`?autour=…&dans=…`) : le
// bouton Retour du navigateur revient à l'Element précédent, et une
// exploration peut être mise en favori.
// ─────────────────────────────────────────────────────────────────────
export function ConnectionsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openPeek } = usePeek();
  const [params, setParams] = useSearchParams();

  const { index, elements: all, relations: allRelations, isLoading } = useConnectionsData();

  // Sans centre demandé, on part de l'Element touché en dernier : c'est
  // souvent celui dont on veut voir l'entourage.
  const fallbackId = useMemo(
    () => [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.id ?? null,
    [all]
  );
  const requested = params.get('autour');
  const centerId = requested && index.byId.has(requested) ? requested : fallbackId;
  const scopeParam = params.get('dans');
  const scope = scopeParam && index.byId.has(scopeParam) ? scopeParam : null;

  // ── Chemin parcouru ────────────────────────────────────────────────
  // Revenir sur une étape déjà parcourue raccourcit le chemin jusqu'à elle,
  // au lieu d'empiler une boucle A › B › A.
  const [trail, setTrail] = useState<string[]>([]);
  const startNewTrail = useRef(false);
  useEffect(() => {
    if (!centerId) return;
    setTrail((prev) => {
      if (startNewTrail.current) {
        startNewTrail.current = false;
        return [centerId];
      }
      const at = prev.indexOf(centerId);
      return at >= 0 ? prev.slice(0, at + 1) : [...prev, centerId];
    });
  }, [centerId]);
  const trailShown = useMemo(() => trail.filter((id) => index.byId.has(id)), [trail, index]);

  const [hotId, setHotId] = useState<string | null>(null);
  const [focusCenter, setFocusCenter] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [animate, setAnimate] = useState(false);

  const recenter = useCallback(
    (id: string, opts: { newTrail?: boolean; focus?: boolean } = {}) => {
      if (!index.byId.has(id) || id === centerId) return;
      if (opts.newTrail) startNewTrail.current = true;
      if (opts.focus) setFocusCenter(true);
      setHotId(null);
      setAnimate(true);
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('autour', id);
        return next;
      });
    },
    [index, centerId, setParams]
  );

  const setScope = (id: string | null) => {
    setHotId(null);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('dans', id);
        else next.delete('dans');
        return next;
      },
      { replace: true }
    );
  };

  // Retour arrière : revenir d'une étape. Ignoré pendant qu'on écrit.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Backspace' || trailShown.length < 2) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      recenter(trailShown[trailShown.length - 2], { focus: true });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [trailShown, recenter]);

  // ── Filtres ────────────────────────────────────────────────────────
  const [affinerOpen, setAffinerOpen] = useState(false);
  const [show, setShow] = useState(DEFAULT_SHOW);
  const [time, setTime] = useState<ConnectionFilters['time']>('all');
  const filters = useMemo<ConnectionFilters>(() => ({ show, time, scope }), [show, time, scope]);
  // Le filtre par Groupe ou Element est déjà visible en haut : Affiner ne
  // signale que ses propres réglages.
  const affinerChanged = time !== 'all' || SHOW_OPTIONS.some(([key]) => show[key] !== DEFAULT_SHOW[key]);

  const reasons = useMemo(
    () => (centerId ? neighbourhood(index, centerId, filters) : []),
    [index, centerId, filters]
  );
  const citations = useMemo(
    () => (centerId ? unlinkedCitations(index, centerId, filters) : []),
    [index, centerId, filters]
  );

  // ── Écritures ──────────────────────────────────────────────────────
  const invalidateAround = (ids: string[]) => {
    queryClient.invalidateQueries({ queryKey: ['relations'] });
    queryClient.invalidateQueries({ queryKey: ['elements'] });
    for (const id of ids) {
      queryClient.invalidateQueries({ queryKey: ['elements', id] });
      queryClient.invalidateQueries({ queryKey: ['backlinks', id] });
      queryClient.invalidateQueries({ queryKey: ['manual-relations', id] });
    }
  };
  // Un lien qui vient d'être créé passe devant les autres dans le visuel,
  // pour se voir aussitôt même quand le côté est déjà plein.
  const markFresh = (id: string) => setFreshIds((prev) => new Set(prev).add(id));

  const citationMutation = useMutation({
    mutationFn: (otherId: string) => linkCitation(index, centerId!, otherId).then(() => otherId),
    onSuccess: (otherId) => {
      markFresh(otherId);
      invalidateAround([otherId, centerId ?? '']);
    },
    onError: reportError,
  });

  const [relierOpen, setRelierOpen] = useState(false);
  const [relierLabel, setRelierLabel] = useState('');
  const knownLabels = useMemo(
    () => [...new Set(allRelations.map((r) => r.label?.trim()).filter((l): l is string => !!l))].sort(),
    [allRelations]
  );

  const relierMutation = useMutation({
    mutationFn: ({ target, label }: { target: Element; label: string }) =>
      createManualRelation(centerId!, target.id, label),
    onSuccess: (_relation, { target }) => {
      markFresh(target.id);
      invalidateAround([centerId ?? '', target.id]);
      setRelierOpen(false);
      setRelierLabel('');
    },
    onError: reportError,
  });

  // Garder ce parcours : un Element ordinaire qui mentionne les étapes dans
  // l'ordre. Ses mentions sont synchronisées tout de suite, pour qu'il
  // apparaisse dans les connexions de chaque étape sans attendre qu'on
  // enregistre son texte.
  const keepMutation = useMutation({
    mutationFn: async () => {
      const steps = trailShown.map((id) => index.byId.get(id)).filter((e): e is Element => !!e);
      const title = `Parcours : ${displayName(steps[0])} → ${displayName(steps[steps.length - 1])}`;
      const created = await createElement({ name: title, content: parcoursContent(steps) });
      await syncMentionRelations(created.id, steps.map((s) => s.id));
      return created;
    },
    onSuccess: (created) => {
      invalidateAround(trailShown);
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
    onError: reportError,
  });

  const detailsRef = useRef<HTMLElement>(null);
  const graphTopRef = useRef<HTMLDivElement>(null);
  const onCenterFocused = useCallback(() => setFocusCenter(false), []);

  // ── Rendu ──────────────────────────────────────────────────────────
  const header = (
    <>
      <h1 className="title-display mb-2 text-[32px] text-ink max-md:text-[28px]">Connexions</h1>
      <p className="mb-7 max-w-[62ch] text-[15px] text-ink-3">
        Ce qui touche, influence ou référence un Element.
      </p>
    </>
  );

  if (isLoading) {
    return (
      <Page>
        {header}
        <p className="text-[15px] text-ink-3">Chargement…</p>
      </Page>
    );
  }

  if (!centerId) {
    return (
      <Page>
        {header}
        <p className="max-w-[52ch] text-[15px] text-ink-3">
          Rien à relier pour l'instant. Écris une première idée depuis l'accueil : ses liens apparaîtront ici.
        </p>
      </Page>
    );
  }

  const center = index.byId.get(centerId)!;
  const scopeElement = scope ? index.byId.get(scope) : undefined;
  const hotReasons = hotId ? reasons.filter((r) => r.id === hotId) : [];
  const originId = trailShown.length > 1 ? trailShown[trailShown.length - 2] : null;
  const jumpToDetails = () => detailsRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Page>
      {header}

      <div className="grid max-w-[48rem] grid-cols-2 gap-x-7 gap-y-3 max-md:grid-cols-1 max-md:gap-y-1.5">
        <ElementCombobox
          index={index}
          placeholder="Autour de…"
          ariaLabel="Choisir l'Element au centre"
          rank={byExactness}
          onPick={(id) => recenter(id, { newTrail: true })}
        />
        {scopeElement ? (
          <div className="animate-page-in flex items-center gap-2 border-b border-ink-4 py-2 text-[15px] text-ink-3">
            <span className="min-w-0 truncate">
              {isGroup(index, scopeElement.id) ? 'Dans' : 'En commun avec'}{' '}
              <strong className="font-semibold text-ink">{displayName(scopeElement)}</strong>
            </span>
            <button
              onClick={() => setScope(null)}
              aria-label="Retirer le filtre"
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-ink"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
        ) : (
          <ElementCombobox
            index={index}
            placeholder="Filtrer par groupe ou Element…"
            ariaLabel="Filtrer les voisins par groupe ou Element"
            // Les Groupes remontent en premier, sauf un nom tapé en entier.
            rank={(found, q) => {
              const sorted = byExactness(found, q);
              const exact = sorted.filter((e) => normalize(displayName(e)) === q);
              const rest = sorted.filter((e) => normalize(displayName(e)) !== q);
              return [
                ...exact,
                ...rest.filter((e) => isGroup(index, e.id)),
                ...rest.filter((e) => !isGroup(index, e.id)),
              ];
            }}
            onPick={(id) => setScope(id)}
          />
        )}
      </div>

      <div ref={graphTopRef} className="mt-7 mb-1.5 flex scroll-mt-6 flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Chemin parcouru" className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto text-[14px]">
          {trailShown.map((id, i) => {
            const last = i === trailShown.length - 1;
            const element = index.byId.get(id)!;
            return (
              <Fragment key={`${id}-${i}`}>
                {i > 0 && <span className="text-ink-4" aria-hidden>›</span>}
                <button
                  onClick={() => recenter(id)}
                  aria-current={last ? 'step' : undefined}
                  className={`shrink-0 rounded-lg px-1.5 py-1 whitespace-nowrap transition hover:bg-surface-2 hover:text-ink ${
                    last ? 'font-semibold text-ink' : 'text-ink-3'
                  }`}
                >
                  {truncate(displayName(element), 22)}
                </button>
              </Fragment>
            );
          })}
          {trailShown.length > 1 && (
            <button
              onClick={() => setTrail([centerId])}
              aria-label="Effacer le chemin"
              className="shrink-0 rounded-lg px-1.5 py-1 text-ink-4 transition hover:bg-surface-2 hover:text-ink"
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1 max-md:ml-0">
          {trailShown.length >= 3 && (
            <button onClick={() => keepMutation.mutate()} disabled={keepMutation.isPending} className={quietButton}>
              Garder ce parcours
            </button>
          )}
          <button onClick={() => setAffinerOpen((v) => !v)} aria-expanded={affinerOpen} className={quietButton}>
            <SlidersHorizontal size={15} strokeWidth={2} />
            Affiner
            {/* Pas de pastille ni de nombre : un mot dit qu'un réglage agit. */}
            {affinerChanged && <span className="text-ink-4">· filtré</span>}
          </button>
        </div>
      </div>

      {/* Affiner se déplie en hauteur plutôt que d'apparaître d'un bloc. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          affinerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
        inert={!affinerOpen}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3.5 border-b border-line-soft pt-4 pb-5 text-[14px] max-md:grid-cols-1 max-md:gap-y-1.5">
            <span className="text-ink-4">Montrer</span>
            <span className="flex flex-wrap gap-1.5">
              {SHOW_OPTIONS.map(([key, label]) => (
                <Toggle key={key} pressed={show[key]} onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}>
                  {label}
                </Toggle>
              ))}
            </span>
            <span className="text-ink-4 max-md:mt-2">Temps</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {TIME_OPTIONS.map(([value, label]) => (
                <Toggle key={value} round pressed={time === value} onClick={() => setTime(value)}>
                  {label}
                </Toggle>
              ))}
              <button
                onClick={() => {
                  setShow(DEFAULT_SHOW);
                  setTime('all');
                }}
                className="ml-auto rounded-lg px-2 py-1 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
              >
                Réinitialiser
              </button>
            </span>
          </div>
        </div>
      </div>

      <ConnectionsGraph
        index={index}
        centerId={centerId}
        reasons={reasons}
        originId={originId}
        freshIds={freshIds}
        hotId={hotId}
        onHot={setHotId}
        onRecenter={recenter}
        focusCenter={focusCenter}
        onCenterFocused={onCenterFocused}
        onHiddenCount={setHiddenCount}
      />

      {/* La ligne qui dit pourquoi le lien survolé existe. */}
      <div className="flex min-h-[62px] items-start gap-2.5 pt-4 text-[14.5px] text-ink-3" aria-live="polite">
        {hotId && hotReasons.length > 0 ? (
          <>
            <span
              className="mt-[7px] size-2 shrink-0 rounded-full"
              style={{ background: KIND_STYLE[hotReasons[0].kind].color }}
            />
            <span>
              {hotReasons[0].kind === 'named' ? (
                reasonText(hotReasons[0], index, centerId)
              ) : (
                <>
                  <strong className="font-semibold text-ink">{KIND_STYLE[hotReasons[0].kind].group}</strong>
                  {' · '}
                  {displayName(index.byId.get(hotId)!)}
                  {['mentions', 'mentionedBy'].includes(hotReasons[0].kind) && hotReasons[0].quote
                    ? ` — « ${hotReasons[0].quote} »`
                    : ''}
                </>
              )}
              {hotReasons.length > 1 && (
                <span className="text-ink-4">
                  {' · aussi : '}
                  {hotReasons
                    .slice(1)
                    .map((r) => KIND_STYLE[r.kind].group.toLowerCase())
                    .join(', ')}
                </span>
              )}
              <span className="mt-1 block text-[13.5px] text-ink-4">
                {firstSentence(index.plain.get(hotId) ?? '')}
              </span>
            </span>
          </>
        ) : (
          <span>
            {reasons.length === 0
              ? scopeElement
                ? <>Aucun voisin {isGroup(index, scopeElement.id) ? 'dans' : 'en commun avec'} <strong className="font-semibold text-ink">{displayName(scopeElement)}</strong>. Retire le filtre pour tout revoir.</>
                : <>Relié à rien pour l'instant. Mentionne <strong className="font-semibold text-ink">{displayName(center)}</strong> avec « / » dans une scène, ou relie-le à la main.</>
              : 'Clique un voisin pour le mettre au centre — ou flèches, puis Entrée.'}
            {(hiddenCount > 0 || citations.length > 0) && (
              <span className="mt-1 block">
                {hiddenCount > 0 && (
                  <button onClick={jumpToDetails} className="text-ink-2 underline decoration-line underline-offset-[3px] transition hover:text-ink hover:decoration-ink-4">
                    Voir tous les liens
                  </button>
                )}
                {hiddenCount > 0 && citations.length > 0 && <span className="text-ink-4"> · </span>}
                {citations.length > 0 && (
                  <button onClick={jumpToDetails} className="text-ink-2 underline decoration-line underline-offset-[3px] transition hover:text-ink hover:decoration-ink-4">
                    Des citations sans lien attendent
                  </button>
                )}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="-ml-2.5 flex flex-wrap gap-1">
        <button onClick={() => openPeek(centerId)} className={quietButton}>
          <ExternalLink size={15} strokeWidth={2} />
          Ouvrir
        </button>
        <button onClick={() => setRelierOpen((v) => !v)} aria-expanded={relierOpen} className={quietButton}>
          <Plus size={15} strokeWidth={2.2} />
          Relier à un Element
        </button>
      </div>

      {relierOpen && (
        <div className="animate-page-in mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-line-soft pt-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-[12.5px] text-ink-4">
            Nommer le lien — facultatif
            <input
              list="cx-known-labels"
              value={relierLabel}
              onChange={(e) => setRelierLabel(e.target.value)}
              placeholder="trahit, mère de, provoque…"
              className="border-b border-line bg-transparent py-1.5 text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink-4"
            />
          </label>
          <div className="min-w-[14rem] flex-1">
            <p className="mb-0.5 text-[12.5px] text-ink-4">Relier à</p>
            <ElementPicker
              excludeIds={[centerId]}
              allowCreate={false}
              placeholder="Nom d'un Element…"
              onPick={(target) => relierMutation.mutate({ target, label: relierLabel })}
            />
          </div>
          <p className="basis-full text-[13px] text-ink-3">
            Le lien part de « {displayName(center)} » vers l'Element choisi.
          </p>
          <datalist id="cx-known-labels">
            {knownLabels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>
      )}

      <section ref={detailsRef} aria-labelledby="cx-all-links" className="mt-11 scroll-mt-6">
        <p id="cx-all-links" className="mb-1.5 text-[12px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
          Tous les liens, et pourquoi
        </p>
        <ConnectionsDetails
          index={index}
          centerId={centerId}
          reasons={reasons}
          citations={citations}
          hotId={hotId}
          animate={animate}
          linkingId={citationMutation.isPending ? (citationMutation.variables ?? null) : null}
          onHot={setHotId}
          onRecenter={(id) => {
            recenter(id);
            graphTopRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          onLinkCitation={(id) => citationMutation.mutate(id)}
        />
      </section>
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[62rem] px-6 py-14 max-md:py-8 sm:px-14">{children}</div>;
}

function Toggle({
  pressed,
  round = false,
  onClick,
  children,
}: {
  pressed: boolean;
  round?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-surface-2 hover:text-ink ${
        pressed ? 'text-ink' : 'text-ink-3'
      }`}
    >
      <span
        className={`size-[13px] transition ${round ? 'rounded-full' : 'rounded-[4px]'} ${
          pressed ? 'bg-ink' : 'shadow-[inset_0_0_0_1.5px_var(--color-line)]'
        }`}
      />
      {children}
    </button>
  );
}

// Choisir un Element en tapant son nom. Le même champ sert à changer de
// centre et à filtrer : seul ce qui se passe au choix diffère.
function ElementCombobox({
  index,
  placeholder,
  ariaLabel,
  rank,
  onPick,
}: {
  index: ConnectionsIndex;
  placeholder: string;
  ariaLabel: string;
  rank: (found: Element[], q: string) => Element[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const found = index.elements.filter((e) => normalize(displayName(e)).includes(q));
    return rank(found, q).slice(0, 6);
  }, [query, index, rank]);

  const choose = (element: Element) => {
    setQuery('');
    setOpen(false);
    onPick(element.id);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className="w-full border-b border-line bg-transparent py-2 text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink-4"
      />
      {open && matches.length > 0 && (
        <div className="animate-page-in absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-2xl border border-line-soft bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.18)]">
          {matches.map((element, i) => {
            const tone = pastelFor(element.id).bg;
            const group = isGroup(index, element.id);
            return (
              <button
                key={element.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(element);
                }}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14.5px] transition ${
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={group ? { background: tone } : { boxShadow: `inset 0 0 0 2px ${tone}` }}
                />
                <span className="truncate">{displayName(element)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
