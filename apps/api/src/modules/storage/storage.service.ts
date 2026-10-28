import { Injectable, Logger } from '@nestjs/common'
import { Readable } from 'node:stream'
import { S3Client, PutObjectCommand, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3'

export type UploadFolder = 'posts/images' | 'documents' | 'avatars' | 'banners' | 'chat'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly publicUrl: string

  constructor() {
    // Credentials R2 chỉ lấy từ env (.env / systemd EnvironmentFile), không hardcode
    const accountId = process.env.R2_ACCOUNT_ID || ''
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`
    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('R2 credentials missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) — upload sẽ lỗi')
    }

    this.bucketName = process.env.R2_BUCKET_NAME || 'pu-connector'
    this.publicUrl = process.env.R2_PUBLIC_URL || 'https://pub-66e8a07080a74cb697df1ffbf74a4ecb.r2.dev'

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
  }

  // URL công khai của 1 key trên R2 (dùng để kiểm tra tệp đính kèm)
  publicUrlFor(key: string): string {
    return `${this.publicUrl.replace(/\/$/, '')}/${key}`
  }

  // Ngược lại của publicUrlFor: key của một URL R2 của hệ thống; URL ngoài ⇒ null
  keyFromUrl(url: string): string | null {
    const base = `${this.publicUrl.replace(/\/$/, '')}/`
    if (!url.startsWith(base)) return null
    const key = url.slice(base.length).split('?')[0]
    return key && !key.includes('..') ? key : null
  }

  // Key do chính user tải lên thư mục này? (chặn gắn tệp người khác / URL ngoài) / Ownership check
  isOwnedKey(key: string, folder: UploadFolder, userId: string): boolean {
    return key.startsWith(`${folder}/${userId}/`) && !key.includes('..')
  }

  // Đọc 1 tệp từ R2 (cho trình xem trong app: R2 public không bật CORS nên trình duyệt không tự tải byte được); không có ⇒ null
  async readObject(key: string): Promise<{ body: Readable; size?: number } | null> {
    try {
      const out = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
      return out.Body ? { body: out.Body as Readable, size: out.ContentLength } : null
    } catch (error: any) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null
      throw error
    }
  }

  // Xóa nhiều key (≤ 1000 / lệnh, chuẩn S3); lỗi chỉ ghi log — dọn tệp là best-effort
  async deleteObjects(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000)
      try {
        await this.s3Client.send(new DeleteObjectsCommand({ Bucket: this.bucketName, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }))
      } catch (error: any) {
        this.logger.warn(`Xóa ${batch.length} tệp R2 thất bại: ${error?.message}`)
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: UploadFolder = 'posts/images',
    userId?: string
  ): Promise<{ url: string; key: string; size: number }> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const userPrefix = userId ? `${userId}/` : ''
    const key = `${folder}/${userPrefix}${timestamp}_${randomSuffix}_${cleanFileName}`

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType
      })

      await this.s3Client.send(command)
      const url = this.publicUrlFor(key)

      this.logger.log(`Uploaded file to R2 successfully: ${url}`)
      return {
        url,
        key,
        size: fileBuffer.length
      }
    } catch (error: any) {
      this.logger.error(`Failed to upload file to Cloudflare R2: ${error.message}`, error.stack)
      throw error
    }
  }
}
