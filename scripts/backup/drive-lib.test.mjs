import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { test } from 'node:test'
import { accessToken, backupName, drive, latest, selectForDeletion } from './drive-lib.mjs'

test('tên file theo ngày Việt Nam (01:00 VN = 18:00 UTC hôm trước)', () => {
  assert.equal(backupName(new Date('2026-10-04T18:00:00Z')), '2026-10-05.sql.gz')
  assert.equal(backupName(new Date('2026-10-05T16:59:00Z')), '2026-10-05.sql.gz')
})

test('giữ 30 bản mới nhất, bỏ qua file khác', () => {
  // 33 bản liên tiếp 01/09 → 03/10
  const files = Array.from({ length: 33 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
    return { id: String(i), name: `${d}.sql.gz` }
  })
  files.push({ id: 'x', name: 'ghi-chu.txt' })
  const del = selectForDeletion(files, 30)
  assert.deepEqual(
    del.map((f) => f.name),
    ['2026-09-03.sql.gz', '2026-09-02.sql.gz', '2026-09-01.sql.gz'],
  )
  assert.equal(latest(files).name, '2026-10-03.sql.gz')
  assert.deepEqual(selectForDeletion(files.slice(0, 5), 30), [])
})

test('JWT gửi đúng tài khoản đóng vai và scope drive', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const sa = {
    client_email: 'backup@p.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }
  let sent
  const fake = async (url, init) => {
    sent = new URLSearchParams(init.body)
    return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
  }
  assert.equal(await accessToken(sa, 'sale05@mitaexport.com', fake), 'tok')
  const claims = JSON.parse(Buffer.from(sent.get('assertion').split('.')[1], 'base64url'))
  assert.equal(claims.sub, 'sale05@mitaexport.com')
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/drive')
})

test('upload resumable: tạo phiên rồi PUT nội dung, luôn supportsAllDrives', async () => {
  const calls = []
  const fake = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET' })
    if (url.includes('uploadType=resumable'))
      return new Response('', { status: 200, headers: { location: 'https://upload/session1' } })
    return new Response(JSON.stringify({ id: 'file1' }), { status: 200 })
  }
  const id = await drive('tok', fake).upload('folder', '2026-10-05.sql.gz', Buffer.from('abc'))
  assert.equal(id, 'file1')
  assert.equal(calls[0].method, 'POST')
  assert.match(calls[0].url, /supportsAllDrives=true/)
  assert.deepEqual(calls[1], { url: 'https://upload/session1', method: 'PUT' })
})
