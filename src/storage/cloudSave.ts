import type { AppData } from '../types'
import { inspectCloudSaveRisk, type CloudSaveRisk } from './cloudSaveProtection'
import { migrateSaveData } from './saveFile'
import { isSupabaseConfigured, supabase, type CloudSession } from './supabaseClient'

interface CloudSaveRow {
  id: string
  app_data: unknown
  schema_version: number
  updated_at: string
  backup_saves?: unknown
}

interface CloudAutoSaveRow {
  id: string
  slot_index: number
  app_data: unknown
  schema_version: number
  updated_at: string
}

interface CloudBackupRow {
  app_data: unknown
  schema_version: number
  updated_at: string
}

export interface CloudSaveSnapshot {
  key: string
  type: 'manual' | 'auto_backup'
  data: AppData
  updatedAt: string
  schemaVersion: number
}

export interface CloudSaveVersionSummary {
  key: string
  type: 'manual' | 'auto_backup'
  updatedAt: string
  schemaVersion: number
}

export interface CloudSaveHistory {
  manual: CloudSaveSnapshot | null
  backups: CloudSaveSnapshot[]
  versions: CloudSaveSnapshot[]
}

export interface CloudSaveRiskCheck {
  risk: CloudSaveRisk
  baseline: CloudSaveSnapshot
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
    key: 'manual',
    type: 'manual',
    data: migrated,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  }
}

const normalizeBackupSave = (backup: CloudBackupRow, index: number): CloudSaveSnapshot | null => {
  const migrated = migrateSaveData(backup.app_data)

  if (!migrated) {
    return null
  }

  return {
    key: `auto_backup_${index + 1}`,
    type: 'auto_backup',
    data: migrated,
    updatedAt: backup.updated_at,
    schemaVersion: backup.schema_version,
  }
}

const isCloudBackupRow = (value: unknown): value is CloudBackupRow => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CloudBackupRow>

  return (
    typeof candidate.updated_at === 'string' &&
    typeof candidate.schema_version === 'number' &&
    'app_data' in candidate
  )
}

const parseBackupSaves = (value: unknown): CloudBackupRow[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isCloudBackupRow).slice(0, 4)
}

const normalizeAutoSave = (row: CloudAutoSaveRow): CloudSaveSnapshot | null => {
  const migrated = migrateSaveData(row.app_data)

  if (!migrated) {
    return null
  }

  return {
    key: `auto_backup_${row.slot_index}`,
    type: 'auto_backup',
    data: migrated,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  }
}

const fetchCloudSaveRow = async (userId: string): Promise<CloudSaveRow | null> => {
  const client = requireSupabase()
  const withBackups = await client
    .from('user_saves')
    .select('id, app_data, schema_version, updated_at, backup_saves')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<CloudSaveRow>()

  if (!withBackups.error) {
    return withBackups.data
  }

  const missingBackupColumn =
    withBackups.error.code === '42703' || withBackups.error.message.includes('backup_saves')

  if (!missingBackupColumn) {
    throw new Error(withBackups.error.message)
  }

  const legacy = await client
    .from('user_saves')
    .select('id, app_data, schema_version, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<CloudSaveRow>()

  if (legacy.error) {
    throw new Error(legacy.error.message)
  }

  return legacy.data
}

const fetchAutoSaveRows = async (userId: string): Promise<CloudAutoSaveRow[]> => {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_auto_saves')
    .select('id, slot_index, app_data, schema_version, updated_at')
    .eq('user_id', userId)
    .order('slot_index', { ascending: true })
    .returns<CloudAutoSaveRow[]>()

  if (error) {
    const missingAutoSaveTable =
      error.code === '42P01' || error.message.includes('user_auto_saves')

    if (missingAutoSaveTable) {
      throw new Error('自动云存档表尚未创建。请先在 Supabase SQL Editor 重新运行 supabase/user_saves.sql。')
    }

    throw new Error(error.message)
  }

  return data ?? []
}

const getNextAutoSlotIndex = (rows: CloudAutoSaveRow[]): number => {
  const usedSlots = new Set(rows.map((row) => row.slot_index))
  const missingSlot = [1, 2, 3, 4].find((slot) => !usedSlots.has(slot))

  if (missingSlot) {
    return missingSlot
  }

  const latest = [...rows].sort((first, second) => second.updated_at.localeCompare(first.updated_at))[0]

  return latest.slot_index >= 4 ? 1 : latest.slot_index + 1
}

const getBackupHistory = (row: CloudSaveRow | null, autoRows: CloudAutoSaveRow[] = []): CloudSaveHistory => {
  const manual = normalizeCloudSave(row)
  const legacyBackups = parseBackupSaves(row?.backup_saves)
    .map(normalizeBackupSave)
    .filter((snapshot): snapshot is CloudSaveSnapshot => Boolean(snapshot))
  const autoBackups = autoRows
    .map(normalizeAutoSave)
    .filter((snapshot): snapshot is CloudSaveSnapshot => Boolean(snapshot))
  const backups = autoBackups.length > 0 ? autoBackups : legacyBackups

  return {
    manual,
    backups,
    versions: manual ? [manual, ...backups] : backups,
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
  const userId = await getCurrentUserId()
  const row = await fetchCloudSaveRow(userId)

  return normalizeCloudSave(row)
}

export const loadCloudSaveHistory = async (): Promise<CloudSaveHistory> => {
  const userId = await getCurrentUserId()
  const row = await fetchCloudSaveRow(userId)
  let autoRows: CloudAutoSaveRow[] = []

  try {
    autoRows = await fetchAutoSaveRows(userId)
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('自动云存档表尚未创建'))) {
      throw error
    }
  }

  return getBackupHistory(row, autoRows)
}

export const inspectCloudSaveUpload = async (appData: AppData): Promise<CloudSaveRiskCheck | null> => {
  const history = await loadCloudSaveHistory()
  const baseline = [...history.versions].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  )[0]

  if (!baseline) {
    return null
  }

  return {
    baseline,
    risk: inspectCloudSaveRisk(appData, baseline.data),
  }
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
    if (error.code === '42703' || error.message.includes('backup_saves')) {
      throw new Error('云存档历史字段尚未创建。请先在 Supabase SQL Editor 重新运行 supabase/user_saves.sql。')
    }

    throw new Error(error.message)
  }

  return timestamp
}

export const uploadAutoCloudSave = async (appData: AppData): Promise<{ updatedAt: string; slotIndex: number }> => {
  const client = requireSupabase()
  const userId = await getCurrentUserId()
  const rows = await fetchAutoSaveRows(userId)
  const slotIndex = getNextAutoSlotIndex(rows)
  const timestamp = new Date().toISOString()
  const payload = {
    user_id: userId,
    slot_index: slotIndex,
    app_data: appData,
    schema_version: appData.schemaVersion,
    updated_at: timestamp,
  }
  const { error } = await client
    .from('user_auto_saves')
    .upsert(payload, { onConflict: 'user_id,slot_index' })

  if (error) {
    const missingAutoSaveTable =
      error.code === '42P01' || error.message.includes('user_auto_saves')

    if (missingAutoSaveTable) {
      throw new Error('自动云存档表尚未创建。请先在 Supabase SQL Editor 重新运行 supabase/user_saves.sql。')
    }

    throw new Error(error.message)
  }

  return { updatedAt: timestamp, slotIndex }
}
