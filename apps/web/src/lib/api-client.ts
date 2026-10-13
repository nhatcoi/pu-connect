export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Lỗi HTTP kèm mã trạng thái (phân biệt 401 / 4xx / 5xx khi cache & retry)
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions extends RequestInit {
  token?: string
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers = {}, ...rest } = options

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>)
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include', // Automatically send and receive session cookies
    headers: defaultHeaders,
    ...rest
  })

  if (!response.ok) {
    let errorMessage = `HTTP Error: ${response.statusText}`
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.message || errorMessage
    } catch {
      // Fallback to status text
    }
    throw new ApiError(errorMessage, response.status)
  }

  return response.json() as Promise<T>
}

export async function uploadFileToR2(
  file: File,
  folder: 'posts/images' | 'documents' | 'avatars' = 'posts/images'
): Promise<{ url: string; key: string; size: number }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/upload/file?folder=${folder}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })

  if (!response.ok) {
    let errorMessage = 'Không thể tải tệp lên máy chủ'
    try {
      const err = await response.json()
      errorMessage = err.message || errorMessage
    } catch {}
    throw new Error(errorMessage)
  }

  const result = await response.json()
  return result.data
}

