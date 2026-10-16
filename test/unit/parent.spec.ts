import { describe, expect, it } from 'vitest'
import { parseParentNumber } from '../../shared/utils/parent'

describe('parseParentNumber 父工单编号', () => {
  it('从 parent_issue_url 末尾取编号', () => {
    expect(parseParentNumber('https://api.github.com/repos/acme/board/issues/12', 'Part of #99')).toBe(12)
    expect(parseParentNumber('https://github.com/acme/board/issues/7/', null)).toBe(7)
  })

  it('没有 parent_issue_url 时认正文首行 Part of #N', () => {
    expect(parseParentNumber(null, 'Part of #42\n\n正文')).toBe(42)
    expect(parseParentNumber('', '  Part of #3  ')).toBe(3)
    expect(parseParentNumber(undefined, 'Part of #8\r\nnext')).toBe(8)
  })

  it('链接无法解析、首行不是 Part of、或编号不合法时返回 null', () => {
    expect(parseParentNumber('https://api.github.com/repos/acme/board', 'see #4')).toBeNull()
    expect(parseParentNumber(null, 'Part of #0')).toBeNull()
    expect(parseParentNumber(null, '第二行才写\nPart of #5')).toBeNull()
    expect(parseParentNumber(null, null)).toBeNull()
  })
})
