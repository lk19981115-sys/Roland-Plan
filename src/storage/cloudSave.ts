import type { AppData } from '../types'
import { migrateSaveData } from './saveFile'
import { isSupabaseConfigured, supabase, type CloudSession } from './supabaseClient'

interface CloudSaveRow {
  id: string
  app_data: unknown
  schema_version: number
  updated_at: string
}

export interface CloudSaveSnapshot {
  data: AppData
  updatedAt: string
  schemaVersion: number
}

const requireSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 尚未配置，请先填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。')
  }

  return supabase
}

const getCurrentUserId = async () => {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('请先登录云存档账号。')
  }

  return data.user.id
}

const normalizeCloudSave = (row: CloudSaveRow | null): CloudSaveSnapshot | null => {
  if (!row) {
    return null
  }

  const migrated = migrateSaveData(row.app_data)

  if (!migrated) {
    throw new Error('云端存档格式无法识别，请先导出本地存档作为备份。')
  }

  return {
    data: migrated,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  }
}

export const getCloudSession = async (): Promise<CloudSession | null> => {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export const onCloudAuthChange = (callback: (session: CloudSession | null) => void) => {
  const client = requireSupabase()
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session))

  return () => data.subscription.unsubscribe()
}

export const signUpCloudAccount = async (email: string, password: string) => {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export const signInCloudAccount = async (email: string, password: string) => {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export const signInWithGoogleAccount = async () => {
  const client = requireSupabase()
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const signOutCloudAccount = async () => {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export const loadCloudSave = async (): Promise<CloudSaveSnapshot | null> => {
  const client = requireSupabase()
  const userId = await getCurrentUserId()
  const { data, error } = await client
    .from('user_saves')
    .select('id, app_data, schema_version, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<CloudSaveRow>()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeCloudSave(data)
}

export const uploadCloudSave = async (appData: AppData): Promise<string> => {
  const client = requireSupabase()
  const userId = await getCurrentUserId()
  const timestamp = new Date().toISOString()
  const payload = {
    user_id: userId,
    app_data: appData,
    schema_version: appData.schemaVersion,
    updated_at: timestamp,
  }
  const { error } = await client
    .from('user_saves')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw new Error(error.message)
  }

  return timestamp
}
