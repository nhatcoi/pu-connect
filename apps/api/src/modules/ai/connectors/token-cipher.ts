import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// Mã hóa token connector (AES-256-GCM): iv.tag.ciphertext (base64url)
// Khóa = SHA-256(CONNECTOR_ENCRYPTION_KEY || SESSION_SECRET) ⇒ DB lộ vẫn không dùng được token
export class TokenCipher {
  private readonly key: Buffer

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest()
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
  }

  decrypt(payload: string): string {
    const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  }
}
