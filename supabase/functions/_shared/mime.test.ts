import { assert, assertEquals } from 'jsr:@std/assert@1'
import { buildMimeMessage, encodeHeader } from './mime.ts'

Deno.test('tiêu đề ASCII giữ nguyên', () => {
  assertEquals(encodeHeader('Hello'), 'Hello')
})

Deno.test('tiêu đề tiếng Việt mã hóa UTF-8 base64', () => {
  const encoded = encodeHeader('[Mita Workspace] Nhắc: nộp kế hoạch')
  assert(encoded.startsWith('=?UTF-8?B?'))
  const inner = encoded.slice(10, -2)
  const bytes = Uint8Array.from(atob(inner), (c) => c.charCodeAt(0))
  assertEquals(new TextDecoder().decode(bytes), '[Mita Workspace] Nhắc: nộp kế hoạch')
})

Deno.test('thân email base64, dòng ≤ 76 ký tự', () => {
  const msg = buildMimeMessage({
    from: 'sale05@mitaexport.com',
    fromName: 'Mita Workspace',
    to: 'a@mitaexport.com',
    subject: 'Tóm tắt',
    text: 'Xin chào '.repeat(40),
  })
  const [, body] = msg.split('\r\n\r\n')
  assert(body!.split('\r\n').every((l) => l.length <= 76))
  assert(msg.includes('To: a@mitaexport.com'))
})
