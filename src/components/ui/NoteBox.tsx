import { Info, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'

type NoteType = 'info' | 'warn' | 'ok' | 'tip'

interface NoteBoxProps {
  type?: NoteType
  title?: string
  children: ReactNode
}

const config: Record<NoteType, { icon: typeof Info; color: string; bg: string; border: string; label: string }> = {
  info: {
    icon: Info,
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/5',
    border: 'border-accent-cyan/20',
    label: 'Info',
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-accent-orange',
    bg: 'bg-accent-orange/5',
    border: 'border-accent-orange/20',
    label: 'Attention',
  },
  ok: {
    icon: CheckCircle,
    color: 'text-accent-green',
    bg: 'bg-accent-green/5',
    border: 'border-accent-green/20',
    label: 'OK',
  },
  tip: {
    icon: Lightbulb,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/5',
    border: 'border-accent-purple/20',
    label: 'Astuce',
  },
}

export function NoteBox({ type = 'info', title, children }: NoteBoxProps) {
  const { icon: Icon, color, bg, border, label } = config[type]

  return (
    <div className={`rounded-xl border p-4 ${bg} ${border}`} role="note">
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
        <div className="text-sm min-w-0">
          <span className={`font-semibold ${color}`}>{title || label} — </span>
          <span className="text-slate-300 leading-relaxed">{children}</span>
        </div>
      </div>
    </div>
  )
}
