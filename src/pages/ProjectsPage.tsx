import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTree,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import type { AppActions } from '../hooks/useAppData'
import {
  addDaysISO,
  calculateCompletionRate,
  formatReadableDate,
  getProjectTaskDateBounds,
  getTodayISO,
} from '../lib'
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_TAGS,
  type AppData,
  type Project,
  type ProjectDraft,
  type Task,
  type TaskDraft,
} from '../types'

interface ProjectsPageProps {
  data: AppData
  actions: AppActions
}

type ProjectTab = 'overview' | 'tasks' | 'gantt'

interface HierarchyRow {
  task: Task
  level: number
}

interface EffectiveRange {
  start: string
  end: string
}

const DAY_MS = 24 * 60 * 60 * 1000

const toDateStamp = (date: string) => new Date(`${date}T00:00:00`).getTime()

const daysBetween = (start: string, end: string) =>
  Math.max(0, Math.round((toDateStamp(end) - toDateStamp(start)) / DAY_MS))

const clampDate = (date: string, start: string, end: string) => {
  if (date < start) return start
  if (date > end) return end
  return date
}

const projectStatusLabel = (project: Project) =>
  PROJECT_STATUSES.find((status) => status.value === project.status)?.label || '进行中'

const buildHierarchy = (tasks: Task[], collapsedIds = new Set<string>()): HierarchyRow[] => {
  const taskIds = new Set(tasks.map((task) => task.id))
  const children = new Map<string, Task[]>()
  const roots: Task[] = []

  tasks.forEach((task) => {
    if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) {
      roots.push(task)
      return
    }

    children.set(task.parentTaskId, [...(children.get(task.parentTaskId) || []), task])
  })

  const sortByRange = (items: Task[]) =>
    [...items].sort((first, second) => {
      const firstDate = first.plannedStartDate || first.date
      const secondDate = second.plannedStartDate || second.date
      return firstDate.localeCompare(secondDate) || first.title.localeCompare(second.title)
    })
  const rows: HierarchyRow[] = []
  const visited = new Set<string>()

  const visit = (task: Task, level: number) => {
    if (visited.has(task.id)) {
      return
    }

    visited.add(task.id)
    rows.push({ task, level })

    if (collapsedIds.has(task.id)) {
      return
    }

    sortByRange(children.get(task.id) || []).forEach((child) => visit(child, level + 1))
  }

  sortByRange(roots).forEach((task) => visit(task, 0))
  sortByRange(tasks.filter((task) => !visited.has(task.id))).forEach((task) => visit(task, 0))

  return rows
}

const getChildrenMap = (tasks: Task[]) => {
  const map = new Map<string, Task[]>()

  tasks.forEach((task) => {
    if (task.parentTaskId) {
      map.set(task.parentTaskId, [...(map.get(task.parentTaskId) || []), task])
    }
  })

  return map
}

const getDescendantIds = (taskId: string, childrenMap: Map<string, Task[]>) => {
  const ids = new Set<string>()
  const visit = (id: string) => {
    ;(childrenMap.get(id) || []).forEach((child) => {
      if (ids.has(child.id)) {
        return
      }

      ids.add(child.id)
      visit(child.id)
    })
  }

  visit(taskId)
  return ids
}

const getEffectiveRange = (
  task: Task,
  childrenMap: Map<string, Task[]>,
  visited = new Set<string>(),
): EffectiveRange => {
  if (visited.has(task.id)) {
    return {
      start: task.plannedStartDate || task.date,
      end: task.plannedEndDate || task.date,
    }
  }

  const nextVisited = new Set(visited).add(task.id)
  const children = childrenMap.get(task.id) || []

  if (children.length === 0) {
    return {
      start: task.plannedStartDate || task.date,
      end: task.plannedEndDate || task.date,
    }
  }

  const ranges = children.map((child) => getEffectiveRange(child, childrenMap, nextVisited))

  return {
    start: ranges.map((range) => range.start).sort()[0],
    end: ranges.map((range) => range.end).sort().at(-1) || task.date,
  }
}

const getLeafTasks = (
  task: Task,
  childrenMap: Map<string, Task[]>,
  visited = new Set<string>(),
): Task[] => {
  if (visited.has(task.id)) {
    return [task]
  }

  const children = childrenMap.get(task.id) || []

  if (children.length === 0) {
    return [task]
  }

  const nextVisited = new Set(visited).add(task.id)
  return children.flatMap((child) => getLeafTasks(child, childrenMap, nextVisited))
}

const getTaskProgress = (task: Task, childrenMap: Map<string, Task[]>): number => {
  const children = childrenMap.get(task.id) || []

  if (children.length === 0) {
    return task.completed ? 100 : 0
  }

  return calculateCompletionRate(getLeafTasks(task, childrenMap))
}

function ProjectForm({
  initialProject,
  projectTasks = [],
  onSubmit,
  onCancel,
}: {
  initialProject?: Project
  projectTasks?: Task[]
  onSubmit: (draft: ProjectDraft) => void
  onCancel: () => void
}) {
  const today = getTodayISO()
  const [draft, setDraft] = useState<ProjectDraft>(() => ({
    title: initialProject?.title || '',
    status: initialProject?.status || 'active',
    plannedStartDate: initialProject?.plannedStartDate || today,
    plannedEndDate: initialProject?.plannedEndDate || addDaysISO(today, 30),
    description: initialProject?.description || '',
  }))
  const hasInvalidRange = draft.plannedEndDate < draft.plannedStartDate
  const outsideTaskCount = projectTasks.filter(
    (task) =>
      !task.plannedStartDate ||
      !task.plannedEndDate ||
      task.plannedStartDate < draft.plannedStartDate ||
      task.plannedEndDate > draft.plannedEndDate,
  ).length
  const hasTaskRangeConflict = outsideTaskCount > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!draft.title.trim() || hasInvalidRange || hasTaskRangeConflict) {
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
        <span>项目名称</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="例如：完成新工作室装修"
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>项目开始日期</span>
          <input
            type="date"
            value={draft.plannedStartDate}
            onChange={(event) => setDraft((current) => ({ ...current, plannedStartDate: event.target.value }))}
            required
          />
        </label>
        <label className="field">
          <span>项目完成日期</span>
          <input
            type="date"
            value={draft.plannedEndDate}
            onChange={(event) => setDraft((current) => ({ ...current, plannedEndDate: event.target.value }))}
            required
          />
        </label>
      </div>
      {hasInvalidRange ? <p className="form-error">项目完成日期不能早于开始日期。</p> : null}
      {hasTaskRangeConflict ? (
        <p className="form-error">
          当前时间范围会排除 {outsideTaskCount} 个项目任务。请先调整这些任务的计划时间。
        </p>
      ) : null}
      <label className="field field-wide">
        <span>项目状态</span>
        <select
          value={draft.status}
          onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Project['status'] }))}
        >
          {PROJECT_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field field-wide">
        <span>项目说明</span>
        <textarea
          rows={4}
          value={draft.description || ''}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="记录项目目标、范围或重要约束"
        />
      </label>
      <div className="form-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button button-primary" type="submit" disabled={hasInvalidRange || hasTaskRangeConflict}>
          <Save size={16} />
          保存项目
        </button>
      </div>
    </form>
  )
}

function ProjectTaskForm({
  projects,
  projectTasks,
  currentProject,
  initialTask,
  parentTaskId,
  onSubmit,
  onCancel,
}: {
  projects: Project[]
  projectTasks: Task[]
  currentProject: Project
  initialTask?: Task
  parentTaskId?: string
  onSubmit: (draft: TaskDraft) => void
  onCancel: () => void
}) {
  const initialProjectId = initialTask?.projectId || currentProject.id
  const selectedProject = projects.find((project) => project.id === initialProjectId) || currentProject
  const initialParentTaskId = initialTask?.parentTaskId || parentTaskId || ''
  const initialBounds = getProjectTaskDateBounds(
    initialProjectId,
    initialParentTaskId,
    projects,
    projectTasks,
  ) || {
    start: selectedProject.plannedStartDate,
    end: selectedProject.plannedEndDate,
    source: 'project' as const,
    sourceTitle: selectedProject.title,
  }
  const initialEndDate = clampDate(
    initialTask?.plannedEndDate || initialTask?.date || initialBounds.end,
    initialBounds.start,
    initialBounds.end,
  )
  const initialStartDate = clampDate(
    initialTask?.plannedStartDate || initialBounds.start,
    initialBounds.start,
    initialEndDate,
  )
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    title: initialTask?.title || '',
    date: initialEndDate,
    startTime: initialTask?.startTime || '',
    endTime: initialTask?.endTime || '',
    noTime: initialTask?.noTime ?? true,
    description: initialTask?.description || '',
    tag: initialTask?.tag || 'other',
    priority: initialTask?.priority || 'normal',
    completed: initialTask?.completed || false,
    projectId: initialProjectId,
    parentTaskId: initialParentTaskId,
    plannedStartDate: initialStartDate,
    plannedEndDate: initialEndDate,
  }))
  const selectedProjectTasks = projectTasks.filter((task) => task.projectId === draft.projectId)
  const unavailableParentIds = initialTask
    ? getDescendantIds(initialTask.id, getChildrenMap(selectedProjectTasks))
    : new Set<string>()
  const availableParents = selectedProjectTasks.filter(
    (task) => task.id !== initialTask?.id && !unavailableParentIds.has(task.id),
  )
  const dateBounds = getProjectTaskDateBounds(
    draft.projectId,
    draft.parentTaskId,
    projects,
    projectTasks,
  )
  const descendantIds = initialTask
    ? getDescendantIds(initialTask.id, getChildrenMap(selectedProjectTasks))
    : new Set<string>()
  const outsideChildCount = selectedProjectTasks.filter(
    (task) =>
      descendantIds.has(task.id) &&
      draft.plannedStartDate &&
      draft.plannedEndDate &&
      (
        !task.plannedStartDate ||
        !task.plannedEndDate ||
        task.plannedStartDate < draft.plannedStartDate ||
        task.plannedEndDate > draft.plannedEndDate
      ),
  ).length
  const hasInvalidRange = Boolean(
    draft.plannedStartDate &&
    draft.plannedEndDate &&
    (
      draft.plannedEndDate < draft.plannedStartDate ||
      (dateBounds &&
        (draft.plannedStartDate < dateBounds.start || draft.plannedEndDate > dateBounds.end))
    ),
  )
  const hasChildRangeConflict = outsideChildCount > 0

  const updateDraft = (patch: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const applyDateBounds = (projectId: string, nextParentTaskId: string) => {
    const bounds = getProjectTaskDateBounds(projectId, nextParentTaskId, projects, projectTasks)
    if (!bounds) return

    setDraft((current) => {
      const plannedEndDate = clampDate(
        current.plannedEndDate || bounds.end,
        bounds.start,
        bounds.end,
      )
      const plannedStartDate = clampDate(
        current.plannedStartDate || bounds.start,
        bounds.start,
        plannedEndDate,
      )

      return {
        ...current,
        projectId,
        parentTaskId: nextParentTaskId,
        plannedStartDate,
        plannedEndDate,
        date: plannedEndDate,
      }
    })
  }

  const changeProject = (projectId: string) => {
    applyDateBounds(projectId, '')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (
      !draft.title.trim() ||
      !draft.projectId ||
      !draft.plannedStartDate ||
      !draft.plannedEndDate ||
      hasInvalidRange ||
      hasChildRangeConflict
    ) {
      return
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      date: draft.plannedEndDate,
      startTime: draft.noTime ? undefined : draft.startTime,
      endTime: draft.noTime ? undefined : draft.endTime,
      description: draft.description?.trim(),
      parentTaskId: draft.parentTaskId || '',
    })
  }

  return (
    <form className="form task-form" onSubmit={handleSubmit}>
      <label className="field field-wide">
        <span>任务标题</span>
        <input
          value={draft.title}
          onChange={(event) => updateDraft({ title: event.target.value })}
          placeholder="例如：确认施工设计方案"
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>所属项目</span>
          <select value={draft.projectId} onChange={(event) => changeProject(event.target.value)} required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>父任务</span>
          <select
            value={draft.parentTaskId || ''}
            onChange={(event) => applyDateBounds(draft.projectId || currentProject.id, event.target.value)}
          >
            <option value="">无，作为顶层任务</option>
            {availableParents.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>计划开始日期</span>
          <input
            type="date"
            value={draft.plannedStartDate || ''}
            min={dateBounds?.start}
            max={draft.plannedEndDate || dateBounds?.end}
            onChange={(event) => {
              const plannedStartDate = dateBounds
                ? clampDate(event.target.value, dateBounds.start, draft.plannedEndDate || dateBounds.end)
                : event.target.value
              updateDraft({ plannedStartDate })
            }}
            required
          />
        </label>
        <label className="field">
          <span>计划完成日期</span>
          <input
            type="date"
            value={draft.plannedEndDate || ''}
            min={draft.plannedStartDate || dateBounds?.start}
            max={dateBounds?.end}
            onChange={(event) => {
              const plannedEndDate = dateBounds
                ? clampDate(event.target.value, draft.plannedStartDate || dateBounds.start, dateBounds.end)
                : event.target.value
              updateDraft({ plannedEndDate, date: plannedEndDate })
            }}
            required
          />
        </label>
      </div>
      {dateBounds ? (
        <p className="project-task-form-note">
          可选时间锁定在{dateBounds.source === 'parent' ? '父任务' : '项目'}「{dateBounds.sourceTitle}」：
          {dateBounds.start} 至 {dateBounds.end}
        </p>
      ) : null}
      {hasInvalidRange ? <p className="form-error">计划时间必须位于当前项目或父任务的时间范围内。</p> : null}
      {hasChildRangeConflict ? (
        <p className="form-error">
          当前时间范围会排除 {outsideChildCount} 个下级任务。请先调整这些下级任务的计划时间。
        </p>
      ) : null}
      <div className="form-grid">
        <label className="field">
          <span>标签</span>
          <select value={draft.tag} onChange={(event) => updateDraft({ tag: event.target.value as TaskDraft['tag'] })}>
            {TASK_TAGS.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>重要程度</span>
          <select
            value={draft.priority}
            onChange={(event) => updateDraft({ priority: event.target.value as TaskDraft['priority'] })}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>{priority.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="check-field">
        <input type="checkbox" checked={draft.noTime} onChange={(event) => updateDraft({ noTime: event.target.checked })} />
        <span>无具体时间</span>
      </label>
      {!draft.noTime ? (
        <div className="form-grid">
          <label className="field">
            <span>当天开始时间</span>
            <input type="time" value={draft.startTime || ''} onChange={(event) => updateDraft({ startTime: event.target.value })} />
          </label>
          <label className="field">
            <span>当天结束时间</span>
            <input type="time" value={draft.endTime || ''} onChange={(event) => updateDraft({ endTime: event.target.value })} />
          </label>
        </div>
      ) : null}
      <label className="field field-wide">
        <span>备注</span>
        <textarea
          rows={3}
          value={draft.description || ''}
          onChange={(event) => updateDraft({ description: event.target.value })}
          placeholder="记录交付标准、依赖条件或执行说明"
        />
      </label>
      <div className="form-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button button-primary" type="submit" disabled={hasInvalidRange || hasChildRangeConflict}>
          <Save size={16} />
          保存项目任务
        </button>
      </div>
    </form>
  )
}

function ProjectOverview({ project, tasks }: { project: Project; tasks: Task[] }) {
  const childrenMap = getChildrenMap(tasks)
  const leafTasks = tasks.filter((task) => !(childrenMap.get(task.id)?.length))
  const completionTasks = leafTasks.length > 0 ? leafTasks : tasks
  const openTasks = completionTasks.filter((task) => !task.completed)
  const overdueTasks = openTasks.filter((task) => task.date < getTodayISO())
  const topLevelTasks = tasks.filter((task) => !task.parentTaskId || !tasks.some((item) => item.id === task.parentTaskId))

  return (
    <div className="project-overview">
      <div className="project-stat-grid">
        <div><span>项目状态</span><strong>{projectStatusLabel(project)}</strong></div>
        <div><span>执行任务</span><strong>{completionTasks.length}</strong></div>
        <div><span>未完成</span><strong>{openTasks.length}</strong></div>
        <div><span>已逾期</span><strong>{overdueTasks.length}</strong></div>
      </div>
      <ProgressBar value={calculateCompletionRate(completionTasks)} label="项目完成率" />
      <div className="project-summary-grid">
        <article>
          <span>计划周期</span>
          <strong>{formatReadableDate(project.plannedStartDate)} 至 {formatReadableDate(project.plannedEndDate)}</strong>
          <p>{project.description || '还没有填写项目说明。'}</p>
        </article>
        <article>
          <span>阶段概览</span>
          {topLevelTasks.length > 0 ? (
            <div className="project-phase-list">
              {topLevelTasks.slice(0, 6).map((task) => {
                const range = getEffectiveRange(task, childrenMap)
                return (
                  <div key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{range.start} 至 {range.end} · {getTaskProgress(task, childrenMap)}%</span>
                  </div>
                )
              })}
            </div>
          ) : <p>新增顶层任务后，会在这里形成项目阶段。</p>}
        </article>
      </div>
    </div>
  )
}

function ProjectTaskList({
  tasks,
  actions,
  collapsedIds,
  onToggleCollapse,
  onAddChild,
  onEdit,
}: {
  tasks: Task[]
  actions: AppActions
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  onAddChild: (task: Task) => void
  onEdit: (task: Task) => void
}) {
  const rows = buildHierarchy(tasks, collapsedIds)
  const childrenMap = getChildrenMap(tasks)

  if (rows.length === 0) {
    return <EmptyState title="项目还没有任务" description="先新增一个项目任务，再逐步拆分为子任务。" />
  }

  return (
    <div className="project-task-list">
      {rows.map(({ task, level }) => {
        const childCount = childrenMap.get(task.id)?.length || 0
        const range = getEffectiveRange(task, childrenMap)
        const progress = getTaskProgress(task, childrenMap)

        return (
          <article className={`project-task-row ${task.completed ? 'is-completed' : ''}`} key={task.id}>
            <div className="project-task-main" style={{ paddingLeft: `${Math.min(level, 4) * 18}px` }}>
              {childCount > 0 ? (
                <button className="tree-toggle" type="button" onClick={() => onToggleCollapse(task.id)} aria-label="展开或折叠子任务">
                  {collapsedIds.has(task.id) ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                </button>
              ) : <span className="tree-spacer" />}
              <button
                className="task-check"
                type="button"
                onClick={() => actions.toggleTask(task.id)}
                aria-label={task.completed ? '取消完成' : '标记完成'}
                title={childCount > 0 ? '同时完成或取消完成全部下级任务' : undefined}
              >
                {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div>
                <strong>{task.title}</strong>
                <span>{range.start} 至 {range.end}{childCount > 0 ? ` · ${childCount} 个直接子任务 · ${progress}%` : ''}</span>
              </div>
            </div>
            <div className="project-task-actions">
              <button className="icon-button" type="button" onClick={() => onAddChild(task)} aria-label="新增子任务" title="新增子任务">
                <Plus size={16} />
              </button>
              <button className="icon-button" type="button" onClick={() => onEdit(task)} aria-label="编辑任务" title="编辑任务">
                <Pencil size={16} />
              </button>
              <button className="icon-button danger" type="button" onClick={() => actions.deleteTask(task.id)} aria-label="删除任务" title="删除任务">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function ProjectGantt({ project, tasks, collapsedIds }: { project: Project; tasks: Task[]; collapsedIds: Set<string> }) {
  const rows = buildHierarchy(tasks, collapsedIds)
  const childrenMap = getChildrenMap(tasks)
  const ranges = rows.map(({ task }) => getEffectiveRange(task, childrenMap))
  const rangeStart = [project.plannedStartDate, ...ranges.map((range) => range.start)].sort()[0]
  const rangeEnd = [project.plannedEndDate, ...ranges.map((range) => range.end)].sort().at(-1) || project.plannedEndDate
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1
  const unitDays = totalDays > 100 ? 7 : 1
  const unitCount = Math.ceil(totalDays / unitDays)
  const units = Array.from({ length: unitCount }, (_, index) => addDaysISO(rangeStart, index * unitDays))
  const gridTemplateColumns = `var(--gantt-label-width, 260px) repeat(${unitCount}, minmax(${unitDays === 1 ? 34 : 52}px, 1fr))`

  if (tasks.length === 0) {
    return <EmptyState title="暂无甘特图数据" description="新增带计划开始和完成日期的项目任务后，时间线会显示在这里。" />
  }

  return (
    <div className="gantt-shell">
      <div className="gantt-scroll">
        <div className="gantt-header-row" style={{ gridTemplateColumns }}>
          <strong>{unitDays === 1 ? '任务 / 日期' : '任务 / 周起始日'}</strong>
          {units.map((date) => <span key={date}>{date.slice(5).replace('-', '/')}</span>)}
        </div>
        {rows.map(({ task, level }) => {
          const range = getEffectiveRange(task, childrenMap)
          const startColumn = Math.floor(daysBetween(rangeStart, range.start) / unitDays) + 2
          const endColumn = Math.floor(daysBetween(rangeStart, range.end) / unitDays) + 3
          const hasChildren = Boolean(childrenMap.get(task.id)?.length)
          const progress = getTaskProgress(task, childrenMap)

          return (
            <div className="gantt-row" style={{ gridTemplateColumns }} key={task.id}>
              <div className="gantt-task-label" style={{ paddingLeft: `${12 + Math.min(level, 4) * 16}px` }}>
                <strong>{task.title}</strong>
                <span>{range.start} 至 {range.end}</span>
              </div>
              <div
                className={`gantt-bar ${hasChildren ? 'is-parent' : ''} ${task.completed ? 'is-completed' : ''}`}
                style={{ gridColumn: `${startColumn} / ${Math.max(startColumn + 1, endColumn)}` }}
                title={`${task.title}：${range.start} 至 ${range.end}`}
              >
                <i style={{ width: `${progress}%` }} />
                <span>{progress}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectsPage({ data, actions }: ProjectsPageProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(data.projects[0]?.id || '')
  const [tab, setTab] = useState<ProjectTab>('overview')
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [parentTaskId, setParentTaskId] = useState<string | undefined>()
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) || data.projects[0]
  const projectTasks = useMemo(
    () => selectedProject ? data.tasks.filter((task) => task.projectId === selectedProject.id) : [],
    [data.tasks, selectedProject],
  )

  const openAddTask = (parentId?: string) => {
    setParentTaskId(parentId)
    setIsAddingTask(true)
  }

  const deleteSelectedProject = () => {
    if (!selectedProject) {
      return
    }

    const confirmed = window.confirm(
      `确认删除项目「${selectedProject.title}」？\n项目中的任务会保留，并解除项目归属。`,
    )

    if (!confirmed) {
      return
    }

    actions.deleteProject(selectedProject.id)
    setSelectedProjectId(data.projects.find((project) => project.id !== selectedProject.id)?.id || '')
  }

  return (
    <div className="page-stack">
      <section className="panel project-page" data-tour="projects-main">
        <div className="section-heading">
          <div>
            <p>大型计划与任务拆分</p>
            <h2>项目</h2>
          </div>
          <div className="header-actions">
            <button className="button button-primary" type="button" onClick={() => setIsAddingProject(true)}>
              <Plus size={16} />
              新建项目
            </button>
          </div>
        </div>

        {selectedProject ? (
          <>
            <div className="project-context-bar">
              <label>
                <span>当前项目</span>
                <select value={selectedProject.id} onChange={(event) => setSelectedProjectId(event.target.value)}>
                  {data.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
              </label>
              <span className={`project-status status-${selectedProject.status}`}>{projectStatusLabel(selectedProject)}</span>
              <div className="project-context-actions">
                <button className="icon-button" type="button" onClick={() => setIsEditingProject(true)} aria-label="编辑项目" title="编辑项目">
                  <Pencil size={17} />
                </button>
                <button className="icon-button danger" type="button" onClick={deleteSelectedProject} aria-label="删除项目" title="删除项目">
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <div className="project-tabs" role="tablist" aria-label="项目视图">
              <button className={tab === 'overview' ? 'active' : ''} type="button" onClick={() => setTab('overview')}>
                <BarChart3 size={16} />
                概览
              </button>
              <button className={tab === 'tasks' ? 'active' : ''} type="button" onClick={() => setTab('tasks')}>
                <ListTree size={16} />
                任务清单
              </button>
              <button className={tab === 'gantt' ? 'active' : ''} type="button" onClick={() => setTab('gantt')}>
                <CalendarRange size={16} />
                甘特图
              </button>
            </div>

            <div className="project-view-heading">
              <div>
                <h3>{selectedProject.title}</h3>
                <span>{projectTasks.length} 项关联任务</span>
              </div>
              {tab !== 'overview' ? (
                <button className="button button-primary" type="button" onClick={() => openAddTask()}>
                  <Plus size={16} />
                  新增项目任务
                </button>
              ) : null}
            </div>

            {tab === 'overview' ? <ProjectOverview project={selectedProject} tasks={projectTasks} /> : null}
            {tab === 'tasks' ? (
              <ProjectTaskList
                tasks={projectTasks}
                actions={actions}
                collapsedIds={collapsedIds}
                onToggleCollapse={(id) =>
                  setCollapsedIds((current) => {
                    const next = new Set(current)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                onAddChild={(task) => openAddTask(task.id)}
                onEdit={setEditingTask}
              />
            ) : null}
            {tab === 'gantt' ? <ProjectGantt project={selectedProject} tasks={projectTasks} collapsedIds={collapsedIds} /> : null}
          </>
        ) : (
          <EmptyState title="还没有项目" description="建立一个项目，把大型计划拆成带开始和完成日期的任务。" />
        )}
      </section>

      {isAddingProject ? (
        <Modal title="新建项目" onClose={() => setIsAddingProject(false)}>
          <ProjectForm
            onSubmit={(draft) => {
              actions.addProject(draft)
              setIsAddingProject(false)
            }}
            onCancel={() => setIsAddingProject(false)}
          />
        </Modal>
      ) : null}

      {selectedProject && isEditingProject ? (
        <Modal title="编辑项目" onClose={() => setIsEditingProject(false)}>
          <ProjectForm
            initialProject={selectedProject}
            projectTasks={projectTasks}
            onSubmit={(draft) => {
              actions.updateProject(selectedProject.id, draft)
              setIsEditingProject(false)
            }}
            onCancel={() => setIsEditingProject(false)}
          />
        </Modal>
      ) : null}

      {selectedProject && isAddingTask ? (
        <Modal title={parentTaskId ? '新增子任务' : '新增项目任务'} onClose={() => setIsAddingTask(false)}>
          <ProjectTaskForm
            projects={data.projects}
            projectTasks={data.tasks}
            currentProject={selectedProject}
            parentTaskId={parentTaskId}
            onSubmit={(draft) => {
              actions.addTask(draft)
              setSelectedProjectId(draft.projectId || selectedProject.id)
              setIsAddingTask(false)
              setParentTaskId(undefined)
            }}
            onCancel={() => {
              setIsAddingTask(false)
              setParentTaskId(undefined)
            }}
          />
        </Modal>
      ) : null}

      {selectedProject && editingTask ? (
        <Modal title="编辑项目任务" onClose={() => setEditingTask(null)}>
          <ProjectTaskForm
            projects={data.projects}
            projectTasks={data.tasks}
            currentProject={selectedProject}
            initialTask={editingTask}
            onSubmit={(draft) => {
              actions.updateTask(editingTask.id, draft)
              setSelectedProjectId(draft.projectId || selectedProject.id)
              setEditingTask(null)
            }}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}
