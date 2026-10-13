import { Injectable, Logger } from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

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
    const endpoint =
      process.env.R2_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`
    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('R2 credentials missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) — upload sẽ lỗi')
    }

    this.bucketName = process.env.R2_BUCKET_NAME || 'pu-connector'
    this.publicUrl =
      process.env.R2_PUBLIC_URL ||
      'https://pub-66e8a07080a74cb697df1ffbf74a4ecb.r2.dev'

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

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: 'posts/images' | 'documents' | 'avatars' | 'banners' | 'chat' = 'posts/images',
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
