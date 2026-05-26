export const APP_VERSION = '0.8.2'

export const APP_VERSION_LABEL = `Roland-Plan v${APP_VERSION}`

export const RELEASE_NOTES = [
  {
    version: '0.8.2',
    previousVersion: '0.8.1',
    title: '移动端导航与日历打卡视图增强',
    items: [
      '移动端底部导航改为页面常驻，不需要滚动到页面底部也能切换页面。',
      '周期任务的已打卡日期改为更明显的主题色状态，提升打卡历史辨识度。',
      '日历格子新增“任务 x/y”和“打卡 x/y”统计，并在右侧显示当天具体周期打卡事项。',
    ],
  },
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
