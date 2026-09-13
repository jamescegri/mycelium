import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Message clair plutôt qu'un crash silencieux : voir le README pour la
  // configuration du fichier .env.local
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env.local. ' +
      'Copie .env.example vers .env.local et renseigne les valeurs de ton projet Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
