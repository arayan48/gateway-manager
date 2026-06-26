import { NavLink, Link } from 'react-router-dom'
import { Shield, BookOpen, Settings, Layers, Menu, X, ArrowRight, HelpCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/docs', label: 'Docs', icon: BookOpen },
  { to: '/ports', label: 'Ports', icon: Layers },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300
        ${scrolled
          ? 'bg-bg-base/95 backdrop-blur-md border-b border-bg-border shadow-lg shadow-black/20'
          : 'bg-bg-base/80 backdrop-blur-sm border-b border-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link
            to="/"
            className="flex items-center gap-2 group"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-8 h-8 bg-accent-green/15 border border-accent-green/30 rounded-lg flex items-center justify-center group-hover:bg-accent-green/25 group-hover:border-accent-green/50 transition-all duration-200">
              <Shield size={15} className="text-accent-green" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">
              Gateway<span className="text-accent-green">Manager</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'text-white bg-bg-elevated border border-bg-border'
                    : 'text-slate-400 hover:text-white hover:bg-bg-surface'
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}

            <NavLink
              to="/config"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ml-1
                ${isActive
                  ? 'bg-accent-green text-bg-base'
                  : 'bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20'
                }`
              }
            >
              <Settings size={14} />
              Configurer
              <ArrowRight size={12} />
            </NavLink>
          </div>

          {/* Mobile button */}
          <button
            className="md:hidden text-slate-400 hover:text-white transition-colors p-2 -mr-2 rounded-lg hover:bg-bg-elevated"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-bg-border bg-bg-base/98 backdrop-blur-md animate-slide-down">
          <div className="py-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3.5 text-sm transition-colors
                  ${isActive ? 'text-accent-green bg-bg-surface' : 'text-slate-400 active:bg-bg-surface'}`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/config"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3.5 text-sm font-semibold transition-colors
                ${isActive ? 'text-accent-green bg-bg-surface' : 'text-accent-green active:bg-bg-surface'}`
              }
            >
              <Settings size={16} />
              Configurer
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  )
}
