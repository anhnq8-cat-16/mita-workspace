#!/usr/bin/env node
// Backup lên Shared Drive "MITA Backup" (thư mục db/). Dùng trong GitHub Actions.
//   node scripts/backup/backup.mjs upload <file.sql.gz>     → db/<YYYY-MM-DD>.sql.gz, giữ BACKUP_KEEP bản
//   node scripts/backup/backup.mjs download-latest <out>     → tải bản mới nhất (để thử khôi phục)
// Biến môi trường: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SYSTEM_USER, BACKUP_DRIVE_FOLDER_ID,
//                  BACKUP_KEEP (mặc định 30)
import { readFile, writeFile } from 'node:fs/promises'
import { accessToken, backupName, drive, latest, selectForDeletion } from './drive-lib.mjs'

function env(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Thiếu biến môi trường ${name} (xem docs/van-hanh.md – Backup)`)
  return v
}

const [cmd, file] = process.argv.slice(2)
const token = await accessToken(env('GOOGLE_SERVICE_ACCOUNT_JSON'), env('GOOGLE_SYSTEM_USER'))
const d = drive(token)
const dbFolder = await d.ensureFolder(env('BACKUP_DRIVE_FOLDER_ID'), 'db')

if (cmd === 'upload' && file) {
  const bytes = await readFile(file)
  if (bytes.length < 1024)
    throw new Error(`File backup quá nhỏ (${bytes.length} byte) – dump có lỗi?`)
  const name = backupName()
  const before = await d.list(dbFolder)
  const id = await d.upload(dbFolder, name, bytes)
  console.log(`Đã tải lên db/${name} (${(bytes.length / 1024 / 1024).toFixed(2)} MB, id ${id})`)
  // Chạy lại trong ngày: bản cũ cùng tên vào thùng rác
  for (const f of before.filter((f) => f.name === name)) await d.trash(f.id)
  const keep = Number(process.env.BACKUP_KEEP ?? 30)
  for (const f of selectForDeletion(await d.list(dbFolder), keep)) {
    await d.trash(f.id)
    console.log(`Đưa vào thùng rác bản cũ: ${f.name}`)
  }
} else if (cmd === 'download-latest' && file) {
  const f = latest(await d.list(dbFolder))
  if (!f) throw new Error('Chưa có bản backup nào trong MITA Backup/db')
  await writeFile(file, await d.download(f.id))
  console.log(`Đã tải ${f.name} → ${file}`)
} else {
  console.error('Cách dùng: backup.mjs upload <file> | download-latest <out>')
  process.exit(2)
}
