import { Clock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GlobalSearch } from './components/GlobalSearch'
import { Layout } from './components/Layout'
import { OnboardingTour, type TourStep } from './components/OnboardingTour'
import { WelcomeGate } from './components/WelcomeGate'
import { useAppData } from './hooks/useAppData'
import { useAutoCloudSave } from './hooks/useAutoCloudSave'
import { useNotifications } from './hooks/useNotifications'
import { TaskSelectionProvider } from './hooks/useTaskSelection'
import { parseQuickTaskInput, type QuickTaskParseResult } from './lib'
import { Modal } from './components/Modal'
import { TaskForm } from './components/TaskForm'
import { CalendarPage } from './pages/CalendarPage'
import { GoalsPage } from './pages/GoalsPage'
import { RecurringPage } from './pages/RecurringPage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { WeekPage } from './pages/WeekPage'
import { getCloudSession, onCloudAuthChange } from './storage/cloudSave'
import { isSupabaseConfigured } from './storage/supabaseClient'
import type { PageId } from './types'

type TourId = Exclude<PageId, 'settings'>

const LEGACY_ONBOARDING_STORAGE_KEY = 'roland-plan-onboarding-v1'
const ENTRY_GATE_STORAGE_KEY = 'roland-plan-entry-gate-v3'

const getTourStorageKey = (tourId: TourId) => `roland-plan-tour-${tourId}-v1`

const isTourId = (pageId: PageId): pageId is TourId => pageId !== 'settings'

const hasCompletedTour = (tourId: TourId) => {
  try {
    return (
      localStorage.getItem(getTourStorageKey(tourId)) === 'done' ||
      (tourId === 'today' && localStorage.getItem(LEGACY_ONBOARDING_STORAGE_KEY) === 'done')
    )
  } catch {
    return false
  }
}

const markTourCompleted = (tourId: TourId) => {
  try {
    localStorage.setItem(getTourStorageKey(tourId), 'done')

    if (tourId === 'today') {
      localStorage.setItem(LEGACY_ONBOARDING_STORAGE_KEY, 'done')
    }
  } catch {
    // Storage can be unavailable in strict privacy modes; the tour should still close gracefully.
  }
}

const PAGE_TITLES: Record<PageId, string> = {
  today: '今日',
  week: '本周',
  goals: '长期',
  recurring: '周期',
  calendar: '日历',
  review: '回顾',
  settings: '设置',
}

const TOUR_DEFINITIONS: Record<TourId, { id: TourId; steps: TourStep[] }> = {
  today: {
    id: 'today',
    steps: [
      {
        target: '[data-tour="nav"]',
        title: '从这里切换页面',
        description: '今日、本周、长期、周期、日历、回顾和设置都在这里。你可以把它当成主菜单。',
        placement: 'right',
      },
      {
        target: '[data-tour="quick-add"]',
        title: '智能快速记录',
        description: '输入“明天下午3点去银行”这类文字并回车，系统会先帮你填好新增任务卡片。也可以按 N 快速聚焦。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="today-main"]',
        title: '今天要做什么',
        description: '今日任务、逾期任务和完成进度会集中显示在这里，这是每天打开后的第一视图。',
        placement: 'right',
      },
      {
        target: '[data-tour="tomorrow-preview"]',
        title: '提前看明天',
        description: '明日预告会提醒你明天已经安排了什么，适合提前防忘。',
        placement: 'left',
      },
      {
        target: '[data-tour="search"]',
        title: '全局搜索',
        description: '点击搜索，或按 /，可以按关键词、日期、月份、标签和完成状态查找任务。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="undo-redo"]',
        title: '误操作可以回退',
        description: '这里可以撤销或重做最近的数据操作，也可以用 Ctrl+Z、Ctrl+Y 和 Ctrl+Shift+Z。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="shortcuts"]',
        title: '查看快捷键',
        description: '这里可以随时打开快捷键说明。熟悉后，用键盘处理任务会快很多。',
        placement: 'top',
      },
    ],
  },
  week: {
    id: 'week',
    steps: [
      {
        target: '[data-tour="week-main"]',
        title: '本周任务',
        description: '这里不是另一套任务数据，只是把 date 落在本周的普通任务按日期展示出来。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="week-hide-empty"]',
        title: '隐藏空日期',
        description: '默认只显示有任务的日期，想看完整周一到周日时，可以点这里展开。',
        placement: 'left',
      },
      {
        target: '[data-tour="week-next"]',
        title: '下周预告',
        description: '下周任务会提前出现在这里。到了下周，它们会自然进入本周视图，不需要迁移。',
        placement: 'top',
      },
    ],
  },
  goals: {
    id: 'goals',
    steps: [
      {
        target: '[data-tour="goals-main"]',
        title: '长期目标',
        description: '长期页适合管理章节、课程、资料整理这类按数量推进的目标。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="goals-add"]',
        title: '新增长期目标',
        description: '从这里创建一个有总量的目标，例如 20 章、30 节课或 100 条资料。',
        placement: 'left',
      },
      {
        target: '[data-tour="goals-grid"]',
        title: '进度与日志',
        description: '目标卡片会显示总数、已完成、剩余、今日和本周推进，也可以编辑或撤销日志。',
        placement: 'top',
      },
    ],
  },
  recurring: {
    id: 'recurring',
    steps: [
      {
        target: '[data-tour="recurring-main"]',
        title: '周期任务',
        description: '这里管理每天或每周重复确认的事情，和普通一次性任务分开存放。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="recurring-daily"]',
        title: '日常任务',
        description: '每天都可以打卡，系统会记录最近历史和连续完成天数。',
        placement: 'top',
      },
      {
        target: '[data-tour="recurring-weekly"]',
        title: '周常任务',
        description: '周常每周确认一次，适合复盘、备份、维护和定期整理。',
        placement: 'top',
      },
      {
        target: '[data-tour="recurring-history"]',
        title: '打卡历史',
        description: '这些小格子能快速看出最近有没有漏打卡；没有周期任务时，先新增一条即可看到。',
        placement: 'top',
      },
    ],
  },
  calendar: {
    id: 'calendar',
    steps: [
      {
        target: '[data-tour="calendar-board"]',
        title: '月历视图',
        description: '每一天会显示任务密度、待办数和完成状态，适合回顾和提前规划。',
        placement: 'right',
      },
      {
        target: '[data-tour="calendar-day-detail"]',
        title: '当天任务',
        description: '点击月历中的任意日期，右侧会显示那一天的任务详情。',
        placement: 'left',
      },
      {
        target: '[data-tour="calendar-add"]',
        title: '从选中日期新增',
        description: '这里新增任务时，日期会自动使用当前选中的那一天。',
        placement: 'left',
      },
    ],
  },
  review: {
    id: 'review',
    steps: [
      {
        target: '[data-tour="review-month"]',
        title: '选择月份',
        description: '回顾页会从普通任务自动生成月份选项，只展示 tasks 里的已完成任务。',
        placement: 'bottom',
      },
      {
        target: '[data-tour="review-table"]',
        title: '月度完成表',
        description: '这里按日期列出当月每天完成了什么，可以作为日常任务回顾。',
        placement: 'top',
      },
      {
        target: '[data-tour="review-empty-toggle"]',
        title: '显示或隐藏空日期',
        description: '默认折叠没有完成任务的日期，想看整月日历式记录时可以打开。',
        placement: 'left',
      },
      {
        target: '[data-tour="review-export"]',
        title: '导出为 Excel',
        description: '需要留档或分享时，可以把当前回顾表导出成 Excel 可打开的文件。',
        placement: 'left',
      },
    ],
  },
}

const isEditableShortcutTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

const hasOpenDialog = () => Boolean(document.querySelector('[role="dialog"]'))

const hasPassedEntryGate = () => {
  try {
    return localStorage.getItem(ENTRY_GATE_STORAGE_KEY) === 'entered'
  } catch {
    return false
  }
}

const markEntryGatePassed = () => {
  try {
    localStorage.setItem(ENTRY_GATE_STORAGE_KEY, 'entered')
  } catch {
    // The app can still run in local mode if storage access is limited.
  }
}

const hasCloudAuthCallbackParams = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.location.search.includes('code=') ||
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('refresh_token')
  )
}

const getVisibleTaskIds = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-task-card="true"]'))
    .map((element) => element.dataset.taskId)
    .filter((id): id is string => Boolean(id))

const scrollTaskIntoView = (taskId: string) => {
  window.requestAnimationFrame(() => {
    const element = Array.from(document.querySelectorAll<HTMLElement>('[data-task-card="true"]')).find(
      (item) => item.dataset.taskId === taskId,
    )

    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function EntryLoadingScreen() {
  return (
    <div className="entry-loading-screen" aria-live="polite" aria-label="正在进入 Roland-Plan">
      <div className="entry-loading-icon">
        <Clock size={34} strokeWidth={1.9} />
      </div>
      <strong>Roland-Plan</strong>
      <span>正在载入你的日程空间</span>
      <div className="entry-progress" aria-hidden="true">
        <i />
      </div>
    </div>
  )
}

function App() {
  const { data, actions } = useAppData()
  const [page, setPage] = useState<PageId>('today')
  const [hasEnteredApp, setHasEnteredApp] = useState(hasPassedEntryGate)
  const [isLaunchingApp, setIsLaunchingApp] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null)
  const [quickAddFocusSignal, setQuickAddFocusSignal] = useState(0)
  const [quickTaskParseResult, setQuickTaskParseResult] = useState<QuickTaskParseResult | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [shortcutEditingTaskId, setShortcutEditingTaskId] = useState<string | null>(null)
  const launchTimerRef = useRef<number | null>(null)
  const { addTask, deleteTask, postponeTaskToTomorrow, toggleTask, updateSettings, updateTask } = actions
  const autoCloudSave = useAutoCloudSave(data, updateSettings)
  const shortcutEditingTask = data.tasks.find((task) => task.id === shortcutEditingTaskId)
  const effectiveSelectedTaskId =
    selectedTaskId && data.tasks.some((task) => task.id === selectedTaskId) ? selectedTaskId : null

  const disableUnavailableNotifications = useCallback(() => {
    updateSettings({ notificationsEnabled: false })
  }, [updateSettings])

  const openQuickTaskDraft = useCallback((input: string) => {
    setQuickTaskParseResult(parseQuickTaskInput(input))
  }, [])

  const enterApp = useCallback(() => {
    if (launchTimerRef.current) {
      window.clearTimeout(launchTimerRef.current)
    }

    setIsLaunchingApp(true)

    launchTimerRef.current = window.setTimeout(() => {
      markEntryGatePassed()
      setHasEnteredApp(true)
      setIsLaunchingApp(false)
      launchTimerRef.current = null
    }, 1100)
  }, [])

  useNotifications(data, disableUnavailableNotifications)

  useEffect(() => {
    return () => {
      if (launchTimerRef.current) {
        window.clearTimeout(launchTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let mounted = true
    const shouldEnterAfterCloudRedirect = hasCloudAuthCallbackParams()

    getCloudSession()
      .then((session) => {
        if (!mounted) {
          return
        }

        if (session && shouldEnterAfterCloudRedirect) {
          enterApp()
        }
      })
      .catch(() => {
        // If the session cannot be read, keep the entry page usable in local mode.
      })

    const unsubscribe = onCloudAuthChange((session) => {
      if (session && shouldEnterAfterCloudRedirect) {
        enterApp()
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [enterApp])

  useEffect(() => {
    if (!isTourId(page) || activeTourId || isSearchOpen || shortcutEditingTaskId) {
      return
    }

    if (hasCompletedTour(page)) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!hasOpenDialog() && !hasCompletedTour(page)) {
        setActiveTourId(page)
      }
    }, 450)

    return () => window.clearTimeout(timer)
  }, [activeTourId, isSearchOpen, page, shortcutEditingTaskId])

  const closeActiveTour = useCallback(() => {
    if (activeTourId) {
      markTourCompleted(activeTourId)
    }

    setActiveTourId(null)
  }, [activeTourId])

  const replayCurrentTour = useCallback(() => {
    if (!isTourId(page)) {
      return
    }

    setActiveTourId(page)
  }, [page])

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return
      }

      if (isEditableShortcutTarget(event.target)) {
        return
      }

      if (hasOpenDialog()) {
        return
      }

      const key = event.key.toLowerCase()

      if (event.ctrlKey || event.metaKey) {
        if (key === 'z') {
          event.preventDefault()

          if (event.shiftKey) {
            actions.redo()
          } else {
            actions.undo()
          }

          return
        }

        if (key === 'y') {
          event.preventDefault()
          actions.redo()
          return
        }

        return
      }

      if (event.altKey) {
        return
      }

      const pageShortcuts: Partial<Record<string, PageId>> = {
        t: 'today',
        w: 'week',
        c: 'calendar',
        r: 'review',
      }
      const visibleTaskIds = getVisibleTaskIds()
      const selectedVisibleTaskId =
        selectedTaskId && visibleTaskIds.includes(selectedTaskId) ? selectedTaskId : null

      const selectTaskByOffset = (offset: 1 | -1) => {
        if (visibleTaskIds.length === 0) {
          return
        }

        const currentIndex = selectedVisibleTaskId
          ? visibleTaskIds.indexOf(selectedVisibleTaskId)
          : offset > 0
            ? -1
            : visibleTaskIds.length
        const nextIndex = (currentIndex + offset + visibleTaskIds.length) % visibleTaskIds.length
        const nextTaskId = visibleTaskIds[nextIndex]

        setSelectedTaskId(nextTaskId)
        scrollTaskIntoView(nextTaskId)
      }

      if (key === 'j') {
        event.preventDefault()
        selectTaskByOffset(1)
        return
      }

      if (key === 'k') {
        event.preventDefault()
        selectTaskByOffset(-1)
        return
      }

      if (key === ' ' || event.code === 'Space') {
        if (selectedVisibleTaskId) {
          event.preventDefault()
          toggleTask(selectedVisibleTaskId)
        }

        return
      }

      if (key === 'e') {
        if (selectedVisibleTaskId) {
          event.preventDefault()
          setShortcutEditingTaskId(selectedVisibleTaskId)
        }

        return
      }

      if (key === 'm') {
        if (selectedVisibleTaskId) {
          event.preventDefault()
          postponeTaskToTomorrow(selectedVisibleTaskId)
        }

        return
      }

      if (key === 'd') {
        if (selectedVisibleTaskId) {
          event.preventDefault()

          const task = data.tasks.find((item) => item.id === selectedVisibleTaskId)
          const confirmed = window.confirm(`确认删除任务${task ? `「${task.title}」` : ''}？`)

          if (confirmed) {
            const currentIndex = visibleTaskIds.indexOf(selectedVisibleTaskId)
            const nextTaskId = visibleTaskIds[currentIndex + 1] || visibleTaskIds[currentIndex - 1] || null

            deleteTask(selectedVisibleTaskId)
            setSelectedTaskId(nextTaskId)

            if (nextTaskId) {
              scrollTaskIntoView(nextTaskId)
            }
          }
        }

        return
      }

      if (key === '/') {
        event.preventDefault()
        setIsSearchOpen(true)
        return
      }

      if (key === 'n') {
        event.preventDefault()
        setQuickAddFocusSignal((current) => current + 1)
        return
      }

      const targetPage = pageShortcuts[key]

      if (targetPage) {
        event.preventDefault()
        setPage(targetPage)
      }
    }

    document.addEventListener('keydown', handleShortcuts)

    return () => document.removeEventListener('keydown', handleShortcuts)
  }, [actions, data.tasks, deleteTask, postponeTaskToTomorrow, selectedTaskId, toggleTask])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const isDark =
        data.settings.themeMode === 'dark' ||
        (data.settings.themeMode === 'system' && media.matches)

      root.dataset.theme = isDark ? 'dark' : 'light'
      root.dataset.accent = data.settings.accentColor
      root.dataset.density = data.settings.viewDensity
      root.dataset.style = data.settings.appearanceStyle
    }

    applyTheme()
    media.addEventListener('change', applyTheme)

    return () => media.removeEventListener('change', applyTheme)
  }, [
    data.settings.accentColor,
    data.settings.appearanceStyle,
    data.settings.themeMode,
    data.settings.viewDensity,
  ])

  const pageContent = useMemo(() => {
    switch (page) {
      case 'week':
        return <WeekPage data={data} actions={actions} />
      case 'goals':
        return <GoalsPage data={data} actions={actions} />
      case 'recurring':
        return <RecurringPage data={data} actions={actions} />
      case 'calendar':
        return <CalendarPage data={data} actions={actions} />
      case 'review':
        return <ReviewPage data={data} />
      case 'settings':
        return <SettingsPage data={data} actions={actions} autoCloudSave={autoCloudSave} />
      case 'today':
      default:
        return <TodayPage data={data} actions={actions} onNavigate={setPage} />
    }
  }, [actions, autoCloudSave, data, page])
  const activeTour = activeTourId ? TOUR_DEFINITIONS[activeTourId] : null

  if (!hasEnteredApp) {
    if (isLaunchingApp) {
      return <EntryLoadingScreen />
    }

    return <WelcomeGate onContinueLocal={enterApp} onSignedIn={enterApp} />
  }

  return (
    <TaskSelectionProvider value={{ selectedTaskId: effectiveSelectedTaskId, selectTask: setSelectedTaskId }}>
      <Layout
        data={data}
        currentPage={page}
        title={PAGE_TITLES[page]}
        onNavigate={setPage}
        onOpenSearch={() => setIsSearchOpen(true)}
        onQuickAddTask={openQuickTaskDraft}
        quickAddFocusSignal={quickAddFocusSignal}
        canReplayTour={isTourId(page)}
        onReplayTour={replayCurrentTour}
        canUndo={actions.canUndo}
        canRedo={actions.canRedo}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onAppearanceStyleChange={(appearanceStyle) => updateSettings({ appearanceStyle })}
        onReplaceData={actions.replaceData}
      >
        {pageContent}
      </Layout>
      {isSearchOpen ? (
        <GlobalSearch data={data} actions={actions} onClose={() => setIsSearchOpen(false)} />
      ) : null}
      {shortcutEditingTask ? (
        <Modal title="编辑任务" onClose={() => setShortcutEditingTaskId(null)}>
          <TaskForm
            initialTask={shortcutEditingTask}
            submitLabel="保存修改"
            onSubmit={(draft) => {
              updateTask(shortcutEditingTask.id, draft)
              setShortcutEditingTaskId(null)
            }}
            onCancel={() => setShortcutEditingTaskId(null)}
          />
        </Modal>
      ) : null}
      {quickTaskParseResult ? (
        <Modal title="确认新增任务" onClose={() => setQuickTaskParseResult(null)}>
          <div className="quick-parse-panel">
            <span>智能识别</span>
            <strong>{quickTaskParseResult.source}</strong>
            <ul>
              {quickTaskParseResult.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
          <TaskForm
            key={quickTaskParseResult.source}
            initialDraft={quickTaskParseResult.draft}
            submitLabel="新增任务"
            onSubmit={(draft) => {
              addTask(draft)
              setQuickTaskParseResult(null)
            }}
            onCancel={() => setQuickTaskParseResult(null)}
          />
        </Modal>
      ) : null}
      {activeTour ? (
        <OnboardingTour
          key={activeTour.id}
          isOpen
          steps={activeTour.steps}
          onClose={closeActiveTour}
        />
      ) : null}
    </TaskSelectionProvider>
  )
}

export default App
