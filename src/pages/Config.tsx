import { useState, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Download, Eye, EyeOff, Shuffle, Plus, Trash2, RotateCcw, Upload, AlertTriangle, Save } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'
import { CodeBlock } from '../components/ui/CodeBlock'
import { Badge, StepBadge } from '../components/ui/Badge'
import { NoteBox } from '../components/ui/NoteBox'
import type { PortEntry, Protocol, TargetOS, WireGuardKeys } from '../types'
import { PORT_PRESETS } from '../types'
import { Link } from 'react-router-dom'
import { generateAllFiles } from '../utils/generateConfigs'
import { exportToZip, exportSingleFile } from '../utils/zipExport'

import { genId, isValidIp, isValidWgKey } from '../utils/helpers'

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
  { id: 1, label: 'Général' },
  { id: 2, label: 'Clés' },
  { id: 3, label: 'Ports' },
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
  const [wgPortInput, setWgPortInput] = useState(String(wgPort))

  const commitWgPort = () => {
    const v = parseInt(wgPortInput)
    const clamped = !v || v < 1 ? 1 : v > 65535 ? 65535 : v
    setWgPort(clamped)
    setWgPortInput(String(clamped))
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="cfg-project-name">Nom du projet / serveur</label>
        <input id="cfg-project-name" className="input-field" placeholder="ex: Mon Serveur FiveM" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="cfg-vps-ip">IP publique du VPS <span className="text-accent-red">*</span></label>
          <input
            id="cfg-vps-ip"
            className={`input-field ${vpsIpInvalid ? 'border-red-500 focus:border-red-400' : ''}`}
            placeholder="ex: 185.142.21.45"
            value={vpsIp}
            onChange={(e) => setVpsIp(e.target.value)}
          />
          {vpsIpInvalid && <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 185.142.21.45</p>}
        </div>
        <div>
          <label className="label" htmlFor="cfg-local-ip">IP locale WireGuard (client)</label>
          <input
            id="cfg-local-ip"
            className={`input-field ${localIpInvalid ? 'border-red-500 focus:border-red-400' : ''}`}
            placeholder="10.10.0.2"
            value={localWgIp}
            onChange={(e) => setLocalWgIp(e.target.value)}
          />
          {localIpInvalid && <p className="text-xs text-red-400 mt-1 font-mono">Format invalide — ex: 10.10.0.2</p>}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cfg-wg-port">Port WireGuard</label>
        <input
          id="cfg-wg-port"
          className="input-field w-40"
          type="number"
          placeholder="51820"
          min={1}
          max={65535}
          value={wgPortInput}
          onChange={(e) => setWgPortInput(e.target.value)}
          onBlur={commitWgPort}
        />
        <p className="text-xs text-slate-500 mt-1 font-mono">Défaut : 51820/UDP — doit être ouvert sur le VPS</p>
      </div>
      <div>
        <label className="label">OS de votre PC local <span className="text-accent-red">*</span></label>
        <p className="text-xs text-slate-500 mb-2 font-mono">
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
  id, label, isPrivate, value, onChange, showPrivate, onTogglePrivate,
}: {
  id: string
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
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
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
            aria-label={showPrivate ? 'Masquer la clé' : 'Afficher la clé'}
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

function Step2({ keys, setKeys, addToast }: { keys: WireGuardKeys; setKeys: (k: WireGuardKeys) => void; addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [showPrivate, setShowPrivate] = useState(false)
  const [generating, setGenerating] = useState(false)

  const generateTestKeys = async () => {
    setGenerating(true)
    try {
      const server = await generateWgKeypair()
      const client = await generateWgKeypair()
      setKeys({
        serverPrivateKey: server.privateKey,
        serverPublicKey:  server.publicKey,
        clientPrivateKey: client.privateKey,
        clientPublicKey:  client.publicKey,
      })
      addToast('Clés Curve25519 générées avec succès')
    } catch {
      addToast('Erreur lors de la génération des clés', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const toggle = () => setShowPrivate((v) => !v)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={generateTestKeys}
          disabled={generating}
          className="flex items-center gap-2 btn-ghost text-xs disabled:opacity-50"
        >
          <Shuffle size={13} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Génération...' : 'Générer des clés'}
        </button>
      </div>

      <NoteBox type="info" title="Génération des clés">
        Le bouton ci-dessus génère de vraies paires de clés Curve25519 utilisables directement. Si vous préférez générer les clés manuellement sur votre machine : <code className="font-mono text-xs">wg genkey | tee priv.key | wg pubkey &gt; pub.key</code>
      </NoteBox>

      <div className="border border-bg-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Serveur VPS</h3>
        <KeyField id="cfg-key-server-priv" label="Clé privée VPS" isPrivate value={keys.serverPrivateKey} onChange={(v) => setKeys({ ...keys, serverPrivateKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
        <KeyField id="cfg-key-server-pub" label="Clé publique VPS" value={keys.serverPublicKey} onChange={(v) => setKeys({ ...keys, serverPublicKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
      </div>

      <div className="border border-bg-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Client (serveur distant)</h3>
        <KeyField id="cfg-key-client-priv" label="Clé privée client" isPrivate value={keys.clientPrivateKey} onChange={(v) => setKeys({ ...keys, clientPrivateKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
        <KeyField id="cfg-key-client-pub" label="Clé publique client" value={keys.clientPublicKey} onChange={(v) => setKeys({ ...keys, clientPublicKey: v })} showPrivate={showPrivate} onTogglePrivate={toggle} />
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="cfg-step3-port">Port</label>
              <input id="cfg-step3-port" className="input-field" type="number" placeholder="8080" value={newPort} onChange={(e) => setNewPort(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPort()} />
            </div>
            <div>
              <label className="label" htmlFor="cfg-step3-proto">Protocole</label>
              <select id="cfg-step3-proto" className="input-field" value={newProto} onChange={(e) => setNewProto(e.target.value as Protocol)}>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="tcp+udp">TCP+UDP</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="cfg-step3-label">Label</label>
              <input id="cfg-step3-label" className="input-field" placeholder="Mon service" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPort()} />
            </div>
          </div>
          <button onClick={addPort} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-1">
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
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm text-white w-10 text-right shrink-0">{entry.port}</span>
                <Badge variant={entry.protocol === 'tcp' ? 'cyan' : entry.protocol === 'udp' ? 'orange' : 'green'}>
                  {entry.protocol.toUpperCase()}
                </Badge>
                <span className="text-slate-400 text-sm truncate">{entry.label}</span>
              </div>
              <button onClick={() => setPorts((p) => p.filter((x) => x.id !== entry.id))} aria-label={`Supprimer le port ${entry.port}`} className="text-slate-500 hover:text-accent-red transition-colors sm:opacity-0 sm:group-hover:opacity-100 p-1 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const fileMeta: Record<string, { machine: string; color: string; hint: string }> = {
  'setup-vps.sh':     { machine: 'VPS',      color: 'text-accent-cyan',   hint: 'Exécuter sur le VPS (SSH)' },
  'setup-client.sh':  { machine: 'PC Local', color: 'text-accent-orange', hint: 'Exécuter sur votre PC local' },
  'setup-client.ps1': { machine: 'PC Local', color: 'text-accent-orange', hint: 'PowerShell Admin sur votre PC' },
  'wg0-server.conf':  { machine: 'VPS',      color: 'text-accent-cyan',   hint: 'Config WireGuard du VPS' },
  'wg0-client.conf':  { machine: 'PC Local', color: 'text-accent-orange', hint: 'Config WireGuard du PC local' },
  'README.txt':       { machine: 'Lisez-moi',color: 'text-slate-400',     hint: 'Instructions d\'installation' },
}

// ─── Validation ────────────────────────────────────────────────
function getConfigWarnings(config: Parameters<typeof generateAllFiles>[0]): string[] {
  const warnings: string[] = []
  if (!config.vpsPublicIp || !isValidIp(config.vpsPublicIp))
    warnings.push('IP publique du VPS manquante ou invalide')
  if (!config.keys.serverPrivateKey || !config.keys.serverPublicKey)
    warnings.push('Clés serveur VPS incomplètes')
  else if (!isValidWgKey(config.keys.serverPrivateKey) || !isValidWgKey(config.keys.serverPublicKey))
    warnings.push('Clés serveur VPS invalides — elles seront remplacées par des valeurs placeholder dans les fichiers générés')
  if (!config.keys.clientPrivateKey || !config.keys.clientPublicKey)
    warnings.push('Clés client incomplètes')
  else if (!isValidWgKey(config.keys.clientPrivateKey) || !isValidWgKey(config.keys.clientPublicKey))
    warnings.push('Clés client invalides — elles seront remplacées par des valeurs placeholder dans les fichiers générés')
  if (config.ports.length === 0)
    warnings.push('Aucun port configuré — les scripts n\'auront pas de redirections')
  return warnings
}

// ─── Step 4 ─────────────────────────────────────────────────────
function Step4({
  config,
  addToast,
  onGoToStep,
}: {
  config: Parameters<typeof generateAllFiles>[0]
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onGoToStep: (step: number) => void
}) {
  const warnings = getConfigWarnings(config)
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
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-accent-orange font-semibold text-sm">
            <AlertTriangle size={16} />
            Configuration incomplète
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-accent-orange mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            {warnings.some(w => w.includes('IP')) && (
              <button onClick={() => onGoToStep(1)} className="text-xs text-accent-cyan hover:underline">Corriger (Étape 1)</button>
            )}
            {warnings.some(w => w.includes('Clés')) && (
              <button onClick={() => onGoToStep(2)} className="text-xs text-accent-cyan hover:underline">Corriger (Étape 2)</button>
            )}
            {warnings.some(w => w.includes('port')) && (
              <button onClick={() => onGoToStep(3)} className="text-xs text-accent-cyan hover:underline">Corriger (Étape 3)</button>
            )}
          </div>
        </div>
      )}

      {/* Config summary */}
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-4">
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-3">Récapitulatif</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-slate-500">Projet</div>
            <div className="text-white font-medium truncate">{config.projectName || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">IP VPS</div>
            <div className="text-white font-mono">{config.vpsPublicIp || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">IP Client</div>
            <div className="text-white font-mono">{config.localWireguardIp}</div>
          </div>
          <div>
            <div className="text-slate-500">OS / Ports</div>
            <div className="text-white">{config.targetOS} / {config.ports.length} port(s)</div>
          </div>
        </div>
      </div>

      {/* Header + bouton ZIP */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="font-bold text-white">Fichiers générés</h3>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            {fileEntries.length} fichiers — prêts à télécharger
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
                <p className="text-xs text-slate-500 font-mono mb-2">→ {meta.hint}</p>
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

      {/* FAQ link */}
      <div className="rounded-xl border border-bg-border bg-bg-surface p-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">Un problème après l'installation ?</p>
        <Link to="/faq" className="text-sm text-accent-purple hover:underline font-medium">Consulter la FAQ</Link>
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

  const handleReset = () => {
    if (!window.confirm('Réinitialiser toute la configuration ? Les données seront perdues.')) return
    setProjectName('')
    setVpsIp('')
    setLocalWgIp('10.10.0.2')
    setWgPort(51820)
    setTargetOS('linux-debian')
    setKeys({ serverPrivateKey: '', serverPublicKey: '', clientPrivateKey: '', clientPublicKey: '' })
    setPorts([])
    setStep(1)
    addToast('Configuration réinitialisée', 'info')
  }

  const handleImportConf = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) return
      const get = (key: string) => {
        const m = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))
        return m?.[1]?.trim() || ''
      }
      const privKey = get('PrivateKey')
      const addr = get('Address').replace(/\/\d+$/, '')
      const pubKey = get('PublicKey')
      const endpoint = get('Endpoint')
      const listenPort = get('ListenPort')

      if (endpoint) {
        const [ip, port] = endpoint.split(':')
        if (ip) setVpsIp(ip)
        if (port) setWgPort(parseInt(port) || 51820)
      }
      if (listenPort) setWgPort(parseInt(listenPort) || 51820)
      if (addr) setLocalWgIp(addr)
      if (privKey) {
        if (endpoint) {
          setKeys(k => ({ ...k, clientPrivateKey: privKey }))
        } else {
          setKeys(k => ({ ...k, serverPrivateKey: privKey }))
        }
      }
      if (pubKey) {
        if (endpoint) {
          setKeys(k => ({ ...k, serverPublicKey: pubKey }))
        } else {
          setKeys(k => ({ ...k, clientPublicKey: pubKey }))
        }
      }

      if (!privKey && !pubKey && !addr && !endpoint && !listenPort) {
        addToast('Fichier .conf illisible — aucun champ WireGuard reconnu', 'error')
        return
      }
      addToast('Configuration importée depuis ' + file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [setVpsIp, setWgPort, setLocalWgIp, setKeys, addToast])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
            Générateur de configuration
          </h1>
          <p className="text-slate-500 text-sm">
            4 étapes pour générer vos fichiers WireGuard et scripts d'installation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="btn-ghost text-xs flex items-center gap-1.5 cursor-pointer">
            <Upload size={13} />
            <span className="hidden sm:inline">Importer .conf</span>
            <input type="file" accept=".conf" onChange={handleImportConf} className="hidden" />
          </label>
          <button onClick={handleReset} className="btn-ghost text-xs flex items-center gap-1.5 text-slate-500 hover:text-accent-red hover:border-accent-red/30">
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Auto-save indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-6">
        <Save size={11} />
        Sauvegarde automatique dans le navigateur
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => setStep(s.id)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <StepBadge number={s.id} active={step === s.id} />
              <span className={`text-xs font-medium transition-colors hidden sm:block
                ${step === s.id ? 'text-white' : step > s.id ? 'text-accent-green' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 sm:mx-3 h-px bg-bg-border relative">
                <div
                  className="absolute inset-y-0 left-0 bg-accent-green transition-all duration-300"
                  style={{ width: step > s.id ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="card mb-6 animate-fade-in">

        {step === 1 && (
          <Step1
            projectName={projectName} setProjectName={setProjectName}
            vpsIp={vpsIp} setVpsIp={setVpsIp}
            localWgIp={localWgIp} setLocalWgIp={setLocalWgIp}
            wgPort={wgPort} setWgPort={setWgPort}
            targetOS={targetOS} setTargetOS={setTargetOS}
          />
        )}
        {step === 2 && <Step2 keys={keys} setKeys={setKeys} addToast={addToast} />}
        {step === 3 && <Step3 ports={ports} setPorts={setPorts} />}
        {step === 4 && <Step4 config={config} addToast={addToast} onGoToStep={setStep} />}
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
