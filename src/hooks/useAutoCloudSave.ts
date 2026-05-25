import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData, Settings } from '../types'
import {
  getCloudSession,
  onCloudAuthChange,
  uploadAutoCloudSave,
} from '../storage/cloudSave'
import { isSupabaseConfigured, type CloudSession } from '../storage/supabaseClient'

export interface AutoCloudSaveState {
  isSignedIn: boolean
  isSaving: boolean
  hasPendingChanges: boolean
  countdownSeconds: number | null
  status: string
  nextSaveAt?: string
  runNow: () => void
}

const CHECK_INTERVAL_MS = 5 * 1000
const MINUTE_MS = 60 * 1000
const UPLOAD_TIMEOUT_MS = 20 * 1000

const getComparableData = (data: AppData): AppData => ({
  ...data,
  settings: {
    ...data.settings,
    lastAutoCloudSaveAt: undefined,
  },
})

const getDataSignature = (data: AppData) => JSON.stringify(getComparableData(data))

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('自动云存档超时，请检查网络，或确认 Supabase 自动存档表已经创建。'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
  }
}

const getNextSaveTime = (
  lastAutoCloudSaveAt: string | undefined,
  pendingSince: number | null,
  intervalMinutes: number,
) => {
  const baseTime = lastAutoCloudSaveAt ? Date.parse(lastAutoCloudSaveAt) : pendingSince ?? Date.now()
  const safeInterval = Math.max(1, intervalMinutes) * MINUTE_MS

  return baseTime + safeInterval
}

export const useAutoCloudSave = (
  data: AppData,
  updateSettings: (patch: Partial<Settings>) => void,
): AutoCloudSaveState => {
  const [session, setSession] = useState<CloudSession | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastStatus, setLastStatus] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [pendingInfo, setPendingInfo] = useState<{ hasChanges: boolean; since: number | null }>({
    hasChanges: false,
    since: null,
  })
  const latestDataRef = useRef(data)
  const pendingSignatureRef = useRef<string | null>(null)
  const pendingSinceRef = useRef<number | null>(null)
  const lastSeenSignatureRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)

  const markPending = (signature: string) => {
    pendingSignatureRef.current = signature
    pendingSinceRef.current ??= Date.now()
    setPendingInfo({ hasChanges: true, since: pendingSinceRef.current })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      latestDataRef.current = data

      const signature = getDataSignature(data)

      if (lastSeenSignatureRef.current === null) {
        lastSeenSignatureRef.current = signature

        if (!data.settings.lastAutoCloudSaveAt) {
          markPending(signature)
        }

        return
      }

      if (lastSeenSignatureRef.current !== signature) {
        lastSeenSignatureRef.current = signature
        markPending(signature)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [data])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    getCloudSession()
      .then(setSession)
      .catch(() => setSession(null))

    return onCloudAuthChange(setSession)
  }, [])

  const nextSaveAtMs = getNextSaveTime(
    data.settings.lastAutoCloudSaveAt,
    pendingInfo.since,
    data.settings.autoCloudSaveIntervalMinutes,
  )

  const runAutoSave = useCallback(async (options?: { force?: boolean }) => {
    const currentData = latestDataRef.current

    if (
      !currentData.settings.autoCloudSaveEnabled ||
      !pendingSignatureRef.current ||
      isSavingRef.current ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      return
    }

    if (!session) {
      return
    }

    if (!options?.force) {
      const intervalMs = Math.max(1, currentData.settings.autoCloudSaveIntervalMinutes) * MINUTE_MS
      const lastSavedAt = currentData.settings.lastAutoCloudSaveAt
        ? Date.parse(currentData.settings.lastAutoCloudSaveAt)
        : pendingSinceRef.current ?? Date.now()

      if (Date.now() - lastSavedAt < intervalMs) {
        return
      }
    }

    isSavingRef.current = true
    setIsSaving(true)

    try {
      const result = await withTimeout(uploadAutoCloudSave(currentData), UPLOAD_TIMEOUT_MS)
      pendingSignatureRef.current = null
      pendingSinceRef.current = null
      setPendingInfo({ hasChanges: false, since: null })
      updateSettings({ lastAutoCloudSaveAt: result.updatedAt })
      setLastStatus(`自动存档 ${result.slotIndex} 已更新`)
    } catch (error) {
      setLastStatus(error instanceof Error ? error.message : '自动云存档失败')
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [session, updateSettings])

  const runNow = useCallback(() => {
    const signature = getDataSignature(latestDataRef.current)

    markPending(signature)
    void runAutoSave({ force: true })
  }, [runAutoSave])

  useEffect(() => {
    if (!data.settings.autoCloudSaveEnabled) {
      return
    }

    if (!session) {
      return
    }

    const timer = window.setInterval(() => {
      void runAutoSave()
    }, CHECK_INTERVAL_MS)

    const immediateTimer = window.setTimeout(() => {
      void runAutoSave()
    }, 0)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(immediateTimer)
    }
  }, [
    data.settings.autoCloudSaveEnabled,
    data.settings.autoCloudSaveIntervalMinutes,
    runAutoSave,
    session,
  ])
  const hasPendingChanges = pendingInfo.hasChanges
  const countdownSeconds =
    hasPendingChanges && data.settings.autoCloudSaveEnabled && session
      ? Math.max(0, Math.ceil((nextSaveAtMs - nowMs) / 1000))
      : null
  const status = !isSupabaseConfigured
    ? 'Supabase 未配置，自动云存档未启用'
    : !data.settings.autoCloudSaveEnabled
      ? '自动云存档已关闭'
      : !session
        ? '登录后自动云存档会开始工作'
        : isSaving
          ? '正在自动云存档'
          : hasPendingChanges
            ? '有待自动云存档的数据'
            : lastStatus || '自动云存档已开启，等待数据变化'

  return {
    isSignedIn: Boolean(session),
    isSaving,
    hasPendingChanges,
    countdownSeconds,
    status,
    nextSaveAt: hasPendingChanges ? new Date(nextSaveAtMs).toISOString() : undefined,
    runNow,
  }
}
