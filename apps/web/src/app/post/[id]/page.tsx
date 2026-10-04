'use client'

import React, { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileX2, Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { PostCard } from '@/components/social/post-card'
import { apiClient } from '@/lib/api-client'
import type { PostItem } from '@pu/schemas'

// Trang chi tiết bài viết: /post/{id}?comment={commentId} (đích điều hướng của thông báo)
function PostDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const highlightCommentId = useSearchParams().get('comment')
  const [post, setPost] = useState<PostItem | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    apiClient<{ success: boolean; data: PostItem }>(`/posts/${id}`)
      .then((res) => {
        if (cancelled) return
        setPost(res.data)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('missing'))
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AppShell>
      <div className="mx-2 sm:mx-0 mb-2 flex items-center gap-2">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/home'))}
          aria-label="Quay lại"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold">Bài viết</h1>
      </div>

      <div className="px-2 sm:px-0">
        {status === 'loading' ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : status === 'missing' || !post ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card py-14 text-center text-muted-foreground">
            <FileX2 className="h-8 w-8 opacity-60" />
            <p className="text-sm">Bài viết không tồn tại hoặc đã bị xóa</p>
            <Link href="/home" className="text-xs font-semibold text-primary hover:underline">
              Về bảng tin
            </Link>
          </div>
        ) : (
          <PostCard
            key={post.id}
            post={post}
            variant="card"
            defaultCommentsOpen
            highlightCommentId={highlightCommentId}
            onDeleteSuccess={() => router.push('/home')}
          />
        )}
      </div>
    </AppShell>
  )
}

export default function PostDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <PostDetail />
    </Suspense>
  )
}
