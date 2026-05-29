# Roland-Plan

Roland-Plan 是一个防遗忘型个人日程 / 任务管理 Web App。它的目标不是复杂项目管理，而是帮助用户记录、查看和回顾任何需要完成的事情，减少遗忘。

当前版本：`Roland-Plan v0.8.4`

## 产品定位

Roland-Plan 关注个人长期使用体验：

- 今天要做什么
- 本周还有哪些安排
- 下周有哪些预告任务
- 哪些日常 / 周常需要打卡
- 哪些长期目标需要推进
- 每个月实际完成了哪些任务

打开应用后直接进入主界面，没有营销首页。

## 当前功能

- 今日页：今日任务、逾期提醒、明日预告、打卡提醒、长期目标入口
- 本周页：本周任务、下周预告、隐藏空日期
- 日历页：月历视图、任务 / 简洁 / 全部显示模式、任务与打卡统计
- 回顾页：按月份自动生成已完成任务回顾，可导出 Excel
- 长期页：长期目标、无上限目标、日志编辑 / 撤销
- 周期页：日常 / 周常打卡、打卡历史、连续完成统计
- 设置 / 存档：本地存档导入导出、重置存档、数据健康检查、整体数据导出 Excel
- 云存档实验区：Supabase 登录、手动云存档、自动云存档、历史云备份槽位
- 智能快速新增：识别“明天下午3点去银行”这类自然语言，并打开预填好的任务确认卡片
- 新手教程：首次进入和各页面首次访问时显示引导
- 版本更新提示：每个版本可显示一次性更新说明
- 主题：简约风格 / 轻松纸质风格，支持主题色和深浅色模式

## 数据原则

普通一次性任务只保存在同一个 `tasks` 数组中。

今日、本周、下周、日历、搜索、回顾等页面都只是 `tasks` 的不同视图，按日期、标签、完成状态等条件动态计算。

不会为今日任务、本周任务、下周任务分别建立独立数据源。

## 技术栈

- React
- TypeScript
- Vite
- Supabase
- localStorage
- lucide-react
- CSS

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址通常是：

```text
http://127.0.0.1:5173/
```

## 构建

```bash
npm run build
```

## 代码检查

```bash
npm run lint
npx tsc -b
```

## Supabase 配置

如果只使用本地存档，不配置 Supabase 也可以正常使用。

如果要启用云存档，需要在项目根目录创建 `.env.local`：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

不要把 `.env.local` 上传到 GitHub。

Supabase 数据表 SQL 放在：

```text
supabase/
```

云功能当前仍属于实验区，第一阶段保留本地存档导入导出作为主要备份和迁移入口。

## GitHub 上传建议

建议上传：

- `src/`
- `public/`
- `supabase/`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig*.json`
- `eslint.config.js`
- `.env.example`
- `.gitignore`
- `README.md`
- `open-roland-plan.cmd`

不要上传：

- `node_modules/`
- `dist/`
- `.env.local`
- `dev-server*.log`
- 临时目录或本地缓存文件

## 当前阶段

Roland-Plan 目前是一个可部署、可体验的正式 demo。

后续可以继续完善：

- 更完整的账号资料页
- 更成熟的云同步冲突处理
- 移动端 App 封装
- 桌面端提醒、悬浮窗、系统托盘
- AI 辅助任务整理与计划建议
