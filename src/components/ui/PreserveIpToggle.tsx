import { Fingerprint } from 'lucide-react'
import { NoteBox } from './NoteBox'
import { ToggleCard } from './ToggleCard'

interface PreserveIpToggleProps {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  /** OS du PC local — Windows / macOS passent en tunnel complet */
  clientOs?: 'linux' | 'windows' | 'macos'
}

export function PreserveIpToggle({ id, checked, onChange, clientOs = 'linux' }: PreserveIpToggleProps) {
  const osName = clientOs === 'windows' ? 'Windows' : 'macOS'
  return (
    <ToggleCard
      id={id}
      icon={Fingerprint}
      accent="green"
      title="Conserver l'IP réelle des visiteurs"
      description="Vos services (logs, bans, txAdmin, Coolify/Traefik, fail2ban…) voient l'IP de la personne qui se connecte, et non celle du VPS."
      checked={checked}
      onChange={onChange}
    >
      {!checked ? (
        <NoteBox type="info" title="Mode simple">
          Toutes les connexions arriveront sur votre PC avec l'IP du VPS (10.10.0.1) : impossible de bannir un joueur ou de lire l'IP d'origine dans les logs.
        </NoteBox>
      ) : clientOs === 'linux' ? (
        <NoteBox type="ok" title="Routage intelligent">
          Seules les réponses aux connexions arrivées par le tunnel y retournent ; le reste du trafic du PC sort normalement par votre box. Compatible Docker / Coolify.
        </NoteBox>
      ) : (
        <NoteBox type="warn" title={`Tunnel complet sous ${osName}`}>
          {osName} ne sait pas router « seulement les réponses » : tout le trafic internet du PC passera par le VPS (le réseau local reste accessible). Désactivez l'option si vous ne voulez pas de ce comportement.
        </NoteBox>
      )}
    </ToggleCard>
  )
}
