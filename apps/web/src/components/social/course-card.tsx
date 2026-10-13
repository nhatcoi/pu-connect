'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap, FileText, MessageSquare, Star, ArrowRight } from 'lucide-react'
import type { Course } from '@pu/schemas'

export function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="hover:border-primary/50 transition-all hover:shadow-md flex flex-col justify-between">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-xs text-primary font-mono">
                {course.code}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {course.credits} Tín chỉ
              </span>
            </div>
            <h3 className="font-bold text-sm mt-1.5 text-foreground leading-snug line-clamp-1">
              {course.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
            <Star className="h-3 w-3 fill-amber-500" />
            <span>{course.rating.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 pb-3 text-xs text-muted-foreground space-y-2">
        <p className="line-clamp-2">{course.description || 'Chưa có mô tả chi tiết cho học phần này.'}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" /> {course.documentCount} tài liệu & đề thi
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5 text-accent" /> {course.postCount} thảo luận
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Link href={`/courses/${encodeURIComponent(course.code)}`} className="w-full">
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground">
            <span>Xem kho môn học</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
