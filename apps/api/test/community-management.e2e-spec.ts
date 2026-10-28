import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Community, CommunityHiddenPost, CommunityMemberItem } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Cộng đồng: người dùng tạo (chờ duyệt), chủ + điều hành viên, ẩn bài, admin duyệt / gỡ
describe('Community management (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let n = 0

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  type Agent = Awaited<ReturnType<typeof loginAgent>>
  const slug = () => `cm-${Date.now().toString(36)}-${++n}`
  const verifiedUser = async () => {
    const u = await createUser(db)
    await db.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [u.id])
    return u
  }
  const create = (agent: Agent, s: string) =>
    agent.post('/api/communities').send({ slug: s, name: 'Cộng đồng thử', description: 'Mô tả cộng đồng thử nghiệm', communityType: 'club' })
  // Tạo xong, admin duyệt để cộng đồng hoạt động
  const activeCommunity = async (admin: Agent, owner: Agent, s: string) => {
    await create(owner, s).expect(200)
    const row = (await db.query(`SELECT id FROM communities WHERE slug = $1`, [s])).rows[0]
    await admin.post(`/api/admin/communities/${row.id}/approve`).expect(200)
    return row.id as string
  }

  it('điều kiện tạo: cần xác thực hoặc đủ uy tín; mới tạo ở trạng thái chờ duyệt, chỉ chủ thấy', async () => {
    const plain = await loginAgent(app, await createUser(db))
    await create(plain, slug()).expect(403)

    const reputable = await createUser(db)
    await db.query(`UPDATE users SET reputation_points = 300 WHERE id = $1`, [reputable.id])
    const rep = await loginAgent(app, reputable)
    const s = slug()
    const made = (await create(rep, s).expect(200)).body.data as Community
    expect(made).toMatchObject({ slug: s, status: 'pending', userRole: 'owner', membersCount: 1 })
    await create(rep, s).expect(409)

    // Người khác không thấy cộng đồng chờ duyệt; không join được
    await plain.get(`/api/communities/${s}`).expect(404)
    const listed = (await plain.get('/api/communities').expect(200)).body.data as Community[]
    expect(listed.find((c) => c.slug === s)).toBeUndefined()
    expect(((await rep.get('/api/communities').expect(200)).body.data as Community[]).find((c) => c.slug === s)).toBeDefined()
    await plain.post(`/api/communities/${s}/join`).expect(404)
  })

  it('loại campus bị từ chối với người thường; tối đa 3 cộng đồng mỗi người', async () => {
    const agent = await loginAgent(app, await verifiedUser())
    await agent
      .post('/api/communities')
      .send({ slug: slug(), name: 'Đại sảnh giả', description: 'Mô tả đại sảnh giả mạo', communityType: 'campus' })
      .expect(400)
    for (let i = 0; i < 3; i++) await create(agent, slug()).expect(200)
    await create(agent, slug()).expect(400)
  })

  it('admin duyệt ⇒ công khai; từ chối giữ lại ghi chú; chủ không rời được', async () => {
    const admin = await loginAgent(app, await createUser(db, { role: 'admin' }))
    const owner = await loginAgent(app, await verifiedUser())
    const s = slug()
    const id = await activeCommunity(admin, owner, s)

    const guest = await loginAgent(app, await createUser(db))
    expect(((await guest.get(`/api/communities/${s}`).expect(200)).body.data as Community).status).toBe('active')
    await guest.post(`/api/communities/${s}/join`).expect(201)
    await owner.post(`/api/communities/${s}/join`).expect(400) // chủ không rời được
    await admin.post(`/api/admin/communities/${id}/approve`).expect(404) // đã xử lý

    const s2 = slug()
    await create(owner, s2).expect(200)
    const id2 = (await db.query(`SELECT id FROM communities WHERE slug = $1`, [s2])).rows[0].id
    await admin.post(`/api/admin/communities/${id2}/reject`).send({ note: 'Trùng chủ đề' }).expect(200)
    expect((await owner.get(`/api/communities/${s2}`).expect(200)).body.data as Community).toMatchObject({ status: 'rejected', reviewNote: 'Trùng chủ đề' })
  })

  it('vai trò: chủ đặt điều hành viên; điều hành viên sửa giới thiệu, xóa thành viên thường nhưng không xóa được điều hành viên khác', async () => {
    const admin = await loginAgent(app, await createUser(db, { role: 'admin' }))
    const owner = await loginAgent(app, await verifiedUser())
    const s = slug()
    await activeCommunity(admin, owner, s)

    const modUser = await createUser(db)
    const mod2User = await createUser(db)
    const memUser = await createUser(db)
    const [mod, mod2, mem] = await Promise.all([modUser, mod2User, memUser].map((u) => loginAgent(app, u)))
    for (const a of [mod, mod2, mem]) await a.post(`/api/communities/${s}/join`).expect(201)

    // Thành viên thường không quản trị được
    await mem.patch(`/api/communities/${s}`).send({ description: 'Mô tả mới dài đủ' }).expect(403)
    await mem.get(`/api/communities/${s}/members`).expect(403)

    // Chỉ chủ đặt vai trò
    await mod.put(`/api/communities/${s}/members/${memUser.id}/role`).send({ role: 'moderator' }).expect(403)
    await owner.put(`/api/communities/${s}/members/${modUser.id}/role`).send({ role: 'moderator' }).expect(200)
    await owner.put(`/api/communities/${s}/members/${mod2User.id}/role`).send({ role: 'moderator' }).expect(200)
    await owner.put(`/api/communities/${s}/members/${modUser.id}/role`).send({ role: 'owner' }).expect(400)

    // Điều hành viên sửa mô tả / quy tắc / ảnh bìa; không sửa được tên
    const updated = (
      await mod
        .patch(`/api/communities/${s}`)
        .send({ description: 'Mô tả mới của cộng đồng', rules: [{ title: 'Lịch sự', desc: 'Không công kích' }], bannerUrl: 'https://example.com/b.png' })
        .expect(200)
    ).body.data as Community
    expect(updated).toMatchObject({ description: 'Mô tả mới của cộng đồng', bannerUrl: 'https://example.com/b.png' })
    expect(updated.rules).toHaveLength(1)
    await mod.patch(`/api/communities/${s}`).send({ name: 'Tên khác' }).expect(400)
    await mod.patch(`/api/communities/${s}`).send({}).expect(400)

    const list = (await mod.get(`/api/communities/${s}/members`).expect(200)).body.data as { items: CommunityMemberItem[]; total: number }
    expect(list.total).toBe(4)
    expect(list.items.map((m) => m.role).slice(0, 3)).toEqual(['owner', 'moderator', 'moderator'])

    // Điều hành viên: xóa được thành viên thường, không xóa được điều hành viên / chủ
    await mod.delete(`/api/communities/${s}/members/${mod2User.id}`).expect(403)
    await mod
      .delete(
        `/api/communities/${s}/members/${(await db.query(`SELECT user_id FROM community_members WHERE community_id = (SELECT id FROM communities WHERE slug = $1) AND role = 'owner'`, [s])).rows[0].user_id}`
      )
      .expect(403)
    const removed = (await mod.delete(`/api/communities/${s}/members/${memUser.id}`).expect(200)).body.data
    expect(removed.membersCount).toBe(3)
    // Chủ xóa được điều hành viên; gỡ vai trò về thành viên
    await owner.put(`/api/communities/${s}/members/${mod2User.id}/role`).send({ role: 'member' }).expect(200)
  })

  it('ẩn bài vi phạm: ẩn khỏi bảng tin cộng đồng, thông báo tác giả, khôi phục được; bài ngoài cộng đồng không ẩn được', async () => {
    const admin = await loginAgent(app, await createUser(db, { role: 'admin' }))
    const owner = await loginAgent(app, await verifiedUser())
    const s = slug()
    await activeCommunity(admin, owner, s)
    const authorUser = await createUser(db)
    const author = await loginAgent(app, authorUser)
    await author.post(`/api/communities/${s}/join`).expect(201)

    const postId = (await author.post('/api/posts').send({ content: 'Bài quảng cáo vi phạm', communitySlug: s }).expect(201)).body.data.id as string
    const outside = (await author.post('/api/posts').send({ content: 'Bài ngoài cộng đồng' }).expect(201)).body.data.id as string
    const feed = async () => ((await author.get(`/api/communities/${s}/posts`).expect(200)).body.data as { id: string }[]).map((p) => p.id)
    expect(await feed()).toContain(postId)
    const count = async () => (await db.query(`SELECT posts_count FROM communities WHERE slug = $1`, [s])).rows[0].posts_count as number
    expect(await count()).toBe(1) // bài ngoài cộng đồng không tính

    await author.post(`/api/communities/${s}/posts/${postId}/hide`).send({}).expect(403) // tác giả không phải điều hành viên
    await owner.post(`/api/communities/${s}/posts/${outside}/hide`).send({}).expect(404)
    await owner.post(`/api/communities/${s}/posts/${postId}/hide`).send({ reason: 'Quảng cáo' }).expect(200)
    expect(await feed()).not.toContain(postId)
    expect(await count()).toBe(0)

    const hidden = (await owner.get(`/api/communities/${s}/hidden-posts`).expect(200)).body.data as CommunityHiddenPost[]
    expect(hidden).toHaveLength(1)
    expect(hidden[0]).toMatchObject({ id: postId, hiddenReason: 'Quảng cáo' })
    const notice = await db.query(`SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'account_notice' AND title LIKE '%đã bị ẩn%'`, [
      authorUser.id
    ])
    expect(notice.rowCount).toBe(1)

    await owner.delete(`/api/communities/${s}/posts/${postId}/hide`).expect(200)
    expect(await feed()).toContain(postId)
    expect(await count()).toBe(1)

    // Bài do admin hệ thống ẩn: điều hành viên không khôi phục được
    await admin.post(`/api/admin/posts/${postId}/hide`).send({ reason: 'vi phạm' }).expect(200)
    await owner.delete(`/api/communities/${s}/posts/${postId}/hide`).expect(404)
  })

  it('admin: tạo thẳng (hoạt động ngay, đặt chủ), chuyển chủ, gỡ cộng đồng giữ bài viết', async () => {
    const admin = await loginAgent(app, await createUser(db, { role: 'admin' }))
    const plain = await loginAgent(app, await createUser(db))
    await plain.post('/api/admin/communities').send({}).expect(403)

    const ownerUser = await createUser(db)
    const newOwner = await createUser(db)
    const s = slug()
    const id = (
      await admin
        .post('/api/admin/communities')
        .send({ slug: s, name: 'Khoa Toán', description: 'Cộng đồng khoa toán học', communityType: 'faculty', ownerUsername: ownerUser.username })
        .expect(200)
    ).body.data.id as string
    await admin.post('/api/admin/communities').send({ slug: s, name: 'Khoa Toán', description: 'Cộng đồng khoa toán học' }).expect(409)

    const row = async () => (await db.query(`SELECT status, members_count FROM communities WHERE id = $1`, [id])).rows[0]
    expect(await row()).toMatchObject({ status: 'active', members_count: 1 })

    await admin.put(`/api/admin/communities/${id}/owner`).send({ username: newOwner.username }).expect(200)
    const roles = (await db.query(`SELECT user_id, role FROM community_members WHERE community_id = $1`, [id])).rows
    expect(roles.find((r) => r.user_id === newOwner.id)?.role).toBe('owner')
    expect(roles.find((r) => r.user_id === ownerUser.id)?.role).toBe('moderator')
    expect(await row()).toMatchObject({ members_count: 2 })

    const owner = await loginAgent(app, newOwner)
    const postId = (await owner.post('/api/posts').send({ content: 'Bài trong khoa toán', communitySlug: s }).expect(201)).body.data.id as string
    const list = (await admin.get('/api/admin/communities').query({ status: 'active', q: s }).expect(200)).body
    expect(list.data.items[0]).toMatchObject({ slug: s, status: 'active', ownerName: expect.any(String) })

    await admin.delete(`/api/admin/communities/${id}`).expect(200)
    await owner.get(`/api/communities/${s}`).expect(404)
    expect((await db.query(`SELECT community_id FROM posts WHERE id = $1`, [postId])).rows[0].community_id).toBeNull()
  })
})
