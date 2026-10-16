import { Trash2, Lock, ArrowRight } from 'lucide-react'
import type { PortEntry } from '../../types'
import { Badge } from '../ui/Badge'
import { isRange } from '../../utils/network'

const protoColors = { tcp: 'cyan', udp: 'orange', 'tcp+udp': 'green' } as const

export function PortRow({ entry, onRemove }: { entry: PortEntry; onRemove: () => void }) {
  const range = isRange(entry)
  const mapped = !range && entry.targetPort !== undefined && entry.targetPort !== entry.port
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-bg-elevated border border-bg-border group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm text-white font-semibold min-w-[3rem] text-right shrink-0 flex items-center gap-1">
          {range ? `${entry.port}-${entry.endPort}` : entry.port}
          {mapped && (
            <>
              <ArrowRight size={11} className="text-slate-500" aria-label="vers le port" />
              <span className="text-accent-cyan">{entry.targetPort}</span>
            </>
          )}
        </span>
        <Badge variant={protoColors[entry.protocol]}>{entry.protocol.toUpperCase()}</Badge>
        <span className="text-slate-400 text-sm truncate">{entry.label}</span>
        {entry.allowedSources && (
          <span title={`Limité à : ${entry.allowedSources}`} className="flex items-center gap-1 text-[11px] text-accent-purple font-mono shrink-0">
            <Lock size={11} />
            <span className="hidden sm:inline truncate max-w-[10rem]">{entry.allowedSources}</span>
          </span>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label={`Supprimer ${entry.label}`}
        className="text-slate-500 hover:text-accent-red transition-colors sm:opacity-0 sm:group-hover:opacity-100 p-1 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
