import React, { useState, useEffect, useMemo } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { DocViewer } from './components/DocViewer'
import { TableOfContents } from './components/TableOfContents'
import { SearchModal } from './components/SearchModal'
import { getAllDocs, getCategories, getDocBySlug } from './lib/docs-service'

export function App() {
  const docs = useMemo(() => getAllDocs(), [])
  const categories = useMemo(() => getCategories(), [])

  // Đọc slug từ URL hash (#overview hoặc #core/01-social-feed-and-posts)
  const getInitialSlug = () => {
    const hash = window.location.hash.replace(/^#/, '')
    return hash || 'index'
  }

  const [activeSlug, setActiveSlug] = useState<string>(getInitialSlug)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Đồng bộ hash URL khi người dùng bấm Back / Forward
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash && hash !== activeSlug) {
        setActiveSlug(hash)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [activeSlug])

  // Lắng nghe phím tắt Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const currentDoc = useMemo(() => {
    return getDocBySlug(activeSlug) || docs[0]
  }, [activeSlug, docs])

  const handleSelectDoc = (slug: string) => {
    setActiveSlug(slug)
    window.location.hash = slug
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onGoHome={() => handleSelectDoc('index')}
      />

      <div className="flex-1 w-full max-w-[1600px] mx-auto flex">
        {/* Left Sidebar */}
        <Sidebar
          categories={categories}
          docs={docs}
          activeSlug={activeSlug}
          onSelect={handleSelectDoc}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Center Content */}
        <main className="flex-1 min-w-0 pb-16">
          {currentDoc && (
            <DocViewer
              doc={currentDoc}
              onNavigate={handleSelectDoc}
            />
          )}
        </main>

        {/* Right Table of Contents */}
        {currentDoc && <TableOfContents headings={currentDoc.headings} />}
      </div>

      {/* Global Search Modal */}
      <SearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSelectDoc}
      />
    </div>
  )
}
