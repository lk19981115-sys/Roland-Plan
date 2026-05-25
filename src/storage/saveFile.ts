import type {
  AppData,
  LongTermGoal,
  LongTermLog,
  MigrationRecord,
  RecurringTask,
  Settings,
  SyncMetadata,
  Task,
} from '../types'
import { SCHEMA_VERSION, UNLIMITED_GOAL_TOTAL } from '../types'
import { calculateRecurringStreak, getTodayISO } from '../lib/date'

const TASK_TAG_VALUES = ['work', 'life', 'urgent', 'other']
const TASK_PRIORITY_VALUES = ['normal', 'important', 'must']
const THEME_MODE_VALUES = ['light', 'dark', 'system']
const ACCENT_COLOR_VALUES = ['blue', 'green', 'purple', 'gray', 'pink']
const VIEW_DENSITY_VALUES = ['comfortable', 'compact']
const SYNC_STATUS_VALUES = ['local', 'pending', 'synced', 'error']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/
const WEEK_PATTERN = /^\d{4}-W\d{2}$/

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isString = (value: unknown): value is string => typeof value === 'string'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isOptionalString = (value: unknown): boolean => value === undefined || isString(value)

const isOptionalNumber = (value: unknown): boolean => value === undefined || isNumber(value)

const isDateString = (value: unknown): value is string => {
  if (!isString(value) || !DATE_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

const isTimeString = (value: unknown): value is string => {
  if (!isString(value) || !TIME_PATTERN.test(value)) {
    return false
  }

  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

const isOptionalTimeString = (value: unknown): boolean => value === undefined || isTimeString(value)

const isWeekKey = (value: unknown): value is string => {
  if (!isString(value) || !WEEK_PATTERN.test(value)) {
    return false
  }

  const week = Number(value.slice(6))
  return week >= 1 && week <= 53
}

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

const normalizeOptionalString = (value: unknown): string | undefined => {
  return isString(value) && value.trim() ? value.trim() : undefined
}

const normalizeTimestamp = (value: unknown, fallback: string): string => {
  return isString(value) && value.trim() ? value : fallback
}

const normalizeReminderInterval = (value: unknown): number => {
  if (!isNumber(value)) {
    return 7
  }

  return Math.min(30, Math.max(1, Math.floor(value)))
}

const normalizeAutoCloudSaveInterval = (value: unknown): number => {
  if (!isNumber(value)) {
    return 5
  }

  return Math.min(60, Math.max(1, Math.floor(value)))
}

const isTimestampString = (value: unknown): value is string => {
  return isString(value) && Number.isFinite(Date.parse(value))
}

const createMigrationId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isSyncMetadata = (value: Record<string, unknown>): boolean => {
  return (
    isOptionalString(value.remoteId) &&
    isOptionalString(value.deletedAt) &&
    (value.syncStatus === undefined ||
      (isString(value.syncStatus) && SYNC_STATUS_VALUES.includes(value.syncStatus)))
  )
}

const normalizeSyncMetadata = (value: Record<string, unknown>): SyncMetadata => ({
  remoteId: normalizeOptionalString(value.remoteId),
  deletedAt: normalizeOptionalString(value.deletedAt),
  syncStatus:
    isString(value.syncStatus) && SYNC_STATUS_VALUES.includes(value.syncStatus)
      ? (value.syncStatus as SyncMetadata['syncStatus'])
      : 'local',
})

const isMigrationRecord = (value: unknown): value is MigrationRecord => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isNumber(value.fromVersion) &&
    isNumber(value.toVersion) &&
    isString(value.migratedAt) &&
    Array.isArray(value.notes) &&
    value.notes.every(isString)
  )
}

const getMigrationNotes = (fromVersion: number, toVersion: number): string[] => {
  const notes: string[] = []

  if (fromVersion <= 1) {
    notes.push('补全任务优先级、视图密度和备份状态等字段。')
  }

  if (fromVersion <= 2) {
    notes.push('为任务、周期任务、长期目标补全云同步预备字段。')
  }

  if (fromVersion <= 3) {
    notes.push('加入本地备份提醒设置和存档版本迁移记录。')
  }

  if (fromVersion <= 4) {
    notes.push('为普通任务加入可选排序字段，支持本周视图拖动改日期和同日排序。')
  }

  if (fromVersion <= 5) {
    notes.push('为长期目标加入无上限累计模式，适合字数、页数、时长等持续记录。')
  }

  if (fromVersion <= 6) {
    notes.push('加入自动云存档设置，支持默认开启的周期性云端自动备份。')
  }

  if (fromVersion === toVersion) {
    notes.push('修复当前版本存档结构缺失的字段。')
  }

  notes.push('保留 tasks 作为唯一普通任务数据源，今日/本周/日历仍由日期动态计算。')

  return notes
}

const isTask = (value: unknown): value is Task => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isString(value.title) &&
    isDateString(value.date) &&
    isOptionalTimeString(value.startTime) &&
    isOptionalTimeString(value.endTime) &&
    isBoolean(value.noTime) &&
    isString(value.tag) &&
    TASK_TAG_VALUES.includes(value.tag) &&
    isString(value.priority) &&
    TASK_PRIORITY_VALUES.includes(value.priority) &&
    isBoolean(value.completed) &&
    isOptionalNumber(value.sortOrder) &&
    isOptionalString(value.description) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isSyncMetadata(value)
  )
}

const isRecurringTask = (value: unknown): value is RecurringTask => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isString(value.title) &&
    (value.type === 'daily' || value.type === 'weekly') &&
    Array.isArray(value.completedKeys) &&
    value.completedKeys.every(value.type === 'daily' ? isDateString : isWeekKey) &&
    isNumber(value.streak) &&
    value.streak >= 0 &&
    isOptionalString(value.description) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isSyncMetadata(value)
  )
}

const isLongTermLog = (value: unknown): value is LongTermLog => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isDateString(value.date) &&
    isNumber(value.count) &&
    value.count >= 0 &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isSyncMetadata(value)
  )
}

const isLongTermGoal = (value: unknown): value is LongTermGoal => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isString(value.title) &&
    isNumber(value.total) &&
    value.total >= 1 &&
    isNumber(value.completed) &&
    value.completed >= 0 &&
    isBoolean(value.unlimited) &&
    (value.unlimited || value.completed <= value.total) &&
    Array.isArray(value.logs) &&
    value.logs.every(isLongTermLog) &&
    isOptionalString(value.description) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isSyncMetadata(value)
  )
}

const isSettings = (value: unknown): value is Settings => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.themeMode) &&
    THEME_MODE_VALUES.includes(value.themeMode) &&
    isString(value.accentColor) &&
    ACCENT_COLOR_VALUES.includes(value.accentColor) &&
    isBoolean(value.notificationsEnabled) &&
    isBoolean(value.collapseCompletedTasks) &&
    isString(value.viewDensity) &&
    VIEW_DENSITY_VALUES.includes(value.viewDensity) &&
    isBoolean(value.autoCloudSaveEnabled) &&
    isNumber(value.autoCloudSaveIntervalMinutes) &&
    value.autoCloudSaveIntervalMinutes >= 1 &&
    value.autoCloudSaveIntervalMinutes <= 60 &&
    (value.lastAutoCloudSaveAt === undefined || isTimestampString(value.lastAutoCloudSaveAt)) &&
    (value.lastBackupAt === undefined || isDateString(value.lastBackupAt)) &&
    isBoolean(value.backupReminderEnabled) &&
    isNumber(value.backupReminderIntervalDays) &&
    value.backupReminderIntervalDays >= 1 &&
    value.backupReminderIntervalDays <= 30 &&
    (value.backupReminderSnoozedUntil === undefined ||
      isDateString(value.backupReminderSnoozedUntil))
  )
}

export const validateSaveData = (data: unknown): data is AppData => {
  if (!isRecord(data)) {
    return false
  }

  return (
    data.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(data.tasks) &&
    data.tasks.every(isTask) &&
    Array.isArray(data.recurringTasks) &&
    data.recurringTasks.every(isRecurringTask) &&
    Array.isArray(data.longTermGoals) &&
    data.longTermGoals.every(isLongTermGoal) &&
    isSettings(data.settings) &&
    Array.isArray(data.migrationHistory) &&
    data.migrationHistory.every(isMigrationRecord)
  )
}

export const migrateSaveData = (data: unknown): AppData | null => {
  if (!isRecord(data)) {
    return null
  }

  if (validateSaveData(data)) {
    return {
      ...data,
      longTermGoals: data.longTermGoals.map((goal) =>
        goal.unlimited
          ? {
              ...goal,
              total: UNLIMITED_GOAL_TOTAL,
              completed: Math.min(UNLIMITED_GOAL_TOTAL, Math.floor(goal.completed)),
            }
          : goal,
      ),
      recurringTasks: data.recurringTasks.map((task) => ({
        ...task,
        streak: calculateRecurringStreak(task),
      })),
    }
  }

  const sourceVersion = Number(data.schemaVersion)

  if (![1, 2, 3, 4, 5, 6, SCHEMA_VERSION].includes(sourceVersion)) {
    return null
  }

  const timestamp = new Date().toISOString()
  const settingsSource = isRecord(data.settings) ? data.settings : {}
  const settings: Settings = {
    themeMode:
      isString(settingsSource.themeMode) && THEME_MODE_VALUES.includes(settingsSource.themeMode)
        ? (settingsSource.themeMode as Settings['themeMode'])
        : 'light',
    accentColor:
      isString(settingsSource.accentColor) && ACCENT_COLOR_VALUES.includes(settingsSource.accentColor)
        ? (settingsSource.accentColor as Settings['accentColor'])
        : 'blue',
    notificationsEnabled: isBoolean(settingsSource.notificationsEnabled)
      ? settingsSource.notificationsEnabled
      : false,
    collapseCompletedTasks: isBoolean(settingsSource.collapseCompletedTasks)
      ? settingsSource.collapseCompletedTasks
      : true,
    viewDensity:
      isString(settingsSource.viewDensity) && VIEW_DENSITY_VALUES.includes(settingsSource.viewDensity)
        ? (settingsSource.viewDensity as Settings['viewDensity'])
        : 'comfortable',
    autoCloudSaveEnabled: isBoolean(settingsSource.autoCloudSaveEnabled)
      ? settingsSource.autoCloudSaveEnabled
      : true,
    autoCloudSaveIntervalMinutes: normalizeAutoCloudSaveInterval(settingsSource.autoCloudSaveIntervalMinutes),
    lastAutoCloudSaveAt: isTimestampString(settingsSource.lastAutoCloudSaveAt)
      ? settingsSource.lastAutoCloudSaveAt
      : undefined,
    lastBackupAt: isDateString(settingsSource.lastBackupAt) ? settingsSource.lastBackupAt : undefined,
    backupReminderEnabled: isBoolean(settingsSource.backupReminderEnabled)
      ? settingsSource.backupReminderEnabled
      : true,
    backupReminderIntervalDays: normalizeReminderInterval(settingsSource.backupReminderIntervalDays),
    backupReminderSnoozedUntil: isDateString(settingsSource.backupReminderSnoozedUntil)
      ? settingsSource.backupReminderSnoozedUntil
      : undefined,
  }

  const tasks: Task[] = asRecordArray(data.tasks)
    .map((task): Task | null => {
      if (
        !isString(task.id) ||
        !isString(task.title) ||
        !isDateString(task.date) ||
        !isBoolean(task.noTime) ||
        !isString(task.tag) ||
        !TASK_TAG_VALUES.includes(task.tag) ||
        !isBoolean(task.completed)
      ) {
        return null
      }

      return {
        id: task.id,
        title: task.title,
        date: task.date,
        startTime: isTimeString(task.startTime) ? task.startTime : undefined,
        endTime: isTimeString(task.endTime) ? task.endTime : undefined,
        noTime: task.noTime,
        description: normalizeOptionalString(task.description),
        tag: task.tag as Task['tag'],
        priority:
          isString(task.priority) && TASK_PRIORITY_VALUES.includes(task.priority)
            ? (task.priority as Task['priority'])
            : 'normal',
        completed: task.completed,
        sortOrder: isNumber(task.sortOrder) ? task.sortOrder : undefined,
        createdAt: normalizeTimestamp(task.createdAt, timestamp),
        updatedAt: normalizeTimestamp(task.updatedAt, timestamp),
        ...normalizeSyncMetadata(task),
      }
    })
    .filter((task): task is Task => Boolean(task))

  const recurringTasks: RecurringTask[] = asRecordArray(data.recurringTasks)
    .map((task): RecurringTask | null => {
      if (
        !isString(task.id) ||
        !isString(task.title) ||
        (task.type !== 'daily' && task.type !== 'weekly') ||
        !Array.isArray(task.completedKeys)
      ) {
        return null
      }

      const completedKeys = task.completedKeys.filter(task.type === 'daily' ? isDateString : isWeekKey)
      const normalizedTask: RecurringTask = {
        id: task.id,
        title: task.title,
        type: task.type,
        completedKeys,
        streak: 0,
        description: normalizeOptionalString(task.description),
        createdAt: normalizeTimestamp(task.createdAt, timestamp),
        updatedAt: normalizeTimestamp(task.updatedAt, timestamp),
        ...normalizeSyncMetadata(task),
      }

      return {
        ...normalizedTask,
        streak: calculateRecurringStreak(normalizedTask),
      }
    })
    .filter((task): task is RecurringTask => Boolean(task))

  const longTermGoals: LongTermGoal[] = asRecordArray(data.longTermGoals)
    .map((goal): LongTermGoal | null => {
      if (!isString(goal.id) || !isString(goal.title) || !isNumber(goal.total) || goal.total < 1) {
        return null
      }

      const logs: LongTermLog[] = asRecordArray(goal.logs)
        .filter((log) => isDateString(log.date) && isNumber(log.count) && log.count >= 0)
        .map((log) => ({
          id: isString(log.id) ? log.id : createMigrationId('goal-log'),
          date: log.date as string,
          count: Math.floor(Number(log.count)),
          createdAt: normalizeTimestamp(log.createdAt, timestamp),
          updatedAt: normalizeTimestamp(log.updatedAt, timestamp),
          ...normalizeSyncMetadata(log),
        }))
      const unlimited = isBoolean(goal.unlimited) ? goal.unlimited : false
      const completed = unlimited
        ? Math.min(UNLIMITED_GOAL_TOTAL, Math.max(0, isNumber(goal.completed) ? Math.floor(goal.completed) : 0))
        : Math.min(goal.total, Math.max(0, isNumber(goal.completed) ? Math.floor(goal.completed) : 0))

      const total = unlimited
        ? UNLIMITED_GOAL_TOTAL
        : Math.floor(goal.total)

      return {
        id: goal.id,
        title: goal.title,
        total,
        completed,
        unlimited,
        logs,
        description: normalizeOptionalString(goal.description),
        createdAt: normalizeTimestamp(goal.createdAt, timestamp),
        updatedAt: normalizeTimestamp(goal.updatedAt, timestamp),
        ...normalizeSyncMetadata(goal),
      }
    })
    .filter((goal): goal is LongTermGoal => Boolean(goal))

  const migrationHistory = asRecordArray(data.migrationHistory).reduce<MigrationRecord[]>(
    (records, record) => {
      if (isMigrationRecord(record)) {
        records.push(record)
      }

      return records
    },
    [],
  )

  if (sourceVersion !== SCHEMA_VERSION || migrationHistory.length === 0) {
    migrationHistory.push({
      id: createMigrationId('migration'),
      fromVersion: sourceVersion,
      toVersion: SCHEMA_VERSION,
      migratedAt: timestamp,
      notes: getMigrationNotes(sourceVersion, SCHEMA_VERSION),
    })
  }

  const migrated: AppData = {
    schemaVersion: SCHEMA_VERSION,
    tasks,
    recurringTasks,
    longTermGoals,
    settings,
    migrationHistory,
  }

  return validateSaveData(migrated) ? migrated : null
}

export const exportSaveFile = (data: AppData): void => {
  const saveData: AppData = {
    ...data,
    settings: {
      ...data.settings,
      lastBackupAt: getTodayISO(),
    },
    recurringTasks: data.recurringTasks.map((task) => ({
      ...task,
      streak: calculateRecurringStreak(task),
    })),
  }
  const payload = JSON.stringify(saveData, null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `roland-plan-save-${getTodayISO()}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const importSaveFile = async (file: File): Promise<AppData> => {
  let parsed: unknown

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('这个存档文件无法读取，请确认它是从 Roland-Plan 导出的存档。')
  }

  const migrated = migrateSaveData(parsed)

  if (!migrated) {
    throw new Error('存档格式不匹配或版本不支持，请确认它是从 Roland-Plan 导出的存档。')
  }

  return migrated
}
