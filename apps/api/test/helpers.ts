import { Test } from '@nestjs/testing'
import type { NestExpressApplication } from '@nestjs/platform-express'
import * as bcrypt from 'bcryptjs'
import * as request from 'supertest'
import { randomBytes } from 'crypto'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app.setup'
import { DatabaseService } from '../src/database/database.service'
import { AiProviderRegistry } from '../src/modules/ai/ai-provider.registry'
import { LlmService } from '../src/modules/ai/llm.service'

export const PASSWORD = 'Password123!'

export async function createTestApp(): Promise<{ app: NestExpressApplication; db: DatabaseService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }))
  await app.init()
  return { app, db: app.get(DatabaseService) }
}

export type TestUser = { id: string; username: string; email: string }

// Tạo user trực tiếp trong DB (tránh rate limit đăng ký)
export async function createUser(db: DatabaseService, opts: { role?: string; status?: string } = {}): Promise<TestUser> {
  const suffix = randomBytes(4).toString('hex')
  const username = `u_${suffix}`
  const email = `${username}@example.com`
  const hash = await bcrypt.hash(PASSWORD, 4)
  const res = await db.query(
    `INSERT INTO users (email, username, password_hash, display_name, role, status, is_onboarded, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE) RETURNING id`,
    [email, username, hash, `User ${suffix}`, opts.role || 'student', opts.status || 'active']
  )
  return { id: res.rows[0].id, username, email }
}

// Agent giữ cookie pu_session sau khi đăng nhập
export async function loginAgent(app: NestExpressApplication, user: TestUser) {
  const agent = request.agent(app.getHttpServer())
  const res = await agent.post('/api/auth/login').send({ emailOrUsername: user.email, password: PASSWORD })
  if (res.status !== 200) throw new Error(`Login thất bại (${res.status}): ${JSON.stringify(res.body)}`)
  return agent
}

// LlmService tối giản cho test tự dựng McpAgentService: chat() thật chạy trên một provider giả, không DB / mạng
export function stubLlm(create: unknown): LlmService {
  const client = { chat: { completions: { create } } }
  return {
    client,
    model: 'test',
    providers: { chain: async () => [{ id: 'test', name: 'test', client, modelOverride: null, primary: true }], markDown: () => undefined },
    catalog: { find: async () => null },
    logger: { warn: () => undefined },
    isGatewayFailure: () => false,
    chat: LlmService.prototype.chat
  } as unknown as LlmService
}

// Giả gateway cho app thật: mọi lần LlmService.chat() đi qua `client` này (`client` rỗng = chỉ bật cờ "AI sẵn sàng"). Trả hàm khôi phục
export function stubProviders(app: NestExpressApplication, client: unknown): () => void {
  const registry = app.get(AiProviderRegistry)
  const chain = jest.spyOn(registry, 'chain').mockResolvedValue([{ id: 'test', name: 'test', client, modelOverride: null, primary: true }] as never)
  const primary = jest.spyOn(registry, 'primaryClient').mockReturnValue(client as never)
  return () => {
    chain.mockRestore()
    primary.mockRestore()
  }
}
