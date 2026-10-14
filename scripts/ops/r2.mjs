// Upload / liệt kê / xóa / tải backup trên R2 (dùng AWS SDK sẵn trong apps/api)
// Usage: node r2.mjs put <file> <key> | list <prefix> | delete <key> | get <key> <file>
import { createRequire } from 'node:module'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(here, '../../apps/api/package.json'))
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } =
  require('@aws-sdk/client-s3')

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env
const Bucket = process.env.R2_BUCKET_NAME || 'pu-connector'
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Thiếu R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
  process.exit(2)
}
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
})

// Kiểu nội dung theo đuôi tệp ⇒ ảnh hiển thị thẳng trên trình duyệt / Content type from extension
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' }
const contentType = (file) => CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'put') {
  await s3.send(new PutObjectCommand({ Bucket, Key: b, Body: createReadStream(a), ContentType: contentType(a) }))
  console.log(`uploaded ${b}`)
} else if (cmd === 'list') {
  let token
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: a, ContinuationToken: token }))
    for (const o of r.Contents ?? []) console.log(`${o.LastModified.toISOString()}\t${o.Size}\t${o.Key}`)
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
} else if (cmd === 'delete') {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: a }))
  console.log(`deleted ${a}`)
} else if (cmd === 'get') {
  const r = await s3.send(new GetObjectCommand({ Bucket, Key: a }))
  await pipeline(r.Body, createWriteStream(b))
  console.log(`downloaded ${a} -> ${b}`)
} else {
  console.error('usage: r2.mjs put <file> <key> | list <prefix> | delete <key> | get <key> <file>')
  process.exit(1)
}
