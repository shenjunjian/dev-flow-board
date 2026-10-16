import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const DATA_DIR = join(process.cwd(), 'data')
export const DB_PATH = join(DATA_DIR, 'board.sqlite')

/** 仓库表 */
export const repos = sqliteTable('repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  color: text('color').notNull().default('#1971c2'),
  refreshIntervalMs: integer('refresh_interval_ms').notNull().default(60000),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

/** Issue 表：联合主键 (repoId, number) */
export const issues = sqliteTable('issues', {
  repoId: integer('repo_id')
    .notNull()
    .references(() => repos.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  state: text('state').notNull(), // open | closed
  importance: text('importance').notNull().default('low'), // high | low
  taskType: text('task_type'), // feature | bug | refactor | null
  statusLabel: text('status_label'),
  column: text('board_column').notNull(), // story | dev | review | done
  assignee: text('assignee'),
  githubCreatedAt: integer('github_created_at', { mode: 'timestamp_ms' }).notNull(),
  githubUpdatedAt: integer('github_updated_at', { mode: 'timestamp_ms' }).notNull(),
  githubClosedAt: integer('github_closed_at', { mode: 'timestamp_ms' }),
  highlightUntil: integer('highlight_until', { mode: 'timestamp_ms' }),
}, table => [
  primaryKey({ columns: [table.repoId, table.number] }),
])

/** Issue 生命周期事件表：存已写好的中文句子 */
export const issueEvents = sqliteTable('issue_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  repoId: integer('repo_id').notNull(),
  number: integer('number').notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  message: text('message').notNull(),
}, table => [
  uniqueIndex('issue_events_unique').on(table.repoId, table.number, table.occurredAt, table.message),
])

/** 应用元信息（种子标记等） */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export type RepoRow = typeof repos.$inferSelect
export type IssueRow = typeof issues.$inferSelect
export type IssueEventRow = typeof issueEvents.$inferSelect

// 与上面 drizzle schema 保持一致的手写 DDL，服务启动时自动建表，不需要手跑迁移
const DDL = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#1971c2',
  refresh_interval_ms INTEGER NOT NULL DEFAULT 60000,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'low',
  task_type TEXT,
  status_label TEXT,
  board_column TEXT NOT NULL,
  assignee TEXT,
  github_created_at INTEGER NOT NULL,
  github_updated_at INTEGER NOT NULL,
  github_closed_at INTEGER,
  highlight_until INTEGER,
  PRIMARY KEY (repo_id, number)
);

CREATE TABLE IF NOT EXISTS issue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  number INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  message TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS issue_events_unique
  ON issue_events (repo_id, number, occurred_at, message);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

function createDb() {
  mkdirSync(DATA_DIR, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(DDL)
  migrateColumns(sqlite)
  const db = drizzle(sqlite)
  seedOnFirstRun(db)
  return { sqlite, db }
}

/**
 * 轻量加列迁移：老库的表是 CREATE TABLE IF NOT EXISTS 建出来的，新增列不会自动补上，
 * 这里按 table_info 检查缺哪列就 ALTER TABLE 加哪列（幂等，可重复启动）。
 */
function migrateColumns(sqlite: Database.Database): void {
  const hasColumn = (table: string, column: string): boolean =>
    (sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>).some(c => c.name === column)

  if (!hasColumn('issues', 'task_type')) {
    sqlite.exec('ALTER TABLE issues ADD COLUMN task_type TEXT')
  }
}

export type BoardDb = ReturnType<typeof createDb>

const globalForDb = globalThis as unknown as { __devFlowBoardDb?: BoardDb }

/**
 * 首次建库且 repos 为空时写入测试仓库，并在 app_meta 记下已种过；
 * 用户删掉该仓库后重启不会自动加回。
 */
function seedOnFirstRun(db: BoardDb['db']) {
  const seeded = db.select().from(appMeta).where(eq(appMeta.key, 'seeded')).get()
  if (seeded) return

  const existing = db.select({ id: repos.id }).from(repos).all()
  if (existing.length === 0) {
    const now = new Date()
    db.insert(repos).values({
      owner: 'shenjunjian',
      name: 'dev-flow-board',
      fullName: 'shenjunjian/dev-flow-board',
      sortOrder: 1,
      color: '#1971c2',
      refreshIntervalMs: 60000,
      createdAt: now,
      updatedAt: now,
    }).run()
  }
  db.insert(appMeta).values({ key: 'seeded', value: new Date().toISOString() }).run()
}

/** 获取全局单例数据库连接（开发热更新下也只保留一个，避免叠出多个连接） */
export function useDb(): BoardDb {
  if (!globalForDb.__devFlowBoardDb) {
    globalForDb.__devFlowBoardDb = createDb()
  }
  return globalForDb.__devFlowBoardDb
}
