import { describe, expect, it } from 'vitest'
import { isPersonalEmail } from './invite-rules'

describe('isPersonalEmail', () => {
  const domains = ['mitaexport.com']

  it('email công ty không phải email cá nhân', () => {
    expect(isPersonalEmail('mai@mitaexport.com', domains)).toBe(false)
    expect(isPersonalEmail(' Mai@MitaExport.com ', domains)).toBe(false)
  })

  it('Gmail là email cá nhân', () => {
    expect(isPersonalEmail('nhanvien.a@gmail.com', domains)).toBe(true)
  })

  it('chưa nhập xong hoặc chưa cấu hình domain → không cảnh báo', () => {
    expect(isPersonalEmail('nhanvien', domains)).toBe(false)
    expect(isPersonalEmail('a@gmail.com', [])).toBe(false)
  })
})
