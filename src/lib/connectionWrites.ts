import { updateElement } from './elements';
import { syncMentionRelations } from './relations';
import { extractMentionIds } from './content';
import { displayName } from './display';
import { insertMentionForCitation, type ConnectionsIndex } from './connections';

// Relier une citation : l'occurrence du nom de `targetId` dans le texte de
// `sourceId` devient une vraie mention « / ». La relation naît ensuite de la
// synchronisation des mentions, comme toutes les autres — elle ne sera donc
// pas effacée au prochain enregistrement de ce texte.
//
// Partagé par Connexions et par Fils : les deux montrent les citations sans
// lien, et doivent les relier de la même façon.
export async function linkCitation(
  index: ConnectionsIndex,
  targetId: string,
  sourceId: string
): Promise<void> {
  const target = index.byId.get(targetId);
  const source = index.byId.get(sourceId);
  if (!target || !source) throw new Error('Element introuvable.');
  const content = insertMentionForCitation(source.content, target, index.elements);
  if (!content) {
    throw new Error(
      `« ${displayName(target)} » n'a pas été retrouvé tel quel dans le texte de « ${displayName(source)} ».`
    );
  }
  await updateElement(sourceId, { content });
  await syncMentionRelations(sourceId, extractMentionIds(content));
}
