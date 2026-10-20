# N7AI: demand-driven retrieval and harness performance

Implemented: 2026-10-19. Applies to N7AI private/group chat. Post comments keep their existing retrieval flow.

## Problem and change

A production request for AI materials took 48,235 ms: an automatic library search found nothing, then the model made three PUC search calls. A greeting also ran library retrieval. The old logs contain total latency only, so they do not establish how much time belonged to SQL, embeddings, gateway queueing or generation.

`N7AiService` now loads explicit pinned context, conversation history, learner context and existing attachment context; it does not prefetch connector data. The first model request can answer directly or choose tools. There is no separate routing-model call. Connector selections remain server-enforced permissions; the model cannot enable a disabled source.

## Search and citations

- `puc__search(query, queries?, type?)`: up to three distinct keyword variants total, executed together. Posts/documents use `RagSearchService` full-text + vector ranking; courses/people/groups use `SearchService`, communities use the existing bounded SQL. Each category returns at most five deduplicated results. Explicit uppercase acronyms such as `AI` survive full-text stopword filtering, while lowercase Vietnamese `ai` remains a stopword. Document/post results include `type`, `id`, title, an excerpt of at most 450 characters, genuine `href` and source `n`.
- `puc__read(type, id)`: only documents/posts found in this reply; rechecks visibility through `ChatRefsService`, returns at most 8,000 content characters. The model is instructed to answer material-list requests from search previews when enough evidence is available.
- `library` controls document/post search; turning it off still allows the existing app tools for courses, people, groups, communities and app help. Group chat exposes search/read restricted to public documents/posts only, regardless of forged private connector metadata.
- `RetrievalToolsService` exposes selected `my_documents`, `my_groups`, `web` and `web_search` as optional search/read-URL tools. It reuses existing retrieval/SSRF protection. No external search is enabled implicitly.
- `AgentSources` maintains one per-reply numbering space shared by pinned context and tool sources. Final citations still include only source numbers explicitly cited by the model; Google tools remain separate from numbered PU sources.

## Harness policy

`AgentToolSession.readOnly(name)` explicitly opts a tool into concurrent execution and in-turn caching. Unmarked tools are sequential and uncached. `AgentToolRunner` runs at most three independent reads together, preserves tool-result order in model history, and treats every write as a barrier. Reads after a write observe a cleared cache. Creation of Flashcard/Quiz remains sequential.

Read results are single-flighted by tool name and canonical JSON arguments; repeated keys share a pending or successful result. Failed reads are not retained. Cache state is created per reply and cannot cross accounts/replies. A read wait is bounded by 15 seconds and the overall turn signal. MCP/web transports have their own request deadlines; an already-started local SQL query is not forcibly canceled by the wait deadline.

| Budget | Normal | Research |
| --- | --- | --- |
| Model rounds (last disables tools) | 4 | 6 |
| Tool-call attempts | 8 | 12 |
| Turn deadline after preparation | 90 seconds | 120 seconds |
| Shared output budget | 8,192 tokens | 8,192 tokens |

Tool results are limited to 16,000 characters each, with a 48,000-character cumulative data budget (small error responses may exceed it slightly). These are safety ceilings, not latency targets. Model choice and gateway configuration are unchanged.

## Lazy Google MCP

`GoogleMcpService.open(..., { lazy: true })` does not obtain OAuth access tokens or start MCP HTTP connections. It checks grant versions in PostgreSQL and advertises cached schemas, or a provider-specific `__discover_tools` tool when cold. The model calls discovery only when it needs Google data. After discovery the actual schemas appear in the next model round; a cold catalog can therefore cost one additional model round for a Google question.

Schemas are cached for five minutes, at most 100 account/provider entries, invalidated on missing/changed grants. Tokens, Google results and live clients are never cached here. The first actual use in each reply opens a fresh SDK client, discovers current allowed tools, and preserves OAuth refresh/disconnect checks. Clients close in `finally`. Non-Google questions do not pay MCP network initialization, even when Google connectors are selected.

## Timing and verification

Final message JSON metadata stores `timings` (no migration):

- `preparationMs`: request start through pinned/history/attachment context preparation.
- `modelWaitMs`: summed time until the first content/tool delta in each model request, including request setup, gateway wait and any invisible reasoning.
- `modelStreamMs`: summed time from that first meaningful delta to stream completion.
- `toolWallMs`: wall time of tool batches, including cache lookup/wait.
- `mcpOpenMs`: lazy-session setup plus accumulated real MCP initialization time. This overlaps tool time and may sum parallel provider intervals; do not add all fields as a total.
- `rounds`, actual `toolCalls`, `cacheHits`; final `durationMs` remains end-to-end. `steps[].durationMs` measures each displayed tool wait.

The harness logs `agent.timings` without question text, tool arguments/results, user identifiers or credentials. Model failure still emits these harness counters; final-message detailed timings currently persist on successful replies.

`agent-harness.e2e-spec.ts` tests greeting/no prefetch, batched search, source deduplication, permission rechecks, group privacy, concurrency, write barriers, single-flight/cache isolation, failure retry and abort/budget handling. `google-connectors.e2e-spec.ts` adds lazy discovery, warm catalogs, account isolation, disconnect checks and dynamic schema use in the model loop. A separate live local gateway probe with synthetic public material fixtures completed a greeting in one model request without tools (~8.1 s), and a five-material listing in two model rounds with one search (~16.7 s; ~13.0 s waiting for model deltas). These are illustrative single runs, not a controlled production before/after benchmark.

Integration tests simulate model and MCP network responses; they do not establish real production latency. Compare real requests using the new timing fields after release before claiming a speedup.

## Gateway fallback

`LlmService.chat()` (used by the agent loop and `complete()`) calls the primary gateway (`AI_BASE_URL`/`AI_MODEL`). On connection errors, timeouts, 401/403/404/408/429 or 5xx **before the response starts**, it retries once on the fallback (`AI_FALLBACK_BASE_URL`/`AI_FALLBACK_API_KEY`/`AI_FALLBACK_MODEL`) and routes all calls there for 60 s so users do not wait on a dead gateway. 400/422 are request errors and never fall back. Mid-stream drops keep the existing one-round retry. Prod: primary = tunnel (`v1`, first token ~3 s vs ~10 s on the old gateway), fallback = `api-ai.vnhat.dev` (`v9`). OCR keeps its own `OCR_BASE_URL`/`OCR_MODEL` because the tunnel exposes models under other names. Test: `llm-fallback.e2e-spec.ts`.

## Changelog

- 2026-10-19 — Gateway compatibility: normalize empty/whitespace streamed tool arguments to `{}` before both execution and replay. The tunnel gateway returned an empty argument string for a parameterless tool, then rejected the next model request with `tool_use.input: Input should be an object`. Regression coverage verifies blank arguments and preserves populated JSON objects. Production gateway measurements and rollout results are recorded below.
- 2026-10-19 — Removed chat connector prefetch, unified PUC hybrid search/read tools, added read scheduling/cache, lazy MCP catalogs, mode budgets and per-stage timing.

## Tunnel gateway rollout (2026-10-19)

Preflight ran from the production VPS to `https://r5pctmb.abc-tunnel.us/v1`, using model alias `v1`, three samples per case, streaming and `max_tokens=8192`. The gateway reports model `claude-sonnet-5-5`; this is a gateway-provided identifier, not independent upstream verification. All nine direct requests completed HTTP 200.

| Synthetic request | First content median | Total median | Total range |
| --- | --- | --- | --- |
| Minimal `hi` | 1.159 s | 1.638 s | 1.534–2.008 s |
| N7AI prompt + nine tools, `hi` | 2.304 s | 3.410 s | 2.284–3.769 s |
| N7AI prompt + nine tools, simple arithmetic | 1.679 s | 2.568 s | 2.224–2.889 s |

The earlier localhost `v1` N7AI greeting median was 0.823 s first content / 1.852 s total. The earlier production-gateway `v9` direct greeting median was 4.764 s / 5.414 s. These are small samples taken at different times and routes, not controlled tail-latency comparisons. Tool schemas were declared in these nine direct measurements but tools were not executed. A separate two-round OpenAI SDK preflight with a synthetic parameterless tool reproduced the empty-arguments HTTP 400; normalizing to `{}` completed both rounds successfully.

Rollout scope is the tool-argument compatibility fix and production `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` configuration. Credentials and rollback values are stored only in protected VPS configuration/backups, never in this document. Existing production source is the release baseline to exclude unrelated workspace changes. Live conversation results are added after deployment; these direct timings do not include application preparation, SQL or browser rendering.

### Deployed configuration and live conversation

Production now uses `AI_BASE_URL=https://r5pctmb.abc-tunnel.us/v1` and `AI_MODEL=v1`. The previous three AI settings were backed up in a root-only VPS directory before the atomic environment update. The API runtime environment was checked after restart; all four corresponding `ai_runs` records report model `v1` and status `done`. The compatibility fix was deployed from a snapshot of existing production source using `scripts/deploy.sh`; Web switched from `.next-a` to `.next-b`.

A dedicated QA account used normal registration/login, then sent four sequential turns in one real private conversation through the public PUC REST endpoint and authenticated Socket.IO. Each answer was re-fetched to verify persistence; the session was logged out and the temporary authentication file removed. First text below means arrival of the first nonempty content delta at the socket client, not browser paint.

| Turn | First text | Client completion | API generation | Rounds / tools |
| --- | --- | --- | --- | --- |
| 1. `hi` | 1.809 s | 3.134 s | 2.635 s | 1 / 0 |
| 2. `hi` | 1.817 s | 3.484 s | 3.016 s | 1 / 0 |
| 3. `1 + 1 bằng mấy? Trả lời ngắn gọn.` | 1.494 s | 2.529 s | 2.041 s | 1 / 0 |
| 4. `cần tìm tài liệu về AI` | 8.600 s | 9.057 s | 8.149 s | 2 / 1 |

The earlier comparable `v9` conversation completed the same turns in 6.492 s, 5.798 s, 3.617 s and 18.318 s. The new search completed in 9.057 s with one successful public PUC search (0.664 s tool wall time), two model rounds and 6.781 s summed model wait. The older search used two tools and three rounds. These are observational conversations taken at different times, not an isolated model experiment or a p95 guarantee; output length and selected tools differ.

Validation: root build, typecheck and lint passed; three related integration suites passed 19/19 tests, including empty/whitespace/populated tool arguments. Existing Admin bundle-size and Node color-environment warnings remain informational; ESLint reported no findings. The deployment process exited successfully. Post-switch Web/Admin returned 200, unauthenticated `/api/auth/me` returned 401, API/Web services were active and `nginx -t` passed. Visual browser QA was not part of this measurement.
- 2026-10-19 — Fallback gateway (api-ai.vnhat.dev) behind the tunnel primary.
