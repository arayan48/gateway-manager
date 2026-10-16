export type Protocol = 'tcp' | 'udp' | 'tcp+udp'

export interface PortEntry {
  id: string
  /** Port public (côté VPS) — premier port de la plage si `endPort` est défini */
  port: number
  protocol: Protocol
  label: string
  /** Dernier port d'une plage (ex: 27015-27030) — la plage est redirigée à l'identique */
  endPort?: number
  /** Port sur le PC local s'il diffère du port public (ex: 2222 → 22) — ignoré pour une plage */
  targetPort?: number
  /** IPs / réseaux autorisés (ex: "203.0.113.4, 198.51.100.0/24") — vide = tout internet */
  allowedSources?: string
}

export interface AdvancedOptions {
  /**
   * Les services du PC local voient l'IP réelle des visiteurs au lieu de celle du VPS.
   * Linux : routage par marquage de connexion (seules les réponses repassent par le tunnel).
   * Windows / macOS : tunnel complet (tout le trafic sortant du PC passe par le VPS).
   */
  preserveClientIp: boolean
  /** MTU du tunnel — null = automatique (1420 par défaut dans WireGuard) */
  mtu: number | null
  /** Intervalle de keepalive côté client, en secondes (maintient le NAT de la box ouvert) */
  keepalive: number
}

export const DEFAULT_OPTIONS: AdvancedOptions = {
  preserveClientIp: true,
  mtu: null,
  keepalive: 25,
}

export type TargetOS =
  | 'windows'
  | 'linux-debian'
  | 'linux-ubuntu'
  | 'linux-fedora'
  | 'linux-alpine'
  | 'linux-arch'
  | 'macos'

export interface WireGuardKeys {
  serverPrivateKey: string
  serverPublicKey: string
  clientPrivateKey: string
  clientPublicKey: string
}

export interface ProjectConfig {
  projectName: string
  vpsPublicIp: string
  localWireguardIp: string
  wireguardPort: number
  targetOS: TargetOS
  keys: WireGuardKeys
  ports: PortEntry[]
  /** Redirige tous les ports (1-65535) au lieu de la liste `ports` — utile pour les services à ports dynamiques (ex: Coolify) */
  openAllPorts: boolean
  options: AdvancedOptions
}

export interface GeneratedFiles {
  'wg0-server.conf': string
  'wg0-client.conf': string
  'setup-vps.sh': string
  'setup-client.sh'?: string
  'setup-client.ps1'?: string
  'uninstall-vps.sh': string
  'README.txt': string
}

export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export interface DocSection {
  id: string
  title: string
  os: TargetOS
}

export const PORT_PRESETS: { label: string; port: number; protocol: Protocol; description: string }[] = [
  { label: 'FiveM', port: 30120, protocol: 'tcp+udp', description: 'Serveur FiveM' },
  { label: 'txAdmin', port: 40120, protocol: 'tcp', description: 'Interface txAdmin' },
  { label: 'RDP', port: 3389, protocol: 'tcp', description: 'Bureau à distance Windows' },
  { label: 'HTTP', port: 80, protocol: 'tcp', description: 'Serveur web HTTP' },
  { label: 'HTTPS', port: 443, protocol: 'tcp', description: 'Serveur web HTTPS' },
  { label: 'MySQL', port: 3306, protocol: 'tcp', description: 'Base de données MySQL' },
  { label: 'PostgreSQL', port: 5432, protocol: 'tcp', description: 'Base de données PostgreSQL' },
  { label: 'Redis', port: 6379, protocol: 'tcp', description: 'Cache Redis' },
  { label: 'HTTP Alt', port: 8080, protocol: 'tcp', description: 'Port HTTP alternatif' },
  { label: 'Minecraft', port: 25565, protocol: 'tcp+udp', description: 'Serveur Minecraft' },
]
