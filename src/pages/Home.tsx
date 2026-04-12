import { Link } from 'react-router-dom'
import { BookOpen, Layers, Settings, Shield, Zap, Lock, Globe } from 'lucide-react'
import { useEffect, useState } from 'react'

const flowSteps = [
  { label: 'Internet', color: 'text-slate-400', delay: 0 },
  { label: '──→', color: 'text-accent-green', delay: 200 },
  { label: 'VPS Public', color: 'text-accent-cyan', delay: 400 },
  { label: '══→', color: 'text-accent-green', delay: 600 },
  { label: 'WireGuard', color: 'text-accent-purple', delay: 800 },
  { label: '──→', color: 'text-accent-green', delay: 1000 },
  { label: 'Serveur Local', color: 'text-accent-orange', delay: 1200 },
]

const navCards = [
  {
    to: '/docs',
    icon: BookOpen,
    color: 'text-accent-cyan',
    border: 'hover:border-accent-cyan',
    title: 'Documentation',
    desc: 'Guide d\'installation WireGuard pour Windows, Linux et macOS avec commandes détaillées.',
  },
  {
    to: '/ports',
    icon: Layers,
    color: 'text-accent-orange',
    border: 'hover:border-accent-orange',
    title: 'Gestionnaire de ports',
    desc: 'Configurez vos redirections iptables avec presets FiveM, RDP, MySQL et génération automatique.',
  },
  {
    to: '/config',
    icon: Settings,
    color: 'text-accent-green',
    border: 'hover:border-accent-green',
    title: 'Générateur de config',
    desc: 'Générez en quelques étapes vos fichiers WireGuard et scripts d\'installation exportables en ZIP.',
  },
]

const stackBadges = [
  { label: 'WireGuard', color: 'border-accent-purple/30 text-accent-purple bg-accent-purple/5' },
  { label: 'iptables', color: 'border-accent-orange/30 text-accent-orange bg-accent-orange/5' },
  { label: 'React 18', color: 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/5' },
  { label: 'TypeScript', color: 'border-blue-500/30 text-blue-400 bg-blue-500/5' },
  { label: 'Vite', color: 'border-accent-green/30 text-accent-green bg-accent-green/5' },
  { label: 'Tailwind', color: 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/5' },
]

function AsciiDiagram() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % 7)
    }, 600)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="font-mono text-sm bg-bg-surface border border-bg-border rounded-xl p-6 my-8 overflow-x-auto">
      <div className="text-slate-500 text-xs mb-4"># Flux de la passerelle</div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {flowSteps.map((step, i) => (
          <span
            key={i}
            className={`transition-all duration-300 ${step.color} ${
              active === i ? 'opacity-100 scale-110' : 'opacity-50'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="border border-accent-cyan/20 rounded-lg p-3 bg-accent-cyan/5">
          <div className="text-accent-cyan font-semibold mb-1 flex items-center gap-1">
            <Globe size={12} />
            VPS Public
          </div>
          <div className="text-slate-400">IP: 0.0.0.0</div>
          <div className="text-slate-400">WireGuard :51820/UDP</div>
          <div className="text-slate-400">iptables PREROUTING</div>
        </div>
        <div className="border border-accent-purple/20 rounded-lg p-3 bg-accent-purple/5">
          <div className="text-accent-purple font-semibold mb-1 flex items-center gap-1">
            <Lock size={12} />
            Tunnel VPN
          </div>
          <div className="text-slate-400">WireGuard UDP</div>
          <div className="text-slate-400">10.10.0.0/24</div>
          <div className="text-slate-400">Chiffrement E2E</div>
        </div>
        <div className="border border-accent-orange/20 rounded-lg p-3 bg-accent-orange/5">
          <div className="text-accent-orange font-semibold mb-1 flex items-center gap-1">
            <Shield size={12} />
            Serveur Local
          </div>
          <div className="text-slate-400">IP WG: 10.10.0.2</div>
          <div className="text-slate-400">Sans IP publique</div>
          <div className="text-slate-400">Win / Linux / macOS</div>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 border border-accent-green/30 bg-accent-green/5 text-accent-green text-xs font-mono px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Outil de configuration réseau — usage personnel
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-4 tracking-tight">
          Gateway<span className="text-accent-green">Manager</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto font-mono">
          Passerelle{' '}
          <span className="text-accent-cyan">VPS public</span>
          {' → '}
          <span className="text-accent-orange">serveur local</span>
          {' via '}
          <span className="text-accent-purple">WireGuard</span>
          {' + '}
          <span className="text-slate-300">iptables</span>
        </p>
      </div>

      {/* ASCII Diagram */}
      <AsciiDiagram />

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {navCards.map(({ to, icon: Icon, color, border, title, desc }) => (
          <Link
            key={to}
            to={to}
            className={`card card-hover group cursor-pointer ${border}`}
          >
            <div className={`${color} mb-3 group-hover:scale-110 transition-transform duration-200`}>
              <Icon size={22} />
            </div>
            <h3 className="font-semibold text-white text-base mb-2">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>

  
    </div>
  )
}
