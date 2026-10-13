# 🗄️ ERD — Cơ sở dữ liệu (tự sinh)

> ⚙️ **File tự sinh** bởi `pnpm docs:erd` (`scripts/gen-erd.mjs`) từ database thật. **Không sửa tay.**
> Chạy lại sau mỗi migration. Nguồn: `information_schema` + `pg_constraint`.

Tổng: **30 bảng**, **49 khóa ngoại**. Ký hiệu: `PK` khóa chính · `FK` khóa ngoại · `UK` unique · `||` bắt buộc · `|o` có thể NULL.

## 1. Tổng quan quan hệ

```mermaid
erDiagram
  campus_events {
    string no_fk
  }
  search_logs {
    string no_fk
  }
  user_sessions {
    string no_fk
  }
  users |o--o{ admin_audit_logs : "admin_id"
  users ||--o{ ai_runs : "bot_id"
  users ||--o{ ai_runs : "requester_id"
  users ||--o{ comments : "author_id"
  comments |o--o{ comments : "parent_id"
  posts ||--o{ comments : "post_id"
  communities ||--o{ community_members : "community_id"
  users ||--o{ community_members : "user_id"
  conversations ||--o{ conversation_members : "conversation_id"
  users ||--o{ conversation_members : "user_id"
  users |o--o{ conversations : "created_by"
  study_groups |o--o{ conversations : "study_group_id"
  faculties |o--o{ courses : "faculty_id"
  documents ||--o{ document_chunks : "document_id"
  courses |o--o{ documents : "course_id"
  users ||--o{ documents : "owner_id"
  users |o--o{ mentions : "author_id"
  users ||--o{ mentions : "mentioned_user_id"
  messages ||--o{ message_reactions : "message_id"
  users ||--o{ message_reactions : "user_id"
  conversations ||--o{ messages : "conversation_id"
  users |o--o{ messages : "pinned_by"
  messages |o--o{ messages : "reply_to_id"
  users |o--o{ messages : "sender_id"
  users |o--o{ notifications : "actor_id"
  users ||--o{ notifications : "recipient_id"
  post_polls ||--o{ post_poll_options : "poll_id"
  posts ||--o{ post_polls : "post_id"
  post_poll_options ||--o{ post_poll_votes : "option_id"
  post_polls ||--o{ post_poll_votes : "poll_id"
  users ||--o{ post_poll_votes : "user_id"
  posts ||--o{ post_reactions : "post_id"
  users ||--o{ post_reactions : "user_id"
  posts ||--o{ post_reports : "post_id"
  users ||--o{ post_reports : "reporter_id"
  users |o--o{ post_reports : "resolved_by"
  users ||--o{ posts : "author_id"
  communities |o--o{ posts : "community_id"
  courses |o--o{ posts : "course_id"
  users |o--o{ posts : "hidden_by"
  users ||--o{ push_subscriptions : "user_id"
  posts ||--o{ saved_posts : "post_id"
  users ||--o{ saved_posts : "user_id"
  study_groups ||--o{ study_group_members : "group_id"
  users ||--o{ study_group_members : "user_id"
  courses |o--o{ study_groups : "course_id"
  users ||--o{ study_groups : "leader_id"
  users ||--o{ user_follows : "follower_id"
  users ||--o{ user_follows : "following_id"
```

## 2. Identity & Social graph

```mermaid
erDiagram
  users {
    uuid id PK
    varchar email UK
    varchar username UK
    varchar password_hash
    varchar display_name
    varchar student_id
    varchar faculty
    varchar academic_year
    varchar avatar_url
    varchar bio
    user_role_enum role
    account_status_enum status
    integer reputation_points
    boolean is_onboarded
    text_array skills
    text_array interests
    timestamptz created_at
    timestamptz updated_at
    varchar major
    varchar class_name
    boolean is_verified
    timestamptz verified_at
    jsonb privacy_settings
    varchar location
    varchar website
    varchar birth_date
    varchar banner_url
    varchar school
    varchar google_id
    varchar auth_provider
    boolean email_verified
    timestamptz email_verified_at
    varchar verify_token_hash
    timestamptz verify_token_expires
    timestamptz verify_sent_at
    varchar account_type
    jsonb notification_settings
    varchar reset_token_hash
    timestamptz reset_token_expires
    timestamptz reset_sent_at
    timestamptz password_changed_at
    tsvector search_tsv
    timestamptz suspended_at
    varchar suspended_reason
  }
  user_follows {
    uuid follower_id PK,FK
    uuid following_id PK,FK
    timestamptz created_at
  }
  user_sessions {
    varchar sid PK
    json sess
    timestamp expire
  }
  mentions {
    varchar source_type PK
    text source_id PK
    uuid mentioned_user_id PK,FK
    uuid author_id FK
    timestamptz created_at
  }
  notifications {
    uuid id PK
    uuid recipient_id FK
    uuid actor_id FK
    notification_type_enum type
    varchar title
    text message
    varchar entity_id
    varchar entity_type
    boolean is_read
    timestamptz created_at
    varchar group_key
    uuid_array actor_ids
    integer actors_count
    varchar link
    timestamptz updated_at
    timestamptz push_sent_at
  }
  users ||--o{ mentions : "author_id"
  users ||--o{ mentions : "mentioned_user_id"
  users ||--o{ notifications : "actor_id"
  users ||--o{ notifications : "recipient_id"
  users ||--o{ user_follows : "follower_id"
  users ||--o{ user_follows : "following_id"
```

Liên kết ra ngoài nhóm: `admin_audit_logs.admin_id → users`, `ai_runs.bot_id → users`, `ai_runs.requester_id → users`, `comments.author_id → users`, `community_members.user_id → users`, `conversation_members.user_id → users`, `conversations.created_by → users`, `documents.owner_id → users`, `message_reactions.user_id → users`, `messages.pinned_by → users`, `messages.sender_id → users`, `post_poll_votes.user_id → users`, `post_reactions.user_id → users`, `post_reports.reporter_id → users`, `post_reports.resolved_by → users`, `posts.author_id → users`, `posts.hidden_by → users`, `push_subscriptions.user_id → users`, `saved_posts.user_id → users`, `study_group_members.user_id → users`, `study_groups.leader_id → users`

## 3. Feed & Q&A

```mermaid
erDiagram
  posts {
    uuid id PK
    uuid author_id FK
    uuid course_id FK
    post_type_enum post_type
    varchar title
    varchar slug UK
    text content
    text_array tags
    text_array media_urls
    text_array attached_document_ids
    varchar visibility
    boolean is_pinned
    boolean is_resolved
    integer likes_count
    integer comments_count
    integer shares_count
    integer views_count
    timestamptz created_at
    timestamptz updated_at
    uuid community_id FK
    tsvector search_tsv
    timestamptz hidden_at
    uuid hidden_by FK
    varchar hidden_reason
  }
  comments {
    uuid id PK
    uuid post_id FK
    uuid author_id FK
    uuid parent_id FK
    text content
    integer likes_count
    boolean is_solution
    timestamptz created_at
    timestamptz updated_at
  }
  post_reactions {
    uuid post_id PK,FK
    uuid user_id PK,FK
    reaction_type_enum reaction
    timestamptz created_at
  }
  saved_posts {
    uuid user_id PK,FK
    uuid post_id PK,FK
    varchar collection_name
    timestamptz saved_at
  }
  post_reports {
    uuid id PK
    uuid post_id FK
    uuid reporter_id FK
    varchar reason
    text details
    varchar status
    timestamptz created_at
    varchar resolution
    uuid resolved_by FK
    timestamptz resolved_at
  }
  post_polls {
    uuid id PK
    uuid post_id FK,UK
    varchar question
    integer total_votes
    timestamptz expires_at
    timestamptz created_at
  }
  post_poll_options {
    uuid id PK
    uuid poll_id FK
    varchar option_text
    integer votes_count
    integer display_order
  }
  post_poll_votes {
    uuid poll_id PK,FK
    uuid option_id FK
    uuid user_id PK,FK
    timestamptz voted_at
  }
  comments ||--o{ comments : "parent_id"
  posts ||--o{ comments : "post_id"
  post_polls ||--o{ post_poll_options : "poll_id"
  posts ||--o{ post_polls : "post_id"
  post_poll_options ||--o{ post_poll_votes : "option_id"
  post_polls ||--o{ post_poll_votes : "poll_id"
  posts ||--o{ post_reactions : "post_id"
  posts ||--o{ post_reports : "post_id"
  posts ||--o{ saved_posts : "post_id"
```

Liên kết ra ngoài nhóm: `comments.author_id → users`, `post_poll_votes.user_id → users`, `post_reactions.user_id → users`, `post_reports.reporter_id → users`, `post_reports.resolved_by → users`, `posts.author_id → users`, `posts.community_id → communities`, `posts.course_id → courses`, `posts.hidden_by → users`, `saved_posts.user_id → users`

## 4. Communities

```mermaid
erDiagram
  communities {
    uuid id PK
    varchar slug UK
    varchar name
    text description
    varchar community_type
    varchar avatar_url
    varchar banner_url
    jsonb rules
    integer members_count
    integer posts_count
    timestamptz created_at
    timestamptz updated_at
  }
  community_members {
    uuid community_id PK,FK
    uuid user_id PK,FK
    varchar role
    timestamptz joined_at
  }
  communities ||--o{ community_members : "community_id"
```

Liên kết ra ngoài nhóm: `community_members.user_id → users`, `posts.community_id → communities`

## 5. Academic

```mermaid
erDiagram
  faculties {
    uuid id PK
    varchar code UK
    varchar name
    varchar short_name
    text description
    varchar logo_url
    varchar dean_name
    varchar office_location
    timestamptz created_at
    timestamptz updated_at
  }
  courses {
    uuid id PK
    varchar code UK
    varchar name
    integer credits
    uuid faculty_id FK
    varchar faculty_code
    text description
    varchar syllabus_url
    numeric rating_avg
    integer document_count
    integer post_count
    timestamptz created_at
    timestamptz updated_at
    tsvector search_tsv
  }
  documents {
    uuid id PK
    uuid owner_id FK
    uuid course_id FK
    doc_type_enum doc_type
    varchar type
    varchar title
    varchar slug UK
    text description
    varchar file_url
    bigint file_size
    varchar mime_type
    text_array tags
    varchar visibility
    integer download_count
    integer view_count
    numeric rating_avg
    timestamptz created_at
    timestamptz updated_at
    tsvector search_tsv
  }
  document_chunks {
    uuid id PK
    uuid document_id FK,UK
    integer chunk_index UK
    text content_text
    integer token_count
    vector embedding
    timestamptz created_at
  }
  study_groups {
    uuid id PK
    uuid leader_id FK
    uuid course_id FK
    varchar course_code
    varchar course_name
    varchar name
    varchar slug UK
    varchar topic
    group_type_enum group_type
    text description
    text_array tech_stack
    integer max_members
    integer current_members
    group_status_enum status
    timestamptz created_at
    timestamptz updated_at
    tsvector search_tsv
  }
  study_group_members {
    uuid group_id PK,FK
    uuid user_id PK,FK
    group_member_role_enum role
    timestamptz joined_at
  }
  campus_events {
    uuid id PK
    varchar organizer
    varchar organizer_type
    varchar title
    text description
    varchar location
    varchar start_time
    varchar end_time
    varchar banner_url
    varchar registration_url
    integer attendees_count
    text_array tags
    timestamptz created_at
  }
  faculties ||--o{ courses : "faculty_id"
  documents ||--o{ document_chunks : "document_id"
  courses ||--o{ documents : "course_id"
  study_groups ||--o{ study_group_members : "group_id"
  courses ||--o{ study_groups : "course_id"
```

Liên kết ra ngoài nhóm: `conversations.study_group_id → study_groups`, `documents.owner_id → users`, `posts.course_id → courses`, `study_group_members.user_id → users`, `study_groups.leader_id → users`

## 6. Chưa phân nhóm (cập nhật DOMAINS trong scripts/gen-erd.mjs)

```mermaid
erDiagram
  admin_audit_logs {
    bigint id PK
    uuid admin_id FK
    varchar action
    varchar target_type
    text target_id
    jsonb details
    timestamptz created_at
  }
  ai_runs {
    uuid id PK
    uuid bot_id FK
    uuid requester_id FK
    varchar trigger
    varchar task
    jsonb source_ref
    jsonb reply_ref
    varchar status
    varchar model
    integer input_tokens
    integer output_tokens
    text error
    integer latency_ms
    timestamptz created_at
    timestamptz finished_at
  }
  conversation_members {
    uuid conversation_id PK,FK
    uuid user_id PK,FK
    varchar role
    bigint last_read_message_id
    timestamptz joined_at
    timestamptz left_at
    timestamptz muted_until
    timestamptz pinned_at
    timestamptz push_shown_at
  }
  conversations {
    uuid id PK
    varchar type
    varchar title
    varchar avatar_url
    uuid created_by FK
    varchar direct_key UK
    bigint last_message_id
    timestamptz last_message_at
    timestamptz created_at
    uuid study_group_id FK
  }
  message_reactions {
    bigint message_id PK,FK
    uuid user_id PK,FK
    varchar emoji PK
    timestamptz created_at
  }
  messages {
    bigint id PK
    uuid conversation_id FK
    uuid sender_id FK,UK
    uuid client_msg_id UK
    varchar kind
    text content
    jsonb blocks
    bigint reply_to_id FK
    varchar status
    timestamptz deleted_at
    timestamptz created_at
    jsonb attachments
    timestamptz edited_at
    timestamptz pinned_at
    uuid pinned_by FK
    jsonb meta
  }
  push_subscriptions {
    uuid id PK
    uuid user_id FK
    text endpoint UK
    varchar p256dh
    varchar auth
    varchar user_agent
    integer failure_count
    timestamptz created_at
    timestamptz last_used_at
  }
  search_logs {
    bigint id PK
    varchar q_norm
    varchar search_type
    integer result_count
    timestamptz created_at
  }
  conversations ||--o{ conversation_members : "conversation_id"
  messages ||--o{ message_reactions : "message_id"
  conversations ||--o{ messages : "conversation_id"
  messages ||--o{ messages : "reply_to_id"
```

Liên kết ra ngoài nhóm: `admin_audit_logs.admin_id → users`, `ai_runs.bot_id → users`, `ai_runs.requester_id → users`, `conversation_members.user_id → users`, `conversations.created_by → users`, `conversations.study_group_id → study_groups`, `message_reactions.user_id → users`, `messages.pinned_by → users`, `messages.sender_id → users`, `push_subscriptions.user_id → users`
