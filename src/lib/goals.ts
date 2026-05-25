import type { LongTermGoal } from '../types'
import { getTodayISO, getWeekRange, isDateInRange } from './date'

export const calculateLongTermTodayCount = (goal: LongTermGoal): number => {
  const today = getTodayISO()
  return goal.logs
    .filter((log) => log.date === today)
    .reduce((total, log) => total + Number(log.count || 0), 0)
}

export const calculateLongTermWeekCount = (goal: LongTermGoal): number => {
  const range = getWeekRange(getTodayISO())
  return goal.logs
    .filter((log) => isDateInRange(log.date, range.start, range.end))
    .reduce((total, log) => total + Number(log.count || 0), 0)
}

export const calculateGoalRate = (goal: LongTermGoal): number => {
  if (goal.unlimited) {
    return 0
  }

  if (goal.total <= 0) {
    return 0
  }

  return Math.min(100, Math.round((goal.completed / goal.total) * 100))
}
