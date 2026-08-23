import { Injectable, Logger } from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly publicUrl: string

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID || 'eb59f9fc900b283bd0ca9b95f52c5424'
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '1f0f71bcf52d20b5a53485dd4ab191e8'
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY ||
      '86a86954995672a6f30440dad5db7aca278ff60619203a088698c2a63c93934a'
    const endpoint =
      process.env.R2_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`

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

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: 'posts/images' | 'documents' | 'avatars' = 'posts/images',
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
      const url = `${this.publicUrl.replace(/\/$/, '')}/${key}`

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
