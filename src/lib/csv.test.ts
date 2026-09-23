import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('có BOM, CRLF và bỏ trống null', () => {
    expect(
      toCsv(
        ['Tên', 'Điểm'],
        [
          ['Long', 100],
          ['Kiên', null],
        ],
      ),
    ).toBe('﻿Tên,Điểm\r\nLong,100\r\nKiên,\r\n')
  })

  it('bọc ngoặc kép khi có dấu phẩy, ngoặc kép, xuống dòng', () => {
    expect(toCsv(['a'], [['x, y'], ['nói "ok"'], ['2\ndòng']])).toBe(
      '﻿a\r\n"x, y"\r\n"nói ""ok"""\r\n"2\ndòng"\r\n',
    )
  })
})
