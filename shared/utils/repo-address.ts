export interface ParsedRepoAddress {
  owner: string
  name: string
}

/**
 * 解析仓库地址，接受：
 * - `owner/repo`
 * - `https://github.com/owner/repo`（可带 `.git`、末尾斜杠）
 * 返回 null 表示格式不合法。
 */
export function parseRepoAddress(input: string): ParsedRepoAddress | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  const urlMatch = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i)
  if (urlMatch) {
    const owner = urlMatch[1]
    const name = urlMatch[2]
    if (!owner || !name) return null
    return { owner, name }
  }

  const shortMatch = raw.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (shortMatch) {
    const owner = shortMatch[1]
    const name = shortMatch[2]
    if (!owner || !name) return null
    return { owner, name }
  }

  return null
}
