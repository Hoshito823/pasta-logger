import { createClient } from '@supabase/supabase-js'
export const supa = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
export async function requireSession() {
  const { data: { session } } = await supa.auth.getSession()
  return session
}
