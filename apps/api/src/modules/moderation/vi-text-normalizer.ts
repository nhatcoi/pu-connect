// Tầng 1 kiểm duyệt: chuẩn hóa tiếng Việt để chống lách luật (d1t, đ.m.m, l0n, địttttt, đ m m...).
// Thuần hàm, không phụ thuộc Nest/DB.

export interface NormToken {
  /** NFC, lowercase, đã bỏ ký tự chèn + leet nội từ. */
  value: string
  /** `value` thu gọn chữ lặp liền kề (địtt → địt). Dùng để so khớp có dấu. */
  key: string
  /** `value` bỏ dấu + đ→d, thu gọn chữ lặp. Dùng để so khớp không dấu. */
  plainKey: string
  /** Token gốc có dấu thanh/mũ hoặc đ. */
  hasMarks: boolean
  /** Token bị biến đổi bởi leet / ký tự chèn / ghép chữ rời / kéo dài. */
  altered: boolean
}

// Ký tự hay bị chèn giữa các chữ để lách luật
const SEPARATORS = /[.\-_*'`~·•+]/gu
// Leet chỉ áp dụng khi nằm GIỮA hai chữ cái (l0n, d1t) — không đụng "5 dm", "2k5"
const LEET_MAP: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }
const LEET_INNER = /(?<=\p{L})[013457@$!](?=\p{L})/gu
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

export function stripMarks(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
}

/** Thu gọn chữ lặp liền kề: "địtt" → "địt", "vclll" → "vcl". */
export function dedupe(s: string): string {
  return s.replace(/(\p{L})\1+/gu, '$1')
}

function isSingleLetter(raw: string): boolean {
  const letters = raw.replace(SEPARATORS, '').replace(/[^\p{L}]/gu, '')
  return letters.length === 1 && raw.replace(/[^\p{L}\p{N}]/gu, '').length === 1
}

export function normalize(input: string): NormToken[] {
  const rawTokens = input
    .normalize('NFC')
    .toLowerCase()
    .split(/\s+/u)
    .map(t => t.replace(EDGE_PUNCT, ''))
    .filter(Boolean)

  // Ghép dãy ≥2 token 1 chữ ("đ m m", "d.i.t") thành 1 token
  const merged: { text: string; joined: boolean }[] = []
  for (let i = 0; i < rawTokens.length; ) {
    if (isSingleLetter(rawTokens[i])) {
      let j = i
      while (j < rawTokens.length && isSingleLetter(rawTokens[j])) j++
      if (j - i >= 2) {
        merged.push({ text: rawTokens.slice(i, j).join('').replace(/[^\p{L}\p{N}]/gu, ''), joined: true })
        i = j
        continue
      }
    }
    merged.push({ text: rawTokens[i], joined: false })
    i++
  }

  return merged.map(({ text, joined }) => {
    let v = text.replace(LEET_INNER, c => LEET_MAP[c] ?? c)
    v = v.replace(SEPARATORS, '')
    const key = dedupe(v)
    const hasMarks = stripMarks(v) !== v
    return {
      value: v,
      key,
      plainKey: dedupe(stripMarks(v)),
      hasMarks,
      altered: joined || v !== text || key !== v
    }
  })
}
