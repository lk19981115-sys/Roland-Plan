import type { CompletionFilter, Task, TaskTag } from '../types'
import { addDaysISO, getNextWeekRange, getTodayISO, getWeekRange, isDateInRange } from './date'

const PRIORITY_WEIGHT: Record<Task['priority'], number> = {
  must: 0,
  important: 1,
  normal: 2,
}

const getSortOrder = (task: Task) => task.sortOrder ?? Number.POSITIVE_INFINITY

export const sortTasksByTime = (tasks: Task[]): Task[] => {
  return [...tasks].sort((first, second) => {
    if (first.date !== second.date) {
      return first.date.localeCompare(second.date)
    }

    const firstTime = first.noTime ? '99:99' : first.startTime || '00:00'
    const secondTime = second.noTime ? '99:99' : second.startTime || '00:00'

    if (first.completed !== second.completed) {
      return Number(first.completed) - Number(second.completed)
    }

    const firstSortOrder = getSortOrder(first)
    const secondSortOrder = getSortOrder(second)

    if (firstSortOrder !== secondSortOrder) {
      return firstSortOrder - secondSortOrder
    }

    if (first.priority !== second.priority) {
      return PRIORITY_WEIGHT[first.priority] - PRIORITY_WEIGHT[second.priority]
    }

    return firstTime.localeCompare(secondTime)
  })
}

export const getTasksForToday = (tasks: Task[]): Task[] => {
  const today = getTodayISO()
  return sortTasksByTime(tasks.filter((task) => task.date === today))
}

export const getTasksForTomorrow = (tasks: Task[]): Task[] => {
  const tomorrow = addDaysISO(getTodayISO(), 1)
  return sortTasksByTime(tasks.filter((task) => task.date === tomorrow))
}

export const getTasksForThisWeek = (tasks: Task[]): Task[] => {
  const range = getWeekRange(getTodayISO())
  return sortTasksByTime(tasks.filter((task) => isDateInRange(task.date, range.start, range.end)))
}

export const getTasksForNextWeek = (tasks: Task[]): Task[] => {
  const range = getNextWeekRange(getTodayISO())
  return sortTasksByTime(tasks.filter((task) => isDateInRange(task.date, range.start, range.end)))
}

export const getOverdueTasks = (tasks: Task[]): Task[] => {
  const today = getTodayISO()
  return sortTasksByTime(tasks.filter((task) => task.date < today && !task.completed))
}

export const getTaskMonthOptions = (tasks: Task[]): string[] => {
  return Array.from(new Set(tasks.map((task) => task.date.slice(0, 7)))).sort((first, second) =>
    second.localeCompare(first),
  )
}

export const calculateCompletionRate = (tasks: Task[]): number => {
  if (tasks.length === 0) {
    return 0
  }

  const completed = tasks.filter((task) => task.completed).length
  return Math.round((completed / tasks.length) * 100)
}

export const filterTasks = (
  tasks: Task[],
  query: string,
  completion: CompletionFilter,
  tag: TaskTag | 'all',
): Task[] => {
  const normalizedQuery = query.trim().toLowerCase()

  return sortTasksByTime(
    tasks.filter((task) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        (task.description || '').toLowerCase().includes(normalizedQuery)
      const matchesCompletion =
        completion === 'all' ||
        (completion === 'done' && task.completed) ||
        (completion === 'open' && !task.completed)
      const matchesTag = tag === 'all' || task.tag === tag

      return matchesQuery && matchesCompletion && matchesTag
    }),
  )
}
