import { CalendarPlus, Eye, EyeOff, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData, Task } from '../types'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { AppActions } from '../hooks/useAppData'
import {
  calculateCompletionRate,
  formatReadableDate,
  getNextWeekRange,
  getTasksForNextWeek,
  getTasksForThisWeek,
  getTodayISO,
  getWeekId,
  getWeekRange,
  sortTasksByTime,
} from '../lib'

interface WeekPageProps {
  data: AppData
  actions: AppActions
}

function groupTasksByDate(tasks: Task[], dates: string[]) {
  return dates.map((date) => ({
    date,
    tasks: sortTasksByTime(tasks.filter((task) => task.date === date)),
  }))
}

export function WeekPage({ data, actions }: WeekPageProps) {
  const today = getTodayISO()
  const thisWeekRange = getWeekRange(today)
  const nextWeekRange = getNextWeekRange(today)
  const thisWeekTasks = useMemo(() => getTasksForThisWeek(data.tasks), [data.tasks])
  const nextWeekTasks = useMemo(() => getTasksForNextWeek(data.tasks), [data.tasks])
  const [defaultDate, setDefaultDate] = useState(today)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [hideEmptyDays, setHideEmptyDays] = useState(true)
  const weekKey = getWeekId(today)
  const weeklyHabits = data.recurringTasks.filter((task) => task.type === 'weekly')
  const weekGroups = useMemo(
    () => groupTasksByDate(thisWeekTasks, thisWeekRange.dates),
    [thisWeekRange.dates, thisWeekTasks],
  )
  const emptyDayCount = weekGroups.filter((group) => group.tasks.length === 0).length
  const visibleWeekGroups = hideEmptyDays
    ? weekGroups.filter((group) => group.tasks.length > 0)
    : weekGroups

  const openAddForm = (date: string) => {
    setDefaultDate(date)
    setIsAdding(true)
  }

  return (
    <div className="page-stack">
      <section className="panel" data-tour="week-main">
        <div className="section-heading">
          <div>
            <p>
              {thisWeekRange.start} 至 {thisWeekRange.end}
            </p>
            <h2>本周任务</h2>
          </div>
          <div className="header-actions">
            <button
              className={`button ${hideEmptyDays ? 'button-primary' : 'button-ghost'}`}
              type="button"
              onClick={() => setHideEmptyDays((current) => !current)}
              aria-pressed={hideEmptyDays}
              data-tour="week-hide-empty"
            >
              {hideEmptyDays ? <EyeOff size={16} /> : <Eye size={16} />}
              只看有任务日期
              <span className="button-subtext">{hideEmptyDays ? `已隐藏 ${emptyDayCount} 天` : '显示整周'}</span>
            </button>
            <button className="button button-primary" type="button" onClick={() => openAddForm(today)}>
              <Plus size={16} />
              新增本周任务
            </button>
          </div>
        </div>

        <ProgressBar value={calculateCompletionRate(thisWeekTasks)} label="本周完成率" />

        <div className="week-board">
          {visibleWeekGroups.length > 0 ? (
            visibleWeekGroups.map((group) => {
              const visibleTasks = data.settings.collapseCompletedTasks
                ? group.tasks.filter((task) => !task.completed)
                : group.tasks

              return (
                <section className="day-column" key={group.date}>
                  <div className="day-column-header">
                    <div>
                      <strong>{formatReadableDate(group.date, { month: 'numeric', day: 'numeric' })}</strong>
                      <span>
                        {group.tasks.filter((task) => !task.completed).length} 待办 / {group.tasks.length} 总计
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => openAddForm(group.date)}
                      aria-label="在这一天新增任务"
                      title="在这一天新增任务"
                    >
                      <CalendarPlus size={16} />
                    </button>
                  </div>
                  <div className="day-tasks">
                    {visibleTasks.length > 0 ? (
                      visibleTasks.map((task) => (
                        <div className="week-task-item" key={task.id}>
                          <TaskCard
                            task={task}
                            onToggle={actions.toggleTask}
                            onEdit={setEditingTask}
                            onDelete={actions.deleteTask}
                            onPostpone={actions.postponeTaskToTomorrow}
                          />
                        </div>
                      ))
                    ) : (
                      <span className="quiet-line">暂无安排</span>
                    )}
                    {data.settings.collapseCompletedTasks && group.tasks.some((task) => task.completed) ? (
                      <span className="quiet-line">
                        已收纳 {group.tasks.filter((task) => task.completed).length} 项完成任务
                      </span>
                    ) : null}
                  </div>
                </section>
              )
            })
          ) : (
            <EmptyState title="本周还没有任务" description="当前隐藏了空日期，新增任务后会自动出现在这里。" />
          )}
        </div>
      </section>

      <section className="panel" data-tour="week-next">
        <div className="section-heading">
          <div>
            <p>
              {nextWeekRange.start} 至 {nextWeekRange.end}
            </p>
            <h2>下周预告</h2>
          </div>
          <button className="button button-ghost" type="button" onClick={() => openAddForm(nextWeekRange.start)}>
            <Plus size={16} />
            新增下周任务
          </button>
        </div>
        {nextWeekTasks.length > 0 ? (
          <div className="task-list two-column">
            {nextWeekTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showDate
                onToggle={actions.toggleTask}
                onEdit={setEditingTask}
                onDelete={actions.deleteTask}
                onPostpone={actions.postponeTaskToTomorrow}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="下周还没有预告任务" description="可以先把确定会发生的事情放进下周一。" />
        )}
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <p>周常</p>
            <h2>本周打卡</h2>
          </div>
        </div>
        <div className="mini-list horizontal">
          {weeklyHabits.length > 0 ? (
            weeklyHabits.map((task) => {
              const checked = task.completedKeys.includes(weekKey)

              return (
                <button
                  key={task.id}
                  className={`mini-check ${checked ? 'checked' : ''}`}
                  type="button"
                  onClick={() => actions.toggleRecurringTask(task.id, weekKey)}
                >
                  <span>{task.title}</span>
                  <strong>{checked ? '已完成' : '本周未打卡'}</strong>
                </button>
              )
            })
          ) : (
            <p className="muted">还没有周常任务。</p>
          )}
        </div>
      </section>

      {isAdding ? (
        <Modal title="新增任务" onClose={() => setIsAdding(false)}>
          <TaskForm
            defaultDate={defaultDate}
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
