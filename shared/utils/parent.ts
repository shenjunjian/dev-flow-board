/**
 * 从 GitHub Issue 还原父工单编号。
 * 优先用 `parent_issue_url` 末尾的 issue 号；没有则认正文首行 `Part of #N`。
 */
export function parseParentNumber(parentIssueUrl: string | null | undefined, body: string | null | undefined): number | null {
  const fromUrl = parseIssueNumber(parentIssueUrl)
  if (fromUrl !== null) return fromUrl

  const firstLine = body?.split(/\r?\n/, 1)[0]?.trim() ?? ''
  const matched = /^Part of #(\d+)$/.exec(firstLine)
  return matched ? toIssueNumber(matched[1]) : null
}

function parseIssueNumber(url: string | null | undefined): number | null {
  if (!url) return null
  const matched = /\/issues\/(\d+)\/?$/.exec(url.trim())
  return matched ? toIssueNumber(matched[1]) : null
}

function toIssueNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}
