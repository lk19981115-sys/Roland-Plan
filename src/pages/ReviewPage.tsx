import { CheckCircle2, ClipboardList, Download, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData, Task } from '../types'
import { TASK_PRIORITIES, TASK_TAGS } from '../types'
import {
  formatMonthKey,
  formatWeekday,
  getMonthDates,
  getMonthKey,
  getTaskMonthOptions,
  getTodayISO,
  sortTasksByTime,
} from '../lib'

interface ReviewPageProps {
  data: AppData
}

const getTagLabel = (value: Task['tag']) =>
  TASK_TAGS.find((tag) => tag.value === value)?.label || '其他'

const getPriorityLabel = (value: Task['priority']) =>
  TASK_PRIORITIES.find((priority) => priority.value === value)?.label || '普通'

const getTimeLabel = (task: Task) => {
  if (task.noTime) {
    return '无具体时间'
  }

  if (task.startTime && task.endTime) {
    return `${task.startTime} - ${task.endTime}`
  }

  return task.startTime || '未设时间'
}

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const buildTaskDetail = (task: Task) => {
  const meta = `${getTimeLabel(task)} / ${getTagLabel(task.tag)} / ${getPriorityLabel(task.priority)}`
  return task.description ? `${task.title}（${meta}）\n${task.description}` : `${task.title}（${meta}）`
}

const downloadExcelFile = (filename: string, html: string) => {
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function ReviewPage({ data }: ReviewPageProps) {
  const currentMonth = getMonthKey(getTodayISO())
  const taskMonthOptions = useMemo(() => getTaskMonthOptions(data.tasks), [data.tasks])
  const monthOptions = useMemo(
    () => (taskMonthOptions.length > 0 ? taskMonthOptions : [currentMonth]),
    [currentMonth, taskMonthOptions],
  )
  const fallbackMonth = monthOptions.includes(currentMonth) ? currentMonth : monthOptions[0]
  const [selectedMonth, setSelectedMonth] = useState(fallbackMonth)
  const [hideEmptyDays, setHideEmptyDays] = useState(true)
  const activeMonth = monthOptions.includes(selectedMonth) ? selectedMonth : fallbackMonth

  const monthDates = useMemo(() => getMonthDates(activeMonth), [activeMonth])
  const completedByDate = useMemo(() => {
    const map = new Map<string, Task[]>()

    monthDates.forEach((date) => map.set(date, []))

    data.tasks.forEach((task) => {
      if (!task.completed || !task.date.startsWith(activeMonth)) {
        return
      }

      map.set(task.date, [...(map.get(task.date) || []), task])
    })

    map.forEach((tasks, date) => {
      map.set(date, sortTasksByTime(tasks))
    })

    return map
  }, [activeMonth, data.tasks, monthDates])

  const rows = monthDates.map((date) => ({
    date,
    weekday: formatWeekday(date),
    tasks: completedByDate.get(date) || [],
  }))
  const completedTasks = rows.flatMap((row) => row.tasks)
  const activeDays = rows.filter((row) => row.tasks.length > 0).length
  const emptyDays = monthDates.length - activeDays
  const visibleRows = hideEmptyDays ? rows.filter((row) => row.tasks.length > 0) : rows

  const exportVisibleReview = () => {
    const tableRows =
      visibleRows.length > 0
        ? visibleRows
            .map((row) => {
              const details =
                row.tasks.length > 0
                  ? row.tasks.map((task) => escapeHtml(buildTaskDetail(task))).join('<br />')
                  : '暂无已完成任务'

              return `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.weekday)}</td><td>${row.tasks.length}</td><td>${details}</td></tr>`
            })
            .join('')
        : `<tr><td colspan="4">这个月还没有已完成任务</td></tr>`
    const html = `<!doctype html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial,'Microsoft YaHei',sans-serif}th,td{border:1px solid #d9dee7;padding:8px;vertical-align:top}th{background:#f0f2f5}</style></head><body><h2>Roland-Plan ${escapeHtml(formatMonthKey(activeMonth))} 每日任务回顾</h2><table><thead><tr><th>日期</th><th>星期</th><th>完成数量</th><th>已完成任务详情</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`

    downloadExcelFile(`roland-plan-review-${activeMonth}.xls`, html)
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading review-heading">
          <div>
            <p>普通任务完成记录</p>
            <h2>每日任务回顾</h2>
          </div>
          <div className="review-heading-actions">
            <label className="month-select" data-tour="review-month">
              <span>选择月份</span>
              <select value={activeMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {monthOptions.map((month) => (
                  <option value={month} key={month}>
                    {formatMonthKey(month)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`button ${hideEmptyDays ? 'button-primary' : 'button-ghost'} review-empty-toggle`}
              type="button"
              onClick={() => setHideEmptyDays((current) => !current)}
              aria-pressed={!hideEmptyDays}
              data-tour="review-empty-toggle"
            >
              {hideEmptyDays ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{hideEmptyDays ? '显示空日期' : '隐藏空日期'}</span>
              <strong>{hideEmptyDays ? `已隐藏 ${emptyDays} 天` : '正在显示整月'}</strong>
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={exportVisibleReview}
              data-tour="review-export"
            >
              <Download size={16} />
              导出为Excel
            </button>
          </div>
        </div>

        <div className="review-summary">
          <div>
            <span>当前月份</span>
            <strong>{formatMonthKey(activeMonth)}</strong>
          </div>
          <div>
            <span>完成任务</span>
            <strong>{completedTasks.length}</strong>
          </div>
          <div>
            <span>有记录天数</span>
            <strong>
              {activeDays} / {monthDates.length}
            </strong>
          </div>
        </div>

        <div className="review-table-wrap" data-tour="review-table">
          <table className="review-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>星期</th>
                <th>完成数量</th>
                <th>已完成任务详情</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length > 0 ? (
                visibleRows.map((row) => (
                  <tr className={row.tasks.length > 0 ? 'has-completed' : ''} key={row.date}>
                    <td data-label="日期">
                      <strong>{row.date}</strong>
                    </td>
                    <td data-label="星期">{row.weekday}</td>
                    <td data-label="完成数量">
                      <span className="review-count">
                        <CheckCircle2 size={15} />
                        {row.tasks.length}
                      </span>
                    </td>
                    <td data-label="已完成任务详情">
                      {row.tasks.length > 0 ? (
                        <ul className="review-task-list">
                          {row.tasks.map((task) => (
                            <li key={task.id}>
                              <div>
                                <strong>{task.title}</strong>
                                <span>
                                  {getTimeLabel(task)} · {getTagLabel(task.tag)} · {getPriorityLabel(task.priority)}
                                </span>
                              </div>
                              {task.description ? <p>{task.description}</p> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">暂无已完成任务</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="review-empty-row">
                  <td colSpan={4}>
                    <div>
                      <ClipboardList size={18} />
                      <span>这个月还没有已完成任务。可以点击上方“显示空日期”查看整月日期。</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.tasks.length === 0 ? (
          <div className="review-empty-note">
            <ClipboardList size={18} />
            <span>当前还没有普通任务。完成任务后，这里会自动按月份生成回顾记录。</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}
