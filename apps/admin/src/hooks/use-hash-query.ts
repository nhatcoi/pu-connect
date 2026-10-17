import { useCallback, useEffect, useState } from 'react'

type Params = Record<string, string>

function read(): Params {
  const q = window.location.hash.split('?')[1] ?? ''
  return Object.fromEntries(new URLSearchParams(q))
}

// State bộ lọc nằm trên URL (#/users?role=ta&page=2) ⇒ F5 / chia sẻ link giữ nguyên view
export function useHashQuery(): [Params, (patch: Partial<Record<string, string | number | undefined | null>>, opts?: { resetPage?: boolean }) => void] {
  const [params, setParams] = useState<Params>(read)

  useEffect(() => {
    const onHash = () => setParams(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const update = useCallback((patch: Partial<Record<string, string | number | undefined | null>>, opts?: { resetPage?: boolean }) => {
    const next = new URLSearchParams(read())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    if (opts?.resetPage ?? true) next.delete('page')
    const path = window.location.hash.split('?')[0] || '#/'
    const qs = next.toString()
    // replaceState: gõ tìm kiếm không làm đầy lịch sử trình duyệt
    window.history.replaceState(null, '', `${path}${qs ? `?${qs}` : ''}`)
    setParams(Object.fromEntries(next))
  }, [])

  return [params, update]
}
