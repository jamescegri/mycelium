import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { displayName } from '../../lib/display';
import { pastelFor } from '../../lib/palette';
import { isGroup, type ConnectionsIndex, type Reason } from '../../lib/connections';
import {
  edgeGeometry,
  layoutNeighbourhood,
  type Place,
  type PlacedNode,
} from '../../lib/connectionsLayout';
import { KIND_STYLE, truncate } from './kinds';

// Le visuel : le centre et ses voisins directs, rien d'autre.
//
// Les nœuds sont repérés par leur Element d'un rendu à l'autre. Quand on
// clique un voisin, React garde son nœud et seule sa position change : il
// glisse vers le centre, l'ancien centre part rejoindre sa place de voisin,
// et seuls les nouveaux venus apparaissent. On voit le réseau se déplacer
// au lieu d'être remplacé.
export function ConnectionsGraph({
  index,
  centerId,
  reasons,
  originId,
  freshIds,
  hotId,
  onHot,
  onRecenter,
  focusCenter,
  onCenterFocused,
  onHiddenCount,
}: {
  index: ConnectionsIndex;
  centerId: string;
  reasons: Reason[];
  // L'Element d'où l'on vient, marqué pour que le retour se voie ici.
  originId: string | null;
  freshIds: Set<string>;
  hotId: string | null;
  onHot: (id: string | null) => void;
  onRecenter: (id: string, opts?: { focus?: boolean }) => void;
  focusCenter: boolean;
  onCenterFocused: () => void;
  onHiddenCount: (count: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      width
        ? layoutNeighbourhood({
            centerId,
            reasons,
            width,
            freshIds,
            groupOf: (id) => index.parents.get(id)?.[0] ?? null,
            groupName: (groupId) => {
              const group = groupId ? index.byId.get(groupId) : undefined;
              return group ? displayName(group) : 'Pas rangé';
            },
          })
        : null,
    [centerId, reasons, width, freshIds, index]
  );

  useEffect(() => {
    onHiddenCount(layout?.hiddenCount ?? 0);
  }, [layout, onHiddenCount]);

  // Rien ne s'anime au premier affichage : la page doit être lisible dès
  // la première image. Ce qui arrive plus tard — après un recentrage ou un
  // changement de filtre — apparaît en mouvement.
  const [mountedAt] = useState(() => performance.now());

  useEffect(() => {
    if (!focusCenter || !layout) return;
    nodeRefs.current.get(centerId)?.focus({ preventScroll: true });
    onCenterFocused();
  }, [focusCenter, layout, centerId, onCenterFocused]);

  // Les flèches font le tour des voisins, dans le sens des aiguilles d'une
  // montre : haut, droite, bas, gauche.
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!layout || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const order = layout.order;
    if (!order.length) return;
    e.preventDefault();
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const at = hotId ? order.indexOf(hotId) : -1;
    const n = order.length;
    const next = at < 0 ? (forward ? 0 : n - 1) : (at + (forward ? 1 : -1) + n) % n;
    nodeRefs.current.get(order[next])?.focus({ preventScroll: true });
  }

  const neighbours = layout?.nodes.filter((n) => n.id !== centerId) ?? [];
  const center = layout?.nodes.find((n) => n.id === centerId);

  return (
    <div ref={wrapRef} className="relative">
      {layout && (
        <svg
          className={`cx-graph block w-full overflow-visible ${hotId ? 'has-hot' : ''}`}
          viewBox={`${-layout.width / 2} ${layout.yMin} ${layout.width} ${layout.height}`}
          style={{ height: layout.height }}
          role="group"
          aria-label="Voisins directs de l'Element au centre. Flèches pour passer d'un voisin à l'autre, Entrée pour le mettre au centre, Retour arrière pour revenir."
          onKeyDown={onKeyDown}
        >
          {/* Redessinés à chaque recentrage : les traits apparaissent une
              fois les nœuds arrivés à leur place. */}
          <EdgeLayer key={centerId} mountedAt={mountedAt}>
            {neighbours.map((node) => {
              const lead = node.lead!;
              const style = KIND_STYLE[lead.kind];
              const geo = edgeGeometry(node, layout.narrow);
              const hot = hotId === node.id;
              return (
                <g key={node.id}>
                  <path
                    d={geo.d}
                    className={`cx-edge ${hot ? 'is-hot' : ''}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={hot ? 3 : 2}
                    strokeLinecap="round"
                    strokeDasharray={style.dash}
                  />
                  {lead.kind === 'named' && !layout.narrow && (
                    <text
                      x={geo.labelX}
                      y={geo.labelY - 8}
                      textAnchor="middle"
                      className={`cx-edge cx-edge-label ${hot ? 'is-hot' : ''}`}
                    >
                      {`${lead.label} →`}
                    </text>
                  )}
                </g>
              );
            })}
            {layout.labels.map((label) => (
              <text
                key={`${label.text}-${label.x}-${label.y}`}
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                className="cx-group-label"
              >
                {truncate(label.text, 26)}
              </text>
            ))}
          </EdgeLayer>

          <g>
            {/* Le centre est dessiné en dernier, au-dessus des traits. */}
            {[...neighbours, ...(center ? [center] : [])].map((node) => {
              const element = index.byId.get(node.id);
              if (!element) return null;
              return (
                <GraphNode
                  key={node.id}
                  node={node}
                  name={displayName(element)}
                  group={isGroup(index, node.id)}
                  isCenter={node.id === centerId}
                  isOrigin={node.id === originId && node.id !== centerId}
                  isHot={hotId === node.id}
                  narrow={layout.narrow}
                  mountedAt={mountedAt}
                  register={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  onHot={onHot}
                  onRecenter={onRecenter}
                />
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

// Le délai sous lequel un élément est considéré comme présent dès
// l'ouverture de la page, donc affiché sans animation.
const SETTLE_MS = 250;

// Les traits, remontés à chaque recentrage (la clé est le centre) : ils
// apparaissent une fois les nœuds arrivés à leur place.
function EdgeLayer({ mountedAt, children }: { mountedAt: number; children: ReactNode }) {
  const [animate] = useState(() => performance.now() - mountedAt > SETTLE_MS);
  return <g className={animate ? 'animate-fade-in' : ''}>{children}</g>;
}

function labelPlacement(place: Place, narrow: boolean) {
  if (narrow && (place === 'left' || place === 'right')) return { x: 0, y: 26, anchor: 'middle' as const };
  switch (place) {
    case 'center': return { x: 0, y: 40, anchor: 'middle' as const };
    case 'top': return { x: 0, y: -16, anchor: 'middle' as const };
    case 'bottom': return { x: 0, y: 26, anchor: 'middle' as const };
    case 'left': return { x: -15, y: 5, anchor: 'end' as const };
    case 'right': return { x: 15, y: 5, anchor: 'start' as const };
  }
}

function GraphNode({
  node,
  name,
  group,
  isCenter,
  isOrigin,
  isHot,
  narrow,
  mountedAt,
  register,
  onHot,
  onRecenter,
}: {
  node: PlacedNode;
  name: string;
  group: boolean;
  isCenter: boolean;
  isOrigin: boolean;
  isHot: boolean;
  narrow: boolean;
  mountedAt: number;
  register: (el: SVGGElement | null) => void;
  onHot: (id: string | null) => void;
  onRecenter: (id: string, opts?: { focus?: boolean }) => void;
}) {
  // Un voisin qui arrive part du centre et s'écarte jusqu'à sa place.
  const [entered, setEntered] = useState(() => performance.now() - mountedAt < SETTLE_MS);
  useEffect(() => {
    if (entered) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(frame);
  }, [entered]);

  const label = truncate(name, isCenter ? 34 : node.maxChars);
  const textRef = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Un fond blanc derrière le nom du centre : les traits qui passent sous
  // lui s'y cachent au lieu de barrer les lettres.
  useLayoutEffect(() => {
    if (!isCenter || !textRef.current) return;
    const b = textRef.current.getBBox();
    setBox({ x: b.x, y: b.y, width: b.width, height: b.height });
  }, [isCenter, label]);

  const tone = pastelFor(node.id).bg;
  const placement = labelPlacement(node.place, narrow);

  return (
    <g
      ref={register}
      className="cx-node outline-none"
      tabIndex={0}
      role="button"
      aria-label={isCenter ? `${name}, au centre` : `Mettre ${name} au centre${isOrigin ? ', d’où tu viens' : ''}`}
      style={{
        transform: entered ? `translate(${node.x}px, ${node.y}px)` : 'translate(0px, 0px) scale(0.6)',
        opacity: entered ? 1 : 0,
        transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease',
        cursor: isCenter ? 'default' : 'pointer',
      }}
      onPointerEnter={() => !isCenter && onHot(node.id)}
      onPointerLeave={() => !isCenter && onHot(null)}
      onFocus={() => !isCenter && onHot(node.id)}
      onBlur={() => !isCenter && onHot(null)}
      onClick={() => !isCenter && onRecenter(node.id)}
      onKeyDown={(e) => {
        if (!isCenter && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onRecenter(node.id, { focus: true });
        }
      }}
    >
      <g className={`cx-dim ${isHot ? 'is-hot' : ''} ${isCenter ? 'is-center' : ''}`}>
        {isCenter && <circle r={26} fill="none" stroke="#efefef" strokeWidth={1.5} />}
        {isOrigin && <circle r={12} fill="none" stroke="#757575" strokeWidth={1.5} strokeDasharray="2 3" />}
        <circle className="cx-hit" r={22} fill="transparent" />
        {isCenter && box && (
          <rect x={box.x - 8} y={box.y - 3} width={box.width + 16} height={box.height + 6} rx={8} fill="#fff" />
        )}
        {/* Plein pour un Groupe, creux pour une feuille : la règle de l'app. */}
        <circle
          r={isCenter ? 12 : 6.5}
          fill={group ? tone : '#fff'}
          stroke={isCenter ? '#000' : group ? 'none' : tone}
          strokeWidth={isCenter ? (group ? 2 : 3) : group ? 0 : 2.5}
        />
        <text
          ref={textRef}
          x={placement.x}
          y={placement.y}
          textAnchor={placement.anchor}
          className={`cx-label ${isCenter ? 'is-center' : ''}`}
        >
          {label}
        </text>
      </g>
    </g>
  );
}
