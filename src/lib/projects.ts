import type { Project, Task } from '../types'

export interface ProjectTaskDateBounds {
  start: string
  end: string
  source: 'project' | 'parent'
  sourceTitle: string
}

const clampDate = (date: string, start: string, end: string) => {
  if (date < start) return start
  if (date > end) return end
  return date
}

const getValidProjectChildrenMap = (tasks: Task[]) => {
  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const childrenMap = new Map<string, Task[]>()

  tasks.forEach((task) => {
    if (!task.projectId || !task.parentTaskId) return

    const parent = taskMap.get(task.parentTaskId)

    if (!parent || parent.projectId !== task.projectId) return

    childrenMap.set(parent.id, [...(childrenMap.get(parent.id) || []), task])
  })

  return childrenMap
}

export const getProjectTaskDescendantIds = (tasks: Task[], taskId: string) => {
  const childrenMap = getValidProjectChildrenMap(tasks)
  const ids = new Set<string>()

  const visit = (id: string) => {
    ;(childrenMap.get(id) || []).forEach((child) => {
      if (ids.has(child.id)) return

      ids.add(child.id)
      visit(child.id)
    })
  }

  visit(taskId)
  return ids
}

export const getProjectTaskDateBounds = (
  projectId: string | undefined,
  parentTaskId: string | undefined,
  projects: Project[],
  tasks: Task[],
): ProjectTaskDateBounds | null => {
  const project = projects.find((item) => item.id === projectId)

  if (!project) return null

  const parent = tasks.find(
    (task) =>
      task.id === parentTaskId &&
      task.projectId === project.id &&
      task.plannedStartDate &&
      task.plannedEndDate,
  )

  if (parent?.plannedStartDate && parent.plannedEndDate) {
    return {
      start: parent.plannedStartDate,
      end: parent.plannedEndDate,
      source: 'parent',
      sourceTitle: parent.title,
    }
  }

  return {
    start: project.plannedStartDate,
    end: project.plannedEndDate,
    source: 'project',
    sourceTitle: project.title,
  }
}

const normalizeProjectTaskDates = (
  tasks: Task[],
  projects: Project[],
  timestamp: string,
): Task[] => {
  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const normalizedMap = new Map<string, Task>()
  const visiting = new Set<string>()

  const normalizeTask = (task: Task): Task => {
    const cached = normalizedMap.get(task.id)
    if (cached) return cached

    const project = projects.find((item) => item.id === task.projectId)
    if (!project) {
      normalizedMap.set(task.id, task)
      return task
    }

    if (visiting.has(task.id)) {
      return task
    }

    visiting.add(task.id)

    const rawParent = task.parentTaskId ? taskMap.get(task.parentTaskId) : undefined
    const parent =
      rawParent?.projectId === project.id
        ? normalizeTask(rawParent)
        : undefined
    const boundStart = parent?.plannedStartDate || project.plannedStartDate
    const boundEnd = parent?.plannedEndDate || project.plannedEndDate
    let plannedStartDate = clampDate(task.plannedStartDate || boundStart, boundStart, boundEnd)
    const plannedEndDate = clampDate(task.plannedEndDate || task.date || boundEnd, boundStart, boundEnd)

    if (plannedEndDate < plannedStartDate) {
      plannedStartDate = plannedEndDate
    }

    const changed =
      task.plannedStartDate !== plannedStartDate ||
      task.plannedEndDate !== plannedEndDate ||
      task.date !== plannedEndDate
    const normalized = changed
      ? {
          ...task,
          date: plannedEndDate,
          plannedStartDate,
          plannedEndDate,
          syncStatus: 'local' as const,
          updatedAt: timestamp,
        }
      : task

    visiting.delete(task.id)
    normalizedMap.set(task.id, normalized)
    return normalized
  }

  return tasks.map(normalizeTask)
}

const normalizeProjectParentCompletion = (tasks: Task[], timestamp: string): Task[] => {
  const childrenMap = getValidProjectChildrenMap(tasks)
  const completionMap = new Map<string, boolean>()
  const visiting = new Set<string>()

  const resolveCompletion = (task: Task): boolean => {
    const cached = completionMap.get(task.id)
    if (cached !== undefined) return cached

    if (visiting.has(task.id)) return task.completed

    const children = childrenMap.get(task.id) || []
    if (children.length === 0) {
      completionMap.set(task.id, task.completed)
      return task.completed
    }

    visiting.add(task.id)
    const completed = children.every(resolveCompletion)
    visiting.delete(task.id)
    completionMap.set(task.id, completed)
    return completed
  }

  return tasks.map((task) => {
    if (!task.projectId || !(childrenMap.get(task.id)?.length)) return task

    const completed = resolveCompletion(task)
    return completed === task.completed
      ? task
      : {
          ...task,
          completed,
          syncStatus: 'local' as const,
          updatedAt: timestamp,
        }
  })
}

export const normalizeProjectTasks = (
  tasks: Task[],
  projects: Project[],
  timestamp = new Date().toISOString(),
) => normalizeProjectParentCompletion(normalizeProjectTaskDates(tasks, projects, timestamp), timestamp)
