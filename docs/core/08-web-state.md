# 08 · Quản lý state & dữ liệu phía web (ADR)

> Trạng thái: **đã triển khai** (2026-10-09). Mã: `apps/web/src/lib/{query-client,query-keys,post-cache}.ts`, `hooks/use-*.ts`, `app/(app)/layout.tsx`.

## 1. Bối cảnh

Trước đây chuyển trang home → search → communities → profile → quay lại đều **tải lại toàn bộ**: spinner, mất vị trí cuộn, tốn request.

| Nguyên nhân | Hậu quả |
|---|---|
| Mỗi hook tự `useState` + `useEffect` fetch (`usePosts`, `useProfile`, `useCommunity`, `useComments`…) | Rời trang = mất dữ liệu |
| Mỗi trang tự dựng AuthGuard + Header + Sidebar + RightSidebar | Mỗi lần chuyển trang gọi `/auth/me` **2 lần**, tải lại gợi ý theo dõi, sidebar nháy |
| Một mảng `posts` toàn cục trong zustand dùng chung mọi tab feed | Đổi tab ghi đè nhau; thích bài ở cộng đồng không đồng bộ sang feed |
| `@tanstack/react-query` đã cài nhưng **không dùng** | — |

## 2. Quyết định

Phân loại state, mỗi loại một công cụ:

| Loại state | Ví dụ | Công cụ |
|---|---|---|
| **Dữ liệu server** | feed, bài viết, hồ sơ, cộng đồng, bình luận, gợi ý, search, thông báo | **TanStack Query** |
| UI dùng chung | user đăng nhập (đồng bộ từ cache `['me']`), hộp thoại soạn bài/tài liệu, xem tài liệu | **zustand** |
| Trạng thái trên URL | tab, `q`, bộ lọc, `?comment=` | `useSearchParams` |
| Cục bộ component | input, hover, menu | `useState` |
| Realtime | thông báo mới, số chưa đọc | Socket → store thông báo, trộn vào cache trang `/notifications` |

**Không dùng**: Redux, SWR, Apollo Client — trùng vai trò với TanStack Query.

## 3. Cơ chế

### 3.1. Layout chung — `app/(app)/layout.tsx`
Route group `(app)` gồm `home, search, communities, c/[slug], [username], notifications, post/[id]`. `AppLayout` dựng **một lần**: AuthGuard, Header (socket thông báo), Sidebar, RightSidebar, MobileBottomNav, hộp thoại toàn cục (soạn bài, tài liệu, nhóm, xem tài liệu). Chuyển trang chỉ thay cột giữa.

Cột phải riêng của trang (search: lọc khoa; cộng đồng: thông tin diễn đàn) dùng `<PageAside>` — portal vào slot của layout; không có thì hiện `RightSidebar` mặc định.

### 3.2. Phiên đăng nhập — `useSession()`
`useQuery(['me'], staleTime: Infinity)` ⇒ `/auth/me` **một lần mỗi lần tải trang**. zustand `setUser/setAuth/logout` ghi luôn vào cache `['me']` (đăng nhập, xác thực email, đổi mật khẩu… ở đâu cũng đồng bộ). `logout` xóa toàn bộ cache.

### 3.3. Khóa cache (`lib/query-keys.ts`) & thời gian "còn mới"

| Khóa | Kiểu | staleTime |
|---|---|---|
| `['me']` | query | ∞ |
| `['feed', feedType, tag]` | infinite (offset) | 60 s |
| `['post', id]` | query (seed từ cache danh sách) | 30 s |
| `['comments', postId]` | infinite (offset theo bình luận gốc) | 30 s |
| `['profile', username]` | query | 5 phút |
| `['communities', type, search]` | query | 2 phút |
| `['community', slug, sort]` | infinite (offset) | 2 phút |
| `['suggested-users', n]` | query | 10 phút |
| `['search', q, type, faculty]` | query | 5 phút |
| `['notifications', filter]` | infinite (cursor) | 30 s |

Mặc định (`lib/query-client.ts`): `gcTime` 10 phút, không refetch khi focus cửa sổ, **không thử lại lỗi 4xx**, lỗi mạng/5xx thử lại 1 lần (`ApiError` mang `status`). Hết hạn ⇒ hiện dữ liệu cũ ngay rồi làm mới ngầm (stale-while-revalidate) — **không spinner**.

### 3.4. Một bài viết, nhiều nơi — `lib/post-cache.ts`
- `patchPostEverywhere(qc, id, updater)`: duyệt mọi cache có thể chứa bài (`feed`, `post`, `community`, `profile`, `search`), thay bài khớp id, **giữ nguyên tham chiếu** phần không đổi. Dùng cho thích, lưu, ghim, sửa bài, số bình luận.
- `removePostEverywhere` (xóa bài), `patchAuthorFollowed` (theo dõi tác giả: cập nhật cờ ở mọi bài của người đó), `invalidateFollowRelated` (hồ sơ + gợi ý).
- `onPostCreated`: chèn bài mới lên đầu feed "Dành cho bạn" (+ "Hỏi đáp" nếu là câu hỏi), cộng đồng chứa bài; làm mới hồ sơ của mình; các tab khác đánh dấu cũ.
- `findCachedPost`: mở `/post/[id]` từ feed/thông báo hiện ngay nếu bài đã có trong cache.

Thao tác **lạc quan**: cập nhật cache trước, gọi API, lỗi thì hoàn tác.

### 3.5. Tải trước (prefetch)
Rê chuột / focus: tab feed khác (`prefetchFeed`), link hồ sơ (PostCard, bình luận, gợi ý theo dõi — `prefetchProfile`), link cộng đồng (`prefetchCommunity`). Code của trang do `<Link>` của Next tự tải trước.

### 3.6. Ảo hóa danh sách & vị trí cuộn — `VirtualPostList`
Feed và trang cộng đồng dùng `useWindowVirtualizer` (`@tanstack/react-virtual`): chỉ các bài gần màn hình (overscan 4) nằm trong DOM, bài xa được gỡ ⇒ feed dài không vượt ngưỡng DOM (~800–1.400 node theo Lighthouse) và không giữ ảnh đã giải mã ngoài màn hình. Kích thước đã đo của từng danh sách được lưu (`takeSnapshot` → `initialMeasurementsCache`, theo khóa `feed:<tab>` / `community:<slug>:<sort>`) nên khi Back, tổng chiều cao đúng và trình duyệt trả về đúng bài đang xem.

Dữ liệu JSON không giới hạn số trang (mỗi bài ~2–5 KB; 500 bài ≈ 1–2,5 MB) — thứ tốn bộ nhớ là DOM và ảnh, đã được ảo hóa giới hạn.

## 4. Kết quả đo (dev, localhost)

| Bước | Trước | Sau |
|---|---|---|
| Lần đầu vào mỗi trang | page data + `/auth/me` ×2 + gợi ý theo dõi | **chỉ 1 request dữ liệu trang** |
| Quay lại home / search / communities / profile | tải lại, spinner | **0 request, không spinner** (114–431 ms trong dev, chủ yếu là render) |
| Back từ trang khác về feed đã cuộn 1500 px | về đầu trang | **giữ đúng 1500 px** |
| Feed ảo hóa: số bài trong DOM khi cuộn hết feed | toàn bộ bài | **8–13 bài**; Back về đúng 2.600 px và đúng bài đang xem |
| Thích ở feed → trang chi tiết → thích lại ở hồ sơ → về feed | — | trạng thái khớp ở cả 3 nơi (5→4→4→5→5) |
| Thích bài ở feed rồi xem nơi khác | mỗi nơi một trạng thái | thống nhất qua `patchPostEverywhere` |

## 5. Quy tắc khi viết code mới

1. Dữ liệu từ API ⇒ `useQuery` / `useInfiniteQuery` với khóa từ `queryKeys`. **Không** fetch trong `useEffect` + `useState`.
2. Thêm nhánh cache mới chứa bài viết ⇒ thêm root vào `POST_BEARING_ROOTS`.
3. Thay đổi dữ liệu ⇒ cập nhật cache (`setQueryData` / helper trong `post-cache.ts`) hoặc `invalidateQueries`; không giữ bản sao trong zustand.
4. Trang cần đăng nhập ⇒ đặt trong `app/(app)/`, không tự render Header/Sidebar; cột phải riêng dùng `<PageAside>`.
5. Hiện spinner chỉ khi `isPending`/`isLoading` (chưa có dữ liệu), **không** dùng `isFetching`.

## 6. Còn lại (làm khi cần)

| Việc | Khi nào |
|---|---|
| Nút "Có N bài mới" (socket báo bài mới) thay vì tự làm mới | Khi có lượng đăng bài đều |
| `useDocuments`, study groups, campus → TanStack Query | Khi các tính năng này được dùng thật |
| Prefetch dữ liệu ở server (RSC + `HydrationBoundary`) | Khi cần SEO / tối ưu lần tải đầu |
