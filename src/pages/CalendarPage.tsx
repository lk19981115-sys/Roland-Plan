import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CALENDAR_DISPLAY_MODES, CALENDAR_VIEW_MODES } from '../types'
import type { AppData, CalendarDisplayMode, CalendarViewMode, RecurringTask, Task } from '../types'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { AppActions } from '../hooks/useAppData'
import {
  addDaysISO,
  formatReadableDate,
  getMonthGridDates,
  getTodayISO,
  getWeekId,
  getWeekRange,
  sortTasksByTime,
} from '../lib'

interface CalendarPageProps {
  data: AppData
  actions: AppActions
}

const monthTitle = (date: Date) =>
  date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })

const toLocalDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}

const formatShortDate = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`

const weekTitle = (start: string, end: string) => `${formatShortDate(start)} 至 ${formatShortDate(end)}`

const formatWeekdayShort = (date: string) =>
  toLocalDate(date).toLocaleDateString('zh-CN', { weekday: 'short' })

const getRecurringKeyForDate = (task: RecurringTask, date: string) =>
  task.type === 'daily' ? date : getWeekId(date)

const getTaskPreviewLabel = (task: Task) => {
  if (task.completed) {
    return '完'
  }

  return task.priority === 'must' ? '必' : '待'
}

const getTaskPreviewState = (task: Task) => {
  if (task.completed) {
    return 'done'
  }

  return task.priority === 'must' ? 'must' : 'open'
}

export function CalendarPage({ data, actions }: CalendarPageProps) {
  const today = getTodayISO()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [isAdding, setIsAdding] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const calendarDisplayMode = data.settings.calendarDisplayMode
  const calendarViewMode = data.settings.calendarViewMode
  const weekRange = useMemo(() => getWeekRange(viewDate), [viewDate])
  const gridDates = useMemo(
    () => (calendarViewMode === 'week' ? weekRange.dates : getMonthGridDates(viewDate)),
    [calendarViewMode, viewDate, weekRange.dates],
  )
  const title = calendarViewMode === 'week' ? weekTitle(weekRange.start, weekRange.end) : monthTitle(viewDate)
  const selectedTasks = useMemo(
    () => sortTasksByTime(data.tasks.filter((task) => task.date === selectedDate)),
    [data.tasks, selectedDate],
  )
  const selectedRecurringItems = useMemo(
    () =>
      data.recurringTasks.map((task) => {
        const key = getRecurringKeyForDate(task, selectedDate)

        return {
          task,
          key,
          checked: task.completedKeys.includes(key),
        }
      }),
    [data.recurringTasks, selectedDate],
  )

  const goToPeriod = (offset: number) => {
    if (calendarViewMode === 'week') {
      setViewDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + offset * 7))
      setSelectedDate((current) => addDaysISO(current, offset * 7))
      return
    }

    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const changeViewMode = (mode: CalendarViewMode) => {
    actions.updateSettings({ calendarViewMode: mode })
    setViewDate(toLocalDate(selectedDate))
  }

  const goToToday = () => {
    const current = new Date()
    setViewDate(current)
    setSelectedDate(today)
  }

  return (
    <div className="page-grid calendar-grid">
      <section className="panel main-panel">
        <div className="section-heading">
          <div>
            <p>回顾与规划</p>
            <h2>{title}</h2>
          </div>
          <div className="toolbar">
            <label className="calendar-display-control">
              <span>视图</span>
              <select
                value={calendarViewMode}
                onChange={(event) => changeViewMode(event.target.value as CalendarViewMode)}
                aria-label="日历视图"
              >
                {CALENDAR_VIEW_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="calendar-display-control">
              <span>显示方式</span>
              <select
                value={calendarDisplayMode}
                onChange={(event) =>
                  actions.updateSettings({
                    calendarDisplayMode: event.target.value as CalendarDisplayMode,
                  })
                }
                aria-label="日历显示方式"
              >
                {CALENDAR_DISPLAY_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              type="button"
              onClick={() => goToPeriod(-1)}
              aria-label={calendarViewMode === 'week' ? '上一周' : '上个月'}
              title={calendarViewMode === 'week' ? '上一周' : '上个月'}
            >
              <ChevronLeft size={18} />
            </button>
            <button className="button button-ghost" type="button" onClick={goToToday}>
              回到今天
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => goToPeriod(1)}
              aria-label={calendarViewMode === 'week' ? '下一周' : '下个月'}
              title={calendarViewMode === 'week' ? '下一周' : '下个月'}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className={`calendar-weekdays ${calendarViewMode === 'week' ? 'calendar-weekdays-week' : ''}`}>
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className={`calendar-board ${calendarViewMode === 'week' ? 'calendar-board-week' : ''}`}
          data-tour="calendar-board"
        >
          {gridDates.map((date) => {
            const tasks = sortTasksByTime(data.tasks.filter((task) => task.date === date))
            const done = tasks.filter((task) => task.completed).length
            const open = tasks.length - done
            const must = tasks.filter((task) => task.priority === 'must' && !task.completed).length
            const recurringItems = data.recurringTasks.map((task) => {
              const key = getRecurringKeyForDate(task, date)

              return {
                task,
                checked: task.completedKeys.includes(key),
              }
            })
            const checkedRecurring = recurringItems.filter((item) => item.checked).length
            const uncheckedRecurring = recurringItems.length - checkedRecurring
            const shouldShowTaskTitles = calendarDisplayMode !== 'compact'
            const shouldShowRecurringTitles = calendarDisplayMode === 'all'
            const previewItems = [
              ...(shouldShowTaskTitles
                ? tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    label: getTaskPreviewLabel(task),
                    state: getTaskPreviewState(task),
                  }))
                : []),
              ...(shouldShowRecurringTitles
                ? recurringItems.map(({ task, checked }) => ({
                    id: task.id,
                    title: task.title,
                    label: checked ? '打' : '待',
                    state: checked ? 'recurring-done' : 'recurring-open',
                  }))
                : []),
            ]
            const previewLimit =
              calendarViewMode === 'week'
                ? calendarDisplayMode === 'all'
                  ? 8
                  : 6
                : calendarDisplayMode === 'all'
                  ? 4
                  : 3
            const visiblePreviewItems = previewItems.slice(0, previewLimit)
            const hiddenPreviewCount = previewItems.length - visiblePreviewItems.length
            const isCurrentPeriod =
              calendarViewMode === 'week' || Number(date.slice(5, 7)) === viewDate.getMonth() + 1
            const dayState =
              tasks.length === 0 && recurringItems.length === 0
                ? 'empty'
                : open === 0 && uncheckedRecurring === 0
                  ? 'all-done'
                  : 'has-open'

            return (
              <button
                key={date}
                className={`calendar-day ${calendarViewMode === 'week' ? 'calendar-day-week' : ''} ${
                  date === selectedDate ? 'selected' : ''
                } ${
                  date === today ? 'today' : ''
                } ${!isCurrentPeriod ? 'muted-day' : ''} ${dayState}`}
                type="button"
                onClick={() => setSelectedDate(date)}
              >
                <span className="calendar-day-number">
                  {calendarViewMode === 'week' ? formatShortDate(date) : Number(date.slice(8, 10))}
                  {calendarViewMode === 'week' ? <small>{formatWeekdayShort(date)}</small> : null}
                </span>
                {tasks.length > 0 || recurringItems.length > 0 ? (
                  <div className="calendar-density">
                    {tasks.length > 0 ? <strong>任务 {done}/{tasks.length}</strong> : null}
                    {recurringItems.length > 0 ? (
                      <em className={checkedRecurring === recurringItems.length ? 'all-done' : ''}>
                        打卡 {checkedRecurring}/{recurringItems.length}
                      </em>
                    ) : null}
                    {must > 0 ? <b>{must} 必做</b> : null}
                  </div>
                ) : null}
                {visiblePreviewItems.length > 0 ? (
                  <ul className="calendar-item-preview" aria-label={`${date} 日程预览`}>
                    {visiblePreviewItems.map((item) => (
                      <li key={`${item.state}-${item.id}`} className={`calendar-preview-${item.state}`}>
                        <span>{item.title}</span>
                        <em>{item.label}</em>
                      </li>
                    ))}
                    {hiddenPreviewCount > 0 ? <li className="calendar-preview-more">+{hiddenPreviewCount} 项</li> : null}
                  </ul>
                ) : null}
                {tasks.length > 0 ? (
                  <i
                    className="calendar-task-meter"
                    style={{ width: `${Math.max(16, (done / tasks.length) * 100)}%` }}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      <aside className="side-stack">
        <section className="panel" data-tour="calendar-day-detail">
          <div className="section-heading compact">
            <div>
              <p>{formatReadableDate(selectedDate)}</p>
              <h2>当天任务</h2>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setIsAdding(true)}
              data-tour="calendar-add"
            >
              <Plus size={16} />
              新增
            </button>
          </div>
          <div className="task-list">
            {selectedTasks.length > 0 ? (
              selectedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={actions.toggleTask}
                  onEdit={setEditingTask}
                  onDelete={actions.deleteTask}
                  onPostpone={actions.postponeTaskToTomorrow}
                />
              ))
            ) : (
              <EmptyState title="这一天还没有任务" description="从选中日期新增，会自动进入同一套任务数据。" />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p>{formatReadableDate(selectedDate)}</p>
              <h2>周期打卡</h2>
            </div>
          </div>
          {selectedRecurringItems.length > 0 ? (
            <div className="calendar-recurring-list">
              {selectedRecurringItems.map(({ task, key, checked }) => (
                <button
                  key={task.id}
                  className={`calendar-recurring-item ${checked ? 'checked' : ''}`}
                  type="button"
                  onClick={() => actions.toggleRecurringTask(task.id, key)}
                >
                  {checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.type === 'daily' ? '日常' : `周常 ${key}`}</small>
                  </span>
                  <em>{checked ? '已打卡' : '未打卡'}</em>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="这一天没有周期任务" description="在周期页新增日常或周常后，会显示在这里。" />
          )}
        </section>
      </aside>

      {isAdding ? (
        <Modal title="新增日历任务" onClose={() => setIsAdding(false)}>
          <TaskForm
            defaultDate={selectedDate}
            submitLabel="新增任务"
            onSubmit={(draft) => {
              actions.addTask(draft)
              setIsAdding(false)
            }}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      ) : null}

      {editingTask ? (
        <Modal title="编辑任务" onClose={() => setEditingTask(null)}>
          <TaskForm
            initialTask={editingTask}
            submitLabel="保存修改"
            onSubmit={(draft) => {
              actions.updateTask(editingTask.id, draft)
              setEditingTask(null)
            }}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}
