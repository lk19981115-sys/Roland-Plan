export const SCHEMA_VERSION = 10

export const UNLIMITED_GOAL_TOTAL = 2147483647

export type TaskTag = 'work' | 'life' | 'urgent' | 'other'

export type TaskPriority = 'normal' | 'important' | 'must'

export type SyncStatus = 'local' | 'pending' | 'synced' | 'error'

export type CompletionFilter = 'all' | 'open' | 'done'

export type ThemeMode = 'light' | 'dark' | 'system'

export type AccentColor = 'blue' | 'green' | 'purple' | 'gray' | 'pink'

export type ViewDensity = 'comfortable' | 'compact'

export type AppearanceStyle = 'minimal' | 'relaxed'

export type CalendarDisplayMode = 'tasks' | 'compact' | 'all'

export type CalendarViewMode = 'month' | 'week'

export type PageId = 'today' | 'week' | 'goals' | 'recurring' | 'calendar' | 'review' | 'settings'

export interface SyncMetadata {
  remoteId?: string
  deletedAt?: string
  syncStatus?: SyncStatus
}

export interface Task extends SyncMetadata {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  noTime: boolean
  description?: string
  tag: TaskTag
  priority: TaskPriority
  completed: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface TaskDraft {
  title: string
  date: string
  startTime?: string
  endTime?: string
  noTime: boolean
  description?: string
  tag: TaskTag
  priority: TaskPriority
  completed?: boolean
}

export interface RecurringTask extends SyncMetadata {
  id: string
  title: string
  type: 'daily' | 'weekly'
  completedKeys: string[]
  streak: number
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RecurringTaskDraft {
  title: string
  type: 'daily' | 'weekly'
  description?: string
}

export interface LongTermLog extends SyncMetadata {
  id: string
  date: string
  count: number
  createdAt: string
  updatedAt: string
}

export interface LongTermGoal extends SyncMetadata {
  id: string
  title: string
  total: number
  completed: number
  unlimited: boolean
  logs: LongTermLog[]
  description?: string
  createdAt: string
  updatedAt: string
}

export interface LongTermGoalDraft {
  title: string
  total: number
  completed: number
  unlimited: boolean
  description?: string
}

export interface Settings {
  themeMode: ThemeMode
  accentColor: AccentColor
  appearanceStyle: AppearanceStyle
  notificationsEnabled: boolean
  collapseCompletedTasks: boolean
  viewDensity: ViewDensity
  calendarDisplayMode: CalendarDisplayMode
  calendarViewMode: CalendarViewMode
  autoCloudSaveEnabled: boolean
  autoCloudSaveIntervalMinutes: number
  lastAutoCloudSaveAt?: string
  lastBackupAt?: string
  backupReminderEnabled: boolean
  backupReminderIntervalDays: number
  backupReminderSnoozedUntil?: string
}

export interface MigrationRecord {
  id: string
  fromVersion: number
  toVersion: number
  migratedAt: string
  notes: string[]
}

export interface AppData {
  schemaVersion: number
  tasks: Task[]
  recurringTasks: RecurringTask[]
  longTermGoals: LongTermGoal[]
  settings: Settings
  migrationHistory: MigrationRecord[]
}

export interface DateRange {
  start: string
  end: string
  dates: string[]
}

export const TASK_TAGS: Array<{ value: TaskTag; label: string }> = [
  { value: 'work', label: '工作' },
  { value: 'life', label: '生活' },
  { value: 'urgent', label: '紧急' },
  { value: 'other', label: '其他' },
]

export const TASK_PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'normal', label: '普通' },
  { value: 'important', label: '重要' },
  { value: 'must', label: '必做' },
]

export const ACCENT_COLORS: Array<{ value: AccentColor; label: string }> = [
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'purple', label: '紫色' },
  { value: 'gray', label: '灰色' },
  { value: 'pink', label: '粉色' },
]

export const APPEARANCE_STYLES: Array<{ value: AppearanceStyle; label: string }> = [
  { value: 'minimal', label: '简约' },
  { value: 'relaxed', label: '轻松' },
]

export const CALENDAR_DISPLAY_MODES: Array<{ value: CalendarDisplayMode; label: string }> = [
  { value: 'tasks', label: '任务' },
  { value: 'compact', label: '简洁' },
  { value: 'all', label: '全部' },
]

export const CALENDAR_VIEW_MODES: Array<{ value: CalendarViewMode; label: string }> = [
  { value: 'month', label: '月' },
  { value: 'week', label: '周' },
]
