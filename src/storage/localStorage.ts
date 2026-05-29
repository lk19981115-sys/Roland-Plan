import type { AppData, Settings } from '../types'
import { SCHEMA_VERSION } from '../types'
import { calculateRecurringStreak } from '../lib/date'
import { migrateSaveData } from './saveFile'

export const STORAGE_KEY = 'roland-plan-save-v1'

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'light',
  accentColor: 'blue',
  appearanceStyle: 'minimal',
  notificationsEnabled: false,
  collapseCompletedTasks: true,
  viewDensity: 'comfortable',
  calendarDisplayMode: 'tasks',
  calendarViewMode: 'month',
  autoCloudSaveEnabled: true,
  autoCloudSaveIntervalMinutes: 5,
  backupReminderEnabled: true,
  backupReminderIntervalDays: 7,
}

export const createEmptyData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  tasks: [],
  recurringTasks: [],
  longTermGoals: [],
  settings: { ...DEFAULT_SETTINGS },
  migrationHistory: [],
})

export const refreshRecurringStreaks = (data: AppData): AppData => ({
  ...data,
  recurringTasks: data.recurringTasks.map((task) => ({
    ...task,
    streak: calculateRecurringStreak(task),
  })),
})

export const loadAppData = (): AppData => {
  if (typeof window === 'undefined') {
    return createEmptyData()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return createEmptyData()
    }

    const parsed: unknown = JSON.parse(raw)

    const migrated = migrateSaveData(parsed)

    if (!migrated) {
      return createEmptyData()
    }

    return refreshRecurringStreaks(migrated)
  } catch {
    return createEmptyData()
  }
}

export const saveAppData = (data: AppData): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshRecurringStreaks(data)))
}
