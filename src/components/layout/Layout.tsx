import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Shield, BookOpen, Layers, Settings, HelpCircle } from 'lucide-react'
import { SiGithub } from 'react-icons/si'

interface LayoutProps {
  children: ReactNode
}

const footerLinks = [
  { to: '/docs', label: 'Documentation', icon: BookOpen },
  { to: '/ports', label: 'Ports', icon: Layers },
  { to: '/config', label: 'Générateur', icon: Settings },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
]

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <Navbar />
      <main id="main-content" className="flex-1 pt-14 animate-fade-in">
        {children}
      </main>
      <footer className="border-t border-bg-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-accent-green/15 border border-accent-green/30 rounded flex items-center justify-center">
                  <Shield size={14} className="text-accent-green" />
                </div>
                <span className="font-bold text-white text-sm">
                  Gateway<span className="text-accent-green">Manager</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Outil open-source de configuration WireGuard pour exposer un serveur local derrière un NAT via un VPS public.
              </p>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-3">Navigation</p>
              <ul className="space-y-2">
                {footerLinks.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link to={to} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                      <Icon size={13} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Info */}
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-3">Compatibilité</p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li>Windows 10 / 11 / Server</li>
                <li>Debian, Ubuntu, Fedora, Alpine, Arch</li>
                <li>macOS 12+ (Monterey et supérieur)</li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-bg-border py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-slate-500 font-mono">
              &copy; {new Date().getFullYear()} GatewayManager
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://arayan.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-accent-green transition-colors font-mono"
              >
                arayan.fr
              </a>
              <a
                href="https://github.com/arayan48"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 text-xs font-mono"
                aria-label="GitHub"
              >
                <SiGithub size={14} />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
