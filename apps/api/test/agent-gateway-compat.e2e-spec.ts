import { McpAgentService } from '../src/modules/ai/mcp-agent.service'
import { GoogleMcpService } from '../src/modules/ai/connectors/google-mcp.service'
import { LlmService } from '../src/modules/ai/llm.service'

describe('Agent gateway streamed arguments', () => {
  it.each(['', '  ', '{"query":"AI"}'])('round-trips tool arguments %j as a JSON object', async (argumentsText) => {
    const expected = JSON.parse(argumentsText.trim() || '{}')
    const call = jest.fn(async () => JSON.stringify({ marker: 'fixture' }))
    const close = jest.fn(async () => undefined)
    let round = 0
    const create = jest.fn(async (params: { messages: { role: string; tool_calls?: { function: { arguments: string } }[] }[] }) => {
      const current = round++
      if (current === 1) {
        const assistant = params.messages.find((message) => message.tool_calls)
        expect(JSON.parse(assistant!.tool_calls![0].function.arguments)).toEqual(expected)
        expect(params.messages.at(-1)?.role).toBe('tool')
      }
      return (async function* () {
        if (current === 0)
          yield {
            choices: [
              {
                delta: { tool_calls: [{ index: 0, id: 'probe-1', function: { name: 'probe', arguments: argumentsText } }] },
                finish_reason: 'tool_calls'
              }
            ]
          }
        else yield { choices: [{ delta: { content: 'fixture' }, finish_reason: 'stop' }] }
      })()
    })
    const mcp = {
      open: async () => ({
        tools: [{ type: 'function', function: { name: 'probe', parameters: { type: 'object' } } }],
        instructions: [],
        call,
        describe: () => ({ provider: 'google_drive', label: 'Probe' }),
        close
      })
    } as unknown as GoogleMcpService
    const llm = { client: { chat: { completions: { create } } }, model: 'test', chat: LlmService.prototype.chat } as unknown as LlmService
    const result = await new McpAgentService(llm, mcp).stream([], 'fixture-account', ['google_drive'], () => undefined)
    expect(result.finishReason).toBe('stop')
    expect(result.timings.rounds).toBe(2)
    expect(result.calls[0].ok).toBe(true)
    expect(call.mock.calls[0]).toEqual(['probe', expected, expect.any(AbortSignal)])
    expect(close).toHaveBeenCalledTimes(1)
  })
})
