import type { AppData } from '../types'
import { inspectCloudSaveUpload, uploadCloudSave } from './cloudSave'
import { formatCloudSaveRiskMessage } from './cloudSaveProtection'

export interface ProtectedManualUploadResult {
  cancelled: boolean
  updatedAt?: string
  warning?: string
}

export const uploadProtectedManualCloudSave = async (
  appData: AppData,
): Promise<ProtectedManualUploadResult> => {
  const protectionMode = appData.settings.cloudSaveProtectionMode
  let warning: string | undefined

  if (protectionMode !== 'off') {
    const check = await inspectCloudSaveUpload(appData)

    if (check?.risk.hasRisk) {
      warning = formatCloudSaveRiskMessage(check.risk)
      const confirmed = window.confirm(
        [
          '云存档安全提醒',
          '',
          warning,
          '',
          '如果这些变化是你主动删除或整理的内容，可以继续保存。',
          '确认仍然覆盖手动云存档？',
        ].join('\n'),
      )

      if (!confirmed) {
        return { cancelled: true, warning }
      }
    }
  }

  return {
    cancelled: false,
    updatedAt: await uploadCloudSave(appData),
    warning,
  }
}
