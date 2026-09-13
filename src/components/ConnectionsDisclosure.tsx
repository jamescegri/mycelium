import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createManualRelation,
  deleteRelation,
  listBacklinks,
  listManualRelations,
} from '../lib/relations';
import {
  createTemporalRelation,
  deleteTemporalRelation,
  listTemporalRelationsForElement,
} from '../lib/temporal';
import { getElementsByIds } from '../lib/elements';
import { ElementPicker } from './ElementPicker';
import type { Element, TemporalRelationType } from '../types';

interface BacklinkItem {
  id: string;
  otherId: string;
  otherName: string;
}

// Les connexions répondent à "qu'est-ce que ça touche ?" — jamais à "où
// est-ce que je range ça ?" (ça, c'est la hiérarchie, gérée ailleurs).
// Repliées par défaut : ce sont des idées liées, pas une fiche technique
// qui mérite d'occuper la moitié de la page.
export function ConnectionsDisclosure({
  elementId,
  onSelect,
}: {
  elementId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['backlinks', elementId] });
    queryClient.invalidateQueries({
      queryKey: ['manual-relations', elementId],
    });
    queryClient.invalidateQueries({
      queryKey: ['temporal-relations', elementId],
    });
    queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
  };

  const { data: backlinks } = useQuery({
    queryKey: ['backlinks', elementId],
    queryFn: async (): Promise<BacklinkItem[]> => {
      const relations = await listBacklinks(elementId);
      const sourceIds = [...new Set(relations.map((r) => r.source_id))];
      const sources = await getElementsByIds(sourceIds);
      const byId = new Map(sources.map((e) => [e.id, e]));
      return relations
        .map((r) => {
          const other = byId.get(r.source_id);
          return other
            ? { id: r.id, otherId: other.id, otherName: other.name }
            : null;
        })
        .filter((x): x is BacklinkItem => !!x);
    },
  });

  const { data: relations } = useQuery({
    queryKey: ['manual-relations', elementId],
    queryFn: async (): Promise<
      { id: string; other: Element; label: string | null }[]
    > => {
      const rels = await listManualRelations(elementId);
      const otherIds = [
        ...new Set(
          rels.map((r) => (r.source_id === elementId ? r.target_id : r.source_id))
        ),
      ];
      const others = await getElementsByIds(otherIds);
      const byId = new Map(others.map((e) => [e.id, e]));
      return rels
        .map((r) => {
          const otherId = r.source_id === elementId ? r.target_id : r.source_id;
          const other = byId.get(otherId);
          return other ? { id: r.id, other, label: r.label } : null;
        })
        .filter((x): x is { id: string; other: Element; label: string | null } => !!x);
    },
  });

  const { data: temporalItems } = useQuery({
    queryKey: ['temporal-relations', elementId],
    queryFn: async (): Promise<
      { id: string; other: Element; label: 'Avant' | 'Après' }[]
    > => {
      const rels = await listTemporalRelationsForElement(elementId);
      const otherIds = [
        ...new Set(
          rels.map((r) => (r.element_a === elementId ? r.element_b : r.element_a))
        ),
      ];
      const others = await getElementsByIds(otherIds);
      const byId = new Map(others.map((e) => [e.id, e]));
      return rels
        .map((r) => {
          const isA = r.element_a === elementId;
          const otherId = isA ? r.element_b : r.element_a;
          const other = byId.get(otherId);
          if (!other) return null;
          const currentIsBefore = isA
            ? r.type === 'BEFORE'
            : r.type === 'AFTER';
          const label: 'Avant' | 'Après' = currentIsBefore ? 'Avant' : 'Après';
          return { id: r.id, other, label };
        })
        .filter(
          (x): x is { id: string; other: Element; label: 'Avant' | 'Après' } =>
            !!x
        );
    },
  });

  const addRelationMutation = useMutation({
    mutationFn: ({ target, label }: { target: Element; label: string }) =>
      createManualRelation(elementId, target.id, label),
    onSuccess: invalidateAll,
  });
  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) => deleteRelation(relationId),
    onSuccess: invalidateAll,
  });
  const [relationLabel, setRelationLabel] = useState('');

  const [temporalDirection, setTemporalDirection] =
    useState<TemporalRelationType>('BEFORE');
  const addTemporalMutation = useMutation({
    mutationFn: (target: Element) =>
      createTemporalRelation(elementId, temporalDirection, target.id),
    onSuccess: invalidateAll,
  });
  const deleteTemporalMutation = useMutation({
    mutationFn: (relationId: string) => deleteTemporalRelation(relationId),
    onSuccess: invalidateAll,
  });

  const total =
    (backlinks?.length ?? 0) +
    (relations?.length ?? 0) +
    (temporalItems?.length ?? 0);

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-neutral-500 hover:text-neutral-700"
      >
        {open
          ? '— Connexions'
          : total > 0
            ? `${total} connexion${total > 1 ? 's' : ''}`
            : 'Connexions'}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <ConnGroup
            title="Relations"
            items={(relations ?? []).map((r) => ({
              id: r.id,
              otherId: r.other.id,
              otherName: r.label ? `${r.label} · ${r.other.name}` : r.other.name,
              onRemove: () => deleteRelationMutation.mutate(r.id),
            }))}
            onSelect={onSelect}
          />
          <ConnGroup
            title="Référencé par"
            items={backlinks ?? []}
            onSelect={onSelect}
          />
          <ConnGroup
            title="Position temporelle"
            items={(temporalItems ?? []).map((t) => ({
              id: t.id,
              otherId: t.other.id,
              otherName: `${t.label} · ${t.other.name}`,
              onRemove: () => deleteTemporalMutation.mutate(t.id),
            }))}
            onSelect={onSelect}
          />

          <div className="flex flex-wrap gap-2">
            <ElementPicker
              excludeIds={[elementId]}
              placeholder="Relier à…"
              onPick={(target) =>
                addRelationMutation.mutate({ target, label: relationLabel })
              }
            />
            <input
              value={relationLabel}
              onChange={(e) => setRelationLabel(e.target.value)}
              placeholder="Label (optionnel)"
              className="w-32 border-b border-neutral-200 bg-transparent px-1 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={temporalDirection}
              onChange={(e) =>
                setTemporalDirection(e.target.value as TemporalRelationType)
              }
              className="border-b border-neutral-200 bg-transparent py-1 text-xs text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="BEFORE">Avant…</option>
              <option value="AFTER">Après…</option>
            </select>
            <ElementPicker
              excludeIds={[elementId]}
              placeholder="Position temporelle…"
              onPick={(target) => addTemporalMutation.mutate(target)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ConnGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { id: string; otherId: string; otherName: string; onRemove?: () => void }[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs text-neutral-400">{title}</div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-0.5">
          <button
            onClick={() => onSelect(item.otherId)}
            className="text-left text-neutral-700 hover:text-yellow-500"
          >
            {item.otherName}
          </button>
          {item.onRemove && (
            <button
              onClick={item.onRemove}
              aria-label="Retirer"
              className="text-neutral-300 hover:text-red-600"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
