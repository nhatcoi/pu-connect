# PU Connect: extension and PKA MCP

Implemented: 2026-10-19. Connector ID `pu_connector`, display name **PU Connect**. This source reads the student's university account, separate from the social app's always-available `puc__*` tools.

## Connection

1. **Connect** in N7AI settings or the chat composer opens `PuConnectorDialog`: install the existing Phenikaa Student Hub extension, sign in to Canvas/QLĐT, continue to PKA.
2. Authenticated `GET /api/ai/connectors/pu-connector/connect` stores a random state, PKCE verifier, requesting user and ten-minute expiry in the PostgreSQL-backed PUC session. Only the S256 challenge travels to `https://pka.vnhat.dev/connect/`.
3. The existing extension bridge runs on the **PKA origin**, without adding PUC to its host permissions. On explicit approval, the PKA page sends the university SSO to the **PKA service**. PKA validates it by reading the student's profile.
4. PKA issues a five-minute, single-use authorization code bound to the PKCE challenge and exact callback URI. The authenticated PUC callback consumes session state, verifies the account/expiry and exchanges the code server-to-server.
5. PUC stores only a scoped, encrypted PKA grant in `user_connectors` and enables `pu_connector` in default sources in one PostgreSQL transaction. It never receives the university SSO. The grant expires after 30 days; university authentication may expire sooner, requiring reconnection.
6. Disconnect revokes the grant on PKA before removing it and the default source locally. If PKA is unavailable, disconnect reports an error and can be retried. Delete-all N7AI data also attempts PKA revocation, using the existing best-effort cleanup policy.

The consent page uses one fixed production callback, no arbitrary redirect URLs. Alternate deployments must update the PKA callback allowlist and consent-page callback together. No password/cookie form is displayed on PUC. Client/account credentials never enter model messages or tool arguments.

## MCP execution

`PuConnectorMcpService` contributes tools to the existing `N7AgentService` only when selected. It opens no network connection for greetings; the first actual call initializes an authenticated Streamable HTTP MCP client at `PKA_CONNECTOR_URL/api/ai/pu-connector/mcp`. Each reply has its own client; every call rechecks the local grant. Groups do not receive this private connector.

| Tool | Data |
| --- | --- |
| `pu_connector__profile` | Student profile |
| `pu_connector__schedule` | Classes and exams |
| `pu_connector__grades` | Grades and credit progress |
| `pu_connector__courses` | Canvas courses |
| `pu_connector__deadlines` | Canvas assignment deadlines |
| `pu_connector__activity` | Recent Canvas activity |
| `pu_connector__attendance` | Attendance and alerts |
| `pu_connector__courseFiles` | Course file metadata |

Only these eight reads are accepted on **both** sides; writes, registration/cancellation and `ssoCookie` are excluded. PKA validates argument names, integer ranges and required course IDs. File bodies are not included. Results are bounded to 48,000 characters on PKA and 16,000 on PUC; the existing harness applies its per-turn budgets, read concurrency and account-local single-flight cache. Remote errors are converted to short reconnect messages without raw authentication details.

## PKA implementation

Source repository: `/Volumes/NVME_NHAT/Documents/Education/pka`.

- `gateway/src/connectors/pu-connector-store.ts`: idempotent SQLite tables for hashed one-time codes and hashed grant tokens; university SSO is encrypted using the PKA service's existing key encryption. Expired records are pruned on authorization.
- `gateway/src/connectors/pu-connector.routes.ts`: `POST /api/ai/pu-connector/{authorize,token,revoke,mcp}`, `GET .../status`; MCP supports initialize, ping, tools/list and tools/call. GET MCP returns 405 because no server-initiated SSE is offered. MCP rejects foreign Origin headers and requires a scoped bearer token.
- `landing/connect/`: concise extension consent page. Existing extension build and host permissions remain sufficient.
- Existing `executePkaMethod` and Runtime handle the university APIs **on PKA**. No university clients or SSO are installed in the PUC app service.

`PKA_CONNECTOR_URL` defaults to `https://pka.vnhat.dev`; requires HTTPS outside loopback development. PUC uses `CONNECTOR_ENCRYPTION_KEY` or `SESSION_SECRET` for its grant. PKA uses existing `JWT_SECRET`/persisted secret and `DATA_DIR`; optional `PKA_CONNECTOR_ORIGIN` and `PU_CONNECTOR_REDIRECT_URIS` restrict consent and callbacks. PKA and PUC are separate services; the current PKA deployment scripts may target the same physical VPS.

No PUC PostgreSQL migration is needed: `user_connectors.provider` is already extensible and settings are text arrays. PKA owns its two new SQLite tables.

## Validation

`apps/api/test/pu-connector.e2e-spec.ts` uses the real PostgreSQL session, token encryption and MCP client SDK with mocked PKA network: PKCE, cross-session rejection, replay prevention, defaults, lazy initialization, account isolation and revocation. Existing Google/harness tests remain in the validation set. PKA's `gateway/test/pu-connector.test.ts` tests native in-memory SQLite, actual Hono routes, expiry, PKCE, single use, origin/redirect checks, read-only tool validation and independent revocation. These tests use synthetic data; they do not claim a real student's university login was tested.

Protocol reference: [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports).

## Release verification (2026-10-19)

- Isolated PUC release: `/tmp/pu-pka-release.ia221J`, based on the current production snapshot plus the connector files. `pnpm build`, then typecheck/lint passed. All 106 API tests in 22 suites passed. Existing Admin bundle-size, Node color-environment and ts-jest configuration warnings are informational; ESLint had no findings.
- PKA native SQLite/Hono tests passed. A real HTTP wire test connected the actual MCP client SDK to the actual Hono route factory, listed eight tools, read synthetic profile data, rejected `ssoCookie`, and enforced revocation. No real student SSO was used.
- Gateway and landing were deployed with PKA's existing scripts, preserving environment and SQLite state. PUC deployed through `scripts/deploy.sh`, switching Web `.next-b` → `.next-a`. An immediate API health probe during restart returned 502; after startup, repeated checks returned the expected 401. No persistent API failure was found.
- Final health: Web/Admin/PKA consent page 200; unauthenticated PUC API and PKA MCP POST 401; MCP GET 405; invalid token exchange 400. All three systemd services active, Nginx valid.
- A normally registered QA account on production verified the connector name/availability, authenticated redirect to PKA with S256 challenge and exact callback, absence of the verifier in the URL, and rejection of invalid state. The QA session was logged out. The university consent step was not completed using a real student account.
- The three new connector service/controller files, registry, schemas and Web components match the tested release. A separate concurrent change added an optional model override to the existing agent loop after the release snapshot; the PU Connect integration hooks remain intact and the compiled API module loads successfully. This task did not overwrite that change.
- Browser inventory exposed no controllable browser surface, so visual verification and real extension login are not claimed. Git was not committed or pushed.
