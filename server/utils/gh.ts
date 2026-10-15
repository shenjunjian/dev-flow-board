import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// --paginate --slurp 拉整仓 Issue 时输出可能很大
const MAX_BUFFER = 64 * 1024 * 1024

export interface GhCheck {
  ok: boolean
  message: string
}

/** gh 调用错误：message 可直接展示给用户 */
export class GhError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GhError'
  }
}

function toGhError(err: unknown): GhError {
  const e = err as NodeJS.ErrnoException & { stderr?: string }
  if (e.code === 'ENOENT') {
    return new GhError('未找到 gh 命令，请先安装 GitHub CLI（https://cli.github.com/）')
  }
  const stderr = (e.stderr ?? '').trim()
  if (stderr) {
    return new GhError(`gh 调用失败：${stderr.split('\n')[0]}`)
  }
  const message = (e.message ?? '').trim()
  return new GhError(message ? `gh 调用失败：${message}` : 'gh 调用失败：未知错误')
}

/** 用 execFile 调 gh（不经过 shell），返回 stdout */
export async function ghExec(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: MAX_BUFFER })
    return stdout
  }
  catch (err) {
    throw toGhError(err)
  }
}

/** 调 gh 并把 stdout 解析为 JSON */
export async function ghJson<T = unknown>(args: string[]): Promise<T> {
  const stdout = await ghExec(args)
  try {
    return JSON.parse(stdout) as T
  }
  catch {
    throw new GhError('gh 返回的内容不是合法 JSON')
  }
}

/** 检查 gh 是否可用且已登录 */
export async function checkGhAuth(): Promise<GhCheck> {
  try {
    await execFileAsync('gh', ['auth', 'status'])
    return { ok: true, message: '' }
  }
  catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return { ok: false, message: '未找到 gh 命令，请先安装 GitHub CLI（https://cli.github.com/）' }
    }
    return { ok: false, message: 'gh 未登录或登录已失效，请先运行 gh auth login' }
  }
}
