import { supabase } from './supabase';

// Les images vivent dans le stockage Supabase, pas dans le contenu de
// l'Element : glisser un character design de 4 Mo dans une scène gonflerait
// la colonne jsonb, et chaque chargement de la page rapatrierait l'image
// encodée en base64, même pour afficher une liste.
//
// Le fichier est rangé sous l'identifiant de son auteur — c'est ce que les
// règles du bucket vérifient pour qu'on n'écrive que chez soi.

const BUCKET = 'images';

// Ce que le navigateur sait afficher et que le bucket accepte. Refuser tôt
// évite un aller-retour réseau pour finir sur une erreur du serveur.
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

export function isUploadableImage(file: File): boolean {
  return ACCEPTED.includes(file.type);
}

export async function uploadImage(file: File): Promise<string> {
  if (!isUploadableImage(file)) {
    throw new Error(
      "Ce format d'image n'est pas accepté. Utilise JPEG, PNG, WebP, GIF ou AVIF."
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `Cette image fait ${Math.round(file.size / 1024 / 1024)} Mo. La limite est de 10 Mo.`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
