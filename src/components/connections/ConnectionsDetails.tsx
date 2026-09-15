import { displayName } from '../../lib/display';
import type { Citation, ConnectionsIndex, LinkKind, Reason } from '../../lib/connections';
import { KIND_STYLE, reasonText } from './kinds';

const SECTIONS: { title: string; kinds: LinkKind[] }[] = [
  { title: 'Rangement', kinds: ['parent', 'child'] },
  { title: 'Liens nommés', kinds: ['named'] },
  { title: 'Mentionne', kinds: ['mentions'] },
  { title: 'Mentionné par', kinds: ['mentionedBy'] },
  { title: 'Reliés à la main', kinds: ['manual'] },
  { title: 'Tags en commun', kinds: ['tag'] },
];

// La liste complète. Le visuel ne montre que les liens principaux ; ici
// rien n'est jamais coupé. C'est aussi l'équivalent accessible du visuel.
export function ConnectionsDetails({
  index,
  centerId,
  reasons,
  citations,
  hotId,
  animate,
  linkingId,
  onHot,
  onRecenter,
  onLinkCitation,
}: {
  index: ConnectionsIndex;
  centerId: string;
  reasons: Reason[];
  citations: Citation[];
  hotId: string | null;
  animate: boolean;
  linkingId: string | null;
  onHot: (id: string | null) => void;
  onRecenter: (id: string) => void;
  onLinkCitation: (id: string) => void;
}) {
  const stagger = animate ? 'stagger' : '';
  const sections = SECTIONS.map((s) => ({ ...s, rows: reasons.filter((r) => s.kinds.includes(r.kind)) })).filter(
    (s) => s.rows.length > 0
  );

  if (!sections.length && !citations.length) {
    return <p className="mt-3 text-[14px] text-ink-4">Rien à expliquer tant qu'aucun lien n'existe.</p>;
  }

  return (
    <div onPointerLeave={() => onHot(null)}>
      {sections.map((section) => (
        <div key={section.title} className="mt-6 first:mt-3">
          <p className="mb-0.5 text-[13px] text-ink-4">{section.title}</p>
          <div className={stagger}>
            {section.rows.map((reason) => {
              const other = index.byId.get(reason.id);
              if (!other) return null;
              return (
                <button
                  key={`${reason.kind}-${reason.relationId ?? reason.id}`}
                  onClick={() => onRecenter(reason.id)}
                  onPointerEnter={() => onHot(reason.id)}
                  onFocus={() => onHot(reason.id)}
                  className={`-mx-3 flex w-[calc(100%+1.5rem)] items-baseline gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2 max-md:flex-wrap max-md:gap-y-0.5 ${
                    hotId === reason.id ? 'bg-surface-2' : ''
                  }`}
                >
                  <span
                    className="size-2 shrink-0 self-center rounded-full"
                    style={{ background: KIND_STYLE[reason.kind].color }}
                  />
                  <span className="shrink-0 text-[15px]">{displayName(other)}</span>
                  <span className="min-w-0 truncate text-[14px] text-ink-3 max-md:basis-full max-md:pl-5 max-md:whitespace-normal">
                    {reasonText(reason, index, centerId)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Les citations sans lien ferment la liste : ce ne sont pas encore
          des connexions, elles restent à part pour qu'on ne les confonde
          pas avec les liens qui existent. */}
      {citations.length > 0 && (
        <div className="mt-6 first:mt-3">
          <p className="mb-0.5 text-[13px] text-ink-4">Cité sans lien</p>
          <p className="mb-1 text-[13px] text-ink-4">
            Le nom apparaît dans leur texte, sans être relié. Relier transforme cette occurrence en mention.
          </p>
          <div className={stagger}>
            {citations.map((citation) => {
              const other = index.byId.get(citation.id);
              if (!other) return null;
              return (
                <div
                  key={citation.id}
                  className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-1.5 transition hover:bg-surface-2"
                >
                  <button
                    onClick={() => onRecenter(citation.id)}
                    className="flex min-w-0 flex-1 items-baseline gap-3 py-1 text-left max-md:flex-wrap max-md:gap-y-0.5"
                  >
                    <span
                      className="size-2 shrink-0 self-center rounded-full bg-surface"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${KIND_STYLE.mentions.color}` }}
                    />
                    <span className="shrink-0 text-[15px]">{displayName(other)}</span>
                    <span className="min-w-0 truncate text-[14px] text-ink-3 max-md:basis-full max-md:pl-5 max-md:whitespace-normal">
                      « {citation.quote} »
                    </span>
                  </button>
                  <button
                    onClick={() => onLinkCitation(citation.id)}
                    disabled={linkingId !== null}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[14px] text-ink-2 transition hover:bg-surface-3 hover:text-ink disabled:opacity-50"
                  >
                    {linkingId === citation.id ? 'Relier…' : 'Relier'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
