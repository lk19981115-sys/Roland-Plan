import type { AppData, Task } from '../types'
import { TASK_PRIORITIES, TASK_TAGS } from '../types'
import {
  calculateCompletionRate,
  calculateLongTermTodayCount,
  calculateLongTermWeekCount,
  calculateRecurringStreak,
  formatReadableDate,
  formatWeekday,
  getTasksForThisWeek,
  getTasksForToday,
  getTodayISO,
  getWeekId,
  getWeekRange,
  sortTasksByTime,
} from '../lib'

type CellValue = string | number
type Sheet = {
  name: string
  rows: CellValue[][]
}

const tagLabel = (value: Task['tag']) =>
  TASK_TAGS.find((tag) => tag.value === value)?.label || '其他'

const priorityLabel = (value: Task['priority']) =>
  TASK_PRIORITIES.find((priority) => priority.value === value)?.label || '普通'

const taskStatus = (completed: boolean) => (completed ? '已完成' : '未完成')

const taskTime = (task: Task) => {
  if (task.noTime) {
    return '无具体时间'
  }

  if (task.startTime && task.endTime) {
    return `${task.startTime} - ${task.endTime}`
  }

  return task.startTime || '未设时间'
}

const removeXmlControlCharacters = (value: string) =>
  Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32
    })
    .join('')

const xmlEscape = (value: CellValue) =>
  removeXmlControlCharacters(String(value))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const invalidSheetNameCharacters = new Set(['[', ']', ':', '*', '?', '/', '\\'])

const safeSheetName = (name: string) =>
  Array.from(name)
    .filter((character) => !invalidSheetNameCharacters.has(character))
    .join('')
    .slice(0, 31) || 'Sheet'

const cellType = (value: CellValue) => (typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String')

const buildTaskRows = (tasks: Task[]): CellValue[][] => [
  ['日期', '星期', '标题', '时间', '标签', '优先级', '状态', '备注', '创建时间', '更新时间'],
  ...sortTasksByTime(tasks).map((task) => [
    task.date,
    formatWeekday(task.date),
    task.title,
    taskTime(task),
    tagLabel(task.tag),
    priorityLabel(task.priority),
    taskStatus(task.completed),
    task.description || '',
    task.createdAt,
    task.updatedAt,
  ]),
]

const buildReviewRows = (tasks: Task[]): CellValue[][] => {
  const completedTasks = sortTasksByTime(tasks.filter((task) => task.completed))
  const byDate = new Map<string, Task[]>()

  completedTasks.forEach((task) => {
    byDate.set(task.date, [...(byDate.get(task.date) || []), task])
  })

  return [
    ['日期', '星期', '完成数量', '已完成任务详情'],
    ...Array.from(byDate.entries()).map(([date, dateTasks]) => [
      date,
      formatWeekday(date),
      dateTasks.length,
      dateTasks
        .map((task) => `${task.title}（${taskTime(task)} / ${tagLabel(task.tag)} / ${priorityLabel(task.priority)}）`)
        .join('\n'),
    ]),
  ]
}

const buildWorkbookXml = (sheets: Sheet[]) => {
  const worksheetXml = sheets
    .map((sheet) => {
      const rows = sheet.rows
        .map(
          (row, rowIndex) =>
            `<Row>${row
              .map(
                (cell) =>
                  `<Cell ss:StyleID="${rowIndex === 0 ? 'Header' : 'Body'}"><Data ss:Type="${cellType(
                    cell,
                  )}">${xmlEscape(cell)}</Data></Cell>`,
              )
              .join('')}</Row>`,
        )
        .join('')

      return `<Worksheet ss:Name="${xmlEscape(safeSheetName(sheet.name))}"><Table>${rows}</Table></Worksheet>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#F0F2F5" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Body"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  </Styles>
  ${worksheetXml}
</Workbook>`
}

const downloadExcelXml = (filename: string, workbookXml: string) => {
  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const exportReportFile = (data: AppData): void => {
  const today = getTodayISO()
  const weekRange = getWeekRange(today)
  const weekTasks = getTasksForThisWeek(data.tasks)
  const todayTasks = getTasksForToday(data.tasks)
  const completedTasks = data.tasks.filter((task) => task.completed)
  const openTasks = data.tasks.filter((task) => !task.completed)
  const dailyRecurring = data.recurringTasks.filter((task) => task.type === 'daily')
  const weeklyRecurring = data.recurringTasks.filter((task) => task.type === 'weekly')

  const sheets: Sheet[] = [
    {
      name: '概览',
      rows: [
        ['项目', '数值'],
        ['导出日期', today],
        ['今日', formatReadableDate(today)],
        ['本周范围', `${weekRange.start} 至 ${weekRange.end}`],
        ['普通任务总数', data.tasks.length],
        ['未完成普通任务', openTasks.length],
        ['已完成普通任务', completedTasks.length],
        ['普通任务总完成率', `${calculateCompletionRate(data.tasks)}%`],
        ['今日任务数', todayTasks.length],
        ['今日完成率', `${calculateCompletionRate(todayTasks)}%`],
        ['本周任务数', weekTasks.length],
        ['本周完成率', `${calculateCompletionRate(weekTasks)}%`],
        ['长期目标数', data.longTermGoals.length],
        ['周期任务数', data.recurringTasks.length],
        ['日常任务数', dailyRecurring.length],
        ['周常任务数', weeklyRecurring.length],
      ],
    },
    {
      name: '今日',
      rows: buildTaskRows(todayTasks),
    },
    {
      name: '本周',
      rows: [
        ['本周范围', `${weekRange.start} 至 ${weekRange.end}`],
        [],
        ...buildTaskRows(weekTasks),
      ],
    },
    {
      name: '全部任务',
      rows: buildTaskRows(data.tasks),
    },
    {
      name: '长期目标',
      rows: [
        ['标题', '模式', '总目标', '已完成', '剩余', '今日完成', '本周完成', '备注', '创建时间', '更新时间'],
        ...data.longTermGoals.map((goal) => [
          goal.title,
          goal.unlimited ? '无上限累计' : '固定总量',
          goal.unlimited ? '无上限' : goal.total,
          goal.completed,
          goal.unlimited ? '' : Math.max(0, goal.total - goal.completed),
          calculateLongTermTodayCount(goal),
          calculateLongTermWeekCount(goal),
          goal.description || '',
          goal.createdAt,
          goal.updatedAt,
        ]),
      ],
    },
    {
      name: '长期日志',
      rows: [
        ['目标标题', '模式', '日期', '数量', '创建时间', '更新时间'],
        ...data.longTermGoals.flatMap((goal) =>
          goal.logs.map((log) => [
            goal.title,
            goal.unlimited ? '无上限累计' : '固定总量',
            log.date,
            log.count,
            log.createdAt,
            log.updatedAt,
          ]),
        ),
      ],
    },
    {
      name: '周期任务',
      rows: [
        ['标题', '类型', '当前周期', '当前周期已打卡', '连续次数', '打卡历史', '备注', '创建时间', '更新时间'],
        ...data.recurringTasks.map((task) => {
          const currentKey = task.type === 'daily' ? today : getWeekId(today)

          return [
            task.title,
            task.type === 'daily' ? '日常' : '周常',
            currentKey,
            task.completedKeys.includes(currentKey) ? '是' : '否',
            calculateRecurringStreak(task),
            task.completedKeys.join(', '),
            task.description || '',
            task.createdAt,
            task.updatedAt,
          ]
        }),
      ],
    },
    {
      name: '回顾',
      rows: buildReviewRows(data.tasks),
    },
  ]

  const workbookXml = buildWorkbookXml(sheets)

  downloadExcelXml(`roland-plan-report-${today}.xls`, workbookXml)
}
