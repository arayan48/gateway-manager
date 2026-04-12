import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Toast } from '../ui/Toast'
import type { ToastMessage } from '../../types'

interface LayoutProps {
  children: ReactNode
  toasts: ToastMessage[]
  onRemoveToast: (id: string) => void
}

export function Layout({ children, toasts, onRemoveToast }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />
      <main className="flex-1 pt-14 animate-fade-in">
        {children}
      </main>
      <footer className="border-t border-bg-border py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-600 font-mono">
            Copyright {new Date().getFullYear()} GatewayManager
          </p>
          <p className="text-xs text-slate-600 font-mono">
            fait par{' '}
            <a
              href="https://arayan.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-green font-semibold tracking-wide"
            >
              arayan.fr
            </a>
          </p>
        </div>
      </footer>
      <Toast toasts={toasts} onRemove={onRemoveToast} />
    </div>
  )
}
