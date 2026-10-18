# N7AI Google MCP connectors

Implemented: 2026-10-17. Server switched 2026-10-18. Replaces the fixed Google REST retrieval described in the earlier connector design.

N7AI is the MCP **client**. The MCP **server** is the self-hosted [`workspace-mcp`](https://github.com/taylorwilsdon/google_workspace_mcp) (MIT, pinned `2.1.0`) running on the VPS. Google's hosted MCP servers (`drivemcp` / `calendarmcp` / `gmailmcp.googleapis.com`) were tried first and rejected every call because they require the Google Workspace Developer Preview Program; `workspace-mcp` calls the ordinary Drive / Calendar / Gmail REST APIs instead.

| Connector | OAuth scope | Exposed read tools (workspace-mcp names) |
| --- | --- | --- |
| `google_drive` | `drive.readonly` | `search_drive_files`, `get_drive_file_content`, `list_drive_items` |
| `google_calendar` | `calendar.readonly` | `list_calendars`, `get_events`, `query_freebusy` |
| `google_gmail` | `gmail.readonly` | `search_gmail_messages`, `get_gmail_message_content`, `get_gmail_messages_content_batch`, `get_gmail_thread_content`, `list_gmail_labels` |

Scopes above are prefixed with `https://www.googleapis.com/auth/`. There are no send, draft, upload, create, update, or delete tools in the N7AI allowlist, and the server itself runs `--read-only`.

## Server (workspace-mcp)

| Item | Value |
| --- | --- |
| Install | `/opt/workspace-mcp/venv` (`pip install workspace-mcp==2.1.0`), system user `workspace-mcp` (no shell) |
| Service | `systemd` unit `workspace-mcp`: `workspace-mcp --transport streamable-http --tools drive calendar gmail --read-only`; `MemoryMax=350M`, `ProtectSystem=strict`, `NoNewPrivileges` |
| Env | `/etc/workspace-mcp.env` (root, 600): `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MCP_ENABLE_OAUTH21=true`, `EXTERNAL_OAUTH21_PROVIDER=true`, `WORKSPACE_MCP_STATELESS_MODE=true`, `WORKSPACE_MCP_READ_ONLY=true`, `WORKSPACE_MCP_HOST=127.0.0.1`, `WORKSPACE_MCP_PORT=8765` |
| Auth model | External provider: the API sends the user's Google access token (`ya29.*`) as `Authorization: Bearer`; the server validates it with Google userinfo (needs the `openid email` scopes requested at connect) and calls Google APIs with it. It stores no tokens (stateless) and has no login flow (`start_google_auth` disabled) |
| Endpoint | `http://127.0.0.1:8765/mcp`, configured in the API as `GOOGLE_WORKSPACE_MCP_URL`. Bound to localhost only; unauthenticated requests get 401 |
| Footprint | ~100 MB RSS idle |

One endpoint serves every provider, but each provider keeps its own OAuth grant and opens its own MCP client with its own bearer token, and only that provider's tools from the table above are exposed.

## Request flow

1. Settings or the composer selects connectors. The shared `AiConnectorId` and API DTO include Gmail. Existing authenticated connect/callback/disconnect endpoints support `/ai/connectors/google-gmail/*` through the provider registry.
2. Internal PU sources still use `AiRetrieval`. Google data is no longer fetched before the model runs; the former Drive/Calendar REST services were removed.
3. `McpAgentService` opens a per-reply `GoogleMcpService` session for the selected Google connectors. The client uses the official MCP SDK with Streamable HTTP, initialization, `tools/list` and `tools/call`.
4. Discovery filters the server-advertised tools against a provider-specific read allowlist. Function schemas are passed to the configured OpenAI-compatible model. Names are mapped to `google_drive__search_drive_files`, etc., then translated back to the original MCP tool name when executed.
5. The model chooses tools and arguments, sees tool results and may make another call. Calendar IDs, dates and search terms come from the question/model rather than a fixed primary-calendar/14-day query. Results stream through the existing chat delta and follow-up splitter flow.
6. The client closes in `finally`. Actual successful tool calls update `last_used_at`; discovery alone does not. Failures populate a sanitized `last_error`. Final AI messages invalidate the connector status query so Settings shows recent failures and offers reconnect.

## Account boundaries and limits

- Each reply has separate MCP clients and bearer tokens, keyed by the authoritative sender. A mismatched requester/trigger sender is rejected.
- Group chat always passes an empty private-connector selection, regardless of message metadata. It retains public PU retrieval only. Post-comment AI remains on public/internal retrieval.
- Connector existence is checked before opening and before every call. Disconnect prevents subsequent calls in an already-open turn. Refresh tokens remain AES-256-GCM encrypted; a 401 triggers at most one refresh per session, and `invalid_grant` removes the connection.
- Only the configured `GOOGLE_WORKSPACE_MCP_URL` may receive bearer tokens; redirects and other URLs are rejected. Returned resource links are not fetched automatically.
- Tool output is untrusted context. It cannot grant permissions or introduce tools. Raw tool results and OAuth credentials are not persisted in chat history; selected tool names/results are only held during the reply.
- Limits: 15-second request timeout, 120-second turn deadline, five model rounds, twelve executed tool calls, 32 exposed tool definitions, bounded discovery pagination, 16,000 characters of tool arguments and 12,000 characters per result. New calls stop after roughly 48,000 result characters. The final round disables tools.
- The reply shares the existing 8,192-output-token budget across rounds when usage is reported; without usage, UTF-8 byte length provides conservative budget accounting for visible text/arguments. Reported usage is aggregated into the existing `ai_runs`. One user request remains one quota run (Research retains its existing cost).
- Existing numbered PU citations remain separate. MCP answers may link genuine URLs returned by tools; the model is instructed not to invent PU citation numbers for MCP results.

## Google Cloud and environment setup

1. Enable the Drive, Calendar and Gmail APIs in the Google Cloud project of the OAuth client. No MCP service or Developer Preview enrollment is needed.
2. Connectors use `GOOGLE_MCP_CLIENT_ID` / `GOOGLE_MCP_CLIENT_SECRET` when set, otherwise `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. `workspace-mcp` only validates tokens, so it may use the same client.
3. Register the exact `GOOGLE_CONNECTOR_CALLBACK_URL`, or `GOOGLE_CALLBACK_URL` when no separate callback is configured. The existing session-bound one-use state validation remains in place.
4. Add the read scopes above to the consent screen and the test users. `drive.readonly` and `gmail.readonly` are restricted scopes: opening the app to all students needs Google verification (CASA security assessment) regardless of MCP vs REST. Reconnect existing providers after changing OAuth client credentials or scopes; old refresh tokens belong to the client that issued them.
5. Keep `CONNECTOR_ENCRYPTION_KEY` stable. Configure `AI_MODEL`/`AI_BASE_URL` with a gateway that supports **streaming Chat Completions function/tool calling**. A tools/schema rejection produces an actionable chat error instead of silently falling back to fixed REST retrieval.
6. Upgrading `workspace-mcp`: bump the pinned version in the venv, check tool names against the allowlist in `google-mcp.providers.ts`, then `systemctl restart workspace-mcp`.

No new database table, column, migration or public endpoint is required: `user_connectors.provider` and connector preference arrays already support the new provider ID.

## Verification

`pnpm --filter @pu/api exec jest --runTestsByPath test/google-connectors.e2e-spec.ts` exercises the real SDK transport, OAuth/session flow and PostgreSQL with an intercepted workspace-mcp endpoint (one tool list for all services, write tools included): all three providers, discovery, write denial, account isolation, disconnect mid-session, expired/revoked tokens, streamed model tool-call fragments, multi-step results/usage, missing consent scopes and group privacy.

Google responses and model completions are simulated in these integration tests. They do not prove that a deployment's Google Cloud project or user grant can reach the Google APIs. A live gateway capability probe separately confirmed that the configured local gateway accepts a harmless forced function call; it sent no Google/user data.

## References

- [workspace-mcp (taylorwilsdon/google_workspace_mcp)](https://github.com/taylorwilsdon/google_workspace_mcp) · [deployment env vars](https://workspacemcp.com/docs/deployment)
- [MCP TypeScript client](https://ts.sdk.modelcontextprotocol.io/client)

## Changelog

- 2026-10-18 — Google's hosted MCP servers required the Developer Preview Program (every call failed) ⇒ switched to self-hosted `workspace-mcp` 2.1.0 on localhost (external bearer mode, read-only, stateless); tool allowlist renamed; endpoint via `GOOGLE_WORKSPACE_MCP_URL`.
- 2026-10-17 — Replaced Google REST prefetch with model-driven MCP calls; added Gmail, private-turn isolation, read tool policies and separate agent OAuth credentials.
