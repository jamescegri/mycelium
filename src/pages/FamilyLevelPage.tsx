import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listElements, rootElementsByFamily } from '../lib/elements';
import { FAMILY_COLOR } from '../lib/family';
import { Layout } from '../components/Layout';
import { ChildrenList } from '../components/ChildrenList';
import type { ElementFamily } from '../types';

const VALID_FAMILIES = new Set<string>(['TIME', 'SPACE', 'ELEMENTS']);

// Porte d'entrée d'une famille : ses Elements racine, navigables niveau par
// niveau ensuite exactement comme n'importe quel Element. La famille ne
// filtre que la racine — un enfant peut appartenir à n'importe quelle
// famille, librement.
export function FamilyLevelPage() {
  const { family } = useParams<{ family: string }>();
  const navigate = useNavigate();
  const { data: elements, isLoading } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });

  const fam = family?.toUpperCase();
  if (!fam || !VALID_FAMILIES.has(fam)) {
    return (
      <Layout>
        <p className="text-sm text-neutral-500">Espace introuvable.</p>
      </Layout>
    );
  }
  const typedFam = fam as ElementFamily;
  const roots = elements ? rootElementsByFamily(elements, typedFam) : [];

  return (
    <Layout>
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-4 text-xs text-neutral-500 hover:text-neutral-700"
      >
        Dashboard
      </button>
      <h1
        className="mb-6 text-2xl font-semibold"
        style={{ color: FAMILY_COLOR[typedFam] }}
      >
        {typedFam}
      </h1>
      {isLoading ? (
        <p className="text-sm text-neutral-500">Chargement…</p>
      ) : (
        <ChildrenList items={roots} parentId={null} defaultFamily={typedFam} />
      )}
    </Layout>
  );
}
