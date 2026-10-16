import { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import type { PortEntry, Protocol } from '../../types'
import { genId, isValidPort, parseSources, formatPortEntry } from '../../utils/helpers'
import { portsOverlap } from '../../utils/network'

interface AddPortFormProps {
  idPrefix: string
  existing: PortEntry[]
  onAdd: (entry: PortEntry) => void
  onError: (message: string) => void
}

function toPort(v: string): number | undefined {
  return v.trim() === '' ? undefined : Number(v)
}

export function AddPortForm({ idPrefix, existing, onAdd, onError }: AddPortFormProps) {
  const [port, setPort] = useState('')
  const [proto, setProto] = useState<Protocol>('tcp')
  const [label, setLabel] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [endPort, setEndPort] = useState('')
  const [targetPort, setTargetPort] = useState('')
  const [sources, setSources] = useState('')

  const sourcesInvalid = sources.trim() !== '' && parseSources(sources) === null

  const submit = () => {
    const p = Number(port)
    const end = toPort(endPort)
    const target = toPort(targetPort)
    if (!isValidPort(p)) return onError('Port invalide (1-65535)')
    if (end !== undefined && (!isValidPort(end) || end <= p)) return onError('Fin de plage invalide — elle doit être supérieure au premier port')
    if (target !== undefined && !isValidPort(target)) return onError('Port local invalide (1-65535)')
    if (end !== undefined && target !== undefined && target !== p) return onError('Une plage est redirigée à l\'identique — laissez le port local vide')
    if (sourcesInvalid) return onError('IPs autorisées invalides — ex: 203.0.113.4, 198.51.100.0/24')

    const entry: PortEntry = {
      id: genId(),
      port: p,
      protocol: proto,
      label: label.trim() || (end ? `Ports ${p}-${end}` : `Port ${p}`),
      ...(end !== undefined && { endPort: end }),
      ...(target !== undefined && target !== p && end === undefined && { targetPort: target }),
      ...(sources.trim() && { allowedSources: parseSources(sources)!.join(', ') }),
    }
    const clash = existing.find((e) => portsOverlap(e, entry))
    if (clash) return onError(`Conflit avec « ${clash.label} » (${formatPortEntry(clash)} ${clash.protocol.toUpperCase()})`)

    onAdd(entry)
    setPort(''); setLabel(''); setEndPort(''); setTargetPort(''); setSources('')
  }

  const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && submit()

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label" htmlFor={`${idPrefix}-port`}>Port public</label>
          <input id={`${idPrefix}-port`} className="input-field" placeholder="ex: 8080" type="number" min={1} max={65535}
            value={port} onChange={(e) => setPort(e.target.value)} onKeyDown={onEnter} />
        </div>
        <div className="w-28">
          <label className="label" htmlFor={`${idPrefix}-proto`}>Protocole</label>
          <select id={`${idPrefix}-proto`} className="input-field" value={proto} onChange={(e) => setProto(e.target.value as Protocol)}>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="tcp+udp">TCP+UDP</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-label`}>Label (optionnel)</label>
        <input id={`${idPrefix}-label`} className="input-field" placeholder="ex: Mon service"
          value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={onEnter} />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Plage, port différent, restriction d'IP
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-bg-border p-3 bg-bg-base/40">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor={`${idPrefix}-end`}>Fin de plage</label>
              <input id={`${idPrefix}-end`} className="input-field" placeholder="ex: 27030" type="number" min={1} max={65535}
                value={endPort} onChange={(e) => setEndPort(e.target.value)} onKeyDown={onEnter} />
            </div>
            <div>
              <label className="label" htmlFor={`${idPrefix}-target`}>Port sur le PC</label>
              <input id={`${idPrefix}-target`} className="input-field" placeholder="= port public" type="number" min={1} max={65535}
                value={targetPort} onChange={(e) => setTargetPort(e.target.value)} onKeyDown={onEnter} disabled={endPort.trim() !== ''} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Plage : redirige 27015 → 27030 d'un coup. Port sur le PC : exposer par ex. le 2222 public vers le 22 du PC.
          </p>
          <div>
            <label className="label" htmlFor={`${idPrefix}-sources`}>IPs autorisées</label>
            <input
              id={`${idPrefix}-sources`}
              className={`input-field ${sourcesInvalid ? 'border-red-500 focus:border-red-400' : ''}`}
              placeholder="vide = tout internet — ex: 203.0.113.4, 198.51.100.0/24"
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              onKeyDown={onEnter}
            />
            <p className={`text-[11px] mt-1 ${sourcesInvalid ? 'text-red-400 font-mono' : 'text-slate-500'}`}>
              {sourcesInvalid ? 'Format invalide — IPv4 ou réseau CIDR, séparés par des virgules' : 'Idéal pour RDP, SSH ou une base de données : seules ces IPs pourront se connecter.'}
            </p>
          </div>
        </div>
      )}

      <button onClick={submit} className="btn-primary w-full flex items-center justify-center gap-2">
        <Plus size={14} />
        Ajouter le port
      </button>
    </div>
  )
}
