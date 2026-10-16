import type { BoardIssue, BoardRepo } from '#shared/utils/board'
import type { IssueRow, RepoRow } from './db'

export function toBoardRepo(row: RepoRow): BoardRepo {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    fullName: row.fullName,
    sortOrder: row.sortOrder,
    color: row.color,
    refreshIntervalMs: row.refreshIntervalMs,
  }
}

export function toBoardIssue(row: IssueRow, timeline: string[]): BoardIssue {
  return {
    repoId: row.repoId,
    number: row.number,
    title: row.title,
    body: row.body ?? null,
    state: row.state as BoardIssue['state'],
    importance: row.importance as BoardIssue['importance'],
    taskType: row.taskType as BoardIssue['taskType'],
    statusLabel: row.statusLabel ?? null,
    column: row.column as BoardIssue['column'],
    assignee: row.assignee ?? null,
    createdAt: row.githubCreatedAt.toISOString(),
    updatedAt: row.githubUpdatedAt.toISOString(),
    closedAt: row.githubClosedAt ? row.githubClosedAt.toISOString() : null,
    highlightUntil: row.highlightUntil ? row.highlightUntil.toISOString() : null,
    timeline,
  }
}
