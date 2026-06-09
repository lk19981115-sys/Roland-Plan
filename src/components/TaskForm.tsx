import { CalendarDays, Clock, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Task, TaskDraft } from '../types'
import { TASK_PRIORITIES, TASK_TAGS } from '../types'
import { getTodayISO } from '../lib/date'

interface TaskFormProps {
  initialTask?: Task
  initialDraft?: Partial<TaskDraft>
  defaultDate?: string
  submitLabel?: string
  onSubmit: (draft: TaskDraft) => void
  onCancel?: () => void
}

const createInitialDraft = (
  initialTask?: Task,
  defaultDate = getTodayISO(),
  initialDraft?: Partial<TaskDraft>,
): TaskDraft => {
  const baseDraft: TaskDraft = {
    title: initialTask?.title || '',
    date: initialTask?.date || defaultDate,
    startTime: initialTask?.startTime || '',
    endTime: initialTask?.endTime || '',
    noTime: initialTask?.noTime ?? true,
    description: initialTask?.description || '',
    tag: initialTask?.tag || 'other',
    priority: initialTask?.priority || 'normal',
    completed: initialTask?.completed || false,
  }

  return {
    ...baseDraft,
    ...initialDraft,
  }
}

export function TaskForm({
  initialTask,
  initialDraft,
  defaultDate = getTodayISO(),
  submitLabel = '保存任务',
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(() => createInitialDraft(initialTask, defaultDate, initialDraft))

  const updateDraft = (patch: Partial<TaskDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      startTime: draft.noTime ? undefined : draft.startTime,
      endTime: draft.noTime ? undefined : draft.endTime,
      description: draft.description?.trim(),
    })
  }

  return (
    <form className="form task-form" onSubmit={handleSubmit}>
      {initialTask?.projectId ? (
        <div className="project-task-form-note">
          这是一个项目任务。修改日期时，项目计划完成日期也会同步更新；完整计划可在项目页编辑。
        </div>
      ) : null}
      <label className="field field-wide">
        <span>任务标题</span>
        <input
          value={draft.title}
          onChange={(event) => updateDraft({ title: event.target.value })}
          placeholder="例如：给朋友回消息"
          required
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>
            <CalendarDays size={15} />
            日期
          </span>
          <input
            type="date"
            value={draft.date}
            onChange={(event) => updateDraft({ date: event.target.value })}
            required
          />
        </label>

        <label className="field">
          <span>标签</span>
          <select
            value={draft.tag}
            onChange={(event) => updateDraft({ tag: event.target.value as TaskDraft['tag'] })}
          >
            {TASK_TAGS.map((tag) => (
              <option key={tag.value} value={tag.value}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field field-wide">
        <span>重要程度</span>
        <select
          value={draft.priority}
          onChange={(event) => updateDraft({ priority: event.target.value as TaskDraft['priority'] })}
        >
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>
      </label>

      <label className="check-field">
        <input
          type="checkbox"
          checked={draft.noTime}
          onChange={(event) => updateDraft({ noTime: event.target.checked })}
        />
        <span>无具体时间</span>
      </label>

      {!draft.noTime ? (
        <div className="form-grid">
          <label className="field">
            <span>
              <Clock size={15} />
              开始
            </span>
            <input
              type="time"
              value={draft.startTime || ''}
              onChange={(event) => updateDraft({ startTime: event.target.value })}
            />
          </label>
          <label className="field">
            <span>结束</span>
            <input
              type="time"
              value={draft.endTime || ''}
              onChange={(event) => updateDraft({ endTime: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <label className="field field-wide">
        <span>备注</span>
        <textarea
          value={draft.description || ''}
          onChange={(event) => updateDraft({ description: event.target.value })}
          placeholder="可选：补充上下文，避免之后想不起来"
          rows={3}
        />
      </label>

      <div className="form-actions">
        {onCancel ? (
          <button className="button button-ghost" type="button" onClick={onCancel}>
            取消
          </button>
        ) : null}
        <button className="button button-primary" type="submit">
          <Save size={16} />
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
