---
name: dev-flow
description: 自动向仓库创建issue 或更新issue,附带正确的Label名字，用于标识用户的开发阶段
---

## 前置条件： 

- 默认用户机器已经安装gh cli， 并且正常登录。 不要每次判断用户是否安装了 gh cli, 只有当执行返回错误时，才提醒用户安装并告知详细的安装步骤。
- 默认当前用户在一个github仓库中，自动获取项目的github 地址。

## 约定

每一个Issue 相当一个工单，需求，任务。

Issue 的状态 Label: Story / WaitDev / Dev / DevDone / Review / ReviewDone / ReviewErrors
Issue 的重要度 Label:  High / Low。 注意：在修改状态Label时，不要修改重要度Label。

你使用 issue 的Label 进行 issue 跟踪， 用户说 `#N` 时通常就是指的相应Issue。 你使用 gh cli 在github上自动创建issue,回复issue,并标记正确的Label, 它主要有以下场景：


- **创建工单**：`gh issue create --title "..." --body "..."`。多行正文用 heredoc。
- **读取工单**：`gh issue view <number> --json number,title,body,labels,comments`。
- **列出工单**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并配合合适的 `--label` 和 `--state` 过滤器。
- **把工单设为父工单的子工单**：`gh issue create --parent <parent> ...`，或事后用 `gh issue edit <parent> --add-sub-issue <child>`（`gh` 2.94+）。旧版 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`（database id，取法见下文**阻塞关系**）。没有 sub-issue 能力时，在子工单正文顶部写 `Part of #<parent>`。
- **评论工单**：`gh issue comment <number> --body "..."`，在工单中追加评论
- **修改评论**： `gh issue comment <issue-number> --edit-last --body "..."`
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

- **子工单**：以 GitHub sub-issue 的形式关联到当前Issue。工单被认领后，指派给当前推进它的开发者。
- **阻塞关系**：使用 GitHub 的**原生 issue dependencies**，这是规范的、界面上可见的表示方式。用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 加一条边，其中 `<blocker-db-id>` 是阻塞方的数字 **database id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，_不是_ `#number`，也不是 `node_id`）。GitHub 会通过 `issue_dependencies_summary.blocked_by` 报告阻塞项（只报未关闭的，也就是实时闸门）。所有阻塞方都关闭后，该工单即为解除阻塞。
- **前沿查询**：列出Issue的未关闭子工单（`gh issue list --state open`，范围限定到 Issue 的 sub-issue / 任务列表），剔除有未关闭阻塞方的（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行里有未关闭工单）或已有指派人的工单；按 map 中顺序取第一个。
- **认领/指派工单**：`gh issue edit <n> --add-assignee @me`，这是本次会话的第一次写入。
- **解决工单**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`。

从 `git remote -v` 推断仓库；在克隆目录里运行时 `gh` 会自动完成这件事。

## 执行方法

只有对话中或对话上下文中有准确的 Issue Number时，才执行下面的步骤

### 当 skill 说"发布需求，任务，或工单"

请自动分析出任务的标题和详情以及重要度，然后创建创建一个 GitHub issue，并打上 `Story`的Label和 重要度Label。

### 当 skill 说"分析/拆解需求，任务，或工单"

按上文**读取工单**的方式读取，如果当前Issue的Label 不包含 `Story`的Label， 则立即提醒用户它不是新发布的任务，并立即停止。
如果包含`Story`的Label，则先为该Issue 添加 `WaitDev` 的Label，并移除`Story`的Label。 然后根据Issue详情和用户的要求以及仓库中代码进行分析，生成该需求或任务的详细实施方案， 按照`评论工单`的方式评论到该Issue下面。
如果用户明确求生成开发计划，或者需求更适合进行多步开发时，请参考 `开发计划的格式` 来生成开发计划，之后评论在当前Issue下面，并请按照`子工单`的方法，为该Issue创建 sub-issue， 并分析子工单之间的阻塞关系之后，创建相应的阻塞。 子工单也要添加 `WaitDev` 的Label。

### 当 skill 说"实现/解决需求，任务，或工单"

按上文**读取工单**的方式读取工单的详情以及实施方案等信息后，如果当前Issue的Label 不包含 `WaitDev`的Label，则立即提醒用户并立即停止。
如果包含`WaitDev`的Label， 则为该Issue 修改为 `Dev` 的Label，之后再进行开发。

### 当 skill 说"提交代码/开发完成"

先判断当前的代码，若没有提交则生成commit 信息并自动提交。在代码提交之后，为该issue 修改为 `DevDone`的标签。
如果当前是 sub-issue, 则要找到父issue, 并执行`修改评论`的方法修改本次子任务对应的`todos`项的status 状态。
如果当前Issue阻塞了另一个任务，需要调用解除该阻塞。

### 当 skill 说"检视/审核"

先判断当前Issue有没有`DevDone`的Label， 如果没有则立即提醒用户并立即停止。如果包含`DevDone`的Label，则修改为 `Review` 的Label。
在代码检视后，如果发现问题，则执行`评论工单`方法进行评论，每个问题是一个单独的评论，最后要将当前Issue的Label 修改为 `ReviewErrors`。
如果代码检视未发现问题，将当前Issue的Label 修改为 `ReviewDone`。


## 详细实施方案

实施方案应该详细阐述实现的具体逻辑，如果有破坏之前的实现或影响其它模块，需要明确告警。实施方案的编写建议：

- 分步骤解释
- 绘制关系图/逻辑图/依赖图等，使用Mermaid 图表
- 使用伪代码解释
- 使用 emoji 图标

## 开发计划的格式 

生成以下格式：id：为计划的标题， content：一句话浓缩整个计划的内容。 status： 可选值为： pending/completed。

```md
📋 todos:
  - id: 任务1标题
    content: 计划内容
    status: complete
  - id: 任务2标题
    content: 计划内容
    status: pending
```