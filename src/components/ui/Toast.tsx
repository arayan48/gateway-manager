import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import type { ToastMessage } from '../../types'

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

const icons = {
  success: <CheckCircle size={16} className="text-accent-green shrink-0" />,
  error: <XCircle size={16} className="text-accent-red shrink-0" />,
  info: <Info size={16} className="text-accent-cyan shrink-0" />,
}

const borders = {
  success: 'border-accent-green/20',
  error: 'border-accent-red/20',
  info: 'border-accent-cyan/20',
}

export function Toast({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-center gap-3 bg-bg-elevated border ${borders[toast.type]} rounded-lg px-4 py-3 shadow-xl shadow-black/30 animate-slide-up min-w-[220px] max-w-sm`}
        >
          {icons[toast.type]}
          <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 p-0.5"
            aria-label="Fermer la notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
