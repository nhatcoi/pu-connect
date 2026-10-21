// Đọc CSV / TSV (RFC 4180: ngoặc kép, dấu phân cách và xuống dòng trong ô)
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// CSV của Excel tiếng Việt thường dùng ";" ⇒ chọn dấu xuất hiện nhiều nhất ở dòng đầu
export function detectDelimiter(text: string, ext: string): string {
  if (ext === 'tsv') return '\t'
  const head = text.slice(0, text.search(/\r?\n/) === -1 ? undefined : text.search(/\r?\n/))
  return (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ','
}
