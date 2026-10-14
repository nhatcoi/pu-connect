import { Injectable, NotFoundException } from '@nestjs/common'
import type { UserInsight } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { AiSuggestionsService, SUGGESTION_POOL } from './ai-suggestions.service'
import { courseMentionSql } from './interest-profile.sql'
import { PROFILE_TTL_HOURS, personalizationOnSql } from './personalization.constants'

const RECENT_EVENTS = 30
const RECENT_QUESTIONS = 10

// Câu hỏi PU AI của người dùng (tin văn bản, chưa thu hồi) / User's PU AI questions
const AI_QUESTIONS_FROM = `FROM messages m JOIN conversations c ON c.id = m.conversation_id
  WHERE c.type = 'ai' AND m.sender_id = $1 AND m.kind = 'text' AND m.deleted_at IS NULL`

// Admin: ảnh chụp dữ liệu cá nhân hóa của 1 người — chỉ đọc, không tính lại hồ sơ
// Read-only personalisation snapshot for the admin console
@Injectable()
export class UserInsightService {
  constructor(
    private readonly db: DatabaseService,
    private readonly suggestions: AiSuggestionsService
  ) {}

  async get(userId: string): Promise<UserInsight> {
    const [user, interests, signals, eventCounts, events, questions] = await Promise.all([
      this.db.query(
        `SELECT id, username, display_name, avatar_url, major, class_name, interests, skills, last_seen_at,
                interests_updated_at, ${personalizationOnSql('u')} AS personalization,
                (interests_updated_at IS NULL OR interests_updated_at < NOW() - INTERVAL '${PROFILE_TTL_HOURS} hours') AS stale
         FROM users u WHERE id = $1 AND account_type = 'human'`,
        [userId]
      ),
      this.db.query(`SELECT kind, key, label, score FROM user_interests WHERE user_id = $1 ORDER BY score DESC`, [userId]),
      this.db.query(
        `SELECT (SELECT COUNT(*) FROM posts WHERE author_id = $1)::int AS posts_authored,
                (SELECT COUNT(*) FROM documents WHERE owner_id = $1)::int AS docs_uploaded,
                (SELECT COUNT(*) FROM saved_posts WHERE user_id = $1)::int AS posts_saved,
                (SELECT COUNT(*) FROM study_group_members WHERE user_id = $1)::int AS study_groups,
                (SELECT COUNT(*) FROM comments WHERE author_id = $1)::int AS comments,
                (SELECT COUNT(*) FROM post_reactions WHERE user_id = $1)::int AS reactions,
                (SELECT COUNT(*) ${AI_QUESTIONS_FROM})::int AS ai_questions`,
        [userId]
      ),
      this.db.query(`SELECT type, COUNT(*)::int AS n FROM user_events WHERE user_id = $1 GROUP BY type`, [userId]),
      this.db.query(
        `SELECT e.type, e.created_at,
                COALESCE(p.title, d.title, e.meta->>'q', e.meta->>'text') AS target,
                COALESCE(pc.code, dc.code) AS course, COALESCE(p.tags, d.tags, '{}') AS tags
         FROM user_events e
         LEFT JOIN posts p ON e.target_type = 'post' AND p.id = e.target_id
         LEFT JOIN courses pc ON pc.id = p.course_id
         LEFT JOIN documents d ON e.target_type = 'document' AND d.id = e.target_id
         LEFT JOIN courses dc ON dc.id = d.course_id
         WHERE e.user_id = $1 ORDER BY e.id DESC LIMIT ${RECENT_EVENTS}`,
        [userId]
      ),
      this.db.query(
        `SELECT m.created_at, left(m.content, 200) AS text,
                ARRAY(SELECT co.code FROM courses co WHERE ${courseMentionSql('m.content', 'co')}) AS courses
         ${AI_QUESTIONS_FROM} ORDER BY m.id DESC LIMIT ${RECENT_QUESTIONS}`,
        [userId]
      )
    ])

    const u = user.rows[0]
    if (!u) throw new NotFoundException('Người dùng không tồn tại')
    const s = signals.rows[0]
    const topics = interests.rows.map((r) => ({ kind: r.kind, key: r.key, label: r.label, score: Number(r.score) }))
    const iso = (v: Date | null) => (v ? new Date(v).toISOString() : null)

    return {
      user: {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        major: u.major,
        className: u.class_name,
        interests: u.interests ?? [],
        skills: u.skills ?? [],
        lastSeenAt: iso(u.last_seen_at)
      },
      personalization: u.personalization,
      profileUpdatedAt: iso(u.interests_updated_at),
      profileStale: u.stale,
      interests: topics,
      signals: {
        postsAuthored: s.posts_authored,
        docsUploaded: s.docs_uploaded,
        postsSaved: s.posts_saved,
        studyGroups: s.study_groups,
        comments: s.comments,
        reactions: s.reactions,
        aiQuestions: s.ai_questions
      },
      eventCounts: Object.fromEntries(eventCounts.rows.map((r) => [r.type, r.n])),
      recentEvents: events.rows.map((r) => ({
        type: r.type,
        createdAt: new Date(r.created_at).toISOString(),
        target: r.target,
        course: r.course,
        tags: r.tags
      })),
      aiQuestions: questions.rows.map((r) => ({ createdAt: new Date(r.created_at).toISOString(), text: r.text, courses: r.courses })),
      suggestionPreview: this.suggestions.fromTopics('ask', topics.slice(0, SUGGESTION_POOL)).items
    }
  }
}
