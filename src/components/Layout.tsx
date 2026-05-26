import {
  CalendarCheck2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Flag,
  BookOpen,
  Keyboard,
  Plus,
  Repeat2,
  Redo2,
  Search,
  Settings,
  Target,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { APP_VERSION_LABEL } from '../lib'
import type { AppData, PageId } from '../types'
import { Modal } from './Modal'
import { UserMenu } from './UserMenu'

interface LayoutProps {
  data: AppData
  currentPage: PageId
  title: string
  children: ReactNode
  onNavigate: (page: PageId) => void
  onOpenSearch: () => void
  onQuickAddTask: (title: string) => void
  quickAddFocusSignal: number
  canReplayTour: boolean
  onReplayTour: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReplaceData: (data: AppData) => void
}

const navItems: Array<{ id: PageId; label: string; icon: typeof CalendarCheck2 }> = [
  { id: 'today', label: '今日', icon: CalendarCheck2 },
  { id: 'week', label: '本周', icon: CalendarDays },
  { id: 'goals', label: '长期', icon: Target },
  { id: 'recurring', label: '周期', icon: Repeat2 },
  { id: 'calendar', label: '日历', icon: CheckSquare },
  { id: 'review', label: '回顾', icon: ClipboardList },
  { id: 'settings', label: '设置', icon: Settings },
]

const shortcutItems = [
  { keys: ['/'], action: '打开全局搜索' },
  { keys: ['N'], action: '聚焦智能快速新增' },
  { keys: ['Ctrl', 'Z'], action: '撤销最近一次数据操作' },
  { keys: ['Ctrl', 'Y'], action: '重做刚才撤销的操作' },
  { keys: ['Ctrl', 'Shift', 'Z'], action: '重做刚才撤销的操作' },
  { keys: ['T'], action: '回到今日页' },
  { keys: ['W'], action: '打开本周页' },
  { keys: ['C'], action: '打开日历页' },
  { keys: ['R'], action: '打开回顾页' },
  { keys: ['Esc'], action: '关闭当前弹窗' },
  { keys: ['J'], action: '选择下一个可见任务' },
  { keys: ['K'], action: '选择上一个可见任务' },
  { keys: ['Space'], action: '完成或取消完成选中任务' },
  { keys: ['E'], action: '编辑选中任务' },
  { keys: ['D'], action: '删除选中任务' },
  { keys: ['M'], action: '推迟选中任务到明天' },
]

export function Layout({
  data,
  currentPage,
  title,
  children,
  onNavigate,
  onOpenSearch,
  onQuickAddTask,
  quickAddFocusSignal,
  canReplayTour,
  onReplayTour,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReplaceData,
}: LayoutProps) {
  const openTasks = data.tasks.filter((task) => !task.completed).length
  const [quickTitle, setQuickTitle] = useState('')
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false)
  const quickInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (quickAddFocusSignal <= 0) {
      return
    }

    window.requestAnimationFrame(() => {
      quickInputRef.current?.focus()
      quickInputRef.current?.select()
    })
  }, [quickAddFocusSignal])

  const commitQuickTask = () => {
    const title = quickTitle.trim()

    if (!title) {
      return
    }

    onQuickAddTask(title)
    setQuickTitle('')
  }

  const submitQuickTask = (event: FormEvent) => {
    event.preventDefault()
    commitQuickTask()
  }

  const handleQuickKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      commitQuickTask()
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Flag size={20} />
          </div>
          <div>
            <strong>Roland-Plan</strong>
            <span>防遗忘日程系统</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航" data-tour="nav">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                className={item.id === currentPage ? 'active' : ''}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="shortcut-help-button tour-replay-button"
            type="button"
            onClick={onReplayTour}
            disabled={!canReplayTour}
            title={canReplayTour ? '回看当前页面的新手教程' : '设置页暂时没有教程'}
          >
            <BookOpen size={17} />
            <span>新手教程</span>
            <strong>{canReplayTour ? '回看' : '暂无'}</strong>
          </button>

          <button
            className="shortcut-help-button"
            type="button"
            onClick={() => setIsShortcutHelpOpen(true)}
            data-tour="shortcuts"
          >
            <Keyboard size={17} />
            <span>快捷键</span>
            <strong>查看</strong>
          </button>

          <div className="sidebar-status">
            <span>当前存档已自动保存</span>
            <strong>{openTasks} 个未完成任务</strong>
          </div>
          <span className="app-version-label">{APP_VERSION_LABEL}</span>
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-title">
            <p>Roland-Plan</p>
            <h1>{title}</h1>
          </div>
          <form className="quick-add-form" onSubmit={submitQuickTask} data-tour="quick-add">
            <label className="quick-add-field">
              <Plus size={16} />
              <input
                ref={quickInputRef}
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                onKeyDown={handleQuickKeyDown}
                placeholder="输入：明天下午3点去银行"
                aria-label="智能快速新增任务"
              />
            </label>
            <button className="icon-button quick-add-submit" type="submit" aria-label="解析并新增任务" title="解析并新增任务">
              <Plus size={17} />
            </button>
          </form>
          <div className="topbar-actions">
            <div className="undo-redo-group" data-tour="undo-redo" aria-label="撤销与重做">
              <button
                className="icon-button"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="撤销"
                title="撤销 Ctrl+Z"
              >
                <Undo2 size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="重做"
                title="重做 Ctrl+Y / Ctrl+Shift+Z"
              >
                <Redo2 size={16} />
              </button>
            </div>
            <button className="button button-ghost" type="button" onClick={onOpenSearch} data-tour="search">
              <Search size={16} />
              搜索
            </button>
            <UserMenu data={data} onReplaceData={onReplaceData} onNavigate={onNavigate} />
          </div>
        </header>
        <main key={currentPage} className="page page-transition">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="移动端导航" data-tour="nav">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              className={item.id === currentPage ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {isShortcutHelpOpen ? (
        <Modal title="快捷键" onClose={() => setIsShortcutHelpOpen(false)}>
          <div className="shortcut-help">
            <div className="shortcut-list">
              {shortcutItems.map((item) => (
                <div className="shortcut-row" key={item.action}>
                  <span>
                    {item.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                  <strong>{item.action}</strong>
                </div>
              ))}
            </div>
            <p>在输入框、日期选择和下拉菜单中输入时，快捷键不会触发。</p>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
