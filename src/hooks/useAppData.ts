import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  AppData,
  LongTermGoalDraft,
  ProjectDraft,
  RecurringTaskDraft,
  Settings,
  TaskDraft,
} from '../types'
import type { AppDataRepository } from '../storage/appRepository'
import { localAppRepository } from '../storage/localAppRepository'
import { addDaysISO, getTodayISO } from '../lib/date'

export interface AppActions {
  addTask: (draft: TaskDraft) => void
  updateTask: (id: string, draft: Partial<TaskDraft>) => void
  deleteTask: (id: string) => void
  toggleTask: (id: string) => void
  moveTaskToDate: (id: string, date: string) => void
  moveTasksToDate: (ids: string[], date: string) => void
  reorderTask: (id: string, targetDate: string, beforeTaskId?: string) => void
  postponeTaskToTomorrow: (id: string) => void
  postponeTasksToTomorrow: (ids: string[]) => void
  addProject: (draft: ProjectDraft) => void
  updateProject: (id: string, draft: Partial<ProjectDraft>) => void
  deleteProject: (id: string) => void
  addRecurringTask: (draft: RecurringTaskDraft) => void
  updateRecurringTask: (id: string, draft: Partial<RecurringTaskDraft>) => void
  deleteRecurringTask: (id: string) => void
  toggleRecurringTask: (id: string, key: string) => void
  resetRecurring: (type: 'daily' | 'weekly', key: string) => void
  addGoal: (draft: LongTermGoalDraft) => void
  updateGoal: (id: string, draft: Partial<LongTermGoalDraft>) => void
  deleteGoal: (id: string) => void
  logGoalProgress: (id: string, count: number, date?: string) => void
  updateGoalLog: (goalId: string, logId: string, date: string, count: number) => void
  deleteGoalLog: (goalId: string, logId: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceData: (data: AppData) => void
  resetData: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const HISTORY_LIMIT = 30

const cloneAppData = (data: AppData): AppData => {
  if (typeof structuredClone === 'function') {
    return structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as AppData
}

const isSameData = (left: AppData, right: AppData) => JSON.stringify(left) === JSON.stringify(right)

export const useAppData = (
  repository: AppDataRepository = localAppRepository,
): { data: AppData; actions: AppActions } => {
  const [activeRepository] = useState(() => repository)
  const [data, setData] = useState<AppData>(() => activeRepository.loadData())
  const dataRef = useRef(data)
  const undoStackRef = useRef<AppData[]>([])
  const redoStackRef = useRef<AppData[]>([])
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const refreshHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    })
  }, [])

  const run = useCallback((operation: (repository: AppDataRepository) => AppData) => {
    const before = cloneAppData(dataRef.current)
    const nextData = operation(activeRepository)

    dataRef.current = nextData
    setData(nextData)

    if (isSameData(before, nextData)) {
      return
    }

    undoStackRef.current = [...undoStackRef.current, before].slice(-HISTORY_LIMIT)
    redoStackRef.current = []
    refreshHistoryState()
  }, [activeRepository, refreshHistoryState])

  const undo = useCallback(() => {
    const previous = undoStackRef.current.at(-1)

    if (!previous) {
      return
    }

    const current = cloneAppData(dataRef.current)
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current, current].slice(-HISTORY_LIMIT)

    const restored = activeRepository.replaceData(previous)
    dataRef.current = restored
    setData(restored)
    refreshHistoryState()
  }, [activeRepository, refreshHistoryState])

  const redo = useCallback(() => {
    const next = redoStackRef.current.at(-1)

    if (!next) {
      return
    }

    const current = cloneAppData(dataRef.current)
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current, current].slice(-HISTORY_LIMIT)

    const restored = activeRepository.replaceData(next)
    dataRef.current = restored
    setData(restored)
    refreshHistoryState()
  }, [activeRepository, refreshHistoryState])

  const actions = useMemo<AppActions>(
    () => ({
      addTask: (draft) => run((repo) => repo.createTask(draft)),
      updateTask: (id, draft) => run((repo) => repo.updateTask(id, draft)),
      deleteTask: (id) => run((repo) => repo.deleteTask(id)),
      toggleTask: (id) => run((repo) => repo.toggleTask(id)),
      moveTaskToDate: (id, date) => run((repo) => repo.moveTaskToDate(id, date)),
      moveTasksToDate: (ids, date) => run((repo) => repo.moveTasksToDate(ids, date)),
      reorderTask: (id, targetDate, beforeTaskId) =>
        run((repo) => repo.reorderTask(id, targetDate, beforeTaskId)),
      postponeTaskToTomorrow: (id) => {
        const tomorrow = addDaysISO(getTodayISO(), 1)
        run((repo) => repo.moveTaskToDate(id, tomorrow))
      },
      postponeTasksToTomorrow: (ids) => {
        const tomorrow = addDaysISO(getTodayISO(), 1)
        run((repo) => repo.moveTasksToDate(ids, tomorrow))
      },
      addProject: (draft) => run((repo) => repo.createProject(draft)),
      updateProject: (id, draft) => run((repo) => repo.updateProject(id, draft)),
      deleteProject: (id) => run((repo) => repo.deleteProject(id)),
      addRecurringTask: (draft) => run((repo) => repo.createRecurringTask(draft)),
      updateRecurringTask: (id, draft) => run((repo) => repo.updateRecurringTask(id, draft)),
      deleteRecurringTask: (id) => run((repo) => repo.deleteRecurringTask(id)),
      toggleRecurringTask: (id, key) => run((repo) => repo.toggleRecurringTask(id, key)),
      resetRecurring: (type, key) => run((repo) => repo.resetRecurring(type, key)),
      addGoal: (draft) => run((repo) => repo.createGoal(draft)),
      updateGoal: (id, draft) => run((repo) => repo.updateGoal(id, draft)),
      deleteGoal: (id) => run((repo) => repo.deleteGoal(id)),
      logGoalProgress: (id, count, date) => run((repo) => repo.logGoalProgress(id, count, date)),
      updateGoalLog: (goalId, logId, date, count) =>
        run((repo) => repo.updateGoalLog(goalId, logId, date, count)),
      deleteGoalLog: (goalId, logId) => run((repo) => repo.deleteGoalLog(goalId, logId)),
      updateSettings: (patch) => run((repo) => repo.updateSettings(patch)),
      replaceData: (nextData) => run((repo) => repo.replaceData(nextData)),
      resetData: () => run((repo) => repo.resetData()),
      undo,
      redo,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
    }),
    [historyState.canRedo, historyState.canUndo, redo, run, undo],
  )

  return { data, actions }
}
