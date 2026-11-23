'use client'

import { useEffect } from 'react'
import { startLoading } from './loadingBar'

/**
 * Keep the top loading bar running while `busy` is true. Pages pass "fresh
 * numbers not in yet", so the bar shows even when a saved copy is on screen.
 * The bar only appears when the wait passes its delay (LoadingBar), so a fast
 * answer never flashes it.
 */
export function useLoadingBar(busy: boolean): void {
  useEffect(() => {
    if (!busy) return
    return startLoading()
  }, [busy])
}
