const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

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
    throw new Error(errorMessage)
  }

  return response.json() as Promise<T>
}
