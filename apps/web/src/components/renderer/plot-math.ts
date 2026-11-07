// Bộ tính biểu thức toán cho khối `plot` — tự viết (recursive descent), KHÔNG dùng eval / new Function.
// Biến: x, y (alias x1/x_1 → x, x2/x_2 → y). Hàm: sin cos tan … sqrt abs exp ln log min max pow. Hằng: pi, e.

export type Fn2 = (x: number, y: number) => number

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

const SUP: Record<string, string> = { '²': '^2', '³': '^3', '⁴': '^4', '¹': '^1', '⁻': '^-' }

function normalize(src: string): string {
  return src
    .replace(/[²³⁴¹]/g, (c) => SUP[c])
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/≤|⩽/g, '<=')
    .replace(/≥|⩾/g, '>=')
    .replace(/\*\*/g, '^')
    .replace(/\\(cdot|times)/g, '*')
    .replace(/\\(le|leq)\b/g, '<=')
    .replace(/\\(ge|geq)\b/g, '>=')
    .replace(/\\(sin|cos|tan|ln|log|exp|sqrt|pi)\b/g, '$1')
    .replace(/\\left|\\right/g, '')
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z_0-9]*)|(<=|>=|==|!=|[-+*/^(),<>=|]))/y
  let pos = 0
  while (pos < src.length) {
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break
      throw new Error(`Ký tự lạ: "${src.slice(pos, pos + 6)}"`)
    }
    pos = re.lastIndex
    if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) })
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] })
    else out.push({ t: 'op', v: m[3] })
  }
  return out
}

const FN1: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, cbrt: Math.cbrt
}
const FN2: Record<string, (a: number, b: number) => number> = { min: Math.min, max: Math.max, pow: Math.pow, atan2: Math.atan2, mod: (a, b) => a % b }
const CONST: Record<string, number> = { pi: Math.PI, e: Math.E }

function varIndex(name: string): 0 | 1 | -1 {
  const n = name.toLowerCase()
  if (n === 'x' || n === 'x1' || n === 'x_1') return 0
  if (n === 'y' || n === 'x2' || n === 'x_2') return 1
  return -1
}

class Parser {
  private i = 0
  constructor(private toks: Tok[]) {}
  private peek = () => this.toks[this.i]
  private isOp = (v: string) => {
    const t = this.peek()
    return t?.t === 'op' && t.v === v
  }
  done() {
    return this.i >= this.toks.length
  }
  expr(): Fn2 {
    let l = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v
      const r = this.term()
      const a = l
      l = op === '+' ? (x, y) => a(x, y) + r(x, y) : (x, y) => a(x, y) - r(x, y)
    }
    return l
  }
  private startsFactor() {
    const t = this.peek()
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))
  }
  private term(): Fn2 {
    let l = this.unary()
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as { v: string }).v
        const r = this.unary()
        const a = l
        l = op === '*' ? (x, y) => a(x, y) * r(x, y) : (x, y) => a(x, y) / r(x, y)
      } else if (this.startsFactor()) {
        const r = this.unary() // nhân ngầm: 2x, 3(x+1), x sin(x)
        const a = l
        l = (x, y) => a(x, y) * r(x, y)
      } else return l
    }
  }
  private unary(): Fn2 {
    if (this.isOp('-')) {
      this.i++
      const a = this.unary()
      return (x, y) => -a(x, y)
    }
    if (this.isOp('+')) {
      this.i++
      return this.unary()
    }
    return this.power()
  }
  private power(): Fn2 {
    const base = this.atom()
    if (this.isOp('^')) {
      this.i++
      const exp = this.unary()
      return (x, y) => Math.pow(base(x, y), exp(x, y))
    }
    return base
  }
  private atom(): Fn2 {
    const t = this.toks[this.i++]
    if (!t) throw new Error('Biểu thức thiếu vế')
    if (t.t === 'num') {
      const v = t.v
      return () => v
    }
    if (t.t === 'op') {
      if (t.v === '(') {
        const e = this.expr()
        if (!this.isOp(')')) throw new Error('Thiếu ")"')
        this.i++
        return e
      }
      if (t.v === '|') {
        const e = this.expr()
        if (!this.isOp('|')) throw new Error('Thiếu "|"')
        this.i++
        return (x, y) => Math.abs(e(x, y))
      }
      throw new Error(`Không hiểu "${t.v}"`)
    }
    const name = t.v
    const lower = name.toLowerCase()
    if (this.isOp('(') && (FN1[lower] || FN2[lower])) {
      this.i++
      const args: Fn2[] = [this.expr()]
      while (this.isOp(',')) {
        this.i++
        args.push(this.expr())
      }
      if (!this.isOp(')')) throw new Error('Thiếu ")"')
      this.i++
      const f1 = FN1[lower]
      const f2 = FN2[lower]
      if (f1) return (x, y) => f1(args[0](x, y))
      return (x, y) => f2(args[0](x, y), (args[1] ?? args[0])(x, y))
    }
    if (FN1[lower] && !this.isOp('(')) {
      // "sin x" (không ngoặc): lấy một nhân tử
      const arg = this.power()
      const f = FN1[lower]
      return (x, y) => f(arg(x, y))
    }
    if (lower in CONST) {
      const v = CONST[lower]
      return () => v
    }
    const vi = varIndex(name)
    if (vi === 0) return (x) => x
    if (vi === 1) return (_x, y) => y
    throw new Error(`Biến lạ "${name}"`)
  }
}

/** Biên dịch biểu thức một vế thành hàm (x, y) ⇒ số. Ném lỗi nếu sai cú pháp. */
export function compileExpr(src: string): Fn2 {
  const p = new Parser(tokenize(normalize(src)))
  const f = p.expr()
  if (!p.done()) throw new Error('Thừa ký tự cuối biểu thức')
  return f
}

export type Rel = '<' | '<=' | '>' | '>=' | '='

/** Tách `lhs REL rhs` (một quan hệ). */
export function splitRelation(src: string): { lhs: string; op: Rel; rhs: string } | null {
  const s = normalize(src)
  const m = /^(.*?)(<=|>=|==|<|>|=)(.*)$/.exec(s)
  if (!m) return null
  const op = (m[2] === '==' ? '=' : m[2]) as Rel
  return { lhs: m[1], op, rhs: m[3] }
}

/** Hàm f(x,y)=lhs−rhs của quan hệ (dùng vẽ đường mức f=0). */
export function compileRelation(src: string): { f: Fn2; op: Rel } {
  const r = splitRelation(src)
  if (!r) throw new Error('Thiếu dấu quan hệ (=, <=, >=, <, >)')
  const a = compileExpr(r.lhs)
  const b = compileExpr(r.rhs)
  return { f: (x, y) => a(x, y) - b(x, y), op: r.op }
}

/** Tập hợp ràng buộc ("x>=0, y>=0 && x+y<=4") ⇒ hàm kiểm tra điểm thuộc miền. */
export function compileConstraints(src: string): (x: number, y: number) => boolean {
  const parts = normalize(src)
    .split(/&&|∧|;|,|\band\b|\bvà\b/i)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new Error('Miền rỗng')
  const rels = parts.map((p) => compileRelation(p))
  return (x, y) =>
    rels.every(({ f, op }) => {
      const v = f(x, y)
      if (!Number.isFinite(v)) return false
      switch (op) {
        case '<': return v < 0
        case '<=': return v <= 1e-9
        case '>': return v > 0
        case '>=': return v >= -1e-9
        default: return Math.abs(v) < 1e-9
      }
    })
}

/** `y = x^2`, `f(x) = sin x`, `x^2` ⇒ hàm y theo x; trả null nếu là phương trình ẩn (vd x = 2, x^2+y^2=1). */
export function compileFunction(src: string): ((x: number) => number) | null {
  const s = normalize(src).trim()
  const m = /^\s*(?:y|x2|x_2|[a-zA-Z]\s*\(\s*x\s*\))\s*=(?!=)(.*)$/.exec(s)
  const body = m ? m[1] : s
  if (!m && /[<>=]/.test(s)) return null
  const f = compileExpr(body)
  return (x) => f(x, 0)
}
