export type Protocol = 'tcp' | 'udp' | 'tcp+udp'

export interface PortEntry {
  id: string
  port: number
  protocol: Protocol
  label: string
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
}

export interface GeneratedFiles {
  'wg0-server.conf': string
  'wg0-client.conf': string
  'setup-vps.sh': string
  'setup-client.sh'?: string
  'setup-client.ps1'?: string
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
