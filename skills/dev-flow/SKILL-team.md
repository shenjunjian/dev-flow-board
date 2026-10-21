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

## 用户触发指令

用工单标签管理着项目的开发，如果用户发出的指令，但工单不满足入口标签时，说明原因并停止。此时不改 label，不关闭工单。

### 发布

用户说发布需求、任务或工单。

从对话归纳标题、正文、重要性（未说明则 `Low`）和任务类型。创建工单，贴上 `Story` 和该重要性 label 和 任务类型 label。不改代码，不提交。

尽量保持需求的原始表达，不发散思维，不猜测需求，因为真正的需求详情是在`分析、拆解`的步骤中细化。

### 分析 / 拆解

用户说分析或拆解，且已确定工单编号。工单没有 `Story` 时停止：它不是新发布的任务。

读取工单和仓库代码，然后使用 `grilling模式` 澄清需求，对齐开发目标，之后根据需求的复杂度，分以下2种情况，将内容在写**一条**评论：

- 简单任务，适合一次性开发：只写`Spec文档` 记录在issue中，然后设置 `WaitDev` 和重要性 label和任务类型label。
- 用户要求开发计划，或任务适合分步：同一条评论先写`Spec文档`，后附上 `todos`列表。 为每个 todo 建一个子工单，设置它的 label 为 `WaitDev` 和重要性 label和任务类型label。有先后依赖时，用 `blocked_by` 把前置工单标为阻塞方。评论、子工单和阻塞都成功创建后，把父工单的 `Story` 换成 `WaitDev`。父工单停在 `WaitDev`，不为它建 PR。子工单各自走后续状态机。

本阶段不动源码，将所有结果写入工单的评论中。如果引入新的`术语` 或 `架构决策记录`，也暂时记录在评论中，在实现、开发功能时写入 `AGENTS.md`中。

### 实现 / 修复 / 开发

用户说实现、解决或修复，且已确定工单编号。工单上既没有 `WaitDev` 也没有 `ReviewErrors` 时停止。

先读取正文和评论中的方案，把状态 label 换成 `Dev`，之后再去开发。

如果用户明确说明`Worktree开发` 或 `并行开发`,则创建Git Worktree 进行任务开发，创建Worktree时，要从`dev` , `develop`, `master`,`main` 等分支上创建，如果主项目不在这些分支上，则提醒用户切换分支或指明从哪个分支创建worktree。
在Worktree的新目录中进行代码开发或检视问题修改。 否则直接在用户当前工作目录自动创建`<任务类型label>-<title>`的分支后进行开发。

如果当前任务/工单引入新的`术语` 或 `架构决策记录`， 请务必记录在 `AGENTS.md`中。同时将工单中的`Spec文档`部分要保存到源码的 `.specs`中去。

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

如果目前关联工单是一个子工单，则将其父工单的 `todos`中的当前项的`status`修改为`completed`，如果父工单的所有 `todos`都已完成，就将父工单的状态标签修改为 `Merged`， 父工单也全部结束，完成使命。

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

- 创建worktree: `git worktree add -b <任务类型label>-<title> ../<repoName>-issue<N> <base-branch>` , 从`<base-branch>` 分支创建一个新分支，比如 `feature-something`， 如果不指定`<base-branch>`, 则表示从主项目的当前分支创建。
- 移除worktree: `git worktree remove ../agent-issue-<N>`

## Spec文档编写说明

Spec文档将之前的对话变成一份规格说明，它固定下来的那些决定，需要探索仓库，理解代码库当前的状态（如果你还没做过），并结合AGENTS.md记录术语和架构决策记录来生成Spec文档的内容。在`分析拆解`需求时，它保存到工单评论上，在`开发`时，要保存到项目的 `.specs` 目录中。

`.specs/index.md` 保存所有spec文档的索引，如果没有则创建它。每次编写Spec文档时，先读取索引判断是否已有对应的Spec, 如果存在同主题的Spec，则将它们写在一起，并在最后追加 `变更历史`，记录变更的描述以及变更时间。如果不存在同主题的Spec，则新建它。

每一个spec文档保存在 `.specs/REQ-$(date +%Y%m%d)-<your-slug>.md`， 用下面的模板写出 spec

```md
## 问题陈述

用户面临的问题，从用户的视角来写。

## 解决方案

这个问题的解决方案，从用户的视角来写。 也可以包含 `输入 / 输出契约`的决策。

## 用户故事

一份很长的、带编号的用户故事清单。每条用户故事使用这个格式：

1. 作为一名 <actor>，我希望有一个 <feature>，以便 <benefit>

<user-story-example>
1. 作为一名手机银行客户，我希望能在我的账户上看到余额，以便我能对自己的支出做出更明智的决定
</user-story-example>

这份用户故事清单要极其详尽，覆盖这个功能的方方面面。

## 实现决策

一份已经做出的实现决策清单。可以包括：

- 将要构建/修改的模块
- 这些模块中将被修改的接口
- 开发者给出的技术澄清
- 架构决策
- schema 变更
- API 契约
- 具体的交互

不要写具体的文件路径或代码片段。它们很快就会过时。

例外：如果某次原型试验产出了一段代码，它比散文更精确地编码了一个决策（状态机、reducer、schema、类型形状），把它内联进相关的决策里，并简短注明它来自原型试验。裁剪到只包含承载决策的部分，不是一个能跑的演示，只要关键的片段。

## 测试决策

一份已经做出的测试决策清单。包括：

- 对"什么是好测试"的描述（只测外部行为，不测实现细节）
- 哪些模块会被测试
- 这些测试的先例（即代码库里类似的那些测试）

## 范围之外

对这份 spec 范围之外的那些事情的描述。

## 补充说明

关于这个功能的任何补充说明。
```

## todos 格式

一个 `todos` 任务是一条穿过这次改动每一层（schema、API、UI、测试）的窄而完整的路径，落地之后单独就能演示，验收。

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

哪些决策记录下来：

- **架构形态。** 比如："我们用 monorepo。""写模型采用事件溯源，读模型投影到 Postgres。"
- **上下文之间的集成方式。** 比如："Ordering 和 Billing 通过领域事件通信，而不是同步 HTTP。"
- **带来锁定的技术选择。** 比如：数据库、消息总线、认证服务商、部署目标。不是每个技术都写下来，只写那种变更代价很大的地方。
- **边界与范围的决定。** 比如："客户数据归 Customer 上下文所有，其他上下文只按 ID 引用它。"明确说不的与明确说是的同样有价值。
- **有意偏离显然的做法，特意为之。** 比如："因为 X，我们用手写 SQL 而不是 ORM。" 正常情况下不会这么开发的都记录下来。这些记录能阻止下一位工程师去"修好"一个本来刻意为之的地方。
- **代码里看不出的约束。** 比如："因为合规要求，我们不能用 AWS。" "按合作方 API 约定，响应时间必须低于 200ms。"
- **否决理由不明显的备选方案。** 比如：如果你考虑过 GraphQL，出于细微的原因选了 REST，就记下来；否则半年后又会有人提议 GraphQL。

每个记录生成顺序编号：`0001-slug`、`0002-slug`，依此类推

在 AGENTS.md记录`架构决策记录`的格式如下：

```md
## 0001-slug

### {Short title of the decision}

{1-3 句话: what's the context, what did we decide, and why.}
```

## grilling 模式

不断追问用户，直到你们之间达成共同的理解。

把需求或用户问题梳理成一棵**设计树**：每个决策都会分裂出依附于它的其他决策。

按**轮次**推进这棵树。**前沿**指所有前置条件已经定下的决策，也就是你现在就能问出口、不必去猜尚未听到的答案的那些问题。一轮之内把整个前沿全部问完：给每个问题编号，并给出你推荐的答案。然后等用户回答，再进入下一轮。

一轮按下面的格式组织：

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

每个问题的措辞都要让"是"意味着接受你推荐的答案。

用户每轮的回答会重塑这棵树：定下来的决策把前沿向外推，并解锁那些依赖它们的问题。重新计算前沿，再问下一轮。若某个问题的答案取决于本轮另一个尚未定论的问题，它属于*更晚*的一轮，而不是这一轮。

查找**真实需求和可行方案**是你的职责，绝不是用户的职责。当前沿里的问题需要从环境（文件系统、工具等）取得事实时，派一个 sub-agent（子代理）去查；凡是你自己能查到的东西，都别向用户要。也不要被它卡住：一次仍在进行的探查算作未定的前置条件，所以只有它下游的那些问题要等 sub-agent 回报；前沿的其余问题现在就问。**决策**归用户：把每个决策摆到他们面前，然后等用户选择。

前沿清空时，会话就算完成：设计树的每个分支都走查过，没有任何东西被悄悄假设。在用户确认你们已达成共同理解之前，不要动手执行。
