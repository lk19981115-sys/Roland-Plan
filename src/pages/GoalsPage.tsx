import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { UNLIMITED_GOAL_TOTAL, type AppData, type LongTermGoal, type LongTermGoalDraft } from '../types'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import type { AppActions } from '../hooks/useAppData'
import {
  calculateGoalRate,
  calculateLongTermTodayCount,
  calculateLongTermWeekCount,
} from '../lib'

interface GoalsPageProps {
  data: AppData
  actions: AppActions
}

const emptyFixedGoalDraft = (): LongTermGoalDraft => ({
  title: '',
  total: 20,
  completed: 0,
  unlimited: false,
  description: '',
})

const emptyUnlimitedGoalDraft = (): LongTermGoalDraft => ({
  title: '',
  total: UNLIMITED_GOAL_TOTAL,
  completed: 0,
  unlimited: true,
  description: '',
})

function FixedGoalForm({
  initialGoal,
  onSubmit,
  onCancel,
}: {
  initialGoal?: LongTermGoal
  onSubmit: (draft: LongTermGoalDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<LongTermGoalDraft>(() =>
    initialGoal
      ? {
          title: initialGoal.title,
          total: initialGoal.total,
          completed: initialGoal.completed,
          unlimited: false,
          description: initialGoal.description || '',
        }
      : emptyFixedGoalDraft(),
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      total: Number(draft.total),
      completed: Number(draft.completed),
      unlimited: false,
      description: draft.description?.trim(),
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field field-wide">
        <span>目标标题</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="例如：写完 20 章小说"
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>总目标数</span>
          <input
            type="number"
            min={1}
            value={draft.total}
            onChange={(event) => setDraft((current) => ({ ...current, total: Number(event.target.value) }))}
          />
        </label>
        <label className="field">
          <span>已完成数</span>
          <input
            type="number"
            min={0}
            value={draft.completed}
            onChange={(event) => setDraft((current) => ({ ...current, completed: Number(event.target.value) }))}
          />
        </label>
      </div>
      <label className="field field-wide">
        <span>备注</span>
        <textarea
          rows={3}
          value={draft.description || ''}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="可选：记录范围、衡量方式或下一步"
        />
      </label>
      <div className="form-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>
          取消
        </button>
        <button className="button button-primary" type="submit">
          <Save size={16} />
          保存目标
        </button>
      </div>
    </form>
  )
}

function UnlimitedGoalForm({
  initialGoal,
  onSubmit,
  onCancel,
}: {
  initialGoal?: LongTermGoal
  onSubmit: (draft: LongTermGoalDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<LongTermGoalDraft>(() =>
    initialGoal
      ? {
          title: initialGoal.title,
          total: UNLIMITED_GOAL_TOTAL,
          completed: initialGoal.completed,
          unlimited: true,
          description: initialGoal.description || '',
        }
      : emptyUnlimitedGoalDraft(),
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      completed: Number(draft.completed),
      total: UNLIMITED_GOAL_TOTAL,
      unlimited: true,
      description: draft.description?.trim(),
    })
  }

  return (
    <form className="form unlimited-goal-form" onSubmit={handleSubmit}>
      <div className="unlimited-form-banner">
        <span>∞</span>
        <div>
          <strong>无上限累计目标</strong>
          <p>适合记录字数、页数、时长、素材数量这类持续累加的目标。</p>
        </div>
      </div>
      <label className="field field-wide">
        <span>目标标题</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="例如：每日写作字数累计"
          required
        />
      </label>
      <label className="field">
        <span>当前累计数</span>
        <input
          type="number"
          min={0}
          value={draft.completed}
          onChange={(event) => setDraft((current) => ({ ...current, completed: Number(event.target.value) }))}
        />
      </label>
      <label className="field field-wide">
        <span>备注</span>
        <textarea
          rows={3}
          value={draft.description || ''}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="可选：记录单位、统计口径或推进范围"
        />
      </label>
      <div className="form-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>
          取消
        </button>
        <button className="button button-primary unlimited-save-button" type="submit">
          <span>∞</span>
          保存无上限目标
        </button>
      </div>
    </form>
  )
}

function GoalLogRow({
  goalId,
  log,
  actions,
}: {
  goalId: string
  log: LongTermGoal['logs'][number]
  actions: AppActions
}) {
  const [date, setDate] = useState(log.date)
  const [count, setCount] = useState(log.count)

  return (
    <form
      className="log-row"
      onSubmit={(event) => {
        event.preventDefault()
        actions.updateGoalLog(goalId, log.id, date, count)
      }}
    >
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <input
        type="number"
        min={0}
        value={count}
        onChange={(event) => setCount(Number(event.target.value))}
      />
      <button className="icon-button" type="submit" aria-label="保存记录" title="保存记录">
        <Save size={16} />
      </button>
      <button
        className="icon-button danger"
        type="button"
        onClick={() => actions.deleteGoalLog(goalId, log.id)}
        aria-label="删除记录"
        title="删除记录"
      >
        <Trash2 size={16} />
      </button>
    </form>
  )
}

function GoalLogList({ goal, actions }: { goal: LongTermGoal; actions: AppActions }) {
  const recentLogs = goal.logs
    .slice(-5)
    .reverse()

  if (recentLogs.length === 0) {
    return null
  }

  return (
    <div className="goal-log-list">
      <div className="subsection-title">
        <strong>最近记录</strong>
        <span>可编辑或撤销</span>
      </div>
      {recentLogs.map((log) => (
        <GoalLogRow key={log.id} goalId={goal.id} log={log} actions={actions} />
      ))}
    </div>
  )
}

function GoalCardHeader({
  goal,
  actions,
  onEdit,
}: {
  goal: LongTermGoal
  actions: AppActions
  onEdit: (goal: LongTermGoal) => void
}) {
  return (
    <div className="goal-card-header">
      <div>
        <h3>{goal.title}</h3>
        {goal.description ? <p>{goal.description}</p> : null}
      </div>
      <div className="task-actions">
        <button className="icon-button" type="button" onClick={() => onEdit(goal)} aria-label="编辑目标" title="编辑目标">
          <Pencil size={17} />
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={() => actions.deleteGoal(goal.id)}
          aria-label="删除目标"
          title="删除目标"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  )
}

function FixedGoalCard({
  goal,
  actions,
  onEdit,
}: {
  goal: LongTermGoal
  actions: AppActions
  onEdit: (goal: LongTermGoal) => void
}) {
  const [count, setCount] = useState(1)
  const remaining = Math.max(0, goal.total - goal.completed)
  const convertToUnlimited = () => {
    actions.updateGoal(goal.id, {
      title: goal.title,
      total: UNLIMITED_GOAL_TOTAL,
      completed: goal.completed,
      unlimited: true,
      description: goal.description,
    })
  }

  return (
    <article className="goal-card">
      <GoalCardHeader goal={goal} actions={actions} onEdit={onEdit} />

      <ProgressBar value={calculateGoalRate(goal)} label="长期进度" />

      <div className="goal-stats">
        <span>
          总数 <strong>{goal.total}</strong>
        </span>
        <span>
          已完成 <strong>{goal.completed}</strong>
        </span>
        <span>
          剩余 <strong>{remaining}</strong>
        </span>
        <span>
          今日 <strong>{calculateLongTermTodayCount(goal)}</strong>
        </span>
        <span>
          本周 <strong>{calculateLongTermWeekCount(goal)}</strong>
        </span>
      </div>

      <form
        className="inline-submit"
        data-tour="goal-log-progress"
        onSubmit={(event) => {
          event.preventDefault()
          actions.logGoalProgress(goal.id, count)
          setCount(1)
        }}
      >
        <label>
          <span>今日完成数</span>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>
        <button className="button button-primary" type="submit" disabled={remaining === 0}>
          提交
        </button>
      </form>

      <button className="button button-ghost goal-convert-button" type="button" onClick={convertToUnlimited}>
        <span>∞</span>
        设为无上限目标
      </button>

      <GoalLogList goal={goal} actions={actions} />
    </article>
  )
}

function UnlimitedGoalCard({
  goal,
  actions,
  onEdit,
}: {
  goal: LongTermGoal
  actions: AppActions
  onEdit: (goal: LongTermGoal) => void
}) {
  const [count, setCount] = useState(1)

  return (
    <article className="goal-card unlimited-goal-card">
      <GoalCardHeader goal={goal} actions={actions} onEdit={onEdit} />

      <div className="goal-unlimited-meter">
        <span>无上限累计</span>
        <strong>{goal.completed}</strong>
      </div>

      <div className="goal-stats unlimited-goal-stats">
        <span>
          模式 <strong>无上限</strong>
        </span>
        <span>
          累计 <strong>{goal.completed}</strong>
        </span>
        <span>
          今日 <strong>{calculateLongTermTodayCount(goal)}</strong>
        </span>
        <span>
          本周 <strong>{calculateLongTermWeekCount(goal)}</strong>
        </span>
      </div>

      <form
        className="inline-submit"
        data-tour="goal-log-progress"
        onSubmit={(event) => {
          event.preventDefault()
          actions.logGoalProgress(goal.id, count)
          setCount(1)
        }}
      >
        <label>
          <span>今日累计数</span>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>
        <button className="button button-primary" type="submit">
          提交
        </button>
      </form>

      <GoalLogList goal={goal} actions={actions} />
    </article>
  )
}

function GoalCard({
  goal,
  actions,
  onEdit,
}: {
  goal: LongTermGoal
  actions: AppActions
  onEdit: (goal: LongTermGoal) => void
}) {
  if (goal.unlimited) {
    return <UnlimitedGoalCard goal={goal} actions={actions} onEdit={onEdit} />
  }

  return <FixedGoalCard goal={goal} actions={actions} onEdit={onEdit} />
}

export function GoalsPage({ data, actions }: GoalsPageProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingGoal, setEditingGoal] = useState<LongTermGoal | null>(null)

  return (
    <div className="page-stack">
      <section className="panel" data-tour="goals-main">
        <div className="section-heading">
          <div>
            <p>长期推进</p>
            <h2>长期目标</h2>
          </div>
          <div className="header-actions" data-tour="goals-add">
            <button className="button button-primary" type="button" onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              新增长期目标
            </button>
          </div>
        </div>

        {data.longTermGoals.length > 0 ? (
          <div className="goal-grid" data-tour="goals-grid">
            {data.longTermGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} actions={actions} onEdit={setEditingGoal} />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有长期目标" description="适合用来推进小说章节、课程、资料整理或阅读计划。" />
        )}
      </section>

      {isAdding ? (
        <Modal title="新增长期目标" onClose={() => setIsAdding(false)}>
          <FixedGoalForm
            onSubmit={(draft) => {
              actions.addGoal(draft)
              setIsAdding(false)
            }}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      ) : null}

      {editingGoal ? (
        <Modal title={editingGoal.unlimited ? '编辑无上限目标' : '编辑固定目标'} onClose={() => setEditingGoal(null)}>
          {editingGoal.unlimited ? (
            <UnlimitedGoalForm
              initialGoal={editingGoal}
              onSubmit={(draft) => {
                actions.updateGoal(editingGoal.id, draft)
                setEditingGoal(null)
              }}
              onCancel={() => setEditingGoal(null)}
            />
          ) : (
            <FixedGoalForm
              initialGoal={editingGoal}
              onSubmit={(draft) => {
                actions.updateGoal(editingGoal.id, draft)
                setEditingGoal(null)
              }}
              onCancel={() => setEditingGoal(null)}
            />
          )}
        </Modal>
      ) : null}
    </div>
  )
}
