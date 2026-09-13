import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listElements, createElement } from '../lib/elements';
import { FAMILIES } from '../types';
import type { Element, ElementFamily } from '../types';
import { Layout } from '../components/Layout';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

interface TreeNode {
  element: Element;
  children: TreeNode[];
}

// Arborescence libre : un Element sans parent (ou dont le parent a disparu)
// est une racine. Profondeur illimitée, pas de contrainte de famille.
function buildTree(elements: Element[]): TreeNode[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const childrenByParent = new Map<string, Element[]>();
  const roots: Element[] = [];

  for (const el of elements) {
    if (el.parent_id && byId.has(el.parent_id)) {
      const list = childrenByParent.get(el.parent_id) ?? [];
      list.push(el);
      childrenByParent.set(el.parent_id, list);
    } else {
      roots.push(el);
    }
  }

  function toNode(el: Element): TreeNode {
    return {
      element: el,
      children: (childrenByParent.get(el.id) ?? []).map(toNode),
    };
  }

  return roots.map(toNode);
}

export function ElementsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: elements, isLoading, error } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [family, setFamily] = useState<ElementFamily>('ELEMENTS');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(elements ?? []), [elements]);

  const createMutation = useMutation({
    mutationFn: createElement,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      setCreating(false);
      setName('');
      navigate(`/elements/${created.id}`);
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), family });
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: TreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.element.id);
    return (
      <li key={node.element.id}>
        <div
          className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900"
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => toggleCollapsed(node.element.id)}
                className="w-4 shrink-0 text-neutral-500 hover:text-neutral-300"
                aria-label={isCollapsed ? 'Déplier' : 'Replier'}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <button
              onClick={() => navigate(`/elements/${node.element.id}`)}
              className="truncate text-left"
            >
              {node.element.name}
            </button>
          </div>
          <span className="ml-3 shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {FAMILY_LABEL[node.element.family]}
          </span>
        </div>
        {hasChildren && !isCollapsed && (
          <ul>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Elements</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/trash')}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            Corbeille
          </button>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-yellow-400"
          >
            + Nouvel Element
          </button>
        </div>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <input
            autoFocus
            placeholder="Nom de l'Element"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[180px] rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as ElementFamily)}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          >
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {FAMILY_LABEL[f]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
          >
            Créer
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
      {error && (
        <p className="text-sm text-red-400">
          Erreur : {(error as Error).message}
        </p>
      )}

      <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {tree.map((node) => renderNode(node, 0))}
        {elements?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            Aucun Element pour l'instant. Crée le premier ci-dessus.
          </li>
        )}
      </ul>
      {elements && elements.length > 0 && (
        <p className="mt-3 text-xs text-neutral-600">
          Change le parent d'un Element depuis sa propre page pour le
          déplacer dans l'arborescence.
        </p>
      )}
    </Layout>
  );
}
