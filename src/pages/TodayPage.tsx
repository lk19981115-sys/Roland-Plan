import { CalendarClock, CalendarPlus, Plus, Search, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData, CompletionFilter, PageId, Task, TaskTag } from '../types'
import { TASK_TAGS } from '../types'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { AppActions } from '../hooks/useAppData'
import {
  calculateCompletionRate,
  calculateGoalRate,
  calculateLongTermTodayCount,
  calculateLongTermWeekCount,
  calculateRecurringStreak,
  filterTasks,
  formatReadableDate,
  addDaysISO,
  getOverdueTasks,
  getTasksForThisWeek,
  getTasksForToday,
  getTasksForTomorrow,
  getTodayISO,
  getWeekId,
} from '../lib'

interface TodayPageProps {
  data: AppData
  actions: AppActions
  onNavigate: (page: PageId) => void
}

export function TodayPage({ data, actions, onNavigate }: TodayPageProps) {
  const today = getTodayISO()
  const tomorrow = addDaysISO(today, 1)
  const weekKey = getWeekId(today)
  const todayTasks = useMemo(() => getTasksForToday(data.tasks), [data.tasks])
  const tomorrowTasks = useMemo(() => getTasksForTomorrow(data.tasks), [data.tasks])
  const weekTasks = useMemo(() => getTasksForThisWeek(data.tasks), [data.tasks])
  const [query, setQuery] = useState('')
  const [completion, setCompletion] = useState<CompletionFilter>('all')
  const [tag, setTag] = useState<TaskTag | 'all'>('all')
  const [addingTaskDate, setAddingTaskDate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const filteredTasks = useMemo(
    () => filterTasks(todayTasks, query, completion, tag),
    [completion, query, tag, todayTasks],
  )
  const overdueTasks = useMemo(() => getOverdueTasks(data.tasks), [data.tasks])
  const openFilteredTasks = filteredTasks.filter((task) => !task.completed)
  const completedFilteredTasks = filteredTasks.filter((task) => task.completed)
  const shouldCollapseCompleted = data.settings.collapseCompletedTasks && completion !== 'done'
  const visibleTodayTasks = shouldCollapseCompleted
    ? [...openFilteredTasks, ...(showCompleted ? completedFilteredTasks : [])]
    : filteredTasks
  const onlyCompletedHidden =
    shouldCollapseCompleted &&
    visibleTodayTasks.length === 0 &&
    completedFilteredTasks.length > 0 &&
    !showCompleted

  const recurringToday = data.recurringTasks.filter((task) => {
    const key = task.type === 'daily' ? today : weekKey
    return task.type === 'daily' || !task.completedKeys.includes(key)
  })

  const topGoals = data.longTermGoals.slice(0, 3)
  const visibleTomorrowTasks = tomorrowTasks.slice(0, 4)

  const postponeAllOverdue = () => {
    if (overdueTasks.length === 0) {
      return
    }

    const confirmed = window.confirm(`确认将 ${overdueTasks.length} 项逾期任务全部推迟到明天？`)

    if (!confirmed) {
      return
    }

    actions.postponeTasksToTomorrow(overdueTasks.map((task) => task.id))
  }

  return (
    <div className="page-grid today-grid">
      <section className="panel main-panel" data-tour="today-main">
        <div className="section-heading">
          <div>
            <p>{formatReadableDate(today)}</p>
            <h2>今天要做什么</h2>
          </div>
          <button className="button button-primary" type="button" onClick={() => setAddingTaskDate(today)}>
            <Plus size={16} />
            新增今日任务
          </button>
        </div>

        <div className="filter-bar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题或备注"
            />
          </label>
          <select value={completion} onChange={(event) => setCompletion(event.target.value as CompletionFilter)}>
            <option value="all">全部状态</option>
            <option value="open">只看未完成</option>
            <option value="done">只看已完成</option>
          </select>
          <select value={tag} onChange={(event) => setTag(event.target.value as TaskTag | 'all')}>
            <option value="all">全部标签</option>
            {TASK_TAGS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <ProgressBar value={calculateCompletionRate(todayTasks)} label="今日完成进度" />

        {overdueTasks.length > 0 ? (
          <section className="overdue-zone" aria-label="逾期未完成任务">
            <div className="section-heading compact">
              <div>
                <p>需要重新安排</p>
                <h2>逾期未完成</h2>
              </div>
              <div className="header-actions">
                <span className="count-pill">{overdueTasks.length} 项</span>
                <button className="button button-ghost" type="button" onClick={postponeAllOverdue}>
                  <CalendarPlus size={16} />
                  全部推迟到明天
                </button>
              </div>
            </div>
            <div className="task-list">
              {overdueTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showDate
                  onToggle={actions.toggleTask}
                  onEdit={setEditingTask}
                  onDelete={actions.deleteTask}
                  onPostpone={actions.postponeTaskToTomorrow}
                  onMoveToToday={(id) => actions.moveTaskToDate(id, today)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="task-list">
          {visibleTodayTasks.length > 0 ? (
            visibleTodayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={actions.toggleTask}
                onEdit={setEditingTask}
                onDelete={actions.deleteTask}
                onPostpone={actions.postponeTaskToTomorrow}
              />
            ))
          ) : onlyCompletedHidden ? (
            <p className="muted">当前筛选下没有未完成任务，已完成任务已收纳。</p>
          ) : (
            <EmptyState
              title={todayTasks.length === 0 ? '今天还没有任务' : '没有匹配的任务'}
              description="可以先记录一件最容易忘的小事。"
            />
          )}
        </div>

        {shouldCollapseCompleted && completedFilteredTasks.length > 0 ? (
          <button
            className="collapse-toggle"
            type="button"
            onClick={() => setShowCompleted((current) => !current)}
          >
            <span>已完成 {completedFilteredTasks.length} 项</span>
            <strong>{showCompleted ? '收起' : '展开'}</strong>
          </button>
        ) : null}
      </section>

      <aside className="side-stack">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p>概览</p>
              <h2>今日状态</h2>
            </div>
            <CalendarClock size={20} />
          </div>
          <div className="stat-grid">
            <div>
              <span>今日任务</span>
              <strong>{todayTasks.length}</strong>
            </div>
            <div>
              <span>本周任务</span>
              <strong>{weekTasks.length}</strong>
            </div>
            <div>
              <span>长期目标</span>
              <strong>{data.longTermGoals.length}</strong>
            </div>
            <div>
              <span>周期任务</span>
              <strong>{data.recurringTasks.length}</strong>
            </div>
          </div>
        </section>

        <section className="panel tomorrow-preview-panel" data-tour="tomorrow-preview">
          <div className="section-heading compact">
            <div>
              <p>{formatReadableDate(tomorrow)}</p>
              <h2>明日预告</h2>
            </div>
            <button className="button button-ghost" type="button" onClick={() => setAddingTaskDate(tomorrow)}>
              <Plus size={16} />
              新增
            </button>
          </div>
          <div className="preview-list">
            {visibleTomorrowTasks.length > 0 ? (
              visibleTomorrowTasks.map((task) => (
                <button
                  className={`preview-item ${task.completed ? 'is-completed' : ''}`}
                  type="button"
                  key={task.id}
                  onClick={() => setEditingTask(task)}
                >
                  <span>
                    <strong>{task.title}</strong>
                    <em>{task.noTime ? '无具体时间' : task.startTime || '未设时间'}</em>
                  </span>
                  <small>{task.completed ? '已完成' : '待办'}</small>
                </button>
              ))
            ) : (
              <p className="muted">明天还没有预告任务。</p>
            )}
          </div>
          {tomorrowTasks.length > visibleTomorrowTasks.length ? (
            <button className="empty-action slim" type="button" onClick={() => onNavigate('calendar')}>
              还有 {tomorrowTasks.length - visibleTomorrowTasks.length} 项，去日历查看
            </button>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p>打卡</p>
              <h2>今天需要确认</h2>
            </div>
            <button className="button button-ghost" type="button" onClick={() => onNavigate('recurring')}>
              管理
            </button>
          </div>
          <div className="mini-list">
            {recurringToday.length > 0 ? (
              recurringToday.map((task) => {
                const key = task.type === 'daily' ? today : weekKey
                const checked = task.completedKeys.includes(key)
                const streak = calculateRecurringStreak(task)

                return (
                  <button
                    key={task.id}
                    className={`mini-check ${checked ? 'checked' : ''}`}
                    type="button"
                    onClick={() => actions.toggleRecurringTask(task.id, key)}
                  >
                    <span>{task.title}</span>
                    <strong>{task.type === 'daily' ? `连续 ${streak} 天` : `连续 ${streak} 周`}</strong>
                  </button>
                )
              })
            ) : (
              <p className="muted">今天没有需要提醒的打卡项。</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p>推进</p>
              <h2>长期目标</h2>
            </div>
            <button className="button button-ghost" type="button" onClick={() => onNavigate('goals')}>
              查看
            </button>
          </div>
          <div className="goal-mini-list">
            {topGoals.length > 0 ? (
              topGoals.map((goal) => (
                <div className="goal-mini" key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>
                      今日 {calculateLongTermTodayCount(goal)} / 本周 {calculateLongTermWeekCount(goal)}
                    </span>
                  </div>
                  <em>{goal.unlimited ? `累计 ${goal.completed}` : `${calculateGoalRate(goal)}%`}</em>
                </div>
              ))
            ) : (
              <button className="empty-action" type="button" onClick={() => onNavigate('goals')}>
                <Target size={18} />
                新建一个长期目标
              </button>
            )}
          </div>
        </section>
      </aside>

      {addingTaskDate ? (
        <Modal title={addingTaskDate === tomorrow ? '新增明日任务' : '新增今日任务'} onClose={() => setAddingTaskDate(null)}>
          <TaskForm
            defaultDate={addingTaskDate}
            submitLabel="新增任务"
            onSubmit={(draft) => {
              actions.addTask(draft)
              setAddingTaskDate(null)
            }}
            onCancel={() => setAddingTaskDate(null)}
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
