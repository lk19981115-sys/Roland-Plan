import { UNLIMITED_GOAL_TOTAL, type AppData, type LongTermGoalDraft, type LongTermLog, type RecurringTaskDraft, type Settings, type TaskDraft } from '../types'
import { calculateRecurringStreak, getTodayISO } from '../lib/date'
import { sortTasksByTime } from '../lib/tasks'
import { createEmptyData, loadAppData, refreshRecurringStreaks, saveAppData } from './localStorage'
import type { AppDataRepository } from './appRepository'

const nowISO = () => new Date().toISOString()

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const cleanText = (value?: string) => value?.trim() || undefined

const buildSortOrder = (index: number) => (index + 1) * 1000

const normalizeGoalCount = (value: unknown) =>
  Math.min(UNLIMITED_GOAL_TOTAL, Math.max(0, Math.floor(Number(value) || 0)))

class LocalAppRepository implements AppDataRepository {
  info = {
    mode: 'local' as const,
    label: '浏览器本地存档',
    supportsCloudSync: false,
  }

  private snapshot: AppData | null = null

  loadData() {
    this.snapshot = loadAppData()
    saveAppData(this.snapshot)
    return this.snapshot
  }

  replaceData(data: AppData) {
    return this.commit(refreshRecurringStreaks(data))
  }

  resetData() {
    return this.commit(createEmptyData())
  }

  listTasks() {
    return this.getSnapshot().tasks
  }

  createTask(draft: TaskDraft) {
    const timestamp = nowISO()

    return this.updateSnapshot((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: createId(),
          title: draft.title.trim(),
          date: draft.date,
          startTime: draft.noTime ? undefined : cleanText(draft.startTime),
          endTime: draft.noTime ? undefined : cleanText(draft.endTime),
          noTime: draft.noTime,
          description: cleanText(draft.description),
          tag: draft.tag,
          priority: draft.priority,
          completed: Boolean(draft.completed),
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'local',
        },
      ],
    }))
  }

  updateTask(id: string, draft: Partial<TaskDraft>) {
    return this.updateSnapshot((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== id) {
          return task
        }

        const nextNoTime = draft.noTime ?? task.noTime

        return {
          ...task,
          ...draft,
          title: draft.title?.trim() ?? task.title,
          startTime:
            nextNoTime || draft.startTime !== undefined
              ? nextNoTime
                ? undefined
                : cleanText(draft.startTime)
              : task.startTime,
          endTime:
            nextNoTime || draft.endTime !== undefined
              ? nextNoTime
                ? undefined
                : cleanText(draft.endTime)
              : task.endTime,
          description:
            draft.description !== undefined ? cleanText(draft.description) : task.description,
          noTime: nextNoTime,
          syncStatus: 'local',
          updatedAt: nowISO(),
        }
      }),
    }))
  }

  deleteTask(id: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }))
  }

  toggleTask(id: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              syncStatus: 'local',
              updatedAt: nowISO(),
            }
          : task,
      ),
    }))
  }

  moveTaskToDate(id: string, date: string) {
    return this.reorderTask(id, date)
  }

  moveTasksToDate(ids: string[], date: string) {
    const idsToMove = new Set(ids)

    if (idsToMove.size === 0) {
      return this.getSnapshot()
    }

    return this.updateSnapshot((current) => {
      const timestamp = nowISO()
      const targetTasks = sortTasksByTime(
        current.tasks.filter((task) => task.date === date && !idsToMove.has(task.id)),
      )
      const movingTasks = sortTasksByTime(current.tasks.filter((task) => idsToMove.has(task.id))).map((task) => ({
        ...task,
        date,
        syncStatus: 'local' as const,
        updatedAt: timestamp,
      }))

      if (movingTasks.length === 0) {
        return current
      }

      const orderedTargetTasks = [...targetTasks, ...movingTasks].map((task, index) => ({
        ...task,
        sortOrder: buildSortOrder(index),
      }))

      return {
        ...current,
        tasks: [
          ...current.tasks.filter((task) => task.date !== date && !idsToMove.has(task.id)),
          ...orderedTargetTasks,
        ],
      }
    })
  }

  reorderTask(id: string, targetDate: string, beforeTaskId?: string) {
    return this.updateSnapshot((current) => {
      const movingTask = current.tasks.find((task) => task.id === id)

      if (!movingTask || beforeTaskId === id) {
        return current
      }

      const timestamp = nowISO()
      const remainingTasks = current.tasks.filter((task) => task.id !== id)
      const targetTasks = sortTasksByTime(remainingTasks.filter((task) => task.date === targetDate))
      const insertIndex = beforeTaskId
        ? targetTasks.findIndex((task) => task.id === beforeTaskId)
        : targetTasks.length
      const safeInsertIndex = insertIndex >= 0 ? insertIndex : targetTasks.length
      const movedTask = {
        ...movingTask,
        date: targetDate,
        syncStatus: 'local' as const,
        updatedAt: timestamp,
      }
      const orderedTargetTasks = [...targetTasks]

      orderedTargetTasks.splice(safeInsertIndex, 0, movedTask)

      const targetTaskMap = new Map(
        orderedTargetTasks.map((task, index) => [
          task.id,
          {
            ...task,
            sortOrder: buildSortOrder(index),
            syncStatus: task.id === id ? ('local' as const) : task.syncStatus,
            updatedAt: task.id === id ? timestamp : task.updatedAt,
          },
        ]),
      )

      return {
        ...current,
        tasks: [
          ...remainingTasks
            .filter((task) => task.date !== targetDate)
            .map((task) =>
              task.id === id
                ? {
                    ...task,
                    date: targetDate,
                    syncStatus: 'local' as const,
                    updatedAt: timestamp,
                  }
                : task,
            ),
          ...orderedTargetTasks.map((task) => targetTaskMap.get(task.id) ?? task),
        ],
      }
    })
  }

  createRecurringTask(draft: RecurringTaskDraft) {
    const timestamp = nowISO()

    return this.updateSnapshot((current) => ({
      ...current,
      recurringTasks: [
        ...current.recurringTasks,
        {
          id: createId(),
          title: draft.title.trim(),
          type: draft.type,
          completedKeys: [],
          streak: 0,
          description: cleanText(draft.description),
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'local',
        },
      ],
    }))
  }

  updateRecurringTask(id: string, draft: Partial<RecurringTaskDraft>) {
    return this.updateSnapshot((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...draft,
              title: draft.title?.trim() ?? task.title,
              description:
                draft.description !== undefined ? cleanText(draft.description) : task.description,
              completedKeys: draft.type && draft.type !== task.type ? [] : task.completedKeys,
              streak: draft.type && draft.type !== task.type ? 0 : task.streak,
              syncStatus: 'local',
              updatedAt: nowISO(),
            }
          : task,
      ),
    }))
  }

  deleteRecurringTask(id: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.filter((task) => task.id !== id),
    }))
  }

  toggleRecurringTask(id: string, key: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.map((task) => {
        if (task.id !== id) {
          return task
        }

        const completedKeys = task.completedKeys.includes(key)
          ? task.completedKeys.filter((item) => item !== key)
          : [...task.completedKeys, key]

        return {
          ...task,
          completedKeys,
          streak: calculateRecurringStreak({ ...task, completedKeys }),
          syncStatus: 'local',
          updatedAt: nowISO(),
        }
      }),
    }))
  }

  resetRecurring(type: 'daily' | 'weekly', key: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.map((task) => {
        if (task.type !== type) {
          return task
        }

        const completedKeys = task.completedKeys.filter((item) => item !== key)

        return {
          ...task,
          completedKeys,
          streak: calculateRecurringStreak({ ...task, completedKeys }),
          syncStatus: 'local',
          updatedAt: nowISO(),
        }
      }),
    }))
  }

  createGoal(draft: LongTermGoalDraft) {
    const timestamp = nowISO()
    const unlimited = draft.unlimited === true
    const rawCompleted = normalizeGoalCount(draft.completed)
    const draftTotal = Math.max(1, Math.floor(Number(draft.total) || 1))
    const total = unlimited ? UNLIMITED_GOAL_TOTAL : draftTotal
    const completed = unlimited
      ? rawCompleted
      : Math.min(total, rawCompleted)

    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: [
        ...current.longTermGoals,
        {
          id: createId(),
          title: draft.title.trim(),
          total,
          completed,
          unlimited,
          logs: [],
          description: cleanText(draft.description),
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'local',
        },
      ],
    }))
  }

  updateGoal(id: string, draft: Partial<LongTermGoalDraft>) {
    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: current.longTermGoals.map((goal) => {
        if (goal.id !== id) {
          return goal
        }

        const unlimited = draft.unlimited === undefined ? goal.unlimited === true : draft.unlimited === true
        const rawCompleted = normalizeGoalCount(draft.completed ?? goal.completed)
        const draftTotal = Math.max(1, Math.floor(Number(draft.total ?? goal.total) || goal.total))
        const total = unlimited ? UNLIMITED_GOAL_TOTAL : draftTotal
        const completed = unlimited ? rawCompleted : Math.min(total, rawCompleted)

        return {
          ...goal,
          ...draft,
          title: draft.title?.trim() ?? goal.title,
          total,
          completed,
          unlimited,
          description:
            draft.description !== undefined ? cleanText(draft.description) : goal.description,
          syncStatus: 'local',
          updatedAt: nowISO(),
        }
      }),
    }))
  }

  deleteGoal(id: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: current.longTermGoals.filter((goal) => goal.id !== id),
    }))
  }

  logGoalProgress(id: string, count: number, date = getTodayISO()) {
    const safeCount = normalizeGoalCount(count)

    if (safeCount === 0) {
      return this.getSnapshot()
    }

    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: current.longTermGoals.map((goal) => {
        if (goal.id !== id) {
          return goal
        }

        const remaining = Math.max(0, goal.total - goal.completed)
        const availableUnlimited = Math.max(0, UNLIMITED_GOAL_TOTAL - goal.completed)
        const appliedCount = goal.unlimited ? Math.min(availableUnlimited, safeCount) : Math.min(remaining, safeCount)

        if (appliedCount === 0) {
          return goal
        }

        const timestamp = nowISO()
        const log: LongTermLog = {
          id: createId(),
          date,
          count: appliedCount,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'local',
        }

        return {
          ...goal,
          completed: goal.completed + appliedCount,
          total: goal.unlimited ? UNLIMITED_GOAL_TOTAL : goal.total,
          logs: [...goal.logs, log],
          syncStatus: 'local',
          updatedAt: timestamp,
        }
      }),
    }))
  }

  updateGoalLog(goalId: string, logId: string, date: string, count: number) {
    const safeCount = normalizeGoalCount(count)

    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: current.longTermGoals.map((goal) => {
        if (goal.id !== goalId) {
          return goal
        }

        const oldLog = goal.logs.find((log) => log.id === logId)

        if (!oldLog) {
          return goal
        }

        const baseCompleted = Math.max(0, goal.completed - oldLog.count)
        const appliedCount = goal.unlimited
          ? Math.min(Math.max(0, UNLIMITED_GOAL_TOTAL - baseCompleted), safeCount)
          : Math.min(Math.max(0, goal.total - baseCompleted), safeCount)
        const timestamp = nowISO()
        const logs = goal.logs.map((log) =>
          log.id === logId
            ? {
                ...log,
                date,
                count: appliedCount,
                syncStatus: 'local' as const,
                updatedAt: timestamp,
              }
            : log,
        )

        return {
          ...goal,
          completed: baseCompleted + appliedCount,
          total: goal.unlimited ? UNLIMITED_GOAL_TOTAL : goal.total,
          logs,
          syncStatus: 'local',
          updatedAt: timestamp,
        }
      }),
    }))
  }

  deleteGoalLog(goalId: string, logId: string) {
    return this.updateSnapshot((current) => ({
      ...current,
      longTermGoals: current.longTermGoals.map((goal) => {
        if (goal.id !== goalId) {
          return goal
        }

        const oldLog = goal.logs.find((log) => log.id === logId)

        if (!oldLog) {
          return goal
        }

        return {
          ...goal,
          completed: Math.max(0, goal.completed - oldLog.count),
          logs: goal.logs.filter((log) => log.id !== logId),
          syncStatus: 'local',
          updatedAt: nowISO(),
        }
      }),
    }))
  }

  updateSettings(patch: Partial<Settings>) {
    return this.updateSnapshot((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }))
  }

  private getSnapshot() {
    if (!this.snapshot) {
      return this.loadData()
    }

    return this.snapshot
  }

  private updateSnapshot(mutator: (current: AppData) => AppData) {
    return this.commit(mutator(this.getSnapshot()))
  }

  private commit(data: AppData) {
    this.snapshot = refreshRecurringStreaks(data)
    saveAppData(this.snapshot)
    return this.snapshot
  }
}

export const localAppRepository = new LocalAppRepository()

export const createLocalAppRepository = (): AppDataRepository => new LocalAppRepository()
