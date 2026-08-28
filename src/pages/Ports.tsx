import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Layers, Terminal, X, Server, ArrowRight } from 'lucide-react'
import { FaWindows } from 'react-icons/fa'
import { SiLinux, SiApple } from 'react-icons/si'
import type { IconType } from 'react-icons'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'
import { CodeBlock } from '../components/ui/CodeBlock'
import { Badge } from '../components/ui/Badge'
import { NoteBox } from '../components/ui/NoteBox'
import type { PortEntry, Protocol } from '../types'
import { PORT_PRESETS } from '../types'
import { genId, isValidIp, isValidPort } from '../utils/helpers'
import type { PortOS } from '../utils/portCommands'
import {
  generateIptablesRules,
  generateVerificationCommands,
  generateFullBlock,
  generateLinuxClientRules,
  generateLinuxClientVerification,
  generateWindowsRules,
  generateWindowsVerification,
  generateMacOSRules,
  generateMacOSVerification,
} from '../utils/portCommands'

const OS_OPTIONS: { value: PortOS; label: string; sublabel: string; icon: IconType | typeof Server }[] = [
  { value: 'linux-vps',    label: 'VPS Linux',       sublabel: 'iptables DNAT — redirection vers le PC local',  icon: Server },
  { value: 'linux-client', label: 'PC local Linux',  sublabel: 'iptables INPUT — ouvrir les ports en local',    icon: SiLinux },
  { value: 'windows',      label: 'PC local Windows',sublabel: 'PowerShell — New-NetFirewallRule',              icon: FaWindows },
  { value: 'macos',        label: 'PC local macOS',  sublabel: 'pfctl — /etc/pf.conf',                         icon: SiApple },
]

const OS_NOTE: Record<PortOS, { type: 'info' | 'warn'; text: string }> = {
  'linux-vps': {
    type: 'info',
    text: 'Ces commandes sont à exécuter sur le VPS. Remplacez eth0 par le nom de votre interface réseau principale si nécessaire (détectable avec : ip route get 8.8.8.8).',
  },
  'linux-client': {
    type: 'info',
    text: 'Ces commandes sont à exécuter sur votre PC local Linux. Le trafic autorisé provient uniquement de l\'interface WireGuard (wg0), donc depuis le tunnel sécurisé.',
  },
  'windows': {
    type: 'info',
    text: 'Ouvrez PowerShell en tant qu\'Administrateur avant d\'exécuter ces commandes. Les règles créées sont persistantes (survivent au redémarrage).',
  },
  'macos': {
    type: 'warn',
    text: 'pfctl est le pare-feu macOS. Si /etc/pf.conf n\'existe pas, créez-le. Les règles sont à ré-appliquer au démarrage (ajoutez un LaunchDaemon si nécessaire).',
  },
}

export function Ports() {
  const { toasts, addToast, removeToast } = useToast()
  const [ports, setPorts] = useLocalStorage<PortEntry[]>('gm-ports', [])
  const [vpsIp, setVpsIp] = useLocalStorage('gm-vps-ip', '')
  const [localWgIp, setLocalWgIp] = useLocalStorage('gm-local-wg-ip', '10.10.0.2')
  const [portOs, setPortOs] = useLocalStorage<PortOS>('gm-port-os', 'linux-vps')

  const [newPort, setNewPort] = useState('')
  const [newProto, setNewProto] = useState<Protocol>('tcp')
  const [newLabel, setNewLabel] = useState('')

  const addPort = () => {
    const p = parseInt(newPort)
    if (!p || p < 1 || p > 65535) {
      addToast('Port invalide (1-65535)', 'error')
      return
    }
    if (ports.some((x) => x.port === p && x.protocol === newProto)) {
      addToast('Ce port/protocole existe déjà', 'error')
      return
    }
    setPorts((prev) => [
      ...prev,
      { id: genId(), port: p, protocol: newProto, label: newLabel || `Port ${p}` },
    ])
    setNewPort('')
    setNewLabel('')
    addToast(`Port ${p} ajouté`)
  }

  const removePort = (id: string) => {
    setPorts((prev) => prev.filter((p) => p.id !== id))
  }

  const togglePreset = (preset: typeof PORT_PRESETS[0]) => {
    const exists = ports.some((p) => p.port === preset.port)
    if (exists) {
      setPorts((prev) => prev.filter((p) => p.port !== preset.port))
      addToast(`${preset.label} retiré`, 'info')
    } else {
      setPorts((prev) => [
        ...prev,
        { id: genId(), port: preset.port, protocol: preset.protocol, label: preset.label },
      ])
      addToast(`${preset.label} ajouté`)
    }
  }

  // Commandes générées selon l'OS sélectionné
  const resolvedLocalIp = localWgIp || '10.10.0.2'
  // Filtré une seule fois ici : les fonctions de portCommands.ts n'ont pas
  // à revalider chaque entrée, elles ne reçoivent que des ports déjà valides.
  const validPorts = ports.filter((p) => isValidPort(p.port))

  const { mainCode, mainTitle, mainFilename, fullCode, fullTitle, fullFilename, verifyCode, verifyFilename, verifyLang } = (() => {
    switch (portOs) {
      case 'linux-vps':
        return {
          mainCode:     generateIptablesRules(validPorts, vpsIp, resolvedLocalIp).join('\n'),
          mainTitle:    'Règles iptables individuelles',
          mainFilename: 'iptables — VPS',
          fullCode:     generateFullBlock(validPorts, vpsIp, resolvedLocalIp),
          fullTitle:    'Bloc complet à copier-coller',
          fullFilename: 'iptables — script complet',
          verifyCode:   generateVerificationCommands(validPorts, vpsIp).join('\n'),
          verifyFilename: 'bash — vérification',
          verifyLang:   'bash',
        }
      case 'linux-client':
        return {
          mainCode:     generateLinuxClientRules(validPorts).join('\n'),
          mainTitle:    'Règles iptables (PC local Linux)',
          mainFilename: 'iptables — PC local',
          fullCode:     generateLinuxClientRules(validPorts).join('\n'),
          fullTitle:    'Bloc complet à copier-coller',
          fullFilename: 'iptables — PC local (complet)',
          verifyCode:   generateLinuxClientVerification(validPorts, vpsIp).join('\n'),
          verifyFilename: 'bash — vérification',
          verifyLang:   'bash',
        }
      case 'windows':
        return {
          mainCode:     generateWindowsRules(validPorts).join('\n'),
          mainTitle:    'Règles pare-feu Windows (PowerShell)',
          mainFilename: 'PowerShell — New-NetFirewallRule',
          fullCode:     generateWindowsRules(validPorts).join('\n'),
          fullTitle:    'Bloc complet à copier-coller',
          fullFilename: 'PowerShell — complet',
          verifyCode:   generateWindowsVerification(validPorts, vpsIp).join('\n'),
          verifyFilename: 'PowerShell — vérification',
          verifyLang:   'powershell',
        }
      case 'macos':
        return {
          mainCode:     generateMacOSRules(validPorts).join('\n'),
          mainTitle:    'Règles pfctl (macOS)',
          mainFilename: 'pfctl — /etc/pf.conf',
          fullCode:     generateMacOSRules(validPorts).join('\n'),
          fullTitle:    'Bloc complet à copier-coller',
          fullFilename: 'pfctl — complet',
          verifyCode:   generateMacOSVerification(validPorts, vpsIp).join('\n'),
          verifyFilename: 'bash — vérification',
          verifyLang:   'bash',
        }
    }
  })()

  const note = OS_NOTE[portOs]

  const protoColors: Record<Protocol, 'green' | 'cyan' | 'orange'> = {
    tcp: 'cyan',
    udp: 'orange',
    'tcp+udp': 'green',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
            Gestionnaire de ports
          </h1>
          <p className="text-slate-500 text-sm">
            Ajoutez vos ports, choisissez l'OS cible et copiez les commandes générées.
            <span className="text-slate-500"> Ces ports sont partagés avec le </span>
            <Link to="/config" className="text-accent-green hover:underline">Générateur de config</Link>.
          </p>
        </div>
        <Link to="/config" className="btn-primary text-xs flex items-center gap-1.5 shrink-0 hidden sm:flex">
          Générer les scripts
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: form */}
        <div className="space-y-4">

          {/* Système cible */}
          <div className="card">
            <h2 className="font-bold text-white text-sm mb-3">Système cible</h2>
            <div className="space-y-1.5">
              {OS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPortOs(opt.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                    portOs === opt.value
                      ? 'border-accent-orange/50 bg-accent-orange/10 text-white'
                      : 'border-bg-border text-slate-400 hover:border-bg-border/60 hover:text-slate-300'
                  }`}
                >
                  <opt.icon size={16} className="shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.sublabel}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Config réseau (uniquement pour linux-vps) */}
          {portOs === 'linux-vps' && (
            <div className="card">
              <h2 className="font-bold text-white text-sm mb-4">Configuration réseau</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">IP publique du VPS</label>
                  <input
                    className={`input-field ${vpsIp.trim() !== '' && !isValidIp(vpsIp) ? 'border-red-500 focus:border-red-400' : ''}`}
                    placeholder="ex: 185.142.21.45"
                    value={vpsIp}
                    onChange={(e) => setVpsIp(e.target.value)}
                  />
                  {vpsIp.trim() !== '' && !isValidIp(vpsIp) && (
                    <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 185.142.21.45</p>
                  )}
                </div>
                <div>
                  <label className="label">IP locale WireGuard (client)</label>
                  <input
                    className={`input-field ${localWgIp.trim() !== '' && !isValidIp(localWgIp) ? 'border-red-500 focus:border-red-400' : ''}`}
                    placeholder="ex: 10.10.0.2"
                    value={localWgIp}
                    onChange={(e) => setLocalWgIp(e.target.value)}
                  />
                  {localWgIp.trim() !== '' && !isValidIp(localWgIp) && (
                    <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 10.10.0.2</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* IP VPS seule pour les autres OS (pour les vérifications) */}
          {portOs !== 'linux-vps' && (
            <div className="card">
              <h2 className="font-bold text-white text-sm mb-4">IP du VPS (vérification)</h2>
              <div>
                <label className="label">IP publique du VPS</label>
                <input
                  className={`input-field ${vpsIp.trim() !== '' && !isValidIp(vpsIp) ? 'border-red-500 focus:border-red-400' : ''}`}
                  placeholder="ex: 185.142.21.45"
                  value={vpsIp}
                  onChange={(e) => setVpsIp(e.target.value)}
                />
                {vpsIp.trim() !== '' && !isValidIp(vpsIp) && (
                  <p className="text-xs text-red-400 mt-1 font-mono">Format invalide</p>
                )}
              </div>
            </div>
          )}

          {/* Presets */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-white text-sm">Presets rapides</h2>
                <p className="text-xs text-slate-500 mt-0.5">Cliquez pour activer / désactiver</p>
              </div>
              {(() => {
                const allAdded = PORT_PRESETS.every(p => ports.some(x => x.port === p.port))
                return (
                  <button
                    onClick={() => {
                      if (allAdded) {
                        const presetPorts = new Set(PORT_PRESETS.map(p => p.port))
                        setPorts(prev => prev.filter(p => !presetPorts.has(p.port)))
                        addToast('Presets retirés', 'info')
                      } else {
                        const existing = new Set(ports.map(p => p.port))
                        const toAdd = PORT_PRESETS.filter(p => !existing.has(p.port))
                          .map(p => ({ id: genId(), port: p.port, protocol: p.protocol, label: p.label }))
                        setPorts(prev => [...prev, ...toAdd])
                        addToast(`${toAdd.length} preset(s) ajouté(s)`)
                      }
                    }}
                    className="text-[11px] text-slate-500 hover:text-white transition-colors"
                  >
                    {allAdded ? 'Tout retirer' : 'Tout ajouter'}
                  </button>
                )
              })()}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PORT_PRESETS.map((preset) => {
                const exists = ports.some((p) => p.port === preset.port)
                return (
                  <button
                    key={preset.port}
                    onClick={() => togglePreset(preset)}
                    title={`${preset.description} — ${preset.port}/${preset.protocol.toUpperCase()}`}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border font-mono transition-all
                      ${exists
                        ? 'border-accent-green/40 text-accent-green bg-accent-green/10 hover:bg-accent-green/5 hover:border-accent-red/40 hover:text-accent-red'
                        : 'border-bg-border text-slate-400 hover:border-accent-orange/40 hover:text-accent-orange hover:bg-accent-orange/5'
                      }`}
                  >
                    {exists && <X size={10} />}
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ajout manuel */}
          <div className="card">
            <h2 className="font-bold text-white text-sm mb-4">Ajouter un port</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Port</label>
                  <input
                    className="input-field"
                    placeholder="ex: 8080"
                    type="number"
                    min={1}
                    max={65535}
                    value={newPort}
                    onChange={(e) => setNewPort(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPort()}
                  />
                </div>
                <div className="w-28">
                  <label className="label">Protocole</label>
                  <select
                    className="input-field"
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value as Protocol)}
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="tcp+udp">TCP+UDP</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Label (optionnel)</label>
                <input
                  className="input-field"
                  placeholder="ex: Mon service"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPort()}
                />
              </div>
              <button onClick={addPort} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={14} />
                Ajouter le port
              </button>
            </div>
          </div>
        </div>

        {/* Right column: list + commands */}
        <div className="lg:col-span-2 space-y-4">
          {/* Port list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white text-sm">
                Ports configurés
                <span className="ml-2 text-xs font-mono text-slate-500 bg-bg-elevated px-1.5 py-0.5 rounded">
                  {ports.length}
                </span>
              </h2>
              {ports.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer les ${ports.length} port(s) configurés ?`)) {
                      setPorts([])
                      addToast('Liste vidée')
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-accent-red transition-colors"
                >
                  Tout supprimer
                </button>
              )}
            </div>

            {ports.length === 0 ? (
              <div className="text-center py-10">
                <Layers size={28} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Aucun port configuré</p>
                <p className="text-slate-500 text-xs mt-1">Ajoutez un preset ou saisissez manuellement</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ports.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-bg-border hover:border-bg-border/80 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-white font-semibold w-12 text-right">
                        {entry.port}
                      </span>
                      <Badge variant={protoColors[entry.protocol]}>
                        {entry.protocol.toUpperCase()}
                      </Badge>
                      <span className="text-slate-400 text-sm">{entry.label}</span>
                    </div>
                    <button
                      onClick={() => removePort(entry.id)}
                      aria-label={`Supprimer le port ${entry.port}`}
                      className="text-slate-500 hover:text-accent-red transition-colors sm:opacity-0 sm:group-hover:opacity-100 p-1 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated commands */}
          {ports.length > 0 && (
            <div className="space-y-4">
              {/* Règles principales */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal size={15} className="text-accent-green" />
                  <h3 className="font-bold text-white text-sm">{mainTitle}</h3>
                </div>
                <CodeBlock
                  code={mainCode}
                  filename={mainFilename}
                  language={portOs === 'windows' ? 'powershell' : 'bash'}
                  onCopy={() => addToast('Règles copiées !')}
                  maxHeight="250px"
                />
              </div>

              {/* Bloc complet (masqué si identique aux règles principales) */}
              {portOs === 'linux-vps' && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal size={15} className="text-accent-cyan" />
                    <h3 className="font-bold text-white text-sm">{fullTitle}</h3>
                  </div>
                  <CodeBlock
                    code={fullCode}
                    filename={fullFilename}
                    language="bash"
                    onCopy={() => addToast('Bloc copié !')}
                    maxHeight="200px"
                  />
                </div>
              )}

              {/* Vérification */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal size={15} className="text-accent-orange" />
                  <h3 className="font-bold text-white text-sm">Commandes de vérification</h3>
                </div>
                <CodeBlock
                  code={verifyCode}
                  filename={verifyFilename}
                  language={verifyLang}
                  onCopy={() => addToast('Commandes copiées !')}
                  maxHeight="200px"
                />
              </div>

              <NoteBox type={note.type}>
                {note.text}
              </NoteBox>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
