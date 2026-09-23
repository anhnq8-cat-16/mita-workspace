// Tạo email RFC 2822 (UTF-8) để gửi qua Gmail API

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** Mã hóa tiêu đề có dấu tiếng Việt: =?UTF-8?B?...?= */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`
}

function wrap76(text: string): string {
  return text.replace(/(.{76})/g, '$1\r\n')
}

export function buildMimeMessage(opts: {
  from: string
  fromName?: string
  to: string
  subject: string
  text: string
}): string {
  const from = opts.fromName ? `${encodeHeader(opts.fromName)} <${opts.from}>` : opts.from
  return [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(opts.text)),
  ].join('\r\n')
}
