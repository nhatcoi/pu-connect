import { useCallback, useEffect, useState } from 'react'

type Params = Record<string, string>
const SYNC_EVENT = 'hashquery:change'

function read(): Params {
  const q = window.location.hash.split('?')[1] ?? ''
  return Object.fromEntries(new URLSearchParams(q))
}

// State bộ lọc nằm trên URL (#/users?role=ta&page=2) ⇒ F5 / chia sẻ link giữ nguyên view
export type SetParams = (patch: Partial<Record<string, string | number | undefined | null>>, opts?: { resetPage?: boolean; replace?: boolean }) => void

export function useHashQuery(): [Params, SetParams] {
  const [params, setParams] = useState<Params>(read)

  useEffect(() => {
    const onHash = () => setParams(read())
    window.addEventListener('hashchange', onHash)
    window.addEventListener(SYNC_EVENT, onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener(SYNC_EVENT, onHash)
    }
  }, [])

  const update = useCallback<SetParams>((patch, opts) => {
    // replace: bỏ toàn bộ tham số cũ (VD: đổi tab con)
    const next = new URLSearchParams(opts?.replace ? '' : read())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    if (opts?.resetPage ?? true) next.delete('page')
    const path = window.location.hash.split('?')[0] || '#/'
    const qs = next.toString()
    // replaceState: gõ tìm kiếm không làm đầy lịch sử trình duyệt
    window.history.replaceState(null, '', `${path}${qs ? `?${qs}` : ''}`)
    // Báo cho mọi nơi đang dùng hook (replaceState không bắn hashchange)
    window.dispatchEvent(new Event(SYNC_EVENT))
  }, [])

  return [params, update]
}
