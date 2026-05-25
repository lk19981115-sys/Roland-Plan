import { useEffect, useRef } from 'react'
import type { AppData } from '../types'
import { getTodayISO } from '../lib/date'

const timeNow = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export const useNotifications = (data: AppData, onUnavailable?: () => void): void => {
  const sentKeysRef = useRef<Set<string>>(new Set())
  const activeDateRef = useRef(getTodayISO())

  useEffect(() => {
    if (!data.settings.notificationsEnabled) {
      return
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      onUnavailable?.()
      return
    }

    let isMounted = true

    const ensurePermission = async (): Promise<NotificationPermission> => {
      if (Notification.permission === 'default') {
        return Notification.requestPermission()
      }

      return Notification.permission
    }

    const checkTasks = () => {
      if (!isMounted || Notification.permission !== 'granted') {
        return
      }

      const today = getTodayISO()

      if (today !== activeDateRef.current) {
        activeDateRef.current = today
        sentKeysRef.current = new Set()
      }

      const currentTime = timeNow()

      data.tasks
        .filter(
          (task) =>
            task.date === today &&
            !task.completed &&
            !task.noTime &&
            Boolean(task.startTime) &&
            String(task.startTime) <= currentTime,
        )
        .forEach((task) => {
          const key = `${task.id}-${task.date}-${task.startTime}`

          if (sentKeysRef.current.has(key)) {
            return
          }

          sentKeysRef.current.add(key)
          new Notification('Roland-Plan 提醒', {
            body: `${task.startTime} ${task.title}`,
          })
        })
    }

    ensurePermission()
      .then((permission) => {
        if (permission !== 'granted') {
          onUnavailable?.()
          return
        }

        checkTasks()
      })
      .catch(() => undefined)

    const timer = window.setInterval(checkTasks, 30_000)

    return () => {
      isMounted = false
      window.clearInterval(timer)
    }
  }, [data.settings.notificationsEnabled, data.tasks, onUnavailable])
}
