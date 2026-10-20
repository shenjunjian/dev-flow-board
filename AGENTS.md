# dev-flow-board · Agent 指南

Nuxt 4 看板应用：把 GitHub Issue 按状态 label 映射成需求 / 开发 / 检视 / 完成四列，数据落在本地 SQLite（drizzle-orm + better-sqlite3）。需求原文见 `README.md` 与 `dev-flow-board.md`。

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm test` | `vitest run`，用例在 `test/**/*.spec.ts`，node 环境（`vitest.config.ts`） |

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `app/` | 页面与组件 |
| `server/` | API、GitHub 同步、SQLite |
| `shared/utils/` | 看板领域纯函数（列判定、甘特、工时分析），前后端共用 |
| `demos/` | 与看板领域无关的独立算法示例，配套用例在 `test/unit/` |

## 术语表

**看板列（Column）**:
由工单状态 label 映射出的展示列；一个工单同一时刻只属于一列。
_Avoid_: 阶段、泳道、状态列

**状态 label**:
`Story`、`WaitDev`、`Dev`、`DevDone`、`Review`、`ReviewDone`、`ReviewErrors`。与重要性 label（`High`/`Low`）、任务类型 label（`feature`/`bug`/`refactor`）互不相干，各自独立解析。
_Avoid_: 标签（不区分种类时的泛称）

**示例算法（Demo）**:
放在 `demos/` 的独立纯函数，只作演示，不参与看板业务流程，不被 `app/`、`server/` 引用。
_Avoid_: 工具函数、shared util

## 架构决策记录

## 0001-demos-dir-for-algorithm-samples

与看板领域无关的算法示例（`demos/sum.js`、`demos/two-sum.js`、`demos/longest-substring.js`）放 `demos/`，测试放 `test/unit/`，不并入 `shared/utils/`。理由：`shared/utils/` 是前后端共用的看板领域代码，混入演示算法会让「这个函数被谁调用」无法判断。`vitest.config.ts` 的 include 已覆盖 `test/**/*.spec.ts`，新增示例无需改测试配置。

## 0002-defensive-boundaries-in-demos

`demos/` 里的函数一律不抛错：入参类型不符时返回安全值（`sum` 返回 `0`，`twoSum` 返回 `[]`，`lengthOfLongestSubstring` 返回 `0`），而不是抛 `TypeError`。三份示例保持同一约定，用例也按此断言（`twoSum(null, 0)` → `[]`、`lengthOfLongestSubstring(123)` → `0`）。新增示例沿用，不要单独改成抛错风格。

## 0003-code-point-iteration-for-string-samples

字符串类示例按 Unicode 码点遍历（`Array.from(s)`），不用 `s[i]` 按 UTF-16 码元索引。理由：代理对（emoji 等 BMP 之外字符）按码元会被拆成两个互不相干的值，判重失真、结果虚增（`"😀abc😀"` 会得 5，正确是 4）。索引位置因此是码点下标而非码元下标；不要为了常数性能改回 `s[i]`。
