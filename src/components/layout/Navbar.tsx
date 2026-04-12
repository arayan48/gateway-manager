import { NavLink, Link } from 'react-router-dom'
import { Shield, BookOpen, Settings, Layers, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/docs', label: 'Documentation', icon: BookOpen },
  { to: '/ports', label: 'Ports', icon: Layers },
  { to: '/config', label: 'Générateur', icon: Settings },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-bg-base/90 backdrop-blur-sm border-b border-bg-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-7 h-7 bg-accent-green/15 border border-accent-green/30 rounded flex items-center justify-center group-hover:bg-accent-green/25 transition-colors">
              <Shield size={14} className="text-accent-green" />
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
                  `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
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
          </div>

          {/* Mobile button */}
          <button
            className="md:hidden text-slate-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-bg-border bg-bg-base animate-fade-in">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm border-b border-bg-border last:border-b-0
                ${isActive ? 'text-accent-green bg-bg-surface' : 'text-slate-400'}`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  )
}
