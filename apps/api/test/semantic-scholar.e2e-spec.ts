import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { SemanticScholarService } from '../src/modules/ai/connectors/semantic-scholar.service'
import { AiRetrieval } from '../src/modules/ai/ai.retrieval'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Semantic Scholar Academic Connector (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let s2Service: SemanticScholarService
  let aiRetrieval: AiRetrieval

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    s2Service = app.get(SemanticScholarService)
    aiRetrieval = app.get(AiRetrieval)
  })

  afterAll(async () => {
    await app.close()
  })

  describe('SemanticScholarService unit logic', () => {
    it('returns empty array on empty or blank query', async () => {
      expect(await s2Service.search('')).toEqual([])
      expect(await s2Service.search('   \n\t  ')).toEqual([])
    })

    it('parses Semantic Scholar API response into Source objects with type paper', async () => {
      const originalFetch = globalThis.fetch
      try {
        globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
          if (typeof url === 'string' && url.includes('api.semanticscholar.org')) {
            return {
              ok: true,
              json: async () => ({
                data: [
                  {
                    paperId: 's2-test-123',
                    title: 'Attention Is All You Need',
                    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
                    authors: [{ name: 'Ashish Vaswani' }, { name: 'Noam Shazeer' }],
                    year: 2017,
                    citationCount: 120000,
                    openAccessPdf: { url: 'https://arxiv.org/pdf/1706.03762' },
                    url: 'https://www.semanticscholar.org/paper/s2-test-123',
                    venue: 'NeurIPS 2017'
                  }
                ]
              })
            } as Response
          }
          return { ok: false, status: 404 } as Response
        })

        const sources = await s2Service.search('transformer attention', 3)
        expect(sources).toHaveLength(1)
        expect(sources[0]).toMatchObject({
          type: 'paper',
          id: 'https://www.semanticscholar.org/paper/s2-test-123',
          title: 'Attention Is All You Need (2017)'
        })
        expect(sources[0].body).toContain('Tác giả: Ashish Vaswani, Noam Shazeer')
        expect(sources[0].body).toContain('Số trích dẫn: 120,000 lượt')
        expect(sources[0].body).toContain('Link PDF: https://arxiv.org/pdf/1706.03762')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('falls back to arXiv Atom XML when Semantic Scholar returns 429 or errors', async () => {
      const originalFetch = globalThis.fetch
      try {
        globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
          if (typeof url === 'string' && url.includes('api.semanticscholar.org')) {
            return { ok: false, status: 429 } as Response
          }
          if (typeof url === 'string' && url.includes('export.arxiv.org')) {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <published>2023-01-01T12:00:00Z</published>
    <title>Deep Learning in Higher Education: A Comprehensive Survey</title>
    <summary>This survey explores recent advances in deep learning applied to university systems.</summary>
    <author><name>Nguyen Van A</name></author>
    <author><name>Tran Thi B</name></author>
    <link title="pdf" href="http://arxiv.org/pdf/2301.00001v1" rel="related" type="application/pdf"/>
    <arxiv:primary_category term="cs.AI"/>
  </entry>
</feed>`
            return {
              ok: true,
              text: async () => xml
            } as Response
          }
          return { ok: false, status: 404 } as Response
        })

        const sources = await s2Service.search('deep learning higher education', 2)
        expect(sources).toHaveLength(1)
        expect(sources[0]).toMatchObject({
          type: 'paper',
          id: 'http://arxiv.org/abs/2301.00001v1',
          title: 'Deep Learning in Higher Education: A Comprehensive Survey (2023)'
        })
        expect(sources[0].body).toContain('Tác giả: Nguyen Van A, Tran Thi B')
        expect(sources[0].body).toContain('Nơi công bố: arXiv:cs.AI')
        expect(sources[0].body).toContain('Link PDF: http://arxiv.org/pdf/2301.00001v1')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('handles getPaper gracefully when found or not found', async () => {
      const originalFetch = globalThis.fetch
      try {
        globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
          if (typeof url === 'string' && url.includes('paper/found-id')) {
            return {
              ok: true,
              json: async () => ({
                paperId: 'found-id',
                title: 'Specific Paper',
                abstract: 'Summary here',
                authors: [{ name: 'Researcher X' }],
                year: 2024
              })
            } as Response
          }
          return { ok: false, status: 404 } as Response
        })

        const found = await s2Service.getPaper('found-id')
        expect(found).toMatchObject({
          type: 'paper',
          title: 'Specific Paper (2024)'
        })

        const notFound = await s2Service.getPaper('missing-id')
        expect(notFound).toBeNull()
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('AiRetrieval routing integration', () => {
    it('retrieves academic papers when semantic_scholar is in activeConnectors', async () => {
      const spy = jest.spyOn(s2Service, 'search').mockResolvedValueOnce([
        {
          type: 'paper',
          id: 'https://arxiv.org/abs/2101.00001',
          title: 'Retrieval Augmented Generation for Students (2021)',
          body: 'Tác giả: Le Van C\nNăm xuất bản: 2021\nNơi công bố: arXiv:cs.CL\nAbstract: Efficient RAG pipelines.'
        }
      ])

      const result = await aiRetrieval.retrieve('RAG for students', 'test-user', {
        connectors: ['semantic_scholar']
      })

      expect(spy).toHaveBeenCalledWith('RAG for students', 3)
      expect(result.sources.some((s) => s.type === 'paper' && s.title.includes('Retrieval Augmented Generation'))).toBe(true)
      spy.mockRestore()
    })
  })

  describe('API endpoints integration', () => {
    it('lists semantic_scholar as a public, connected connector in GET /api/ai/connectors', async () => {
      const user = await createUser(db)
      const agent = await loginAgent(app, user)

      const res = await agent.get('/api/ai/connectors').expect(200)
      const list = res.body.data
      const s2 = list.find((c: { id: string }) => c.id === 'semantic_scholar')
      expect(s2).toBeDefined()
      expect(s2).toMatchObject({
        id: 'semantic_scholar',
        name: 'Semantic Scholar',
        requiresAuth: false,
        connected: true,
        available: true
      })
    })

    it('allows updating defaultConnectors with semantic_scholar in PATCH /api/ai/settings', async () => {
      const user = await createUser(db)
      const agent = await loginAgent(app, user)

      const patch = await agent
        .patch('/api/ai/settings')
        .send({
          defaultConnectors: ['library', 'semantic_scholar']
        })
        .expect(200)

      expect(patch.body.data.defaultConnectors).toContain('semantic_scholar')
    })
  })
})
