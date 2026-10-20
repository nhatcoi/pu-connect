# Feed view modes

Implemented: 2026-10-17.

Home (`/`) offers **Danh sách** (list) and **Tập trung** (focus) through `FeedModeSwitch`, beside the existing feed tabs. Both render the same `usePosts` data and TanStack Query keys: switching presentation does not change ranking, access rules, or the active feed filter.

## Preferences and session state

- `FeaturePreferencesSchema.feedViewMode` is `list | focus`, defaulting to `list` for existing accounts.
- `PATCH /api/users/preferences` accepts this property and atomically merges it into the existing `users.preferences` JSONB. There is no new endpoint or migration.
- Settings → Giao diện → Chế độ bảng tin mặc định saves through `useFeaturePreferences`, synchronizing the `me` query and session store with optimistic rollback. Changing the default clears the current view override.
- Home switches only the in-memory Zustand `feedViewOverride`, scoped to the account. Navigation within the app retains it; a reload/new page session uses the saved account default. It is not persisted in localStorage.
- Mode switches preserve the visible post where it still exists in the current feed; changing a feed tab resets the anchor. List restoration uses `VirtualPostList.initialPostId`.

## Focus presentation

`FocusFeed` uses a dedicated vertical scroll container with mandatory page snapping and fixed-height virtual rows. Only the current post and nearby posts mount. Near the end it requests the next existing feed page; a load failure exposes a retry action instead of retrying indefinitely.

`AppLayout` hides its global Header and side columns on Home in focus mode. The feed toolbar and mobile bottom navigation remain available. Notification synchronization lives in the persistent `GlobalDialogs` component so hiding the Header does not unsubscribe realtime notifications. Desktop provides previous/next buttons; the focused feed region accepts ArrowUp/ArrowDown. Text and media posts remain in the same feed.

- `FocusFeedMedia`: horizontal snapping for multiple attachments, image index, bounded media dimensions. Video URLs ending in mp4/webm/mov/m4v are rendered as video; only the visible slide of the active post may autoplay. Videos start muted, pause offscreen, pause while the detail dialog is open, and pause when the document is hidden. Playback failures leave native controls available. This does not add video upload/transcoding infrastructure.
- `FocusFeedCard`: author, caption, like/comment/share/bookmark actions. Text posts show an excerpt; the reading sheet renders the existing `PostCard` expanded for full Markdown, polls, attached documents, and moderation actions. The comment sheet opens `PostCommentsSection` directly, with counts patched into the shared cache.
- `useFeedPostActions`: optimistic like/bookmark updates through `patchPostEverywhere`, rollback on failure, native sharing with clipboard fallback. Presentation changes do not create a separate post cache.

## Validation

- `apps/api/test/feed-preferences.e2e-spec.ts` checks legacy defaults, persistence across authenticated sessions, partial updates preserving existing flags, account isolation, invalid values, and authentication.
- The integration fixture includes existing admin migrations because current authentication reads sanction/security columns even in feed preference tests.
- Browser checks use intercepted API fixtures for mobile/desktop layout, switching/anchor restoration, optimistic interaction, detail sheet, pagination, virtual DOM bounds, saved defaults, and video pause/play behavior. These checks exercise the UI separately from the real PostgreSQL API integration tests.

## Changelog

- 2026-10-17 — Added list/focus presentation, Home switch, account default in Appearance settings, virtual focus feed, and shared optimistic interactions.
