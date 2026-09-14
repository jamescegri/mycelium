import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listElements } from '../lib/elements';
import { listAllLinks, parentsOf } from '../lib/links';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { extractPlainText } from '../lib/content';
import { displayName } from '../lib/display';
import { pastelFor } from '../lib/palette';
import { Layout } from '../components/Layout';
import { ViewSwitch, type ViewMode } from '../components/ViewSwitch';
import type { Element } from '../types';

// Un Tag traverse l'organisation : les Elements réunis ici vivent dans des
// Groupes différents et n'ont pas bougé de place. C'est pourquoi chaque
// résultat affiche d'où il vient — sans ça, on croirait que le Tag les a
// rangés ensemble quelque part.
export function TagsPage() {
  const [params] = useSearchParams();
  const tagId = params.get('tag');
  const [view, setView] = useState<ViewMode>('galerie');
  const [query, setQuery] = useState('');

  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: elementTags } = useQuery({
    queryKey: ['element-tags'],
    queryFn: listAllElementTags,
  });

  const tag = tags?.find((t) => t.id === tagId) ?? null;

  const tagged = useMemo(() => {
    if (!tagId) return [];
    const ids = new Set(
      (elementTags ?? []).filter((et) => et.tag_id === tagId).map((et) => et.element_id)
    );
    const list = (elements ?? []).filter((e) => ids.has(e.id));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => displayName(e).toLowerCase().includes(q));
  }, [tagId, elementTags, elements, query]);

  if (!tagId) {
    return (
      <Layout>
        <div className="mx-auto max-w-[56rem] px-6 py-10 sm:px-10">
          <h1 className="title-display mb-2 text-[40px]">Tags</h1>
          <p className="max-w-[62ch] text-[16.5px] text-ink-3">
            Un Tag ne range rien : il traverse. Choisis-en un à gauche pour voir
            les Elements qui le portent, où qu'ils soient rangés.
          </p>
        </div>
      </Layout>
    );
  }

  const tone = tag ? pastelFor(tag.id) : null;

  return (
    <Layout>
      <div className="mx-auto max-w-[56rem] px-6 py-10 sm:px-10">
      <div className="mb-2 flex items-center gap-3">
        {tone && (
          <span
            className="size-3.5 rounded-[4px]"
            style={{ backgroundColor: tone.bg }}
          />
        )}
        <h1 className="title-display text-[44px]">{tag?.name ?? 'Tag'}</h1>
      </div>
      <p className="mb-8 max-w-[62ch] text-[17px] text-ink-3">
        {tagged.length === 0
          ? 'Aucun Element ne porte ce tag pour le moment.'
          : `${tagged.length} Element${tagged.length > 1 ? 's' : ''} portent ce tag, répartis dans ton organisation.`}
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un Element…"
        className="mb-7 w-full max-w-[26rem] border-b border-line bg-transparent pb-2.5 text-[16px] outline-none transition placeholder:text-ink-4 focus:border-ink"
      />

      <div className="mb-7">
        <ViewSwitch value={view} onChange={setView} />
      </div>

        <TaggedResults
          view={view}
          elements={tagged}
          all={elements ?? []}
          links={links ?? []}
        />
      </div>
    </Layout>
  );
}

function TaggedResults({
  view,
  elements,
  all,
  links,
}: {
  view: ViewMode;
  elements: Element[];
  all: Element[];
  links: import('../types').ElementLink[];
}) {
  const navigate = useNavigate();

  if (elements.length === 0) return null;

  const origin = (el: Element) => {
    const parents = parentsOf(links, all, el.id);
    return parents.length > 0 ? displayName(parents[0]) : 'Pas encore rangé';
  };

  if (view === 'liste') {
    return (
      <div className="flex flex-col">
        {elements.map((el) => (
          <button
            key={el.id}
            onClick={() => navigate(`/elements/${el.id}`)}
            className="flex items-center gap-3.5 border-b border-line-soft px-2 py-3.5 text-left transition hover:bg-surface-2"
          >
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: pastelFor(el.id).bg }}
            />
            <span className="truncate text-[17px]">{displayName(el)}</span>
            <span className="ml-auto shrink-0 text-[13px] text-ink-4">
              {origin(el)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (view === 'tableau') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-[12.5px] tracking-[0.06em] text-ink-4 uppercase">
              <th className="py-2.5 pr-4 font-semibold">Element</th>
              <th className="py-2.5 pr-4 font-semibold">Rangé dans</th>
              <th className="py-2.5 font-semibold">Temps</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => (
              <tr
                key={el.id}
                onClick={() => navigate(`/elements/${el.id}`)}
                className="cursor-pointer border-b border-line-soft transition hover:bg-surface-2"
              >
                <td className="py-3 pr-4">{displayName(el)}</td>
                <td className="py-3 pr-4 text-ink-3">{origin(el)}</td>
                <td className="py-3 text-ink-3">
                  {el.timeline ? 'Situé' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Kanban : une colonne par Groupe d'origine. Le Tag ne range pas, mais
  // voir d'où viennent les résultats montre justement qu'il traverse.
  if (view === 'kanban') {
    const columns = new Map<string, Element[]>();
    for (const el of elements) {
      const key = origin(el);
      columns.set(key, [...(columns.get(key) ?? []), el]);
    }
    return (
      <div className="flex gap-3.5 overflow-x-auto pb-2">
        {[...columns.entries()].map(([label, items]) => (
          <div key={label} className="w-[15rem] shrink-0">
            <p className="mb-2.5 px-1 text-[12.5px] font-semibold tracking-[0.05em] text-ink-4 uppercase">
              {label} · {items.length}
            </p>
            <div className="flex flex-col gap-2">
              {items.map((el) => (
                <button
                  key={el.id}
                  onClick={() => navigate(`/elements/${el.id}`)}
                  className="rounded-xl border border-line px-3.5 py-3 text-left text-[15px] transition hover:border-ink"
                >
                  {displayName(el)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {elements.map((el) => {
        const excerpt = extractPlainText(el.content, 110);
        return (
          <button
            key={el.id}
            onClick={() => navigate(`/elements/${el.id}`)}
            className="flex flex-col gap-2.5 rounded-2xl border border-line p-4 text-left transition hover:border-ink"
          >
            <span className="text-[11.5px] tracking-[0.07em] text-ink-4 uppercase">
              {origin(el)}
            </span>
            <span className="text-[17px] leading-tight font-semibold">
              {displayName(el)}
            </span>
            {excerpt && (
              <span className="text-[13.5px] leading-relaxed text-ink-3">
                {excerpt}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
