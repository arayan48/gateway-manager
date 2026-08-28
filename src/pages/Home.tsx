import { Link } from 'react-router-dom'
import { BookOpen, Layers, Settings, Shield, Zap, Lock, Globe, ArrowRight, ChevronRight, CheckCircle } from 'lucide-react'
import { FaWindows } from 'react-icons/fa'
import { SiLinux, SiApple } from 'react-icons/si'

const navCards = [
  {
    to: '/config',
    icon: Settings,
    color: 'text-accent-green',
    border: 'hover:border-accent-green/40',
    title: 'Générateur de config',
    desc: 'Créez vos fichiers WireGuard et scripts d\'installation en quelques clics.',
    primary: true,
  },
  {
    to: '/ports',
    icon: Layers,
    color: 'text-accent-orange',
    border: 'hover:border-accent-orange/40',
    title: 'Gestionnaire de ports',
    desc: 'Configurez vos redirections iptables avec des presets ou manuellement.',
  },
  {
    to: '/docs',
    icon: BookOpen,
    color: 'text-accent-cyan',
    border: 'hover:border-accent-cyan/40',
    title: 'Documentation',
    desc: 'Guides pas-à-pas pour chaque système d\'exploitation.',
  },
]

const compatOs = [
  { icon: FaWindows, label: 'Windows' },
  { icon: SiLinux, label: 'Linux' },
  { icon: SiApple, label: 'macOS' },
]

export function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 sm:py-24">

      {/* Hero */}
      <div className="text-center mb-20 sm:mb-24">
        <div className="inline-flex items-center gap-2 border border-accent-green/30 bg-accent-green/5 text-accent-green text-xs font-mono px-3 py-1.5 rounded-full mb-8">
          <Zap size={12} />
          Open source
        </div>

        <h1 className="text-2xl leading-[1.2] sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight sm:leading-tight">
          Exposez votre serveur
          <br />
          <span className="text-accent-green">sans IP publique</span>
        </h1>

        <p className="text-[13px] sm:text-base text-slate-400 sm:max-w-lg mx-auto leading-relaxed mb-10">
          Créez un tunnel WireGuard entre votre VPS et votre machine locale.
          Vos services deviennent accessibles depuis internet en quelques minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/config" className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base rounded-xl">
            Configurer ma passerelle
            <ArrowRight size={16} />
          </Link>
          <Link to="/docs" className="btn-ghost flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base rounded-xl">
            Lire la doc
          </Link>
        </div>
      </div>

      {/* Diagram */}
      <div className="rounded-2xl border border-bg-border bg-bg-surface p-5 sm:p-8 mb-20 sm:mb-24">
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-6">Comment ça marche</p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-3 sm:gap-0">
          <div className="text-center p-5 rounded-xl border border-bg-border bg-bg-elevated">
            <Globe size={20} className="text-slate-400 mx-auto mb-2.5" />
            <div className="text-sm font-semibold text-white">Internet</div>
            <div className="text-xs text-slate-500 mt-1">Trafic entrant</div>
          </div>

          <div className="hidden sm:flex justify-center px-1"><ChevronRight size={16} className="text-accent-green" /></div>
          <div className="sm:hidden flex justify-center"><ChevronRight size={16} className="text-accent-green rotate-90" /></div>

          <div className="text-center p-5 rounded-xl border border-accent-cyan/25 bg-accent-cyan/5">
            <Shield size={20} className="text-accent-cyan mx-auto mb-2.5" />
            <div className="text-sm font-semibold text-white">VPS Public</div>
            <div className="text-xs text-slate-500 mt-1">IP publique + iptables</div>
          </div>

          <div className="hidden sm:flex justify-center px-1"><ChevronRight size={16} className="text-accent-purple" /></div>
          <div className="sm:hidden flex justify-center"><ChevronRight size={16} className="text-accent-purple rotate-90" /></div>

          <div className="text-center p-5 rounded-xl border border-accent-purple/25 bg-accent-purple/5">
            <Lock size={20} className="text-accent-purple mx-auto mb-2.5" />
            <div className="text-sm font-semibold text-white">WireGuard</div>
            <div className="text-xs text-slate-500 mt-1">Tunnel chiffré</div>
          </div>

          <div className="hidden sm:flex justify-center px-1"><ChevronRight size={16} className="text-accent-orange" /></div>
          <div className="sm:hidden flex justify-center"><ChevronRight size={16} className="text-accent-orange rotate-90" /></div>

          <div className="text-center p-5 rounded-xl border border-accent-orange/25 bg-accent-orange/5">
            <Layers size={20} className="text-accent-orange mx-auto mb-2.5" />
            <div className="text-sm font-semibold text-white">Votre serveur</div>
            <div className="text-xs text-slate-500 mt-1">Derrière le NAT</div>
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      <div className="mb-20 sm:mb-24">
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-4">Avant de commencer</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            'Un VPS Linux avec IP publique (Debian/Ubuntu recommandé)',
            'Un accès root (SSH) au VPS',
            'Votre PC local (Windows, Linux ou macOS)',
          ].map((text) => (
            <div key={text} className="flex items-start gap-2.5 p-3 rounded-xl border border-bg-border bg-bg-surface">
              <CheckCircle size={14} className="text-accent-green shrink-0 mt-0.5" />
              <span className="text-xs text-slate-400 leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20 sm:mb-24">
        {navCards.map(({ to, icon: Icon, color, border, title, desc, primary }) => (
          <Link
            key={to}
            to={to}
            className={`card card-hover group flex flex-col ${border} ${primary ? 'ring-1 ring-accent-green/15' : ''}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
              primary ? 'bg-accent-green/10' : 'bg-bg-elevated'
            }`}>
              <Icon size={18} className={color} />
            </div>
            <h3 className="font-semibold text-white text-[15px] mb-2">{title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed flex-1">{desc}</p>
            <div className={`mt-5 flex items-center gap-1.5 text-xs font-medium ${color} opacity-0 group-hover:opacity-100 transition-opacity`}>
              Ouvrir <ArrowRight size={12} />
            </div>
          </Link>
        ))}
      </div>

      {/* Compatibility */}
      <div className="flex items-center justify-center gap-8 sm:gap-10">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Compatible</span>
        <div className="h-4 w-px bg-bg-border" />
        {compatOs.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-slate-400">
            <Icon size={16} />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
