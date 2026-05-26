export const APP_VERSION = '0.8.1'

export const APP_VERSION_LABEL = `Roland-Plan v${APP_VERSION}`

export const RELEASE_NOTES = [
  {
    version: '0.8.1',
    previousVersion: '0.8.0',
    title: '顶部快捷任务输入智能识别系统',
    items: [
      '顶部快捷输入现在会识别日期、星期、时间点和早上/下午/晚上等时段词。',
      '输入后会先打开预填好的新增任务卡片，由用户确认后再写入任务。',
    ],
  },
] as const
