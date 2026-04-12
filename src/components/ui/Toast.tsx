import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import type { ToastMessage } from '../../types'

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

const icons = {
  success: <CheckCircle size={16} className="text-accent-green" />,
  error: <XCircle size={16} className="text-accent-red" />,
  info: <Info size={16} className="text-accent-cyan" />,
}

export function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-bg-elevated border border-bg-border rounded-lg px-4 py-3 shadow-xl animate-slide-up min-w-[220px]"
        >
          {icons[toast.type]}
          <span className="text-sm text-slate-200 flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
