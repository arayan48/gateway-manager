import { Unlock } from 'lucide-react'
import { NoteBox } from './NoteBox'

interface OpenAllPortsToggleProps {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
}

export function OpenAllPortsToggle({ id, checked, onChange }: OpenAllPortsToggleProps) {
  return (
    <div className={`card transition-all duration-150 ${checked ? 'border-accent-orange/50 bg-accent-orange/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-accent-orange/15' : 'bg-bg-elevated'}`}>
            <Unlock size={16} className={checked ? 'text-accent-orange' : 'text-slate-500'} />
          </div>
          <div className="min-w-0">
            <label htmlFor={id} className="font-bold text-white text-sm cursor-pointer">
              Ouvrir tous les ports (1-65535)
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Redirige toute la plage de ports au lieu de la liste ci-dessous — utile pour les services à ports dynamiques (ex: Coolify, qui assigne un port par app déployée).
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          id={id}
          onClick={() => onChange(!checked)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-accent-orange' : 'bg-bg-elevated border border-bg-border'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {checked && (
        <div className="mt-4">
          <NoteBox type="warn" title="Surface d'attaque élargie">
            Tous les ports de votre PC local deviennent accessibles depuis internet via le VPS. La liste de ports ci-dessous est ignorée tant que cette option est active.
          </NoteBox>
        </div>
      )}
    </div>
  )
}
