---
name: dev-flow
description: 用 gh 管理当前 GitHub 仓库的工单状态与 PR 合入。用户说发布、分析、拆解、实现、修复、提交、开发完成、检视、审核、合入、接受 PR，或提到 #N 时使用。同一时刻只保留一个状态 label，不改动重要性 label。
---

# 工单流

工单就是 GitHub issue。用状态 label 跟踪阶段，用 PR 合入收尾。

## 前提

- 默认 `gh` 已安装并登录。不要预先检测。命令因未安装或未登录失败时，再让用户安装 GitHub CLI（https://cli.github.com）并执行 `gh auth login`。
- 在仓库目录中执行。`gh` 使用当前目录对应的 GitHub 仓库。

## 标签

状态 label，同一时刻只保留一个：`Story`、`WaitDev`、`Dev`、`DevDone`、`Review`、`ReviewDone`、`ReviewErrors`。

重要性 label：`High`、`Low`。用户未说明时用 `Low`。更换状态时不添加、不移除重要性 label。

任务类型 label: `feature` / `bug` / `refactor`。对应创建代码分支或pr提交的标题时， `bug` 类型要用 `fix`代替。

换状态：卸下其它全部状态 label，再贴上目标 label。从检视退回 `Dev` 时必须卸下 `Review`、`ReviewDone`、`ReviewErrors`；只加 `Dev` 时，看板仍停在检视列。

合入例外：只追加 `Merged`，保留`DevDone` 或 `ReviewDone`，然后再合并 PR。`Merged` 不是阶段 label。

## 编号

- 发布不需要编号。
- 合入、接受：`#N` 是 PR 编号。未给编号时用当前分支的开放 PR。
- 其它触发：`#N` 是工单编号。
- issue 与 PR 的编号相互独立。先用对应的 `view` 确认存在；确认失败就停止并说明原因。

## 触发

不满足入口标签时，说明原因并停止。此时不改 label，不关闭工单。

### 发布

用户说发布需求、任务或工单。

从对话归纳标题、正文、重要性（未说明则 `Low`）和任务类型。创建工单，贴上 `Story` 和该重要性 label 和 任务类型 label。不改代码，不提交。

### 分析 / 拆解

用户说分析或拆解，且已确定工单编号。工单没有 `Story` 时停止：它不是新发布的任务。

读取工单和仓库代码，写**一条**评论：

- 单步：只写实施方案，然后设置 `WaitDev` 和重要性 label和任务类型label。
- 用户要求开发计划，或任务适合分步：同一条评论在实施方案之后附上 `todos`。每个 todo 建一个子工单，设置它的 label 为 `WaitDev` 和重要性 label和任务类型label。有先后依赖时，用 `blocked_by` 把前置工单标为阻塞方。评论、子工单和阻塞都成功创建后，把父工单的 `Story` 换成 `WaitDev`。父工单停在 `WaitDev`，不为它建 PR。子工单各自走后续状态机。

### 实现 / 修复 / 开发

用户说实现、解决或修复，且已确定工单编号。工单上既没有 `WaitDev` 也没有 `ReviewErrors` 时停止。

先读取正文和评论中的方案，把状态 label 换成 `Dev`，之后再去创建Git Worktree 进行任务开发，创建Worktree时，要从`dev` , `develop`, `master`,`main` 等分支上创建，如果主项目不在这些分支上，则提醒用户切换分支或指明从哪个分支创建worktree。
在Worktree的新目录中进行代码开发或检视问题修改。

如果当前任务/工单引入新的`术语` 或 `架构决策记录`， 请务必记录在 `AGENTS.md`中。

本阶段不 commit、不建 PR、不关闭工单。

### 提交 / 开发完成

用户说提交代码或开发完成，且已确定工单编号。工单没有 `Dev` 时停止。如果上下文没有Worktree信息，则默认从当前项目中进行提交，否则从Worktree进行提交。

工作区有未提交改动才 commit。提交标题为`fix(..): ...`的模式，使用任务类型 feat/fix/refactor 做前缀。提交说明不包含 `Fixes`、`Closes`、`Resolves` 加 `Closes#编号`。没有未提交改动就跳过 commit。

该工单已有开放 PR 则沿用。没有则先把当前分支推送到远端，再创建 PR：base 为仓库默认分支，head 为当前分支，正文包含 `Closes #<工单编号>`。

没有可纳入 PR 的提交时停止，不要改 label。PR 就绪后，把状态换成 `DevDone`。

### 检视 / 审核

用户说检视或审核，且已确定工单编号。工单没有 `DevDone` 时停止。

状态先换成 `Review`，再查看该工单关联 PR 的 diff。

- 有问题：每个问题一条评论，然后换成 `ReviewErrors`。
- 无问题：换成 `ReviewDone`。若是子工单，把父工单里对应 todo 的 `status` 改为 `completed`。父工单取 `parent` 字段；没有该字段时，从正文首行 `Part of #<parent>` 识别。修改含 `todos:` 且含该子任务 `id` 的那条评论。不用 `--edit-last`。

不关闭工单，不删除 `blocked_by`。阻塞方合入并关闭后，GitHub 不再把它算作未关闭阻塞。

### 合入PR

用户说合入PR时， 简单任务是不需要检视阶段。

读取 PR 的 `closingIssuesReferences` 和 `mergeable`。每张关联工单都要有`ReviewDone` 或 `DevDone`，否则停止。`mergeable` 不是 `MERGEABLE` 时停止并说明原因。

先为每张关联工单追加 `Merged`，保留原状态 label，保持开放。再执行 `gh pr merge <n> --squash`。如果用户没有 pr merge的权限，提醒用户未能合入就停止。

PR 正文的 `Closes` 会关闭工单。不要再执行 `gh issue close`。合并失败时不关闭工单，不卸下 `ReviewDone`。

## 命令

多行正文写入临时文件，用 `--body-file`。

- 读工单：`gh issue view <n> --json number,title,body,labels,comments,parent`
- 建工单：`gh issue create --title "..." --body-file <file> --label Story --label Low`
- 换状态：对每个要卸下的状态 label 各写一次 `--remove-label`，再 `--add-label` 目标。例：`gh issue edit <n> --remove-label Story --add-label WaitDev`
- 只追加合入标记：`gh issue edit <n> --add-label Merged`
- 评论：`gh issue comment <n> --body-file <file>`
- 子工单：`gh issue create --parent <parent> --title "..." --body-file <file> --label WaitDev --label Low`。失败时改为正文首行 `Part of #<parent>`。
- 阻塞：`<blocker-db-id>` 取 `gh api repos/<owner>/<repo>/issues/<blocker> --jq .id`。这是 database id，不是 `#number`，也不是 `node_id`。然后 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`。
- 改指定评论：在工单 `comments` 里找到目标 id。把新全文写成 JSON 文件 `{"body":"..."}`，再 `gh api --method PATCH repos/<owner>/<repo>/issues/comments/<comment-id> --input <file>`。
- 默认分支：`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`
- 查 PR：`gh pr view <n> --json number,body,mergeable,mergeStateStatus,closingIssuesReferences`
- PR diff：`gh pr diff <n>`
- 工单的开放 PR：`gh pr list --state open --json number,closingIssuesReferences`，保留引用了该工单的项。
- 建 PR：`gh pr create --base <default> --head <current> --title "..." --body-file <file>`
- 合并：`gh pr merge <n> --squash`

- 创建worktree: `git worktree add -b <任务类型label>-<title> ../agent-issue-<N> <base-branch>` , 从`<base-branch>` 分支创建一个新分支，比如 `feature-something`， 如果不指定`<base-branch>`, 则表示从主项目的当前分支创建。
- 移除worktree: `git worktree remove ../agent-issue-<N>`

## 实施方案

评论中的方案只保留必要内容：

- 分步骤写实现逻辑。
- 会破坏既有行为或影响其它模块时写明告警；没有则不写。
- 关系或依赖用 mermaid。
- 行为用中文伪代码。
- 省略常识，保持简短。

## todos 格式

`status` 只能是 `pending` 或 `completed`。`id` 是任务标题，`content` 是一句话。
示例：

```md
todos:

- id: 任务标题
  content: 一句话说明
  status: pending
```

## 使用AGENTS.md记录术语和架构决策记录

如果项目根目录不存在 `AGENTS.md`，则创建它。如果已经存在，就把 `术语`或 `架构决策记录` 追加到它最后面。在上面的`分析、拆解、开发、检视`等阶段中，一定要先读取 `AGENTS.md`的内容。

### 术语的说明

- **要有立场。**同一个概念存在多个说法时，选出最好的那一个，其余列进 `_Avoid_`。
- **释义要紧。**最多一两句话。定义它本身是什么，而不是它能做什么。
- **只收录本项目上下文特有的术语。**通用编程概念（超时、错误类型、工具类模式）不该进来，即便项目大量使用它们。加术语之前先问：这是本上下文独有的概念，还是通用编程概念？只有前者该收录。
- **出现自然的分组时，用子标题把术语归类。**如果所有术语都属于同一个内聚领域，平铺一份列表就行。

在 AGENTS.md记录`术语`的格式如下：

```md
## {Context Name}

{一两句话说明这个上下文是什么}

### 术语表

**Order**:
{一两句话的说明}
_Avoid_: Purchase, transaction
```

### 架构决策记录的说明

以下三条必须同时成立才记录：

1. **难以回退**：日后反悔的代价不小
2. **脱离上下文会让人意外**：后来的人读代码会想"到底为什么会这么做？"
3. **是真实取舍的结果**：确实存在别的方案，你出于具体理由选了一个

如果一个决定容易回退，就别写：你迟早会回退它。如果不让人意外，没人会追问为什么。如果没有真正的备选方案，那除了"我们做了显然该做的事"之外也没什么可记录的。

哪些情况算数

- **架构形态。** 比如："我们用 monorepo。""写模型采用事件溯源，读模型投影到 Postgres。"
- **上下文之间的集成方式。** 比如："Ordering 和 Billing 通过领域事件通信，而不是同步 HTTP。"
- **带来锁定的技术选择。** 比如：数据库、消息总线、认证服务商、部署目标。不是每个库都写：只写那些换掉要花掉一个季度的。
- **边界与范围的决定。** 比如："客户数据归 Customer 上下文所有，其他上下文只按 ID 引用它。"明确说不的与明确说是的同样有价值。
- **有意偏离显然的做法，特意为之。** 比如："因为 X，我们用手写 SQL 而不是 ORM。"凡是讲道理的读者都会猜反了的，都算。这些记录能阻止下一位工程师去"修好"一个本来刻意为之的地方。
- **代码里看不出的约束。** 比如："因为合规要求，我们不能用 AWS。""按合作方 API 约定，响应时间必须低于 200ms。"
- **否决理由不明显的备选方案。** 比如：如果你考虑过 GraphQL，出于细微的原因选了 REST，就记下来；否则半年后又会有人提议 GraphQL。

每个记录生成顺序编号：`0001-slug`、`0002-slug`，依此类推

在 AGENTS.md记录`架构决策记录`的格式如下：

```md
## 0001-slug

### {Short title of the decision}

{1-3 句话: what's the context, what did we decide, and why.}
```
