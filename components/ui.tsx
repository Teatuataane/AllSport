'use client'

import React, { useState, type CSSProperties, type ReactNode } from 'react'

/* ============================================================
   AllSport UI kit — shared brand primitives.
   Adapted from the AllSport Aotearoa design system.
   All colours come from the tokens in app/globals.css.
   ============================================================ */

export const RAINBOW = 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)'

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'blue' | 'rainbow' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: 13, gap: 6 },
  md: { padding: '12px 24px', fontSize: 15, gap: 8 },
  lg: { padding: '16px 34px', fontSize: 17, gap: 10 },
}

const BTN_VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--red)', color: 'var(--white)', boxShadow: 'var(--glow-red)' },
  blue: { background: 'var(--blue)', color: 'var(--white)', boxShadow: 'var(--glow-blue)' },
  rainbow: { background: RAINBOW, color: 'var(--white)' },
  secondary: { background: 'transparent', color: 'var(--white)', borderColor: 'var(--border-strong)' },
  ghost: { background: 'transparent', color: 'var(--grey-light)' },
}

export function buttonStyle(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false): CSSProperties {
  return {
    display: fullWidth ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-label)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderRadius: 999,
    border: '2px solid transparent',
    cursor: 'pointer',
    width: fullWidth ? '100%' : 'auto',
    transition: 'transform 120ms var(--ease), background 200ms, box-shadow 200ms, border-color 200ms',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    ...BTN_SIZES[size],
    ...BTN_VARIANTS[variant],
  }
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({ variant = 'primary', size = 'md', fullWidth = false, disabled, style, children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        ...buttonStyle(variant, size, fullWidth),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(0) scale(0.97)' }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)' }}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------- Card ---------- */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  rainbowTop?: boolean
  hover?: boolean
  padding?: number
}

export function Card({ rainbowTop = false, hover = false, padding = 24, style, children, ...rest }: CardProps) {
  const [h, setH] = useState(false)
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding,
        overflow: 'hidden',
        transition: 'transform 200ms var(--ease-out), border-color 200ms, box-shadow 200ms',
        ...(hover && h ? { transform: 'translateY(-4px)', borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-lg)' } : {}),
        ...style,
      }}
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => setH(false)}
      {...rest}
    >
      {rainbowTop && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: RAINBOW }} />}
      {children}
    </div>
  )
}

/* ---------- Badge ---------- */

export type BadgeColor = 'red' | 'amber' | 'pink' | 'purple' | 'blue' | 'green' | 'grey'

const BADGE_HEX: Record<BadgeColor, string> = {
  red: '#EA4742', amber: '#F9B051', pink: '#F397C0',
  purple: '#B87DB5', blue: '#2371BB', green: '#4DB26E', grey: '#888888',
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
  subtle?: boolean
}

export function Badge({ color = 'red', subtle = false, style, children, ...rest }: BadgeProps) {
  const c = BADGE_HEX[color]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-label)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontSize: 12,
        lineHeight: 1,
        padding: '5px 10px',
        borderRadius: 999,
        ...(subtle
          ? { background: hexA(c, 0.16), color: c, border: `1px solid ${hexA(c, 0.3)}` }
          : { background: c, color: color === 'amber' || color === 'pink' ? '#0a0a0a' : '#fff' }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}

/* ---------- Tag ---------- */

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  dot?: boolean
  active?: boolean
}

export function Tag({ dot = false, active = false, style, children, ...rest }: TagProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--font-label)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontSize: 13,
        lineHeight: 1,
        padding: '7px 14px',
        borderRadius: 999,
        background: active ? 'var(--white)' : 'transparent',
        color: active ? 'var(--black)' : 'var(--grey-light)',
        border: `1px solid ${active ? 'var(--white)' : 'var(--border-strong)'}`,
        cursor: rest.onClick ? 'pointer' : undefined,
        transition: 'color 200ms, border-color 200ms, background 200ms',
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: RAINBOW, flexShrink: 0 }} />}
      {children}
    </span>
  )
}

/* ---------- Input ---------- */

export const inputLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--grey-light)',
}

export function inputFieldStyle(focus: boolean, error?: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-body)',
    fontSize: 16,
    color: 'var(--white)',
    background: 'var(--surface-2)',
    border: `1px solid ${error ? 'var(--red)' : focus ? 'var(--blue)' : 'var(--border-strong)'}`,
    borderRadius: 10,
    padding: '12px 14px',
    outline: 'none',
    boxShadow: focus && !error ? '0 0 0 3px rgba(35,113,187,0.35)' : 'none',
    transition: 'border-color 160ms, box-shadow 160ms',
    width: '100%',
    boxSizing: 'border-box',
  }
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  wrapStyle?: CSSProperties
}

export function Input({ label, hint, error, id, style, wrapStyle, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false)
  const reactId = React.useId()
  const inputId = id || reactId
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...wrapStyle }}>
      {label && <label htmlFor={inputId} style={inputLabelStyle}>{label}</label>}
      <input
        id={inputId}
        onFocus={e => { setFocus(true); rest.onFocus?.(e) }}
        onBlur={e => { setFocus(false); rest.onBlur?.(e) }}
        style={{ ...inputFieldStyle(focus, !!error), ...style }}
        {...rest}
      />
      {(hint || error) && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: error ? 'var(--red)' : 'var(--grey)' }}>
          {error || hint}
        </span>
      )}
    </div>
  )
}

/* ---------- Select ---------- */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  wrapStyle?: CSSProperties
}

export function Select({ label, id, style, wrapStyle, children, ...rest }: SelectProps) {
  const [focus, setFocus] = useState(false)
  const reactId = React.useId()
  const selectId = id || reactId
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...wrapStyle }}>
      {label && <label htmlFor={selectId} style={inputLabelStyle}>{label}</label>}
      <select
        id={selectId}
        onFocus={e => { setFocus(true); rest.onFocus?.(e) }}
        onBlur={e => { setFocus(false); rest.onBlur?.(e) }}
        style={{ ...inputFieldStyle(focus), appearance: 'none', cursor: 'pointer', ...style }}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
}

/* ---------- Dialog ---------- */

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  maxWidth?: number
  children: ReactNode
}

export function Dialog({ open, onClose, title, maxWidth = 480, children }: DialogProps) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
          width: '100%',
          maxWidth,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: RAINBOW }} />
        {title && (
          <h3 style={{ fontSize: 26, marginBottom: 16, marginTop: 4 }}>{title}</h3>
        )}
        {children}
      </div>
    </div>
  )
}

/* ---------- Brand ---------- */

interface RainbowTextProps {
  children: ReactNode
  style?: CSSProperties
}

export function RainbowText({ children, style }: RainbowTextProps) {
  return (
    <span
      style={{
        background: RAINBOW,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

export function RainbowRule({ height = 5, radius = 0, style }: { height?: number; radius?: number; style?: CSSProperties }) {
  return <div style={{ height, width: '100%', borderRadius: radius, background: RAINBOW, ...style }} />
}

export function SectionLabel({ children, tick = true, color = 'var(--grey-light)', style }: { children: ReactNode; tick?: boolean; color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-label)',
        textTransform: 'uppercase', letterSpacing: '0.18em',
        fontWeight: 600, fontSize: 14, color, ...style,
      }}
    >
      {tick && <span style={{ width: 22, height: 3, borderRadius: 3, background: RAINBOW, flexShrink: 0 }} />}
      {children}
    </span>
  )
}

export function StatBlock({ value, label, rainbow = false, align = 'left', size = 72, style }: { value: ReactNode; label: ReactNode; rainbow?: boolean; align?: 'left' | 'center' | 'right'; size?: number; style?: CSSProperties }) {
  return (
    <div style={{ textAlign: align, ...style }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size, lineHeight: 0.9, letterSpacing: '0.01em',
          ...(rainbow
            ? { background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
            : { color: 'var(--white)' }),
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-label)',
          textTransform: 'uppercase', letterSpacing: '0.14em',
          fontSize: 14, fontWeight: 500, color: 'var(--grey)', marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}
