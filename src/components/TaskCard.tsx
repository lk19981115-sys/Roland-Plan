import {
  CalendarPlus,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Clock3,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { Task } from '../types'
import { TASK_PRIORITIES, TASK_TAGS } from '../types'
import { formatReadableDate } from '../lib/date'
import { useTaskSelection } from '../hooks/useTaskSelection'

interface TaskCardProps {
  task: Task
  compact?: boolean
  showDate?: boolean
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onPostpone: (id: string) => void
  onMoveToToday?: (id: string) => void
  onOpen?: (task: Task) => void
}

const getTagLabel = (value: Task['tag']) => TASK_TAGS.find((tag) => tag.value === value)?.label || '其他'

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

export function TaskCard({
  task,
  compact = false,
  showDate = false,
  onToggle,
  onEdit,
  onDelete,
  onPostpone,
  onMoveToToday,
  onOpen,
}: TaskCardProps) {
  const { selectedTaskId, selectTask } = useTaskSelection()
  const isSelected = selectedTaskId === task.id

  const selectAndOpen = () => {
    selectTask(task.id)
    onOpen?.(task)
  }

  return (
    <article
      className={`task-card ${task.completed ? 'is-completed' : ''} ${compact ? 'is-compact' : ''} ${
        onOpen ? 'is-clickable' : ''
      } ${isSelected ? 'is-selected' : ''}`}
      data-selected={isSelected ? 'true' : 'false'}
      data-task-card="true"
      data-task-id={task.id}
      onClick={selectAndOpen}
    >
      <button
        className="task-check"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle(task.id)
        }}
        aria-label={task.completed ? '取消完成' : '标记完成'}
        title={task.completed ? '取消完成' : '标记完成'}
      >
        {task.completed ? <CheckCircle2 size={21} /> : <Circle size={21} />}
      </button>

      <div className="task-body">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <div className="task-badges">
            {task.projectId ? <span className="project-task-badge">项目任务</span> : null}
            {task.priority !== 'normal' ? (
              <span className={`priority priority-${task.priority}`}>{getPriorityLabel(task.priority)}</span>
            ) : null}
            <span className={`tag tag-${task.tag}`}>{getTagLabel(task.tag)}</span>
          </div>
        </div>
        <div className="task-meta">
          <span>
            <Clock3 size={14} />
            {getTimeLabel(task)}
          </span>
          {showDate ? <span>{formatReadableDate(task.date)}</span> : null}
        </div>
        {task.description ? <p>{task.description}</p> : null}
      </div>

      <div className="task-actions">
        {onMoveToToday ? (
          <button
            className="icon-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onMoveToToday(task.id)
            }}
            aria-label="移到今天"
            title="移到今天"
          >
            <CalendarCheck2 size={17} />
          </button>
        ) : null}
        <button
          className="icon-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPostpone(task.id)
          }}
          aria-label="推迟到明天"
          title="推迟到明天"
        >
          <CalendarPlus size={17} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(task)
          }}
          aria-label="编辑任务"
          title="编辑任务"
        >
          <Pencil size={17} />
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(task.id)
          }}
          aria-label="删除任务"
          title="删除任务"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  )
}
