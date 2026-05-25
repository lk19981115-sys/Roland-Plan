import { EyeOff, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData, CompletionFilter, Task, TaskPriority, TaskTag } from '../types'
import { TASK_PRIORITIES, TASK_TAGS } from '../types'
import type { AppActions } from '../hooks/useAppData'
import { filterTasks, formatMonthKey, formatReadableDate, getTaskMonthOptions, sortTasksByTime } from '../lib'
import { Modal } from './Modal'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { EmptyState } from './EmptyState'

interface GlobalSearchProps {
  data: AppData
  actions: AppActions
  onClose: () => void
}

export function GlobalSearch({ data, actions, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [completion, setCompletion] = useState<CompletionFilter>('all')
  const [tag, setTag] = useState<TaskTag | 'all'>('all')
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all')
  const [month, setMonth] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hideCompleted, setHideCompleted] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const monthOptions = useMemo(() => getTaskMonthOptions(data.tasks), [data.tasks])

  const results = useMemo(() => {
    const filtered = filterTasks(data.tasks, query, completion, tag)
    return filtered.filter((task) => {
      const matchesPriority = priority === 'all' || task.priority === priority
      const matchesMonth = month === 'all' || task.date.startsWith(month)
      const matchesStart = !startDate || task.date >= startDate
      const matchesEnd = !endDate || task.date <= endDate
      const matchesVisibility = !hideCompleted || !task.completed

      return matchesPriority && matchesMonth && matchesStart && matchesEnd && matchesVisibility
    })
  }, [completion, data.tasks, endDate, hideCompleted, month, priority, query, startDate, tag])

  const groupedResults = useMemo(() => {
    const groups = new Map<string, Task[]>()

    sortTasksByTime(results).forEach((task) => {
      groups.set(task.date, [...(groups.get(task.date) || []), task])
    })

    return Array.from(groups.entries()).map(([date, tasks]) => ({ date, tasks }))
  }, [results])

  const updateCompletion = (value: CompletionFilter) => {
    setCompletion(value)

    if (value === 'done') {
      setHideCompleted(false)
    }
  }

  const clearDateRange = () => {
    setMonth('all')
    setStartDate('')
    setEndDate('')
  }

  return (
    <>
      <Modal title="全局搜索" className="modal-search" onClose={onClose}>
        <div className="global-search">
          <div className="filter-bar global-filter global-filter-expanded">
            <label className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索全部任务标题或备注"
                autoFocus
              />
            </label>
            <select value={completion} onChange={(event) => updateCompletion(event.target.value as CompletionFilter)}>
              <option value="all">全部状态</option>
              <option value="open">未完成</option>
              <option value="done">已完成</option>
            </select>
            <select value={tag} onChange={(event) => setTag(event.target.value as TaskTag | 'all')}>
              <option value="all">全部标签</option>
              {TASK_TAGS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="all">全部月份</option>
              {monthOptions.map((item) => (
                <option key={item} value={item}>
                  {formatMonthKey(item)}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | 'all')}>
              <option value="all">全部重要程度</option>
              {TASK_PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className="date-filter-field">
              <span>开始日期</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="date-filter-field">
              <span>结束日期</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <button
              className={`button ${hideCompleted ? 'button-primary' : 'button-ghost'} search-toggle-button`}
              type="button"
              onClick={() => setHideCompleted((current) => !current)}
              aria-pressed={hideCompleted}
            >
              <EyeOff size={16} />
              隐藏已完成
            </button>
            <button className="icon-button" type="button" onClick={clearDateRange} aria-label="清除日期筛选" title="清除日期筛选">
              <X size={16} />
            </button>
          </div>

          <div className="search-result-meta">
            找到 {results.length} 项任务
            {hideCompleted ? <span>已隐藏已完成任务</span> : null}
          </div>

          <div className="search-group-list">
            {groupedResults.length > 0 ? (
              groupedResults.map((group) => (
                <section className="search-result-group" key={group.date}>
                  <div className="search-group-heading">
                    <strong>{formatReadableDate(group.date)}</strong>
                    <span>{group.tasks.length} 项</span>
                  </div>
                  <div className="task-list">
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showDate
                        onToggle={actions.toggleTask}
                        onEdit={setEditingTask}
                        onOpen={setEditingTask}
                        onDelete={actions.deleteTask}
                        onPostpone={actions.postponeTaskToTomorrow}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState title="没有匹配的任务" description="试试缩短关键词，或切换状态和标签筛选。" />
            )}
          </div>
        </div>
      </Modal>

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
    </>
  )
}
