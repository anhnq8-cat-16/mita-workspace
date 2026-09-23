import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
