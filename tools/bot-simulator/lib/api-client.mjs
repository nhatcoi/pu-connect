import { logger } from './logger.mjs'

export class BotApiClient {
  constructor(apiUrl, persona) {
    this.apiUrl = apiUrl.replace(/\/+$/, '')
    this.persona = persona
    this.cookie = null
    this.userId = null
    this.profile = null
    this.isLoggedIn = false
  }

  get headers() {
    const h = {
      'Content-Type': 'application/json',
      'User-Agent': 'PU-Connector-BotSimulator/1.0',
      'X-Forwarded-Proto': 'https'
    }
    if (this.cookie) {
      h['Cookie'] = this.cookie
    }
    // Set origin to match allowed origins
    if (this.apiUrl.includes('puc.vnhat.dev')) {
      h['Origin'] = 'https://puc.vnhat.dev'
    } else {
      h['Origin'] = 'http://localhost:3000'
    }
    return h
  }

  async login() {
    try {
      const res = await fetch(`${this.apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': this.apiUrl.includes('puc.vnhat.dev') ? 'https://puc.vnhat.dev' : 'http://localhost:3000',
          'X-Forwarded-Proto': 'https'
        },
        body: JSON.stringify({
          emailOrUsername: this.persona.username,
          password: this.persona.password
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Login failed with status ${res.status}: ${text}`)
      }

      // Extract session cookie
      const getSetCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
      const rawHeader = res.headers.get('set-cookie') || ''
      const allCookies = [...getSetCookie, rawHeader]

      for (const str of allCookies) {
        const match = str.match(/pu_session=[^;]+/)
        if (match) {
          this.cookie = match[0]
          break
        }
      }

      const json = await res.json()
      // TransformInterceptor might wrap in { success: true, data: ... } or return user directly
      this.profile = json.data || json
      this.userId = this.profile.id
      this.isLoggedIn = true

      logger.success(`Bot @${this.persona.username} đăng nhập thành công`, `ID: ${this.userId}`)
      return true
    } catch (err) {
      logger.error(`Bot @${this.persona.username} lỗi đăng nhập:`, err.message)
      this.isLoggedIn = false
      return false
    }
  }

  async createPost({ title = '', content, tags = [], mediaUrls = [] }) {
    if (!this.isLoggedIn) await this.login()
    const payload = {
      content,
      tags: Array.isArray(tags) ? tags : [],
      visibility: 'public'
    }
    if (title && typeof title === 'string') {
      payload.title = title.trim()
    }
    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      payload.mediaUrls = mediaUrls
    }

    const res = await fetch(`${this.apiUrl}/posts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Create post failed (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.data || data
  }

  async getRecentPosts(limit = 10) {
    if (!this.isLoggedIn) await this.login()
    const res = await fetch(`${this.apiUrl}/posts?limit=${limit}`, {
      method: 'GET',
      headers: this.headers
    })

    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  }

  async getPostComments(postId) {
    if (!this.isLoggedIn) await this.login()
    try {
      const res = await fetch(`${this.apiUrl}/posts/${postId}/comments?limit=30`, {
        method: 'GET',
        headers: this.headers
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    } catch {
      return []
    }
  }

  async toggleLike(postId) {
    if (!this.isLoggedIn) await this.login()
    const res = await fetch(`${this.apiUrl}/posts/${postId}/like`, {
      method: 'POST',
      headers: this.headers
    })
    return res.ok
  }

  async addComment(postId, { content, parentId = null }) {
    if (!this.isLoggedIn) await this.login()
    const body = { content }
    if (parentId) body.parentId = parentId

    const res = await fetch(`${this.apiUrl}/posts/${postId}/comments`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Add comment failed (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.data || data
  }

}
