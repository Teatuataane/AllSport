/**
 * DEPRECATED — do not use this file.
 *
 * This client does not handle SSR auth sessions correctly in Next.js App Router.
 * Sessions are lost on page refresh and RLS policies break.
 *
 * Use instead:
 *   import { createClient } from '@/lib/supabase-browser'   ← client components
 *   import { createServerClient } from '@supabase/ssr'       ← server components / route handlers
 */

export {}
