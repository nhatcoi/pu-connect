# 07 · Web App (`apps/web`)

> Route, component chính, state và nguồn dữ liệu. Cập nhật lần cuối: **2026-10-13**.

## Route map

```mermaid
flowchart LR
  landing["<b>/</b><br/>Landing + AuthForm<br/>(đã đăng nhập → /home)"]
  verify["<b>/verify-email</b><br/>?token="]
  forgot["<b>/forgot-password</b><br/>nhập email"]
  reset["<b>/reset-password</b><br/>?token="]
  getstarted["/get-started<br/>→ redirect /home"]
  legal["<b>/terms</b> · <b>/privacy-policy</b><br/>route group (legal), công khai"]

  subgraph guarded["AuthGuard (cần đăng nhập)"]
    home["<b>/home</b><br/>tab: for_you · following · qa"]
    search["<b>/search</b><br/>?q= &type="]
    comms["<b>/communities</b>"]
    comm["<b>/c/[slug]</b>"]
    profile["<b>/[username]</b><br/>?edit=1 mở dialog sửa hồ sơ"]
    notif["<b>/notifications</b><br/>tab · cài đặt"]
    post["<b>/post/[id]</b><br/>?comment= highlight"]
    courses["<b>/courses</b><br/>danh mục học phần"]
    course["<b>/courses/[code]</b><br/>thảo luận · tài liệu · nhóm học"]
    msgs["<b>/messages</b><br/>lọc · tin nhắn mới · tạo nhóm · PU AI"]
    thread["<b>/messages/[id]</b><br/>tệp · trả lời · cảm xúc · ghim<br/>quiz/flashcard AI · bảng thông tin"]
    adminp["<b>/admin</b><br/>chỉ role admin"]
  end

  landing -->|login / register / Google| home
  landing -->|footer · lời đồng ý| legal
  verify --> home
  landing -->|Quên mật khẩu?| forgot
  forgot -.->|email chứa link| reset
  reset -->|đổi xong| landing
  getstarted --> home
  home --> search & comms & profile & notif
  notif --> post
  comms --> comm
  home --> courses & msgs
  courses --> course
  msgs --> thread
  profile -->|Nhắn tin| thread

  classDef page fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef redirect fill:#fff,stroke:#94a3b8,color:#64748b,stroke-dasharray:5 5
  class landing,verify,forgot,reset,home,search,comms,comm,profile,notif,post,courses,course,msgs,thread,adminp page
  class getstarted redirect
```

## Bố cục & component chính

```mermaid
flowchart TB
  subgraph Shell["app/(app)/layout.tsx — AppLayout dựng 1 lần cho mọi trang cần đăng nhập"]
    direction LR
    header["Header<br/>search · Đăng bài · NotificationsPopover · avatar<br/>VerifyEmailBanner"]
    sidebar["Sidebar<br/>nav + Highlight trượt (animate-ui)"]
    main["Nội dung trang<br/>SlidingTabs · AcademicPostComposer · PostCard[]"]
    right["RightSidebar (mặc định)<br/>hoặc PageAside của trang"]
    dialogs["Hộp thoại toàn cục<br/>soạn bài · tài liệu · nhóm · xem tài liệu"]
    mnav["MobileBottomNav"]
  end

  rq[("TanStack Query cache<br/>me · feed · post · comments · profile<br/>community · search · notifications")]
  store[("Zustand<br/>user (đồng bộ ['me']) · UI dialogs<br/>store thông báo realtime")]
  rest["apiClient → /api/*"]
  gql["graphqlClient → /graphql"]
  rt["useRealtimeEvent → Socket.IO"]
  flags["lib/features.ts<br/>feature flags"]

  main -->|useQuery / useInfiniteQuery| rq
  right -->|useQuery suggestedUsers| rq
  rq --> rest & gql
  sidebar -.-> flags
  right -.-> flags
  header -->|NotificationsPopover| rest
  header -->|event notification| rt
  Shell --- store
```

Quản lý state & cache: xem [08-web-state](../core/08-web-state.md).

## Nguồn dữ liệu theo màn hình

| Màn hình / component | REST | GraphQL | Realtime |
|---|---|---|---|
| Landing / AuthForm | `auth/providers`, `auth/check-email`, `auth/login`, `auth/register`, `auth/me` | — | — |
| `/home` feed, PostCard | `posts`, `posts/:id/*`, `posts/:postId/comments`, `comments/:id/*` | `toggleFollow` (follow trên PostCard) | — |
| RightSidebar | — | `suggestedUsers` | — |
| `/[username]` | `users/:username`, `users/profile` | `userProfile`, `userFollowers`, `userFollowing` | — |
| Communities | `communities`, `communities/:slug/*` | — | — |
| NotificationsPopover / `/notifications` | `notifications`, `notifications/*/read*`, `notifications/settings` | — | `notification`, `notification.read` |
| `/post/[id]` | `posts/:id`, `posts/:postId/comments` | — | — |
| `/courses`, `/courses/[code]` | `courses`, `courses/:code/overview`, `posts?course=`, `documents?course=`, `study-groups?course=`, `study-groups/:id/join` | — | — |
| `/messages`, `/messages/[id]`, badge Tin nhắn | `conversations*`, `messages/:id*`, `ai/*`, `upload/file?folder=chat`, `search?type=users` | — | `message.new/updated/delta`, `conv.read/updated/removed`, `typing` (useChatRealtime trong AppLayout, `hooks/chat/`) |
| `/admin` | `admin/*` | — | — |

## Feature flags (`lib/features.ts`)

Tính năng chưa hoàn thiện bị ẩn bằng flag (QR app mobile, lối tắt danh mục, môn học sôi nổi, xu hướng…). Bật flag ⇒ cập nhật bảng trên và sơ đồ route.

**Changelog:**
- 2026-10-13 — thêm `/terms`, `/privacy-policy` (route group `(legal)`, `LegalDocument`, link chung `lib/legal.ts`); bỏ flag `legalPages` và link footer chết.
- 2026-10-13 — chat P2: hooks tách `hooks/chat/`, component theo `components/chat/{thread,composer,ai,info}`; cột phải `/messages/[id]` = bảng thông tin hội thoại.
- 2026-10-13 — thêm `/courses`, `/courses/[code]`, `/messages`, `/messages/[id]`, `/admin`; sidebar & bottom nav có Học phần, Tin nhắn (badge chưa đọc), Quản trị (admin).
- 2026-10-09 — route group `(app)` + `AppLayout` dùng chung; dữ liệu server qua TanStack Query (cache, prefetch, cập nhật lạc quan); bỏ `AppShell`.
- 2026-10-04 — thêm `/forgot-password`, `/reset-password`.
- 2026-10-04 — thêm `/notifications`, `/post/[id]`, store thông báo dùng chung, mục Thông báo ở sidebar.
- 2026-10-04 — tạo mới; bỏ `/get-started` (redirect), thêm `/verify-email`, realtime notifications.
