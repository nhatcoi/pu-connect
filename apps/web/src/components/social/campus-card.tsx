'use client'

import React from 'react'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar, Users, ExternalLink, Sparkles } from 'lucide-react'
import type { CampusEvent } from '@pu/schemas'

export function CampusEventCard({ event }: { event: CampusEvent }) {
  return (
    <Card className="hover:border-primary/50 transition-all hover:shadow-md flex flex-col justify-between">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-bold text-[10px] text-accent">
                {event.organizer}
              </span>
            </div>
            <h3 className="font-bold text-sm mt-1.5 text-foreground leading-snug">
              {event.title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 pb-3 text-xs text-muted-foreground space-y-2">
        <p className="line-clamp-2">{event.description}</p>
        
        <div className="space-y-1 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{event.startTime}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span>{event.location}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" /> {event.attendeesCount} người quan tâm
        </span>
        <Button size="sm" variant="outline" className="text-xs gap-1.5 hover:bg-accent hover:text-accent-foreground">
          <span>Đăng ký tham gia</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  )
}
