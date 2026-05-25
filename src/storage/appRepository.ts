import type { AppData, LongTermGoalDraft, RecurringTaskDraft, Settings, TaskDraft } from '../types'

export type RepositoryMode = 'local'

export interface AppRepositoryInfo {
  mode: RepositoryMode
  label: string
  supportsCloudSync: boolean
}

export interface AppDataRepository {
  info: AppRepositoryInfo
  loadData: () => AppData
  replaceData: (data: AppData) => AppData
  resetData: () => AppData
  listTasks: () => AppData['tasks']
  createTask: (draft: TaskDraft) => AppData
  updateTask: (id: string, draft: Partial<TaskDraft>) => AppData
  deleteTask: (id: string) => AppData
  toggleTask: (id: string) => AppData
  moveTaskToDate: (id: string, date: string) => AppData
  moveTasksToDate: (ids: string[], date: string) => AppData
  reorderTask: (id: string, targetDate: string, beforeTaskId?: string) => AppData
  createRecurringTask: (draft: RecurringTaskDraft) => AppData
  updateRecurringTask: (id: string, draft: Partial<RecurringTaskDraft>) => AppData
  deleteRecurringTask: (id: string) => AppData
  toggleRecurringTask: (id: string, key: string) => AppData
  resetRecurring: (type: 'daily' | 'weekly', key: string) => AppData
  createGoal: (draft: LongTermGoalDraft) => AppData
  updateGoal: (id: string, draft: Partial<LongTermGoalDraft>) => AppData
  deleteGoal: (id: string) => AppData
  logGoalProgress: (id: string, count: number, date?: string) => AppData
  updateGoalLog: (goalId: string, logId: string, date: string, count: number) => AppData
  deleteGoalLog: (goalId: string, logId: string) => AppData
  updateSettings: (patch: Partial<Settings>) => AppData
}
