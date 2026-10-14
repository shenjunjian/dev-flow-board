# dev-flow-board 开发计划

> 依据 `README.md` 整理。系统监听若干 GitHub 仓库的开发状态，用看板页面实时展示需求 / 开发 / 检视 / 完成的活动数据。
> 技术栈：**Nuxt 4 + Nuxt UI + SQLite（drizzle-orm + better-sqlite3）**。

---

## 一、已确认的关键决策

| 主题 | 决策 |
| --- | --- |
| 变动监听 | **纯 Webhook 为主**；看板页面提供**刷新按钮**可随时手动刷新；额外内置**可选定时轮询**作为 webhook 无法回调公网时的兼容路径（默认关闭） |
| 状态判定依据 | **Issue label 约定驱动**，系统只读取并映射，不回写 GitHub |
| 看板读写权限 | **纯只读**，卡片可点击跳转 GitHub issue |
| 实时推送到前端 | **SSE**（Nuxt server route + `EventSource`），驱动飞行动画与高亮 |
| Token / Secret 存储 | **`.env` 为主**，项目内不存在明文；前端 API 永不回显 token，只返回「已配置」标记；根目录提供 `SETUP.md` 说明如何配置 env、如何获取 `GITHUB_TOKEN` 与 webhook secret |
| 仓库可见性 | **公开 + 私有混合**：支持全局默认 token，并允许仓库级覆盖 |
| 访问控制 | 第一版**不做登录**（本地 / 内网可信环境），服务端预留鉴权开关位 |
| PR 数据 | **只展示 issue**；PR 不作为独立卡片，仅作为完成列的说明信息来源 |
| 示意图 | 无额外要求，完全按 `README.md` 文字实现 |
| 数据库访问 | **drizzle-orm + better-sqlite3**，schema 用 TS 声明，启动时自动建表 |
| 任务粒度 | 8 个阶段，每阶段若干可验证子任务 |

## 二、Label 与列映射规则

README 未写明的部分，统一按以下规则落地（集中定义在 `server/lib/status.ts`，便于后续调整）。

**状态 label（直接采用 README 中的英文名）**

- 需求：`Story`
- 开发：`WaitDev`、`Dev`、`DevDone`
- 检视：`Review`、`ReviewDone`、`ReviewErrors`

**重要性 label**：`High`、`Low`；issue 未带任一标签时**默认为 `Low`**。

**列归属判定**

| 列 | 条件 |
| --- | --- |
| 需求列 | 有 `Story`，且无任何状态 label；无状态图标 |
| 开发列 | 状态为 `WaitDev` / `Dev` / `DevDone` |
| 检视列 | 状态为 `Review` / `ReviewDone` / `ReviewErrors` |
| 完成列 | `state = closed`（即 PR 线下合入后人工关闭 issue）。`ReviewDone` **不**代表进入完成列。只展示近 2 天，按 `closed_at` 倒序，无状态图标 |

**冲突与优先级**

- 同一 issue 同时存在多个状态 label 时，取生命周期中**最靠后**的那个：
  `Story → WaitDev → Dev → DevDone → Review → ReviewErrors → Review → ReviewDone`
  （`ReviewErrors` 排在 `Review` 之后，用于突出「被打回」这一最新事实）
- 列归属变化即视为「任务切换列」，记录一条 `issue_events` 并触发前端飞行动画 + 1 分钟高亮。

---

## 三、开发阶段与任务

### 1. 项目脚手架与环境配置

- `nuxi init` 建立 Nuxt 4 工程，接入 `@nuxt/ui`（4.x）+ Tailwind，采用 `app/` 新目录结构与 `pages/`、`components/` 约定
- 安装 `drizzle-orm`、`better-sqlite3`、`zod`，加 `drizzle-kit`；配置 `type: module` 与原生依赖白名单（`nitro.external`），确保 Windows 下可运行
- `nuxt.config.ts` 配置 `runtimeConfig`：`GITHUB_TOKEN`、`GITHUB_WEBHOOK_SECRET`、轮询开关与间隔、DB 路径、默认 token 策略（服务端专用，不泄露前端）
- 建 `.env.example` 与根目录 `SETUP.md`：如何申请只读 `GITHUB_TOKEN`、如何生成 webhook secret、如何在目标仓库配置 webhook URL 与订阅 Events、本地内网穿透或部署方案
- **验证**：`npm run dev` 能起空看板页；`/api/health` 返回 DB 与配置就绪状态

### 2. 数据层（SQLite + Drizzle）

- `server/db/schema.ts` 定义 `repos`：`id`、`owner`、`name`、`html_url`、`sort_order`、`color`、`enabled`、时间戳
- `issues` 表：`repo_id`、`issue_number`、`title`、`body`、`state`、`labels(JSON)`、`priority`、`status`、`column_key`、`assignees`、`html_url`、`last_changed_at`、`closed_at`；唯一索引 `(repo_id, issue_number)`
- `issue_events` 表：`issue_id`、`type`、`actor`、`occurred_at`、`from_status`、`to_status`、`payload(JSON)` —— 支撑 tooltip 全生命周期与列变更判定
- `sync_state` 表：`repo_id`、`last_seen_at`、`etag`、游标 —— 初始同步与增量轮询复用
- `server/db/index.ts` 封装 DB 客户端 + 启动时自动建表迁移
- **验证**：脚本插入一张仓库与一条 issue，重启服务后数据仍在

### 3. GitHub 集成与状态映射

- `server/lib/github.ts`：REST 客户端，分页拉取 issue（含 labels / assignees / comments）；token 解析优先仓库级、回落全局；限流、404、无权限分类处理并记录，不中断整体同步
- `server/lib/status.ts`：纯函数集中定义 label 名、生命周期顺序、多 label 冲突取最靠后者、列归属与 `priority` 缺省 `Low`
- 初始同步服务：拉全部 issue → upsert `issues` → 用 issue timeline 补齐 `issue_events` → 写入 `sync_state`
- 增量同步服务：基于 `since` + issue events 补新评论 / label 变更 / 关闭；与 webhook 共用同一套 `applyEvents()` 映射与变更检测逻辑
- **验证**：对一个真实公开仓库跑一次初始同步，四列计数与 GitHub 侧一致

### 4. 仓库管理（API + 管理弹窗）

- `/api/repos` 的 GET / POST / PATCH / DELETE，`zod` 校验，按 `sort_order` 返回；删除时级联清理 `issues` / `issue_events` / `sync_state`
- 顶部「管理仓库」按钮打开 `UModal`：增删改仓库地址、排序号、颜色选择器、启用开关
- 保存后自动触发该仓库初始同步，并通过 SSE 广播 `repos-changed`，看板按排序号即时重排
- 增加「连通性测试」动作，把 token / 权限问题直接反馈在弹窗内
- **验证**：修改排序号或颜色后，看板无需刷新即重排、重新着色

### 5. Webhook 接收 + 手动刷新 + 定时器 + SSE 通道

- `POST /api/webhook/github`：校验 `X-Hub-Signature-256`（HMAC-SHA256 + timing-safe 比较），按仓库匹配后处理 `issues`、`issue_comment` 事件，忽略未纳管仓库
- 处理流程统一收敛到 `applyEvents()`：更新 `issues` → 追加 `issue_events` → 列变化时写 `column_key` / `last_changed_at` → SSE 广播 `task-moved`
- `POST /api/refresh`（全量或单仓库）供刷新按钮调用，返回同步统计并广播
- `nitro.scheduledTasks` 定时器（可开关）调增量同步，作为 webhook 打不到公网时的兼容路径
- `GET /api/events`：SSE 通道（带心跳与断线重连）；前端 store 订阅
- **验证**：用 `curl` 模拟一次带签名的 webhook，看板卡片自动换列并收到广播

### 6. 看板页面（四列 + 仓库块 + 卡片）

- `/api/board`：返回按 `repos.sort_order` 分组的四列数据、仓库颜色、时间戳，并完成列做近 2 天过滤
- 顶部筛选栏：仓库多选、重要性筛选（全部 / High / Low）、管理仓库按钮、刷新按钮、SSE 连接状态指示
- 四个列容器（需求 / 开发 / 检视 / 已完成），列内自上而下按排序号渲染仓库块：仓库名大标题 + 该仓库颜色作**边框色与浅色背景**（CSS 变量派生，兼容深浅色主题）
- 卡片字段：issue number、任务名、任务描述（摘要截断）、责任人、重要度徽章、状态图标；整卡可点击跳转 GitHub issue
- 完成列按 `closed_at` 倒序、只渲染近 2 天；处理空列、加载中、离线、token 失效等状态提示
- **验证**：四列与仓库块渲染正确，筛选即时生效且顺序稳定

### 7. 动画、高亮与全生命周期 tooltip

- 列切换「飞过去」动画：记录卡片旧位置，用 FLIP + 绝对定位飞行层移动到新列位置，动画结束落位；批量动画节流，避免同时飞行过多
- 切换后**高亮持续 1 分钟**：前端 timer + 服务端 `last_changed_at` 计算剩余时长，页面刷新后仍能显示余下的高亮
- tooltip：鼠标移入卡片展示全生命周期时间线，形如
  `10-08 12:03:06 - 创建需求`
  `10-08 14:00:06 - 转为 待开发`
  数据来自 `issue_events`
- 事件文案本地化：创建需求 / 转为待开发 / 开发中 / 开发完成 / 检视中 / 检视成功 / 检视到错误 / 已完成，以及评论摘要
- **验证**：手动切换 label 后，可看到飞行动画、1 分钟高亮、tooltip 条目递增

### 8. 状态 SVG 图标、无障碍与交付打磨

- 一套内联 SVG 状态图标组件：`Story`、`WaitDev`、`Dev`（旋转/脉冲动画表示进行中）、`DevDone`（醒目）、`Review`（动画）、`ReviewDone`、`ReviewErrors`（醒目告警）、完成 ✓；动画用 CSS/SMIL，并尊重 `prefers-reduced-motion`
- 深浅色主题、键盘可达、`aria-label`、tooltip 焦点可见性
- 端到端验收：本地测试仓库跑完整链路 —— 创建 `Story` → `WaitDev` → `Dev` → `DevDone` → `Review` → `ReviewErrors` → `Review` → `ReviewDone` → 关闭进入完成列
- 收尾文档：`SETUP.md` 补充 webhook 排障与定时器开关说明；`README.md` 增补架构与运行步骤
- **验证**：上述全链路每一步在看板上列位、图标、tooltip、高亮均正确

---

## 四、遗留待确认事项

实施过程中若遇到以下情况，先暂停并确认，不擅自变更设计：

1. 目标仓库已有自己的 label 命名体系，与 `Story/WaitDev/...` 冲突时的兼容策略。
2. 一个 issue 关联多个仓库（跨仓库需求）是否需要支持 —— 当前模型按 `(repo, issue)` 独立看待。
3. 完成列「近 2 天」是否需要可配置（当前按 README 固定 2 天）。
