import { createClient } from '@supabase/supabase-js';

// Cliente público (anon key) — para uso futuro en el cliente
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Cliente con privilegios de servidor (service role) — bypasa RLS
// Solo usar en API routes (server-side), nunca exponer al cliente
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
