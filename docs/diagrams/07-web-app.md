# 07 · Web App (`apps/web`)

> Route, component chính, state và nguồn dữ liệu. Cập nhật lần cuối: **2026-10-04**.

## Route map

```mermaid
flowchart LR
  landing["<b>/</b><br/>Landing + AuthForm<br/>(đã đăng nhập → /home)"]
  verify["<b>/verify-email</b><br/>?token="]
  getstarted["/get-started<br/>→ redirect /home"]

  subgraph guarded["AuthGuard (cần đăng nhập)"]
    home["<b>/home</b><br/>tab: for_you · following · qa"]
    search["<b>/search</b><br/>?q= &type="]
    comms["<b>/communities</b>"]
    comm["<b>/c/[slug]</b>"]
    profile["<b>/[username]</b><br/>?edit=1 mở dialog sửa hồ sơ"]
  end

  landing -->|login / register / Google| home
  verify --> home
  getstarted --> home
  home --> search & comms & profile
  comms --> comm

  classDef page fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef redirect fill:#fff,stroke:#94a3b8,color:#64748b,stroke-dasharray:5 5
  class landing,verify,home,search,comms,comm,profile page
  class getstarted redirect
```

## Bố cục & component chính

```mermaid
flowchart TB
  subgraph Shell["Layout 3 cột (home, search, communities, profile)"]
    direction LR
    header["Header<br/>search · Đăng bài · NotificationsPopover · avatar<br/>VerifyEmailBanner"]
    sidebar["Sidebar<br/>nav + Highlight trượt (animate-ui)"]
    main["Nội dung trang<br/>SlidingTabs · AcademicPostComposer · PostCard[]"]
    right["RightSidebar<br/>ProfileCompletionCard · Gợi ý theo dõi"]
    mnav["MobileBottomNav"]
  end

  store[("Zustand store<br/>auth · feed · document · course<br/>study-group · campus slices<br/>+ UI dialogs")]
  rest["apiClient → /api/*"]
  gql["graphqlClient → /graphql"]
  rt["useRealtimeEvent → Socket.IO"]
  flags["lib/features.ts<br/>feature flags"]

  main -->|usePosts, useComments| rest
  right -->|suggestedUsers| gql
  sidebar -.-> flags
  right -.-> flags
  header -->|NotificationsPopover| rest
  header -->|event notification| rt
  Shell --- store
```

## Nguồn dữ liệu theo màn hình

| Màn hình / component | REST | GraphQL | Realtime |
|---|---|---|---|
| Landing / AuthForm | `auth/providers`, `auth/check-email`, `auth/login`, `auth/register`, `auth/me` | — | — |
| `/home` feed, PostCard | `posts`, `posts/:id/*`, `posts/:postId/comments`, `comments/:id/*` | `toggleFollow` (follow trên PostCard) | — |
| RightSidebar | — | `suggestedUsers` | — |
| `/[username]` | `users/:username`, `users/profile` | `userProfile`, `userFollowers`, `userFollowing` | — |
| Communities | `communities`, `communities/:slug/*` | — | — |
| NotificationsPopover | `notifications`, `notifications/*/read*` | — | `notification` |

## Feature flags (`lib/features.ts`)

Tính năng chưa hoàn thiện bị ẩn bằng flag (QR app mobile, trang pháp lý, lối tắt danh mục, môn học sôi nổi, xu hướng…). Bật flag ⇒ cập nhật bảng trên và sơ đồ route.

**Changelog:**
- 2026-10-04 — tạo mới; bỏ `/get-started` (redirect), thêm `/verify-email`, realtime notifications.
