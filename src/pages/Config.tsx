import { useState } from 'react'
import { Settings, ChevronRight, ChevronLeft, Download, Eye, EyeOff, Shuffle, Plus, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'
import { CodeBlock } from '../components/ui/CodeBlock'
import { Badge, StepBadge } from '../components/ui/Badge'
import { NoteBox } from '../components/ui/NoteBox'
import type { PortEntry, Protocol, TargetOS, WireGuardKeys } from '../types'
import { PORT_PRESETS } from '../types'
import { generateAllFiles } from '../utils/generateConfigs'
import { exportToZip, exportSingleFile } from '../utils/zipExport'

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))
}

/** Génère une vraie paire de clés Curve25519 (X25519) via Web Crypto — compatible WireGuard */
async function generateWgKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveKey', 'deriveBits'])
  // Les clés privées X25519 ne peuvent pas être exportées en 'raw' — on passe par 'pkcs8'
  // et on extrait les 32 derniers octets (la clé brute, après le header DER de 16 octets)
  const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
  const pubRaw    = await crypto.subtle.exportKey('raw', kp.publicKey)
  return {
    privateKey: toBase64(privPkcs8.slice(privPkcs8.length - 32).buffer),
    publicKey:  toBase64(pubRaw),
  }
}

const steps = [
  { id: 1, label: 'Informations générales' },
  { id: 2, label: 'Clés WireGuard' },
  { id: 3, label: 'Ports à rediriger' },
  { id: 4, label: 'Export' },
]

const osOptions: { value: TargetOS; label: string; desc: string; tag: string }[] = [
  { value: 'windows',       label: 'Windows',                tag: 'win',   desc: 'Windows 10, 11, Server 2019/2022 — Script PowerShell (.ps1)' },
  { value: 'linux-debian',  label: 'Debian 12',              tag: 'deb',   desc: 'Debian Bookworm — commande : apt install' },
  { value: 'linux-ubuntu',  label: 'Ubuntu 22.04 / 24.04',   tag: 'deb',   desc: 'Ubuntu LTS — commande : apt install' },
  { value: 'linux-fedora',  label: 'Fedora / CentOS / RHEL', tag: 'rpm',   desc: 'Fedora 38+, CentOS Stream, AlmaLinux — commande : dnf install' },
  { value: 'linux-alpine',  label: 'Alpine Linux',           tag: 'apk',   desc: 'Souvent utilisé en conteneur / VPS léger — commande : apk add' },
  { value: 'linux-arch',    label: 'Arch Linux / Manjaro',   tag: 'pac',   desc: 'Rolling release — commande : pacman -S' },
  { value: 'macos',         label: 'macOS',                  tag: 'brew',  desc: 'macOS 12 Monterey et supérieur — via Homebrew' },
]

const isValidIp  = (v: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(v.trim())
const isValidWgKey = (v: string) => /^[A-Za-z0-9+/]{43}=$/.test(v.trim())

// ─── Step 1 ─────────────────────────────────────────────────────
function Step1({
  projectName, setProjectName,
  vpsIp, setVpsIp,
  localWgIp, setLocalWgIp,
  wgPort, setWgPort,
  targetOS, setTargetOS,
}: {
  projectName: string; setProjectName: (v: string) => void
  vpsIp: string; setVpsIp: (v: string) => void
  localWgIp: string; setLocalWgIp: (v: string) => void
  wgPort: number; setWgPort: (v: number) => void
  targetOS: TargetOS; setTargetOS: (v: TargetOS) => void
}) {
  const vpsIpInvalid  = vpsIp.trim()     !== '' && !isValidIp(vpsIp)
  const localIpInvalid = localWgIp.trim() !== '' && !isValidIp(localWgIp)

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Nom du projet / serveur</label>
        <input className="input-field" placeholder="ex: Mon Serveur FiveM" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">IP publique du VPS <span className="text-accent-red">*</span></label>
          <input
            className={`input-field ${vpsIpInvalid ? 'border-red-500 focus:border-red-400' : ''}`}
            placeholder="ex: 185.142.21.45"
            value={vpsIp}
            onChange={(e) => setVpsIp(e.target.value)}
          />
          {vpsIpInvalid && <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 185.142.21.45</p>}
        </div>
        <div>
          <label className="label">IP locale WireGuard (client)</label>
          <input
            className={`input-field ${localIpInvalid ? 'border-red-500 focus:border-red-400' : ''}`}
            placeholder="10.10.0.2"
            value={localWgIp}
            onChange={(e) => setLocalWgIp(e.target.value)}
          />
          {localIpInvalid && <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 10.10.0.2</p>}
        </div>
      </div>
      <div>
        <label className="label">Port WireGuard</label>
        <input
          className="input-field w-40"
          type="number"
          placeholder="51820"
          value={wgPort}
          onChange={(e) => setWgPort(parseInt(e.target.value) || 51820)}
        />
        <p className="text-xs text-slate-600 mt-1 font-mono">Défaut : 51820/UDP — doit être ouvert sur le VPS</p>
      </div>
      <div>
        <label className="label">OS de votre PC local <span className="text-accent-red">*</span></label>
        <p className="text-xs text-slate-600 mb-2 font-mono">
          Votre PC local = la machine derrière le NAT qui héberge vos services (jeux, RDP…).
          Ce choix détermine le script <code className="text-accent-orange">setup-client.sh / .ps1</code> généré.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {osOptions.map((os) => (
            <button
              key={os.value}
              onClick={() => setTargetOS(os.value)}
              className={`text-left p-3 rounded-lg border transition-all group
                ${targetOS === os.value
                  ? 'border-accent-cyan bg-accent-cyan/10 text-white'
                  : 'border-bg-border text-slate-400 hover:border-bg-border/60 hover:bg-bg-elevated'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{os.label}</div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-base border border-bg-border text-slate-500">
                  {os.tag}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">{os.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 ─────────────────────────────────────────────────────
function KeyField({
  label, isPrivate, value, onChange, showPrivate, onTogglePrivate,
}: {
  label: string
  isPrivate?: boolean
  value: string
  onChange: (v: string) => void
  showPrivate: boolean
  onTogglePrivate: () => void
}) {
  const invalid = value.trim() !== '' && !isValidWgKey(value)
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          className={`input-field pr-10 ${invalid ? 'border-red-500 focus:border-red-400' : ''}`}
          type={isPrivate && !showPrivate ? 'password' : 'text'}
          placeholder="Base64 44 caractères"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPrivate && (
          <button
            type="button"
            onClick={onTogglePrivate}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {invalid && (
        <p className="text-xs text-red-400 mt-1 font-mono">
          Clé invalide — 44 caractères base64 requis. Générez avec : <span className="text-red-300">wg genkey</span>
        </p>
      )}
    </div>
  )
}

function Step2({ keys, setKeys }: { keys: WireGuardKeys; setKeys: (k: WireGuardKeys) => void }) {
  const [showPrivate, setShowPrivate] = useState(false)

  const generateTestKeys = async () => {
    const server = await generateWgKeypair()
    const client = await generateWgKeypair()
    setKeys({
      serverPrivateKey: server.privateKey,
      serverPublicKey:  server.publicKey,
      clientPrivateKey: client.privateKey,
      clientPublicKey:  client.publicKey,
    })
  }

  const toggle = () => setShowPrivate((v) => !v)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={generateTestKeys}
          className="flex items-center gap-2 btn-ghost text-xs"
        >
          <Shuffle size={13} />
          Générer des clés de test
        </button>
      </div>

      <NoteBox type="info" title="Génération des clés">
        Le bouton ci-dessus génère de vraies paires de clés Curve25519 utilisables directement. Si vous préférez générer les clés manuellement sur votre machine : <code className="font-mono text-xs">wg genkey | tee priv.key | wg pubkey &gt; pub.key</code>
      </NoteBox>

      <div className="border border-bg-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Serveur VPS</h3>
        <KeyField label="Clé privée VPS" isPrivate value={keys.serverPrivateKey} onChange={(v) => setKeys({ ...keys, serverPrivateKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
        <KeyField label="Clé publique VPS" value={keys.serverPublicKey} onChange={(v) => setKeys({ ...keys, serverPublicKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
      </div>

      <div className="border border-bg-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Client (serveur distant)</h3>
        <KeyField label="Clé privée client" isPrivate value={keys.clientPrivateKey} onChange={(v) => setKeys({ ...keys, clientPrivateKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
        <KeyField label="Clé publique client" value={keys.clientPublicKey} onChange={(v) => setKeys({ ...keys, clientPublicKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
      </div>
    </div>
  )
}

// ─── Step 3 ─────────────────────────────────────────────────────
function Step3({ ports, setPorts }: { ports: PortEntry[]; setPorts: (p: PortEntry[] | ((prev: PortEntry[]) => PortEntry[])) => void }) {
  const { toasts, addToast, removeToast } = useToast()
  const [newPort, setNewPort] = useState('')
  const [newProto, setNewProto] = useState<Protocol>('tcp')
  const [newLabel, setNewLabel] = useState('')

  const addPort = () => {
    const p = parseInt(newPort)
    if (!p || p < 1 || p > 65535) { addToast('Port invalide', 'error'); return }
    if (ports.some((x) => x.port === p)) { addToast('Port déjà ajouté', 'info'); return }
    setPorts((prev) => [...prev, { id: genId(), port: p, protocol: newProto, label: newLabel || `Port ${p}` }])
    setNewPort(''); setNewLabel('')
    addToast(`Port ${p} ajouté`)
  }

  const addPreset = (preset: typeof PORT_PRESETS[0]) => {
    if (ports.some((p) => p.port === preset.port)) { addToast('Déjà présent', 'info'); return }
    setPorts((prev) => [...prev, { id: genId(), port: preset.port, protocol: preset.protocol, label: preset.label }])
  }

  return (
    <div className="space-y-4">
      <Toast toasts={toasts} onRemove={removeToast} />

      <NoteBox type="info">
        Ces ports seront inclus dans les scripts générés. Si vous avez déjà configuré des ports dans le Gestionnaire de ports, ils sont pré-chargés ici.
      </NoteBox>

      {/* Presets */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">Presets rapides</h3>
        <div className="flex flex-wrap gap-1.5">
          {PORT_PRESETS.map((preset) => {
            const exists = ports.some((p) => p.port === preset.port)
            return (
              <button
                key={preset.port}
                onClick={() => addPreset(preset)}
                disabled={exists}
                className={`text-xs px-2.5 py-1 rounded border font-mono transition-all
                  ${exists
                    ? 'border-accent-green/30 text-accent-green bg-accent-green/5 cursor-default'
                    : 'border-bg-border text-slate-400 hover:border-accent-orange/40 hover:text-accent-orange'
                  }`}
              >
                {preset.label} :{preset.port}
              </button>
            )
          })}
        </div>
      </div>

      {/* Ajout manuel */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">Ajouter manuellement</h3>
        <div className="flex gap-2 items-end">
          <div>
            <label className="label">Port</label>
            <input className="input-field w-24" type="number" placeholder="8080" value={newPort} onChange={(e) => setNewPort(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPort()} />
          </div>
          <div>
            <label className="label">Protocole</label>
            <select className="input-field w-28" value={newProto} onChange={(e) => setNewProto(e.target.value as Protocol)}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="tcp+udp">TCP+UDP</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Label</label>
            <input className="input-field" placeholder="Mon service" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPort()} />
          </div>
          <button onClick={addPort} className="btn-primary flex items-center gap-1 shrink-0">
            <Plus size={13} />
            Ajouter
          </button>
        </div>
      </div>

      {/* List */}
      {ports.length > 0 && (
        <div className="space-y-2">
          {ports.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 bg-bg-elevated border border-bg-border rounded-lg group">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-white w-10 text-right">{entry.port}</span>
                <Badge variant={entry.protocol === 'tcp' ? 'cyan' : entry.protocol === 'udp' ? 'orange' : 'green'}>
                  {entry.protocol.toUpperCase()}
                </Badge>
                <span className="text-slate-400 text-sm">{entry.label}</span>
              </div>
              <button onClick={() => setPorts((p) => p.filter((x) => x.id !== entry.id))} className="text-slate-600 hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const fileMeta: Record<string, { machine: string; color: string; hint: string }> = {
  'setup-vps.sh':     { machine: '🖥️ VPS',      color: 'text-accent-cyan',   hint: 'Exécuter sur le VPS (SSH)' },
  'setup-client.sh':  { machine: '💻 PC Local',  color: 'text-accent-orange', hint: 'Exécuter sur votre PC local' },
  'setup-client.ps1': { machine: '💻 PC Local',  color: 'text-accent-orange', hint: 'PowerShell Admin sur votre PC' },
  'wg0-server.conf':  { machine: '🖥️ VPS',      color: 'text-accent-cyan',   hint: 'Config WireGuard du VPS' },
  'wg0-client.conf':  { machine: '💻 PC Local',  color: 'text-accent-orange', hint: 'Config WireGuard du PC local' },
  'README.txt':       { machine: '📄 Lisez-moi', color: 'text-slate-400',     hint: 'Instructions d\'installation' },
}

// ─── Step 4 ─────────────────────────────────────────────────────
function Step4({
  config,
  addToast,
}: {
  config: Parameters<typeof generateAllFiles>[0]
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const files = generateAllFiles(config)
  const fileEntries = Object.entries(files) as [string, string][]

  const langMap: Record<string, string> = {
    'wg0-server.conf': 'ini', 'wg0-client.conf': 'ini',
    'setup-vps.sh': 'bash', 'setup-client.sh': 'bash',
    'setup-client.ps1': 'powershell', 'README.txt': 'bash',
  }

  const handleZip = async () => {
    try {
      await exportToZip(files, config.projectName)
      addToast('Archive ZIP téléchargée !')
    } catch {
      addToast('Erreur lors de la génération du ZIP', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + bouton ZIP */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="font-bold text-white">Fichiers générés</h3>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            {fileEntries.length} fichiers — {config.ports.length} port(s) configuré(s)
          </p>
        </div>
        <button
          onClick={handleZip}
          className="flex items-center gap-2 bg-accent-green text-bg-base font-bold px-5 py-2.5 rounded-lg hover:bg-accent-green/90 transition-all text-sm"
        >
          <Download size={15} />
          Télécharger tout (.zip)
        </button>
      </div>

      {/* Guide rapide */}
      <div className="rounded-xl border border-bg-border bg-bg-surface p-4 space-y-3">
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Ordre d'installation</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3">
            <p className="text-accent-cyan font-bold text-sm mb-1">① Sur le VPS</p>
            <code className="text-xs text-slate-300 font-mono block">scp setup-vps.sh root@{config.vpsPublicIp || '<IP_VPS>'}:/root/</code>
            <code className="text-xs text-slate-300 font-mono block">ssh root@{config.vpsPublicIp || '<IP_VPS>'}</code>
            <code className="text-xs text-slate-300 font-mono block">sudo bash /root/setup-vps.sh</code>
          </div>
          <div className="hidden sm:flex items-center text-slate-600 text-xl">→</div>
          <div className="flex-1 rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-3">
            <p className="text-accent-orange font-bold text-sm mb-1">② Sur votre PC local</p>
            {config.targetOS === 'windows' ? (
              <>
                <code className="text-xs text-slate-300 font-mono block">Copier setup-client.ps1 sur le PC</code>
                <code className="text-xs text-slate-300 font-mono block">PowerShell Admin → .\setup-client.ps1</code>
              </>
            ) : (
              <>
                <code className="text-xs text-slate-300 font-mono block">scp setup-client.sh user@&lt;IP_PC&gt;:/tmp/</code>
                <code className="text-xs text-slate-300 font-mono block">sudo bash /tmp/setup-client.sh</code>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Liste des fichiers */}
      <div className="space-y-4">
        {fileEntries.map(([filename, content]) => {
          const meta = fileMeta[filename]
          return (
            <div key={filename}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-300">{filename}</span>
                  {meta && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border border-current/30 bg-current/10 ${meta.color}`}>
                      {meta.machine}
                    </span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await exportSingleFile(filename, content)
                    addToast(`${filename} téléchargé`)
                  }}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <Download size={11} />
                  Télécharger
                </button>
              </div>
              {meta?.hint && (
                <p className="text-xs text-slate-600 font-mono mb-2">→ {meta.hint}</p>
              )}
              <CodeBlock
                code={content}
                filename={filename}
                language={langMap[filename] || 'bash'}
                onCopy={() => addToast(`${filename} copié !`)}
                maxHeight="300px"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Config Page ────────────────────────────────────────────
export function Config() {
  const { toasts, addToast, removeToast } = useToast()
  const [step, setStep] = useState(1)

  const [projectName, setProjectName] = useLocalStorage('gm-cfg-name', '')
  const [vpsIp, setVpsIp] = useLocalStorage('gm-vps-ip', '')
  const [localWgIp, setLocalWgIp] = useLocalStorage('gm-local-wg-ip', '10.10.0.2')
  const [wgPort, setWgPort] = useLocalStorage('gm-cfg-wgport', 51820)
  const [targetOS, setTargetOS] = useLocalStorage<TargetOS>('gm-cfg-os', 'linux-debian')
  const [keys, setKeys] = useLocalStorage<WireGuardKeys>('gm-cfg-keys', {
    serverPrivateKey: '',
    serverPublicKey: '',
    clientPrivateKey: '',
    clientPublicKey: '',
  })
  // Shared with /ports page
  const [ports, setPorts] = useLocalStorage<PortEntry[]>('gm-ports', [])

  const config = {
    projectName,
    vpsPublicIp: vpsIp,
    localWireguardIp: localWgIp,
    wireguardPort: wgPort,
    targetOS,
    keys,
    ports,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
          <Settings className="text-accent-green" size={28} />
          Générateur de configuration
        </h1>
        <p className="text-slate-400 text-sm">
          Remplissez les informations et exportez vos fichiers WireGuard prêts à l'emploi.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border
                ${step === s.id
                  ? 'border-accent-green/40 bg-accent-green/10 text-white'
                  : step > s.id
                    ? 'border-bg-border bg-bg-elevated text-accent-green cursor-pointer hover:border-accent-green/30'
                    : 'border-bg-border text-slate-500 cursor-pointer hover:text-slate-300'
                }`}
            >
              <StepBadge number={s.id} active={step === s.id} />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-slate-600 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="card mb-6 animate-fade-in">
        <h2 className="font-bold text-white mb-6 flex items-center gap-2">
          <StepBadge number={step} active />
          <span>{steps[step - 1].label}</span>
        </h2>

        {step === 1 && (
          <Step1
            projectName={projectName} setProjectName={setProjectName}
            vpsIp={vpsIp} setVpsIp={setVpsIp}
            localWgIp={localWgIp} setLocalWgIp={setLocalWgIp}
            wgPort={wgPort} setWgPort={setWgPort}
            targetOS={targetOS} setTargetOS={setTargetOS}
          />
        )}
        {step === 2 && <Step2 keys={keys} setKeys={setKeys} />}
        {step === 3 && <Step3 ports={ports} setPorts={setPorts} />}
        {step === 4 && <Step4 config={config} addToast={addToast} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Précédent
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep(Math.min(4, step + 1))}
            className="flex items-center gap-2 btn-primary"
          >
            Suivant
            <ChevronRight size={14} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
