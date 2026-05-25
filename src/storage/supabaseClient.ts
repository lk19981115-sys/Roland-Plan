import { createClient, type Session } from '@supabase/supabase-js'

const demoSupabaseUrl = 'https://trttutnaodytvlfhztgs.supabase.co'
const demoSupabaseAnonKey = 'sb_publishable_lkY1xSIoSqP-ety03s-Nzw_QfQdJkVn'

// These values are publishable browser keys. RLS policies protect the actual user data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || demoSupabaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || demoSupabaseAnonKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export type CloudSession = Session
