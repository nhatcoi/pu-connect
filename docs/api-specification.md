# 📡 Đặc tả API — PU Connector API Specification

Tài liệu này mô tả các Endpoint RESTful và WebSocket Events của hệ thống **PU Connector**.

* **Base URL:** `http://localhost:4000/api` (hoặc `http://<LAN_IP>:4000/api`)
* **Format Response:** Mọi response thành công đều được chuẩn hóa qua `TransformInterceptor`:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
* **Format Error:** Được chuẩn hóa qua `AllExceptionsFilter`:
  ```json
  {
    "statusCode": 400,
    "timestamp": "2026-08-22T08:00:00.000Z",
    "path": "/api/...",
    "message": "Chi tiết lỗi"
  }
  ```

---

## 1. Xác thực & Tài khoản (`/api/auth`)

### 1.1. Đăng ký tài khoản
* **Endpoint:** `POST /api/auth/register`
* **Request Body:**
  ```json
  {
    "email": "alex@example.com",
    "username": "alex_nguyen",
    "displayName": "Alex Nguyễn",
    "password": "secure_password_123"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "user_12345",
        "email": "alex@example.com",
        "username": "alex_nguyen",
        "displayName": "Alex Nguyễn",
        "avatarUrl": null,
        "createdAt": "2026-08-22T08:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### 1.2. Đăng nhập
* **Endpoint:** `POST /api/auth/login`
* **Request Body:**
  ```json
  {
    "emailOrUsername": "alex_nguyen",
    "password": "secure_password_123"
  }
  ```
* **Response (200 OK):** Trả về `user` profile và cookie `pu_session`.

### 1.3. Khởi tạo hồ sơ tân sinh viên (Onboarding)
* **Endpoint:** `POST /api/auth/onboarding` (Yêu cầu đăng nhập - Session Cookie)
* **Request Body:**
  ```json
  {
    "studentId": "22010001",
    "faculty": "FIT",
    "academicYear": "K16 (2022-2026)",
    "courses": ["IT101", "MATH201"],
    "skills": ["Next.js", "React Native", "Python AI"],
    "bio": "Sinh viên K16 CNTT - Đam mê AI & Lập trình Web",
    "followUserIds": ["gv_nguyenvanha", "tranminhduc"]
  }
  ```
* **Response (200 OK):** Cập nhật `is_onboarded = true`, cộng thưởng `+100` Điểm danh vọng và trả về User Profile mới nhất.

### 1.4. Đăng xuất tài khoản (Logout)
* **Endpoint:** `POST /api/auth/logout` (Yêu cầu đăng nhập - Session Cookie)
* **Request Body:** Không có (Empty)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Đăng xuất thành công"
    }
  }
  ```
* **Cookie Action:** Xóa `pu_session` và vô hiệu hóa session trên máy chủ.

### 1.5. Quyền riêng tư & Tùy chọn tính năng (`/api/users`)
* **`PATCH /api/users/privacy`** — body là một phần của `{ showEmail, showStudentId, showClass, isPrivateProfile, showActivityStatus, personalization, showLikedPosts, showSavedPosts, showCommentedPosts }` (boolean, field lạ ⇒ 400). Trả về bộ đầy đủ. Tắt `personalization` ⇒ xóa dữ liệu hành vi.
* **`GET /api/users/:username/activity/:type`** — `type` = `liked` · `saved` · `commented`; query `limit` (≤ 50), `offset`, `before` (snapshot). Response giống `GET /api/posts` (`data`, `total`, `hasMore`, `nextOffset`, `snapshotAt`), sắp theo thời điểm hoạt động mới nhất. Chủ hồ sơ luôn xem được; người khác cần cờ `show*Posts` tương ứng, không bị chặn và (nếu hồ sơ riêng tư) đang theo dõi ⇒ ngược lại 403. `type` lạ ⇒ 400.
* GraphQL `userProfile` lọc `email` / `studentId` / `className` theo privacy, thêm `isContentLocked` và `activityTabs`.
* **`PATCH /api/users/preferences`** — body là một phần của `{ featuredComment, newPostsPill, aiSummary }` (boolean, mặc định `true`, field lạ ⇒ 400). Gộp vào `users.preferences` rồi trả về bộ đầy đủ:
  ```json
  { "success": true, "data": { "featuredComment": false, "newPostsPill": true, "aiSummary": true } }
  ```
* **`GET /api/users/suggestions?limit=20`** (cần đăng nhập, ≤ 50) — gợi ý theo dõi đã xếp hạng (bạn chung, đang theo dõi bạn, cùng lớp/khoa/khóa, sở thích trùng, hoạt động gần đây):
  ```json
  { "success": true, "data": [{ "id": "…", "username": "thutrang_ly", "displayName": "Lý Thu Trang", "role": "student", "faculty": "FBA", "className": "K17 TCNH 2", "isVerified": false, "bio": null, "avatarUrl": null, "reason": "mutual", "mutualCount": 7, "mutuals": [{ "username": "…", "displayName": "…", "avatarUrl": null }], "sharedTags": [] }] }
  ```
  `reason`: `follows_you` · `mutual` · `same_class` · `shared_interests` · `same_faculty` · `popular`.
* `GET /api/auth/me` trả kèm `privacySettings` và `preferences`. `featuredComment: false` ⇒ `GET /api/posts` trả `featuredComment: null` cho mọi bài.

### 1.6. Gợi ý mention (`/api/mentions`)
* **`GET /api/mentions/suggest?q=&postId=`** (cần đăng nhập) — `q` bỏ `@`, ≤ 30 ký tự (rỗng ⇒ chỉ người trong bài + đang theo dõi); `postId` UUID tùy chọn. Trả ≤ 8 người thật, đã loại chính mình và quan hệ chặn:
  ```json
  { "success": true, "data": [{ "id": "…", "username": "minhtuan_dev", "displayName": "Nguyễn Minh Tuấn", "avatarUrl": null, "isVerified": true, "reason": "participant" }] }
  ```
  `reason`: `author` · `participant` · `following` · `other`. N7AI (`@n7ai`) không có trong kết quả — client tự ghim.

---

## 2. Mạng xã hội & Bài viết (`/api/posts`)

### 2.1. Lấy danh sách bài viết (Feed)
* **Endpoint:** `GET /api/posts`
* **Query Parameters:**
  * `tag` *(optional)*: Lọc bài viết theo chủ đề (VD: `?tag=nextjs`).
  * `limit` *(optional)*: Số bài viết mỗi trang (default: 20).
  * `offset` *(optional)*: Vị trí bắt đầu (phân trang offset).
  * `feedType` *(optional)*: `for_you` (mặc định) · `following` · `qa` · `courses` · `bookmarks`.
  * `before` *(optional, ISO)*: Mốc snapshot — chỉ lấy bài `created_at ≤ before`. Gửi lại `snapshotAt` của trang đầu cho các trang sau để bài mới không làm lệch offset.
  * `after` *(optional, ISO)*: Chỉ lấy bài `created_at > after` (dùng khi bấm pill "bài mới").
* **Response thêm:** `snapshotAt` (ISO) và mỗi bài có `featuredComment` (`{ id, content, likesCount, repliesCount, reason: solution|top|earliest, createdAt, author }` hoặc `null`).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "post_1",
        "authorId": "user_1",
        "author": {
          "id": "user_1",
          "username": "techlead",
          "displayName": "Alex Nguyễn",
          "avatarUrl": null
        },
        "title": "Kiến trúc Monorepo hiệu năng cao",
        "content": "Nội dung bài viết hỗ trợ Markdown, LaTeX, Mermaid...",
        "tags": ["monorepo", "nextjs", "nestjs"],
        "mediaUrls": [],
        "attachedDocumentIds": ["doc_1"],
        "likesCount": 42,
        "commentsCount": 9,
        "sharesCount": 15,
        "isLikedByMe": false,
        "createdAt": "2026-08-22T08:00:00.000Z"
      }
    ]
  }
  ```

### 2.1b. Đếm bài mới (pill "bài mới")
* **Endpoint:** `GET /api/posts/new-since`
* **Query:** `since` (ISO, bắt buộc), `feedType`, `tag`, `course` — cùng bộ lọc với feed; không đếm bài của chính mình; tối đa 50.
* **Response (200 OK):** `{ "success": true, "data": { "count": 3, "authors": [{ "id", "username", "displayName", "avatarUrl" }] } }` — ≤ 3 tác giả, ưu tiên người mình đang theo dõi.
* **Realtime:** khi có bài mới, follower đang online nhận event socket `feed:new_post` `{ postId, authorId }` (chỉ là tín hiệu để gọi lại endpoint này).

### 2.2. Tạo bài viết mới
* **Endpoint:** `POST /api/posts`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Request Body:**
  ```json
  {
    "title": "Chia sẻ về Mermaid.js và KaTeX trong Next.js",
    "content": "Đây là nội dung Markdown có chứa $$E=mc^2$$...",
    "tags": ["nextjs", "markdown"],
    "attachedDocumentIds": ["doc_1"],
    "visibility": "public"
  }
  ```

### 2.3. Thích / Bỏ thích bài viết
* **Endpoint:** `POST /api/posts/:id/like`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response (200 OK):** Trả về post object sau khi đã cập nhật `likesCount` và `isLikedByMe`.

---

## 3. Kho Tài liệu & Tri thức (`/api/documents`)

### 3.1. Tìm kiếm & Lấy danh sách tài liệu
* **Endpoint:** `GET /api/documents`
* **Query Parameters:**
  * `type` *(optional)*: Lọc theo định dạng (`pdf`, `code`, `sheet`, `markdown`, `all`).
  * `search` *(optional)*: Từ khóa tìm kiếm theo tiêu đề hoặc tag.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "doc_1",
        "ownerId": "user_1",
        "owner": {
          "id": "user_1",
          "username": "techlead",
          "displayName": "Alex Nguyễn"
        },
        "title": "System Architecture Specification v2.4.pdf",
        "description": "Tài liệu đặc tả kiến trúc phân tán.",
        "type": "pdf",
        "fileUrl": "https://r2.puconnector.com/docs/system-spec.pdf",
        "fileSize": 4850000,
        "mimeType": "application/pdf",
        "tags": ["architecture", "spec"],
        "downloadCount": 312,
        "viewCount": 1420,
        "visibility": "public",
        "createdAt": "2026-08-22T08:00:00.000Z"
      }
    ]
  }
  ```

### 3.2. Đăng ký tài liệu mới
* **Endpoint:** `POST /api/documents`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Request Body:**
  ```json
  {
    "title": "Vector_Search_Notebook.ipynb",
    "description": "Thực nghiệm thuật toán HNSW với Python.",
    "type": "code",
    "fileUrl": "https://r2.puconnector.com/docs/vector.ipynb",
    "fileSize": 1250000,
    "mimeType": "application/x-ipynb+json",
    "tags": ["ai", "python"],
    "visibility": "public"
  }
  ```

### 3.3. Tải xuống tài liệu (Ghi nhận lượt tải)
* **Endpoint:** `POST /api/documents/:id/download`
* **Response (200 OK):** `{ "success": true, "data": { "downloadUrl": "https://..." } }`

---

## 4. WebSocket Realtime Gateway (`/socket.io`)

### 4.1. Kết nối & Tham gia phòng (Rooms)
```javascript
const socket = io('http://localhost:4000', {
  auth: { token: 'Bearer <JWT_TOKEN>' }
});

// Tham gia phòng bài viết hoặc phòng chat
socket.emit('join_room', { roomId: 'post_123' }, (response) => {
  console.log('Joined room:', response);
});
```

### 4.2. Các sự kiện lắng nghe (Listen Events):
* `new_message`: Nhận tin nhắn mới trong phòng chat.
* `new_comment`: Nhận bình luận mới trên bài viết đang mở.
* `notification`: Nhận thông báo tương tác (được nhắc tên, nhận reaction, v.v.).

---

## 5. GraphQL API Specification (`/graphql`)

* **Endpoint:** `POST http://localhost:4000/graphql`
* **Session Context:** Tự động xác thực qua Cookie `pu_session` (`credentials: 'include'`).

### 5.1. Bảng tin học thuật (`feed`)
```graphql
query GetFeed($limit: Int, $offset: Int, $tag: String) {
  feed(limit: $limit, offset: $offset, tag: $tag) {
    id
    title
    content
    tags
    likesCount
    commentsCount
    isLikedByMe
    createdAt
    author {
      id
      displayName
      username
      avatarUrl
      faculty
      reputationPoints
    }
  }
}
```

### 5.2. Hồ sơ cá nhân lồng quan hệ (`userProfile`)
```graphql
query GetUserProfile($username: String!) {
  userProfile(username: $username) {
    id
    displayName
    username
    email
    faculty
    studentId
    reputationPoints
    posts {
      id
      title
      likesCount
    }
    documents {
      id
      title
      fileSize
      downloadCount
    }
    studyGroups {
      id
      topic
      status
    }
  }
}
```

### 5.3. Kho tài liệu & đề thi (`documents`)
```graphql
query GetDocuments($faculty: String, $courseCode: String, $type: String) {
  documents(faculty: $faculty, courseCode: $courseCode, type: $type) {
    id
    title
    type
    fileSize
    downloadCount
    uploader {
      displayName
      faculty
    }
  }
}
```

### 5.4. Nhóm đồ án PBL (`studyGroups`)
```graphql
query GetStudyGroups($status: String, $courseCode: String) {
  studyGroups(status: $status, courseCode: $courseCode) {
    id
    topic
    skillsNeeded
    requiredMembers
    currentMembersCount
    leader {
      displayName
    }
  }
}
```

### 5.5. Tương tác bài viết (`toggleLikePost`)
```graphql
mutation ToggleLike($postId: String!) {
  toggleLikePost(postId: $postId)
}
```

