export interface UsageSummary {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  reasoning_tokens?: number
  cache_reported_calls?: number
  cache_write_reported_calls?: number
  cache_input_tokens?: number
  cache_hit_rate?: number | null
  ttft_seconds?: number | null
  duration_seconds?: number
  tokens_per_second?: number | null
}

export function estimateMessageUsage(
  content: string,
  meta?: {
    durationMs?: number
    reasoning?: string
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      reasoning_tokens?: number
      cache_hit_rate?: number
      duration_seconds?: number
      ttft_seconds?: number
      tokens_per_second?: number
    }
  } | null
): UsageSummary {
  if (meta?.usage) {
    const u = meta.usage
    const duration = u.duration_seconds ?? (meta.durationMs ? meta.durationMs / 1000 : null)
    const compTokens = u.completion_tokens ?? Math.max(1, Math.round(content.length * 0.75))
    const promptTokens = u.prompt_tokens ?? 1200
    const reasoningTokens = u.reasoning_tokens ?? (meta.reasoning ? Math.round(meta.reasoning.length * 0.5) : 0)
    const totalTokens = u.total_tokens ?? (promptTokens + compTokens + reasoningTokens)
    const tps = u.tokens_per_second ?? (duration && duration > 0 ? compTokens / duration : 35.5)

    return {
      total_tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: compTokens,
      reasoning_tokens: reasoningTokens,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_input_tokens: promptTokens,
      cache_reported_calls: 1,
      cache_write_reported_calls: 0,
      cache_hit_rate: u.cache_hit_rate ?? 0,
      duration_seconds: duration ?? 2.5,
      ttft_seconds: u.ttft_seconds ?? 0.45,
      tokens_per_second: tps,
    }
  }

  // Graceful fallback estimation based on content and duration
  const compTokens = Math.max(12, Math.round(content.length * 0.72))
  const reasoningTokens = meta?.reasoning ? Math.round(meta.reasoning.length * 0.5) : 0
  const promptTokens = 1250 // Typical context length with system prompt & history
  const totalTokens = promptTokens + compTokens + reasoningTokens
  const duration = meta?.durationMs ? meta.durationMs / 1000 : 2.8
  const tps = duration > 0 ? compTokens / duration : 32.4

  return {
    total_tokens: totalTokens,
    prompt_tokens: promptTokens,
    completion_tokens: compTokens,
    reasoning_tokens: reasoningTokens,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_input_tokens: promptTokens,
    cache_reported_calls: 1,
    cache_write_reported_calls: 0,
    cache_hit_rate: 0,
    duration_seconds: duration,
    ttft_seconds: 0.52,
    tokens_per_second: tps,
  }
}
