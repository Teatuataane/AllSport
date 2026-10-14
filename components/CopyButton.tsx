'use client'
// A small client island so a server page can offer one-tap copy (the koha
// account number). Falls back silently: the value is still selectable text.
import { useState } from 'react'

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked (old browser, insecure context): nothing to do.
        }
      }}
      style={{
        fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.12em',
        textTransform: 'uppercase', background: 'transparent', color: copied ? 'var(--green)' : 'var(--grey-light)',
        border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
