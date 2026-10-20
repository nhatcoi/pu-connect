import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Feed view preferences', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('defaults legacy accounts to list and persists focus across sessions without losing flags', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const before = await agent.get('/api/auth/me').expect(200)
    expect(before.body.data.preferences.feedViewMode).toBe('list')
    await agent.patch('/api/users/preferences').send({ aiSummary: false }).expect(200)
    await agent.patch('/api/users/preferences').send({ feedViewMode: 'focus' }).expect(200)
    const anotherSession = await loginAgent(app, user)
    const after = await anotherSession.get('/api/auth/me').expect(200)
    expect(after.body.data.preferences).toMatchObject({ feedViewMode: 'focus', aiSummary: false, featuredComment: true })
    const otherUser = await createUser(db)
    const otherAgent = await loginAgent(app, otherUser)
    const other = await otherAgent.get('/api/auth/me').expect(200)
    expect(other.body.data.preferences.feedViewMode).toBe('list')
  })

  it('rejects invalid modes and unauthenticated updates', async () => {
    await request(app.getHttpServer()).patch('/api/users/preferences').send({ feedViewMode: 'focus' }).expect(401)
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    for (const feedViewMode of ['invalid', true, null]) {
      await agent.patch('/api/users/preferences').send({ feedViewMode }).expect(400)
    }
    const me = await agent.get('/api/auth/me').expect(200)
    expect(me.body.data.preferences.feedViewMode).toBe('list')
  })
})
