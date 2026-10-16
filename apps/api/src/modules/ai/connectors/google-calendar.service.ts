import { Injectable } from '@nestjs/common'
import type { ConnectorSource } from './google-drive.service'
import { GoogleOAuthService } from './google-oauth.service'

const EVENTS_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TZ = 'Asia/Ho_Chi_Minh'

type CalendarEvent = {
  id: string
  summary?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

const fmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtDay = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })

// Connector Google Calendar (calendar.readonly): lịch sắp tới của lịch chính ⇒ 1 nguồn gọn cho PU AI
// (lập lộ trình ôn quanh lịch học / lịch thi, hỏi "tuần này mình bận gì")
@Injectable()
export class GoogleCalendarService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async upcoming(userId: string, days: number, maxEvents: number): Promise<ConnectorSource[]> {
    const token = await this.oauth.accessToken(userId, 'google_calendar')
    if (!token) return []
    const now = new Date()
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + days * 86_400_000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(maxEvents),
      timeZone: TZ,
      fields: 'items(id,summary,location,start,end)'
    })
    const items = ((await (await this.oauth.get(`${EVENTS_API}?${params}`, token)).json()) as { items?: CalendarEvent[] }).items ?? []
    if (!items.length) return [{ id: 'calendar', title: 'Lịch Google của tôi', body: `Không có sự kiện nào trong ${days} ngày tới.` }]
    const body = items
      .map((e) => {
        const when = e.start?.dateTime ? fmt.format(new Date(e.start.dateTime)) : e.start?.date ? `${fmtDay.format(new Date(e.start.date))} (cả ngày)` : '?'
        return `- ${when}: ${e.summary || '(không tiêu đề)'}${e.location ? ` @ ${e.location}` : ''}`
      })
      .join('\n')
    return [{ id: 'calendar', title: `Lịch Google của tôi (${days} ngày tới)`, body }]
  }
}
