import { Unlock } from 'lucide-react'
import { NoteBox } from './NoteBox'
import { ToggleCard } from './ToggleCard'

interface OpenAllPortsToggleProps {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
}

export function OpenAllPortsToggle({ id, checked, onChange }: OpenAllPortsToggleProps) {
  return (
    <ToggleCard
      id={id}
      icon={Unlock}
      title="Ouvrir tous les ports (1-65535)"
      description="Redirige toute la plage de ports au lieu de la liste ci-dessous — utile pour les services à ports dynamiques (ex: Coolify, qui assigne un port par app déployée)."
      checked={checked}
      onChange={onChange}
    >
      {checked && (
        <NoteBox type="warn" title="Surface d'attaque élargie">
          Tous les ports de votre PC local deviennent accessibles depuis internet via le VPS, sauf SSH et le port WireGuard qui restent servis par le VPS. La liste de ports ci-dessous est ignorée tant que cette option est active.
        </NoteBox>
      )}
    </ToggleCard>
  )
}
