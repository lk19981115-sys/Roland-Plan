import type { AppData } from '../types'

interface SaveCountMetric {
  key: string
  label: string
  current: number
  baseline: number
}

export interface CloudSaveRisk {
  hasRisk: boolean
  summary: string
  details: string[]
  currentTotal: number
  baselineTotal: number
}

const getMetrics = (current: AppData, baseline: AppData): SaveCountMetric[] => [
  {
    key: 'tasks',
    label: '普通任务',
    current: current.tasks.length,
    baseline: baseline.tasks.length,
  },
  {
    key: 'projects',
    label: '项目',
    current: current.projects.length,
    baseline: baseline.projects.length,
  },
  {
    key: 'recurringTasks',
    label: '周期任务',
    current: current.recurringTasks.length,
    baseline: baseline.recurringTasks.length,
  },
  {
    key: 'longTermGoals',
    label: '长期目标',
    current: current.longTermGoals.length,
    baseline: baseline.longTermGoals.length,
  },
  {
    key: 'recurringHistory',
    label: '周期打卡记录',
    current: current.recurringTasks.reduce((total, task) => total + task.completedKeys.length, 0),
    baseline: baseline.recurringTasks.reduce((total, task) => total + task.completedKeys.length, 0),
  },
  {
    key: 'goalLogs',
    label: '长期目标日志',
    current: current.longTermGoals.reduce((total, goal) => total + goal.logs.length, 0),
    baseline: baseline.longTermGoals.reduce((total, goal) => total + goal.logs.length, 0),
  },
]

const isSignificantDrop = ({ current, baseline }: SaveCountMetric) => {
  const removed = baseline - current

  if (removed <= 0) {
    return false
  }

  if (baseline >= 3 && current === 0) {
    return true
  }

  return baseline >= 10 && removed >= 5 && current / baseline <= 0.5
}

export const inspectCloudSaveRisk = (current: AppData, baseline: AppData): CloudSaveRisk => {
  const metrics = getMetrics(current, baseline)
  const currentTotal = metrics.slice(0, 4).reduce((total, metric) => total + metric.current, 0)
  const baselineTotal = metrics.slice(0, 4).reduce((total, metric) => total + metric.baseline, 0)
  const totalRemoved = baselineTotal - currentTotal
  const totalDropIsSignificant =
    totalRemoved > 0 &&
    ((baselineTotal >= 1 && currentTotal === 0) ||
      (baselineTotal >= 10 && totalRemoved >= 5 && currentTotal / baselineTotal <= 0.5))
  const riskyMetrics = metrics.filter(isSignificantDrop)
  const details = riskyMetrics.map(
    (metric) => `${metric.label}从 ${metric.baseline} 项减少到 ${metric.current} 项`,
  )

  if (totalDropIsSignificant) {
    details.unshift(`主要数据总量从 ${baselineTotal} 项减少到 ${currentTotal} 项`)
  }

  return {
    hasRisk: totalDropIsSignificant || riskyMetrics.length > 0,
    summary: details[0] || '未检测到异常的数据减少',
    details,
    currentTotal,
    baselineTotal,
  }
}

export const formatCloudSaveRiskMessage = (risk: CloudSaveRisk) =>
  risk.details.length > 0 ? risk.details.join('；') : risk.summary
