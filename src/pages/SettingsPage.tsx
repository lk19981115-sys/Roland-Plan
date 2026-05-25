import { AlertTriangle, CheckCircle2, Cloud, Download, LogIn, LogOut, RefreshCcw, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { AccentColor, AppData, ThemeMode } from '../types'
import { ACCENT_COLORS, SCHEMA_VERSION } from '../types'
import type { AppActions } from '../hooks/useAppData'
import {
  getCloudSession,
  loadCloudSave,
  onCloudAuthChange,
  signInCloudAccount,
  signInWithGoogleAccount,
  signOutCloudAccount,
  signUpCloudAccount,
  uploadCloudSave,
} from '../storage/cloudSave'
import { exportReportFile } from '../storage/reportExport'
import { exportSaveFile, importSaveFile } from '../storage/saveFile'
import { isSupabaseConfigured, type CloudSession } from '../storage/supabaseClient'
import { Modal } from '../components/Modal'
import { addDaysISO, getTodayISO } from '../lib'

interface SettingsPageProps {
  data: AppData
  actions: AppActions
}

const DAY_MS = 24 * 60 * 60 * 1000
const RESET_CONFIRM_TEXT = 'RESET ROLAND-PLAN'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

const getDateStamp = (date: string): number => new Date(`${date}T00:00:00`).getTime()

const getDaysBetween = (start: string, end: string): number => {
  return Math.max(0, Math.floor((getDateStamp(end) - getDateStamp(start)) / DAY_MS))
}

const formatBackupDate = (date?: string) => {
  if (!date) {
    return '尚未导出'
  }

  return date
}

const countDuplicateOpenTasks = (tasks: AppData['tasks']) => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  tasks
    .filter((task) => !task.completed)
    .forEach((task) => {
      const key = `${task.date}|${task.title.trim().toLowerCase()}`

      if (seen.has(key)) {
        duplicates.add(key)
        return
      }

      seen.add(key)
    })

  return duplicates.size
}

export function SettingsPage({ data, actions }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState('当前存档已自动保存')
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null)
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudInfo, setCloudInfo] = useState('尚未检查云端存档')
  const today = getTodayISO()
  const backupInterval = data.settings.backupReminderIntervalDays
  const daysSinceBackup = data.settings.lastBackupAt
    ? getDaysBetween(data.settings.lastBackupAt, today)
    : null
  const nextBackupDate = data.settings.lastBackupAt
    ? addDaysISO(data.settings.lastBackupAt, backupInterval)
    : today
  const isBackupSnoozed =
    Boolean(data.settings.backupReminderSnoozedUntil) &&
    data.settings.backupReminderSnoozedUntil! > today
  const backupNeedsAttention =
    data.settings.backupReminderEnabled &&
    !isBackupSnoozed &&
    (daysSinceBackup === null || daysSinceBackup >= backupInterval)
  const backupStatusText = !data.settings.backupReminderEnabled
    ? '备份提醒已关闭'
    : isBackupSnoozed
      ? `已暂缓到 ${data.settings.backupReminderSnoozedUntil}`
      : backupNeedsAttention
        ? '建议现在导出一份本地存档'
        : `下次提醒：${nextBackupDate}`
  const recentMigrations = [...data.migrationHistory]
    .sort((first, second) => second.migratedAt.localeCompare(first.migratedAt))
    .slice(0, 4)
  const healthItems = useMemo(() => {
    const blankTitleTasks = data.tasks.filter((task) => !task.title.trim()).length
    const invalidDateTasks = data.tasks.filter((task) => !DATE_PATTERN.test(task.date)).length
    const invalidTimeTasks = data.tasks.filter(
      (task) =>
        !task.noTime &&
        ((task.startTime && !TIME_PATTERN.test(task.startTime)) ||
          (task.endTime && !TIME_PATTERN.test(task.endTime)) ||
          (task.startTime && task.endTime && task.startTime > task.endTime)),
    ).length
    const duplicateOpenTasks = countDuplicateOpenTasks(data.tasks)
    const overdueTasks = data.tasks.filter((task) => !task.completed && task.date < today).length
    const goalOverflow = data.longTermGoals.filter((goal) => !goal.unlimited && goal.completed > goal.total).length
    const schemaMismatch = data.schemaVersion !== SCHEMA_VERSION ? 1 : 0

    return [
      { label: '空标题任务', count: blankTitleTasks, level: 'danger' },
      { label: '日期格式异常', count: invalidDateTasks, level: 'danger' },
      { label: '时间段异常', count: invalidTimeTasks, level: 'danger' },
      { label: '重复未完成任务', count: duplicateOpenTasks, level: 'warning' },
      { label: '长期目标进度超出总量', count: goalOverflow, level: 'danger' },
      { label: '存档版本不一致', count: schemaMismatch, level: 'danger' },
      { label: '逾期未完成任务', count: overdueTasks, level: 'warning' },
    ]
  }, [data.longTermGoals, data.schemaVersion, data.tasks, today])
  const healthWarningCount = healthItems.filter((item) => item.count > 0).length

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let isMounted = true

    getCloudSession()
      .then((session) => {
        if (isMounted) {
          setCloudSession(session)
        }
      })
      .catch((error) => {
        if (isMounted) {
          setCloudInfo(error instanceof Error ? error.message : '云存档状态读取失败。')
        }
      })

    const unsubscribe = onCloudAuthChange((session) => {
      setCloudSession(session)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const imported = await importSaveFile(file)
      actions.replaceData(imported)
      const latestMigration = imported.migrationHistory[imported.migrationHistory.length - 1]
      setMessage(
        latestMigration
          ? `存档导入成功，已迁移到 v${latestMigration.toVersion}。`
          : '存档导入成功，当前存档已自动保存。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请换一个存档文件再试。')
    } finally {
      event.target.value = ''
    }
  }

  const resetSave = () => {
    actions.resetData()
    setMessage('存档已重置。')
    setResetConfirmText('')
    setIsResetOpen(false)
  }

  const handleExport = () => {
    exportSaveFile(data)
    actions.updateSettings({ lastBackupAt: today, backupReminderSnoozedUntil: undefined })
    setMessage('存档已导出，备份提醒已更新。')
  }

  const handleReportExport = () => {
    exportReportFile(data)
    setMessage('Excel 报表已导出。')
  }

  const runCloudAction = async (action: () => Promise<void>) => {
    setCloudBusy(true)

    try {
      await action()
    } catch (error) {
      const text = error instanceof Error ? error.message : '云存档操作失败，请稍后再试。'
      setCloudInfo(text)
      setMessage(text)
    } finally {
      setCloudBusy(false)
    }
  }

  const submitCloudAuth = (mode: 'sign-up' | 'sign-in') => {
    runCloudAction(async () => {
      if (!cloudEmail.trim() || cloudPassword.length < 6) {
        throw new Error('请输入邮箱，并使用至少 6 位密码。')
      }

      const session =
        mode === 'sign-up'
          ? await signUpCloudAccount(cloudEmail.trim(), cloudPassword)
          : await signInCloudAccount(cloudEmail.trim(), cloudPassword)

      setCloudSession(session)
      setCloudPassword('')
      setCloudInfo(mode === 'sign-up' && !session ? '注册成功，请先检查邮箱完成确认。' : '云存档账号已登录。')
      setMessage(mode === 'sign-up' && !session ? '注册成功，请检查邮箱确认。' : '云存档账号已登录。')
    })
  }

  const handleCloudAuth = (mode: 'sign-up' | 'sign-in') => (event: FormEvent) => {
    event.preventDefault()
    submitCloudAuth(mode)
  }

  const handleGoogleSignIn = () => {
    runCloudAction(async () => {
      setCloudInfo('正在跳转到 Google 登录...')
      await signInWithGoogleAccount()
    })
  }

  const handleCloudUpload = () => {
    runCloudAction(async () => {
      const updatedAt = await uploadCloudSave(data)
      setCloudInfo(`云端存档已更新：${new Date(updatedAt).toLocaleString('zh-CN')}`)
      setMessage('当前本地存档已上传到云端。')
    })
  }

  const handleCloudDownload = () => {
    runCloudAction(async () => {
      const snapshot = await loadCloudSave()

      if (!snapshot) {
        setCloudInfo('云端还没有存档。')
        setMessage('云端还没有存档。')
        return
      }

      const confirmed = window.confirm(
        `确认用云端存档覆盖当前本地存档？\n云端更新时间：${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`,
      )

      if (!confirmed) {
        return
      }

      actions.replaceData(snapshot.data)
      setCloudInfo(`已从云端恢复：${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`)
      setMessage('已从云端恢复存档。')
    })
  }

  const handleCloudCheck = () => {
    runCloudAction(async () => {
      const snapshot = await loadCloudSave()

      if (!snapshot) {
        setCloudInfo('云端还没有存档。')
        return
      }

      setCloudInfo(
        `云端存档：v${snapshot.schemaVersion}，更新时间 ${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`,
      )
    })
  }

  const handleCloudSignOut = () => {
    runCloudAction(async () => {
      await signOutCloudAccount()
      setCloudSession(null)
      setCloudInfo('已退出云存档账号。')
      setMessage('已退出云存档账号。')
    })
  }

  const snoozeBackupReminder = () => {
    actions.updateSettings({ backupReminderSnoozedUntil: addDaysISO(today, 1) })
    setMessage('备份提醒已暂缓到明天。')
  }

  const updateNotifications = async (enabled: boolean) => {
    if (!enabled) {
      actions.updateSettings({ notificationsEnabled: false })
      setMessage('本地提醒已关闭。')
      return
    }

    if (!('Notification' in window)) {
      actions.updateSettings({ notificationsEnabled: false })
      setMessage('当前浏览器不支持通知提醒。')
      return
    }

    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission

    if (permission !== 'granted') {
      actions.updateSettings({ notificationsEnabled: false })
      setMessage('浏览器没有授予通知权限，本地提醒未开启。')
      return
    }

    actions.updateSettings({ notificationsEnabled: true })
    setMessage('本地提醒已开启。')
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>存档</p>
            <h2>设置 / 存档</h2>
          </div>
          <span className="autosave-pill">{message}</span>
        </div>

        {backupNeedsAttention ? (
          <div className="backup-reminder backup-reminder-urgent">
            <strong>{daysSinceBackup === null ? '还没有导出过存档' : `距离上次导出已 ${daysSinceBackup} 天`}</strong>
            <span>建议现在导出一份本地存档，避免浏览器本地数据被清理后丢失。</span>
            <div className="backup-reminder-actions">
              <button className="button button-primary" type="button" onClick={handleExport}>
                <Download size={16} />
                立即导出
              </button>
              <button className="button button-ghost" type="button" onClick={snoozeBackupReminder}>
                明天再提醒
              </button>
            </div>
          </div>
        ) : null}

        <div className="settings-grid">
          <article className="setting-card">
            <h3>当前数据概览</h3>
            <div className="stat-grid">
              <div>
                <span>普通任务</span>
                <strong>{data.tasks.length}</strong>
              </div>
              <div>
                <span>长期目标</span>
                <strong>{data.longTermGoals.length}</strong>
              </div>
              <div>
                <span>周期任务</span>
                <strong>{data.recurringTasks.length}</strong>
              </div>
              <div>
                <span>提醒</span>
                <strong>{data.settings.notificationsEnabled ? '开' : '关'}</strong>
              </div>
              <div>
                <span>存档格式</span>
                <strong>v{data.schemaVersion}</strong>
              </div>
              <div>
                <span>上次导出</span>
                <strong>{formatBackupDate(data.settings.lastBackupAt)}</strong>
              </div>
            </div>
          </article>

          <article className="setting-card setting-card-wide">
            <h3>本地存档</h3>
            <p className="setting-note">
              当前存档会自动保存在浏览器本地。未来加入云存档后，本地存档的导入和导出仍会保留，作为备份和迁移入口。
            </p>
            <div className="button-row">
              <button className="button button-primary" type="button" onClick={handleExport}>
                <Download size={16} />
                导出存档
              </button>
              <button className="button button-ghost" type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                导入存档
              </button>
              <button className="button button-danger" type="button" onClick={() => setIsResetOpen(true)}>
                <RefreshCcw size={16} />
                重置存档
              </button>
              <button className="button button-ghost" type="button" onClick={handleReportExport}>
                <Download size={16} />
                导出Excel
              </button>
            </div>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json" onChange={handleImport} />
          </article>

          <article className="setting-card setting-card-wide">
            <div className="health-card-heading">
              <div>
                <h3>云存档实验区</h3>
                <p className="setting-note">
                  第一版云功能只做手动上传和手动恢复，本地存档导入导出仍然保留。
                </p>
              </div>
              <span className={`health-status ${cloudSession ? '' : 'needs-attention'}`}>
                <Cloud size={16} />
                {cloudSession ? '已登录' : isSupabaseConfigured ? '未登录' : '未配置'}
              </span>
            </div>

            {!isSupabaseConfigured ? (
              <p className="setting-note">
                当前还没有配置 Supabase 环境变量。请在本地或 Vercel 中填写 VITE_SUPABASE_URL 和
                VITE_SUPABASE_ANON_KEY。
              </p>
            ) : cloudSession ? (
              <div className="cloud-save-panel">
                <div className="backup-status">
                  <strong>{cloudSession.user.email || '云存档账号'}</strong>
                  <span>{cloudInfo}</span>
                </div>
                <div className="button-row">
                  <button className="button button-primary" type="button" onClick={handleCloudUpload} disabled={cloudBusy}>
                    <Upload size={16} />
                    上传当前存档
                  </button>
                  <button className="button button-ghost" type="button" onClick={handleCloudDownload} disabled={cloudBusy}>
                    <Download size={16} />
                    从云端恢复
                  </button>
                  <button className="button button-ghost" type="button" onClick={handleCloudCheck} disabled={cloudBusy}>
                    检查云端
                  </button>
                  <button className="button button-ghost" type="button" onClick={handleCloudSignOut} disabled={cloudBusy}>
                    <LogOut size={16} />
                    退出登录
                  </button>
                </div>
              </div>
            ) : (
              <form className="cloud-auth-form" onSubmit={handleCloudAuth('sign-in')}>
                <label className="field">
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={cloudEmail}
                    onChange={(event) => setCloudEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="field">
                  <span>密码</span>
                  <input
                    type="password"
                    value={cloudPassword}
                    onChange={(event) => setCloudPassword(event.target.value)}
                    placeholder="至少 6 位"
                  />
                </label>
                <div className="button-row">
                  <button className="button button-ghost" type="button" onClick={handleGoogleSignIn} disabled={cloudBusy}>
                    <LogIn size={16} />
                    使用 Google 登录
                  </button>
                  <button className="button button-primary" type="submit" disabled={cloudBusy}>
                    登录
                  </button>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => submitCloudAuth('sign-up')}
                    disabled={cloudBusy}
                  >
                    注册账号
                  </button>
                </div>
                <p className="setting-note">{cloudInfo}</p>
              </form>
            )}
          </article>

          <article className="setting-card setting-card-wide">
            <div className="health-card-heading">
              <div>
                <h3>数据健康检查</h3>
                <p className="setting-note">检查本地存档里可能影响日常使用的数据问题。</p>
              </div>
              <span className={`health-status ${healthWarningCount > 0 ? 'needs-attention' : ''}`}>
                {healthWarningCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {healthWarningCount > 0 ? `${healthWarningCount} 项需要关注` : '状态良好'}
              </span>
            </div>
            <div className="health-check-grid">
              {healthItems.map((item) => (
                <div className={`health-check-item ${item.count > 0 ? item.level : 'ok'}`} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="setting-card">
            <h3>自动备份提醒</h3>
            <div className={`backup-status ${backupNeedsAttention ? 'needs-attention' : ''}`}>
              <strong>{backupStatusText}</strong>
              <span>
                {daysSinceBackup === null
                  ? '还没有本地导出记录。'
                  : `距离上次导出 ${daysSinceBackup} 天。`}
              </span>
            </div>
            <label className="toggle-row">
              <span>
                <strong>开启备份提醒</strong>
                <em>到达间隔后在设置页提醒你导出本地存档。</em>
              </span>
              <input
                type="checkbox"
                checked={data.settings.backupReminderEnabled}
                onChange={(event) =>
                  actions.updateSettings({
                    backupReminderEnabled: event.target.checked,
                    backupReminderSnoozedUntil: undefined,
                  })
                }
              />
            </label>
            <label className="field">
              <span>提醒间隔</span>
              <select
                value={backupInterval}
                onChange={(event) =>
                  actions.updateSettings({
                    backupReminderIntervalDays: Number(event.target.value),
                    backupReminderSnoozedUntil: undefined,
                  })
                }
              >
                <option value={3}>每 3 天</option>
                <option value={7}>每 7 天</option>
                <option value={14}>每 14 天</option>
                <option value={30}>每 30 天</option>
              </select>
            </label>
            {isBackupSnoozed ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() => actions.updateSettings({ backupReminderSnoozedUntil: undefined })}
              >
                恢复提醒
              </button>
            ) : null}
          </article>

          <article className="setting-card setting-card-wide">
            <h3>存档版本迁移记录</h3>
            <div className="version-summary">
              <span>当前存档格式</span>
              <strong>v{data.schemaVersion}</strong>
              <span>应用支持格式</span>
              <strong>v{SCHEMA_VERSION}</strong>
            </div>
            {recentMigrations.length > 0 ? (
              <div className="migration-list">
                {recentMigrations.map((record) => (
                  <div className="migration-item" key={record.id}>
                    <div>
                      <strong>
                        v{record.fromVersion} {'->'} v{record.toVersion}
                      </strong>
                      <span>{new Date(record.migratedAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <ul>
                      {record.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">当前存档是在最新版结构下创建的，还没有发生过版本迁移。</p>
            )}
          </article>

          <article className="setting-card">
            <h3>外观</h3>
            <label className="field">
              <span>主题模式</span>
              <select
                value={data.settings.themeMode}
                onChange={(event) => actions.updateSettings({ themeMode: event.target.value as ThemeMode })}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </label>
            <div className="swatch-group" aria-label="主题色">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`swatch swatch-${color.value} ${
                    data.settings.accentColor === color.value ? 'active' : ''
                  }`}
                  type="button"
                  onClick={() => actions.updateSettings({ accentColor: color.value as AccentColor })}
                  title={color.label}
                  aria-label={color.label}
                />
              ))}
            </div>
            <label className="field">
              <span>视图密度</span>
              <select
                value={data.settings.viewDensity}
                onChange={(event) =>
                  actions.updateSettings({
                    viewDensity: event.target.value as AppData['settings']['viewDensity'],
                  })
                }
              >
                <option value="comfortable">舒适</option>
                <option value="compact">紧凑</option>
              </select>
            </label>
            <label className="toggle-row">
              <span>
                <strong>收纳已完成任务</strong>
                <em>今日和本周视图默认折叠已完成任务。</em>
              </span>
              <input
                type="checkbox"
                checked={data.settings.collapseCompletedTasks}
                onChange={(event) => actions.updateSettings({ collapseCompletedTasks: event.target.checked })}
              />
            </label>
          </article>

          <article className="setting-card">
            <h3>提醒</h3>
            <label className="toggle-row">
              <span>
                <strong>本地提醒</strong>
                <em>有开始时间且未完成的任务，到点时使用浏览器提醒。</em>
              </span>
              <input
                type="checkbox"
                checked={data.settings.notificationsEnabled}
                onChange={(event) => updateNotifications(event.target.checked)}
              />
            </label>
            {!('Notification' in window) ? <p className="muted">当前浏览器不支持通知提醒。</p> : null}
          </article>
        </div>
      </section>

      {isResetOpen ? (
        <Modal
          title="重置存档"
          onClose={() => {
            setIsResetOpen(false)
            setResetConfirmText('')
          }}
        >
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              if (resetConfirmText === RESET_CONFIRM_TEXT) {
                resetSave()
              }
            }}
          >
            <div className="reset-warning">
              <strong>这个操作会清空当前浏览器里的任务、周期打卡、长期目标和设置。</strong>
              <span>建议先导出一份本地存档，再执行重置。</span>
            </div>
            <label className="field field-wide">
              <span>输入 {RESET_CONFIRM_TEXT} 确认重置</span>
              <input
                value={resetConfirmText}
                onChange={(event) => setResetConfirmText(event.target.value)}
                autoFocus
              />
            </label>
            <div className="form-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  setIsResetOpen(false)
                  setResetConfirmText('')
                }}
              >
                取消
              </button>
              <button
                className="button button-danger"
                type="submit"
                disabled={resetConfirmText !== RESET_CONFIRM_TEXT}
              >
                <RefreshCcw size={16} />
                确认重置
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
