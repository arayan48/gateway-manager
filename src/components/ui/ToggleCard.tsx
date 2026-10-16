import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Accent = 'orange' | 'green'

const accents: Record<Accent, { card: string; iconBg: string; icon: string; track: string }> = {
  orange: { card: 'border-accent-orange/50 bg-accent-orange/5', iconBg: 'bg-accent-orange/15', icon: 'text-accent-orange', track: 'bg-accent-orange' },
  green:  { card: 'border-accent-green/40 bg-accent-green/5',   iconBg: 'bg-accent-green/15',  icon: 'text-accent-green',  track: 'bg-accent-green' },
}

interface ToggleCardProps {
  id: string
  icon: LucideIcon
  title: string
  description: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  accent?: Accent
  /** Affiché sous l'en-tête, quel que soit l'état */
  children?: ReactNode
}

export function ToggleCard({ id, icon: Icon, title, description, checked, onChange, accent = 'orange', children }: ToggleCardProps) {
  const a = accents[accent]
  return (
    <div className={`card transition-all duration-150 ${checked ? a.card : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${checked ? a.iconBg : 'bg-bg-elevated'}`}>
            <Icon size={16} className={checked ? a.icon : 'text-slate-500'} />
          </div>
          <div className="min-w-0">
            <label htmlFor={id} className="font-bold text-white text-sm cursor-pointer">
              {title}
            </label>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          id={id}
          onClick={() => onChange(!checked)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${checked ? a.track : 'bg-bg-elevated border border-bg-border'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
