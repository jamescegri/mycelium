import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, PenLine, Plus } from 'lucide-react';
import { MUTATION, type CreateElementInput } from '../lib/offline';
import type { Element } from '../types';

// Ce qu'on tape ici devient le TEXTE de l'Element, pas son titre : une idée
// arrive rarement déjà nommée. L'Element s'ouvre donc sans titre, curseur
// dans le champ du titre, avec la phrase déjà écrite en dessous.
function paragraphDoc(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

export function CaptureBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  // La mutation est nommée plutôt que définie ici : c'est ce qui lui
  // permet d'être reprise après un rechargement, quand cet écran n'existe
  // plus — une note écrite dans le métro doit partir même si l'app a été
  // fermée entre-temps. Sa fonction vit dans lib/offline.
  const createMutation = useMutation<Element, Error, CreateElementInput>({
    mutationKey: MUTATION.createElement,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  function capture(input: { text: string; timeline: boolean }) {
    // Le champ se vide tout de suite, sans attendre le serveur : hors
    // ligne la mutation est mise en attente et `onSuccess` ne viendra que
    // bien plus tard. Garder le texte à l'écran ferait croire qu'il n'a
    // pas été pris.
    setText('');
    createMutation.mutate({
      name: '',
      content: input.text ? paragraphDoc(input.text) : null,
      timeline: input.timeline,
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) capture({ text: text.trim(), timeline: false });
  }

  return (
    <div>
      <form
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition focus-within:border-ink-4"
        onSubmit={handleSubmit}
      >
        <PenLine size={18} strokeWidth={2} className="shrink-0 text-ink-4" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire une idée, un nom, un lieu…"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-4"
        />
        {text.trim() && (
          <span className="shrink-0 text-[12.5px] font-medium text-ink-3">
            Entrée ↵
          </span>
        )}
      </form>

      {/* Créer sans rien avoir à écrire d'abord. Un Element temporel est un
          Element comme un autre — il se place simplement sur la timeline. */}
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          onClick={() =>
            capture({ text: text.trim(), timeline: false })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2.25} />
          Ajouter un Element
        </button>
        <button
          onClick={() =>
            capture({ text: text.trim(), timeline: true })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Clock size={14} strokeWidth={2.25} />
          Situer dans le temps
        </button>
      </div>
    </div>
  );
}
