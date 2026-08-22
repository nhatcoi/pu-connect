import { Injectable, NotFoundException } from '@nestjs/common'
import type { CampusEvent } from '@pu/schemas'

@Injectable()
export class CampusService {
  private events: CampusEvent[] = []

  async findAllEvents(): Promise<CampusEvent[]> {
    return this.events
  }

  async createEvent(data: Omit<CampusEvent, 'id' | 'attendeesCount'>): Promise<CampusEvent> {
    const newEvent: CampusEvent = {
      id: `event_${Date.now()}`,
      title: data.title,
      organizer: data.organizer,
      organizerType: data.organizerType,
      description: data.description,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      bannerUrl: data.bannerUrl,
      registrationUrl: data.registrationUrl,
      attendeesCount: 0,
      tags: data.tags || []
    }

    this.events.unshift(newEvent)
    return newEvent
  }
}
