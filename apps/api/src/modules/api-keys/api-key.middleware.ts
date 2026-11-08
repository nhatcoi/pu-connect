import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ApiKeysService, type ApiKeyAuth } from './api-keys.service'
import { apiKeyAllows } from './api-key.scopes'
import type { UserProfile } from '@pu/schemas'

export type ApiKeyRequest = Request & { apiKey?: ApiKeyAuth }

// Authorization: Bearer puk_… ⇒ đặt req.user = chủ key (như phiên đăng nhập), nhưng giới hạn theo scope.
// Không có header Bearer ⇒ đi tiếp như thường (cookie phiên). Header sai ⇒ 401, không rơi về phiên.
export function apiKeyMiddleware(keys: ApiKeysService, loadUser: (id: string) => Promise<UserProfile | null>): RequestHandler {
  const deny = (res: Response, status: number, message: string) => res.status(status).json({ statusCode: status, message })
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header || !/^Bearer\s+/i.test(header)) return next()
    try {
      const auth = await keys.authenticate(header.replace(/^Bearer\s+/i, '').trim())
      if (!auth) return deny(res, 401, 'API key không hợp lệ, đã hết hạn hoặc bị thu hồi')
      const apiPath = req.path.replace(/^\/api\//, '')
      if (!apiKeyAllows(auth.scopes, req.method, apiPath) && !/^mcp\/?$/.test(apiPath)) {
        return deny(res, 403, 'API key không có quyền cho thao tác này')
      }
      const user = await loadUser(auth.userId)
      if (!user || user.status === 'suspended') return deny(res, 401, 'Tài khoản không khả dụng')
      ;(req as ApiKeyRequest).apiKey = auth
      req.user = user as unknown as Express.User
      next()
    } catch (err) {
      next(err)
    }
  }
}
