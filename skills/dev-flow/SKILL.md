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

任务类型 label: `feature` / `bug` / `refactor`。

换状态：卸下其它全部状态 label，再贴上目标 label。从检视退回 `Dev` 时必须卸下 `Review`、`ReviewDone`、`ReviewErrors`；只加 `Dev` 时，看板仍停在检视列。

合入例外：只追加 `Merged`，保留`DevDone` 或 `ReviewDone`，然后再合并 PR。`Merged` 不是阶段 label。

## 编号

- 发布不需要编号。
- 合入、接受：`#N` 是 PR 编号。未给编号时用当前分支的开放 PR。
- 其它触发：`#N` 是工单编号。
- issue 与 PR 的编号相互独立。先用对应的 `view` 确认存在；确认失败就停止并说明原因。

## 触发

不满足入口时，说明原因并停止。此时不改 label，不关闭工单。

### 发布

用户说发布需求、任务或工单。

从对话归纳标题、正文、重要性（未说明则 `Low`）和任务类型。创建工单，贴上 `Story` 和该重要性 label 和 任务类型 label。不改代码，不提交。

### 分析 / 拆解

用户说分析或拆解，且已确定工单编号。工单没有 `Story` 时停止：它不是新发布的任务。

读取工单和仓库代码，写**一条**评论：

- 单步：只写实施方案。
- 用户要求开发计划，或任务适合分步：同一条评论在实施方案之后附上 `todos`。每个 todo 建一个子工单，贴 `WaitDev` 和重要性 label和任务类型label。有先后依赖时，用 `blocked_by` 把前置工单标为阻塞方。

评论、子工单和阻塞都成功创建后，把父工单的 `Story` 换成 `WaitDev`。父工单停在 `WaitDev`，不为它建 PR。子工单各自走后续状态机。

### 实现 / 修复

用户说实现、解决或修复，且已确定工单编号。工单上既没有 `WaitDev` 也没有 `ReviewErrors` 时停止。

先读取正文和评论中的方案，状态 label 换成 `Dev`，再改代码或按检视意见修改。

本阶段不 commit、不建 PR、不关闭工单。

### 提交 / 开发完成

用户说提交代码或开发完成，且已确定工单编号。工单没有 `Dev` 时停止。

工作区有未提交改动才 commit。提交标题为`fix(..): ...`的模式，使用任务类型 feat/fix/refactor 做前缀。提交说明不包含 `Fixes`、`Closes`、`Resolves` 加 `Closes#编号`。没有未提交改动就跳过 commit。

该工单已有开放 PR 则沿用。没有则先把当前分支推送到远端，再创建 PR：base 为仓库默认分支，head 为当前分支，正文包含 `Closes #<工单编号>`。

没有可纳入 PR 的提交时停止，不要改 label。PR 就绪后，把状态换成 `DevDone`。

### 检视 / 审核

用户说检视或审核，且已确定工单编号。工单没有 `DevDone` 时停止。

状态先换成 `Review`，再查看该工单关联 PR 的 diff。

- 有问题：每个问题一条评论，然后换成 `ReviewErrors`。
- 无问题：换成 `ReviewDone`。若是子工单，把父工单里对应 todo 的 `status` 改为 `completed`。父工单取 `parent` 字段；没有该字段时，从正文首行 `Part of #<parent>` 识别。修改含 `todos:` 且含该子任务 `id` 的那条评论。不用 `--edit-last`。

不关闭工单，不删除 `blocked_by`。阻塞方合入并关闭后，GitHub 不再把它算作未关闭阻塞。

### 合入 / 接受

用户说合入或接受 PR。状态为 `DevDone` 或 `ReviewDone` 都可以合入（简单任务是不需要检视的）

读取 PR 的 `closingIssuesReferences` 和 `mergeable`。每张关联工单都要有`ReviewDone` 或 `DevDone`，否则停止。`mergeable` 不是 `MERGEABLE` 时停止并说明原因。

先为每张关联工单追加 `Merged`，保留原状态 label，保持开放。再执行 `gh pr merge <n> --squash`。

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
