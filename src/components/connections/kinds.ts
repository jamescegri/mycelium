import { displayName } from '../../lib/display';
import type { ConnectionsIndex, LinkKind, Reason } from '../../lib/connections';

// La couleur dit la nature d'un lien, sans légende. Ce sont les fluos de
// l'éditeur (« @ » cyan, « + » vert, « / » violet), un cran plus denses :
// un trait de 2 px dans le fluo d'origine disparaît presque sur du blanc.
// Les liens posés à la main restent gris — nommés en trait plein, anonymes
// en pointillé.
export const KIND_STYLE: Record<LinkKind, { color: string; dash?: string; group: string }> = {
  parent: { color: '#19b6de', group: 'Rangé dans' },
  child: { color: '#1fc26c', group: 'Contient' },
  named: { color: '#555555', group: 'Liens nommés' },
  mentions: { color: '#a57be8', group: 'Mentionne' },
  mentionedBy: { color: '#a57be8', group: 'Mentionné par' },
  manual: { color: '#9a9a9a', dash: '5 6', group: 'Reliés à la main' },
  tag: { color: '#b3b3b3', dash: '1 6', group: 'Tags en commun' },
};

export const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;

// Pourquoi un lien existe, dit en une ligne. C'est ce qui distingue une
// liste de connexions d'une liste de noms : sans la raison, on voit qu'un
// lien existe sans comprendre ce qu'il veut dire.
export function reasonText(reason: Reason, index: ConnectionsIndex, centerId: string): string {
  const center = index.byId.get(centerId);
  const other = index.byId.get(reason.id);
  const c = center ? displayName(center) : '';
  const o = other ? displayName(other) : '';
  switch (reason.kind) {
    case 'parent': return `contient ${c}`;
    case 'child': return `rangé dans ${c}`;
    case 'named': return reason.out ? `${c} ${reason.label} ${o}` : `${o} ${reason.label} ${c}`;
    case 'mentions': return reason.quote ? `« ${reason.quote} »` : `${c} le mentionne`;
    case 'mentionedBy': return reason.quote ? `« ${reason.quote} »` : `mentionne ${c}`;
    case 'manual': return 'relié à la main';
    case 'tag': return `même tag : ${(reason.tags ?? []).join(', ')}`;
  }
}
