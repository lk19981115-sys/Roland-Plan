import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData, RecurringTask, Task } from '../types'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { AppActions } from '../hooks/useAppData'
import { formatReadableDate, getMonthGridDates, getTodayISO, getWeekId, sortTasksByTime } from '../lib'

interface CalendarPageProps {
  data: AppData
  actions: AppActions
}

const monthTitle = (date: Date) =>
  date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })

const getRecurringKeyForDate = (task: RecurringTask, date: string) =>
  task.type === 'daily' ? date : getWeekId(date)

export function CalendarPage({ data, actions }: CalendarPageProps) {
  const today = getTodayISO()
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [isAdding, setIsAdding] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const gridDates = useMemo(() => getMonthGridDates(monthDate), [monthDate])
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

  const goToMonth = (offset: number) => {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const goToToday = () => {
    const current = new Date()
    setMonthDate(current)
    setSelectedDate(today)
  }

  return (
    <div className="page-grid calendar-grid">
      <section className="panel main-panel">
        <div className="section-heading">
          <div>
            <p>回顾与规划</p>
            <h2>{monthTitle(monthDate)}</h2>
          </div>
          <div className="toolbar">
            <button className="icon-button" type="button" onClick={() => goToMonth(-1)} aria-label="上个月" title="上个月">
              <ChevronLeft size={18} />
            </button>
            <button className="button button-ghost" type="button" onClick={goToToday}>
              回到今天
            </button>
            <button className="icon-button" type="button" onClick={() => goToMonth(1)} aria-label="下个月" title="下个月">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="calendar-weekdays">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-board" data-tour="calendar-board">
          {gridDates.map((date) => {
            const tasks = data.tasks.filter((task) => task.date === date)
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
            const isCurrentMonth = Number(date.slice(5, 7)) === monthDate.getMonth() + 1
            const dayState =
              tasks.length === 0 && recurringItems.length === 0
                ? 'empty'
                : open === 0 && uncheckedRecurring === 0
                  ? 'all-done'
                  : 'has-open'

            return (
              <button
                key={date}
                className={`calendar-day ${date === selectedDate ? 'selected' : ''} ${
                  date === today ? 'today' : ''
                } ${!isCurrentMonth ? 'muted-day' : ''} ${dayState}`}
                type="button"
                onClick={() => setSelectedDate(date)}
              >
                <span>{Number(date.slice(8, 10))}</span>
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
