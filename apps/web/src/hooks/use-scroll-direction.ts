'use client'

import { useState, useEffect } from 'react'

interface ScrollDirectionState {
  scrollDirection: 'up' | 'down' | null
  isHeaderVisible: boolean
  isAtTop: boolean
  scrollY: number
}

export function useScrollDirection(threshold: number = 8): ScrollDirectionState {
  const [scrollState, setScrollState] = useState<ScrollDirectionState>({
    scrollDirection: null,
    isHeaderVisible: true,
    isAtTop: true,
    scrollY: 0
  })

  useEffect(() => {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop
    let ticking = false

    const updateScrollDir = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop
      const isAtTop = currentScrollY <= 20

      if (isAtTop) {
        setScrollState({
          scrollDirection: null,
          isHeaderVisible: true,
          isAtTop: true,
          scrollY: currentScrollY
        })
        lastScrollY = currentScrollY > 0 ? currentScrollY : 0
        ticking = false
        return
      }

      if (Math.abs(currentScrollY - lastScrollY) < threshold) {
        ticking = false
        return
      }

      const isScrollingDown = currentScrollY > lastScrollY && currentScrollY > 50

      setScrollState({
        scrollDirection: isScrollingDown ? 'down' : 'up',
        isHeaderVisible: !isScrollingDown,
        isAtTop: false,
        scrollY: currentScrollY
      })

      lastScrollY = currentScrollY > 0 ? currentScrollY : 0
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrollState
}
