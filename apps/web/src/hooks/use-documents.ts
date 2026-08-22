import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store'
import { graphqlClient } from '@/lib/graphql-client'
import type { DocumentItem } from '@pu/schemas'

const GET_DOCUMENTS_QUERY = `
  query GetDocuments($faculty: String, $courseCode: String, $type: String) {
    documents(faculty: $faculty, courseCode: $courseCode, type: $type) {
      id
      uploaderId
      courseId
      title
      description
      type
      fileUrl
      fileSize
      faculty
      courseCode
      tags
      downloadCount
      viewCount
      isVerified
      createdAt
      uploader {
        id
        displayName
        username
        avatarUrl
        faculty
        role
        reputationPoints
      }
    }
  }
`

export function useDocuments(faculty?: string, courseCode?: string) {
  const documents = useAppStore((state) => state.documents)
  const setDocuments = useAppStore((state) => state.setDocuments)
  const [isLoading, setIsLoading] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await graphqlClient<{ documents: DocumentItem[] }>(GET_DOCUMENTS_QUERY, {
        faculty: faculty || undefined,
        courseCode: courseCode || undefined
      })
      if (data && Array.isArray(data.documents)) {
        setDocuments(data.documents)
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false)
    }
  }, [setDocuments, faculty, courseCode])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return {
    documents,
    isLoading,
    refetch: fetchDocuments
  }
}
