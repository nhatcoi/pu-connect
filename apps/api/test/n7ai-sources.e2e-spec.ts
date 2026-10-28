import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { StorageService } from '../src/modules/storage/storage.service'
import { createTestApp, createUser, loginAgent } from './helpers'

const PDF = 'application/pdf'

// Tài liệu của cuộc trò chuyện N7AI / thư viện (docs/core/24-n7ai-sources.md)
describe('N7AI sources (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('văn bản dán: thêm vào thread · liệt kê · đọc nội dung · xóa', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id

    const added = (await agent.post('/api/ai/sources').send({ type: 'text', threadId, content: 'Định lý Pythagoras: a² + b² = c²\nVí dụ…' }).expect(201)).body.data
    expect(added).toMatchObject({ kind: 'text', threadId, title: 'Định lý Pythagoras: a² + b² = c²', attachment: null })

    const listed = (await agent.get(`/api/ai/sources?threadId=${threadId}`).expect(200)).body.data
    expect(listed.map((s: { id: string }) => s.id)).toEqual([added.id])
    expect((await agent.get('/api/ai/sources').expect(200)).body.data).toEqual([]) // thư viện riêng, không lẫn

    expect((await agent.get(`/api/ai/sources/${added.id}/content`).expect(200)).body.data.content).toContain('Pythagoras')
    await agent.delete(`/api/ai/sources/${added.id}`).expect(200)
    await agent.delete(`/api/ai/sources/${added.id}`).expect(404)
  })

  it('kiểm tra dữ liệu: nội dung rỗng · liên kết sai · tệp không phải của mình · định dạng không đọc được', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const mine = `chat/${user.id}/1_abc_bai.pdf`

    await agent.post('/api/ai/sources').send({ type: 'text', content: '   ' }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'link', url: 'không phải url' }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'link', url: 'http://127.0.0.1/secret' }).expect(422) // chặn địa chỉ nội bộ (SSRF)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: 'chat/someone-else/x.pdf', name: 'x.pdf', size: 10, mime: PDF } }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: `chat/${user.id}/../x.pdf`, name: 'x.pdf', size: 10, mime: PDF } }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: `chat/${user.id}/1_abc_nen.zip`, name: 'nen.zip', size: 10, mime: 'application/zip' } }).expect(400)

    const file = (await agent.post('/api/ai/sources').send({ type: 'file', file: { key: mine, name: 'bai.pdf', size: 10, mime: PDF } }).expect(201)).body.data
    expect(file).toMatchObject({ kind: 'file', threadId: null, attachment: { key: mine, name: 'bai.pdf', mime: PDF } })
    const again = (await agent.post('/api/ai/sources').send({ type: 'file', file: { key: mine, name: 'bai.pdf', size: 10, mime: PDF } }).expect(201)).body.data
    expect(again.id).toBe(file.id) // thêm lại cùng tệp ⇒ không trùng
  })

  it('thêm tài liệu thư viện vào thread (copy) · giới hạn số lượng · không dùng của người khác', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const threadId = (await ownerAgent.post('/api/ai/threads').expect(200)).body.data.id
    const library = (await ownerAgent.post('/api/ai/sources').send({ type: 'text', title: 'Ghi chú', content: 'Nội dung ghi chú' }).expect(201)).body.data

    const copied = (await ownerAgent.post('/api/ai/sources').send({ type: 'copy', threadId, sourceId: library.id }).expect(201)).body.data
    expect(copied).toMatchObject({ threadId, kind: 'text', title: 'Ghi chú' })
    expect(copied.id).not.toBe(library.id)

    await otherAgent.post('/api/ai/sources').send({ type: 'copy', threadId, sourceId: library.id }).expect(404) // thread không phải của mình
    await otherAgent.get(`/api/ai/sources?threadId=${threadId}`).expect(404)
    await otherAgent.delete(`/api/ai/sources/${copied.id}`).expect(404)
    await otherAgent.get(`/api/ai/sources/${copied.id}/content`).expect(404)

    for (let i = 1; i < 30; i++) await ownerAgent.post('/api/ai/sources').send({ type: 'text', threadId, title: `t${i}`, content: `nội dung ${i}` }).expect(201)
    await ownerAgent.post('/api/ai/sources').send({ type: 'text', threadId, content: 'quá giới hạn' }).expect(400)
  })
  // Tài liệu từ kho (documents) và bộ sưu tập: chỉ đọc được bản công khai / của mình, tệp không sao chép
  it('tài liệu trong kho và bộ sưu tập: thêm một tài liệu · thêm cả bộ · chặn tài liệu riêng của người khác', async () => {
    const storage = app.get(StorageService)
    const owner = await createUser(db)
    const reader = await createUser(db)
    const agent = await loginAgent(app, reader)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id

    const doc = async (title: string, file: string, mime: string, visibility: string) =>
      (
        await db.query(
          `INSERT INTO documents (owner_id, title, file_url, file_size, mime_type, visibility, status) VALUES ($1, $2, $3, 1000, $4, $5, 'published') RETURNING id`,
          [owner.id, title, storage.publicUrlFor(`documents/${owner.id}/${file}`), mime, visibility]
        )
      ).rows[0].id as string
    const pub = await doc('Giải tích 1', '1_gt1.pdf', PDF, 'public')
    const priv = await doc('Bí mật', '2_bm.pdf', PDF, 'private')
    const zip = await doc('Nén', '3_nen.zip', 'application/zip', 'public')

    const added = (await agent.post('/api/ai/sources').send({ type: 'document', threadId, documentId: pub }).expect(201)).body.data
    expect(added).toMatchObject({ kind: 'file', threadId, meta: { documentId: pub }, attachment: { key: `documents/${owner.id}/1_gt1.pdf`, mime: PDF } })
    expect((await agent.post('/api/ai/sources').send({ type: 'document', threadId, documentId: pub }).expect(201)).body.data.id).toBe(added.id) // thêm lại ⇒ không trùng
    await agent.post('/api/ai/sources').send({ type: 'document', threadId, documentId: priv }).expect(404) // riêng tư của người khác
    await agent.post('/api/ai/sources').send({ type: 'document', threadId, documentId: zip }).expect(400) // định dạng chưa đọc được

    const thread1 = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const copied = (await agent.post('/api/ai/sources').send({ type: 'copy', threadId: thread1, sourceId: added.id }).expect(201)).body.data
    expect(copied.attachment.key).toBe(added.attachment.key) // nhân bản tệp kho giữ nguyên key

    const col = async (visibility: string) => {
      const id = (await db.query(`INSERT INTO document_collections (owner_id, title, visibility) VALUES ($1, 'Ôn thi', $2) RETURNING id`, [owner.id, visibility])).rows[0].id as string
      for (const d of [pub, priv, zip]) await db.query(`INSERT INTO document_collection_items (collection_id, document_id) VALUES ($1, $2)`, [id, d])
      return id
    }
    // Thread rỗng được dùng lại ⇒ thêm bộ vào thư viện (không threadId) để không lẫn với tài liệu đã thêm ở trên
    const res = (await agent.post('/api/ai/sources/collection').send({ collectionId: await col('public') }).expect(201)).body.data
    expect(res).toEqual({ added: 1, skipped: 1 }) // tài liệu riêng không thấy; zip chưa đọc được ⇒ bỏ qua
    await agent.post('/api/ai/sources/collection').send({ collectionId: await col('private') }).expect(404) // bộ riêng của người khác
  })
  it('giữ tệp N7AI vào Kho của tôi: tạo tài liệu riêng tư một lần · văn bản không lưu được · tệp từ kho chỉ lưu tham chiếu', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const file = (await agent.post('/api/ai/sources').send({ type: 'file', file: { key: `chat/${user.id}/1_abc_de-cuong.pdf`, name: 'de-cuong.pdf', size: 1234, mime: PDF } }).expect(201)).body.data

    const saved = (await agent.post(`/api/ai/sources/${file.id}/to-library`).expect(201)).body.data
    expect(saved.created).toBe(true)
    const doc = (await db.query(`SELECT visibility, status, owner_id FROM documents WHERE id = $1`, [saved.documentId])).rows[0]
    expect(doc).toMatchObject({ visibility: 'private', status: 'published', owner_id: user.id })
    expect((await db.query(`SELECT 1 FROM library_items WHERE owner_id = $1 AND document_id = $2`, [user.id, saved.documentId])).rowCount).toBe(1)
    expect((await agent.post(`/api/ai/sources/${file.id}/to-library`).expect(201)).body.data).toEqual({ documentId: saved.documentId, created: false }) // lưu lại ⇒ không trùng

    const text = (await agent.post('/api/ai/sources').send({ type: 'text', content: 'ghi chú' }).expect(201)).body.data
    await agent.post(`/api/ai/sources/${text.id}/to-library`).expect(400)
    const other = await loginAgent(app, await createUser(db))
    await other.post(`/api/ai/sources/${file.id}/to-library`).expect(404)
  })
})
