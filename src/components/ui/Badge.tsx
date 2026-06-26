import type { ReactNode } from 'react'

type BadgeVariant = 'blue' | 'orange' | 'purple' | 'gray' | 'green' | 'cyan' | 'default'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const variants: Record<BadgeVariant, string> = {
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  orange: 'bg-accent-orange/15 text-accent-orange border-accent-orange/25',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/25',
  gray: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  green: 'bg-accent-green/15 text-accent-green border-accent-green/25',
  cyan: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/25',
  default: 'bg-bg-elevated text-slate-400 border-bg-border',
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-md font-mono font-medium
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}
        ${variants[variant]}`}
    >
      {children}
    </span>
  )
}

export function StepBadge({ number, active }: { number: number; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 transition-all duration-200
        ${active
          ? 'bg-accent-green text-bg-base shadow-md shadow-accent-green/20'
          : 'bg-bg-elevated border border-bg-border text-slate-400'
        }`}
    >
      {number}
    </span>
  )
}
