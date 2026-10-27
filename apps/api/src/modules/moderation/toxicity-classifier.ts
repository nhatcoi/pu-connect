import { Logger } from '@nestjs/common'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface ToxicityScores {
  clean: number
  offense: number
  hate: number
}

/** Tầng 2: bộ phân loại 3 lớp (clean/offense/hate). Tách interface để thay được bằng sidecar sau này. */
export interface ToxicityClassifier {
  classify(text: string): Promise<ToxicityScores>
}

const MAX_TOKENS = 128

/** ViSoBERT (fine-tune ViHSD) xuất ONNX int8; chạy trong tiến trình Node. Thứ tự nhãn: 0 clean, 1 offense, 2 hate. */
export class OnnxToxicityClassifier implements ToxicityClassifier {
  private readonly logger = new Logger(OnnxToxicityClassifier.name)
  private ready: Promise<{ session: any; tokenizer: any; ort: any }> | null = null

  constructor(private readonly modelDir: string) {}

  private load() {
    // Lazy: chỉ nạp model (~100MB) ở lần gọi đầu, không làm chậm khởi động API
    this.ready ??= (async () => {
      const file = ['model_int8.onnx', 'model.onnx'].map(f => join(this.modelDir, f)).find(existsSync)
      if (!file) throw new Error(`Không thấy model ONNX trong ${this.modelDir}`)
      const ort = await import('onnxruntime-node')
      const { Tokenizer } = await import('@huggingface/tokenizers')
      const read = (name: string) => JSON.parse(readFileSync(join(this.modelDir, name), 'utf8'))
      const tokenizer = new Tokenizer(read('tokenizer.json'), read('tokenizer_config.json'))
      const session = await ort.InferenceSession.create(file, { intraOpNumThreads: 1 })
      this.logger.log(`Đã nạp model kiểm duyệt: ${file}`)
      return { session, tokenizer, ort }
    })()
    this.ready.catch(() => (this.ready = null)) // cho phép thử lại sau lỗi nạp
    return this.ready
  }

  async classify(text: string): Promise<ToxicityScores> {
    const { session, tokenizer, ort } = await this.load()
    const enc = tokenizer.encode(text)
    const all: number[] = enc.ids
    // Cắt tối đa MAX_TOKENS nhưng giữ </s> cuối
    const ids = all.length > MAX_TOKENS ? [...all.slice(0, MAX_TOKENS - 1), all[all.length - 1]] : all
    const big = (a: number[]) => BigInt64Array.from(a, BigInt)
    const out = await session.run({
      input_ids: new ort.Tensor('int64', big(ids), [1, ids.length]),
      attention_mask: new ort.Tensor('int64', big(ids.map(() => 1)), [1, ids.length])
    })
    const logits = Array.from(out.logits.data as Float32Array)
    const max = Math.max(...logits)
    const exp = logits.map(l => Math.exp(l - max))
    const sum = exp.reduce((a, b) => a + b, 0)
    const [clean, offense, hate] = exp.map(e => e / sum)
    return { clean, offense, hate }
  }
}
