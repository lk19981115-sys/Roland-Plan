import { CheckCircle2, Circle, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AppData, RecurringTask, RecurringTaskDraft } from '../types'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import type { AppActions } from '../hooks/useAppData'
import { addDaysISO, calculateRecurringStreak, getTodayISO, getWeekId } from '../lib'

interface RecurringPageProps {
  data: AppData
  actions: AppActions
}

const emptyDraft = (): RecurringTaskDraft => ({
  title: '',
  type: 'daily',
  description: '',
})

function RecurringForm({
  initialTask,
  onSubmit,
  onCancel,
}: {
  initialTask?: RecurringTask
  onSubmit: (draft: RecurringTaskDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<RecurringTaskDraft>(() =>
    initialTask
      ? {
          title: initialTask.title,
          type: initialTask.type,
          description: initialTask.description || '',
        }
      : emptyDraft(),
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim(),
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field field-wide">
        <span>打卡标题</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="例如：整理桌面"
          required
        />
      </label>
      <div className="segmented" role="group" aria-label="周期类型">
        <button
          className={draft.type === 'daily' ? 'active' : ''}
          type="button"
          onClick={() => setDraft((current) => ({ ...current, type: 'daily' }))}
        >
          日常
        </button>
        <button
          className={draft.type === 'weekly' ? 'active' : ''}
          type="button"
          onClick={() => setDraft((current) => ({ ...current, type: 'weekly' }))}
        >
          周常
        </button>
      </div>
      <label className="field field-wide">
        <span>备注</span>
        <textarea
          rows={3}
          value={draft.description || ''}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="可选：说明打卡标准"
        />
      </label>
      <div className="form-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>
          取消
        </button>
        <button className="button button-primary" type="submit">
          <Save size={16} />
          保存打卡
        </button>
      </div>
    </form>
  )
}

function RecurringCard({
  task,
  actions,
  onEdit,
}: {
  task: RecurringTask
  actions: AppActions
  onEdit: (task: RecurringTask) => void
}) {
  const key = task.type === 'daily' ? getTodayISO() : getWeekId(getTodayISO())
  const checked = task.completedKeys.includes(key)
  const streak = calculateRecurringStreak(task)
  const history = Array.from({ length: task.type === 'daily' ? 7 : 8 }, (_, index) => {
    const date = addDaysISO(getTodayISO(), task.type === 'daily' ? -index : -index * 7)
    const historyKey = task.type === 'daily' ? date : getWeekId(date)

    return {
      key: historyKey,
      label: task.type === 'daily' ? date.slice(5) : historyKey.slice(5),
      checked: task.completedKeys.includes(historyKey),
    }
  }).reverse()

  return (
    <article className={`recurring-card ${checked ? 'checked' : ''}`}>
      <button
        className="task-check"
        type="button"
        onClick={() => actions.toggleRecurringTask(task.id, key)}
        aria-label={checked ? '取消打卡' : '打卡'}
        title={checked ? '取消打卡' : '打卡'}
      >
        {checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      <div className="recurring-body">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className="tag">{task.type === 'daily' ? '日常' : '周常'}</span>
        </div>
        <p>{task.description || '暂无备注'}</p>
        <strong>{task.type === 'daily' ? `连续 ${streak} 天` : `连续 ${streak} 周`}</strong>
        <div className="habit-history" aria-label="打卡历史" data-tour="recurring-history">
          {history.map((item) => (
            <span
              key={item.key}
              className={item.checked ? 'checked' : ''}
              title={`${item.label} ${item.checked ? '已打卡' : '未打卡'}`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-button" type="button" onClick={() => onEdit(task)} aria-label="编辑打卡" title="编辑打卡">
          <Pencil size={17} />
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={() => actions.deleteRecurringTask(task.id)}
          aria-label="删除打卡"
          title="删除打卡"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  )
}

export function RecurringPage({ data, actions }: RecurringPageProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null)
  const today = getTodayISO()
  const weekKey = getWeekId(today)
  const dailyTasks = data.recurringTasks.filter((task) => task.type === 'daily')
  const weeklyTasks = data.recurringTasks.filter((task) => task.type === 'weekly')

  const resetDaily = () => {
    if (window.confirm('确定要重置今天所有日常打卡状态吗？')) {
      actions.resetRecurring('daily', today)
    }
  }

  const resetWeekly = () => {
    if (window.confirm('确定要重置本周所有周常打卡状态吗？')) {
      actions.resetRecurring('weekly', weekKey)
    }
  }

  return (
    <div className="page-stack">
      <section className="panel" data-tour="recurring-main">
        <div className="section-heading">
          <div>
            <p>重复打卡</p>
            <h2>周期任务</h2>
          </div>
          <button className="button button-primary" type="button" onClick={() => setIsAdding(true)}>
            <Plus size={16} />
            新增周期任务
          </button>
        </div>

        <div className="reset-row" data-tour="recurring-reset">
          <button className="button button-ghost" type="button" onClick={resetDaily}>
            重置今天打卡
          </button>
          <button className="button button-ghost" type="button" onClick={resetWeekly}>
            重置本周打卡
          </button>
        </div>
      </section>

      <section className="panel" data-tour="recurring-daily">
        <div className="section-heading compact">
          <div>
            <p>每天一次</p>
            <h2>日常任务</h2>
          </div>
        </div>
        {dailyTasks.length > 0 ? (
          <div className="recurring-grid">
            {dailyTasks.map((task) => (
              <RecurringCard key={task.id} task={task} actions={actions} onEdit={setEditingTask} />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有日常任务" description="可以记录每天容易忘掉的固定事项。" />
        )}
      </section>

      <section className="panel" data-tour="recurring-weekly">
        <div className="section-heading compact">
          <div>
            <p>每周一次</p>
            <h2>周常任务</h2>
          </div>
        </div>
        {weeklyTasks.length > 0 ? (
          <div className="recurring-grid">
            {weeklyTasks.map((task) => (
              <RecurringCard key={task.id} task={task} actions={actions} onEdit={setEditingTask} />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有周常任务" description="适合整理周报、复盘、备份、维护类事项。" />
        )}
      </section>

      {isAdding ? (
        <Modal title="新增周期任务" onClose={() => setIsAdding(false)}>
          <RecurringForm
            onSubmit={(draft) => {
              actions.addRecurringTask(draft)
              setIsAdding(false)
            }}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      ) : null}

      {editingTask ? (
        <Modal title="编辑周期任务" onClose={() => setEditingTask(null)}>
          <RecurringForm
            initialTask={editingTask}
            onSubmit={(draft) => {
              actions.updateRecurringTask(editingTask.id, draft)
              setEditingTask(null)
            }}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}
