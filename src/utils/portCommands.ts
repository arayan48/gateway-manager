import type { PortEntry } from '../types'
import { sanitizeLabel, formatPortEntry } from './helpers'
import {
  DETECT_IFACE, WG_SUBNET, isRange, isValidPortEntry, linuxClientRoutingHooks, localPort,
  protocolsOf, vpsApplyRules, vpsRemoveRules,
} from './network'

export type PortOS = 'linux-vps' | 'linux-client' | 'windows' | 'macos'

export interface PortCommandInput {
  ports: PortEntry[]
  vpsIp: string
  localWgIp: string
  openAll: boolean
  wgPort: number
  preserveClientIp: boolean
}

const ALL_PORTS_NOTE = '# Tous les ports (1-65535) sont redirigés — utile pour les services à ports dynamiques (ex: Coolify)'

function validPorts(input: PortCommandInput): PortEntry[] {
  return input.ports.filter(isValidPortEntry)
}

function testTarget(input: PortCommandInput): string {
  return input.vpsIp || '<VPS_PUBLIC_IP>'
}

// ─── Linux VPS — mêmes règles que setup-vps.sh, à coller dans un terminal root ──

export function generateVpsCommands(input: PortCommandInput): string[] {
  return [
    '# Interface réseau publique du VPS (détectée automatiquement)',
    DETECT_IFACE,
    'sysctl -w net.ipv4.ip_forward=1',
    '',
    '# Repartir d\'un état propre : recoller ce bloc remplace les règles précédentes',
    ...vpsRemoveRules(),
    '',
    ...vpsApplyRules(
      {
        ports: input.ports,
        localIp: input.localWgIp || '10.10.0.2',
        wgPort: input.wgPort,
        openAll: input.openAll,
        preserveClientIp: input.preserveClientIp,
      },
      'wg0'
    ),
  ]
}

export function generateVpsRemoveCommands(): string[] {
  return [
    '# Retire toutes les règles GatewayManager (Docker, ufw… ne sont pas touchés)',
    ...vpsRemoveRules(),
  ]
}

export function generateVerificationCommands(input: PortCommandInput): string[] {
  const ip = testTarget(input)
  const lines: string[] = [
    '# Diagnostic complet (installé par setup-vps.sh)',
    'sudo gm-status',
    '',
    '# Ou manuellement : compteurs de paquets par redirection',
    'iptables -t nat -L GM_PREROUTING -n -v',
    'wg show',
    '',
  ]

  if (input.openAll) {
    lines.push('# Tous les ports sont ouverts — testez le port réellement utilisé par votre service')
    lines.push(`nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`)
    return lines
  }

  lines.push('# Tests de connectivité (depuis n\'importe quelle machine)')
  for (const entry of validPorts(input)) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${proto === 'udp' ? '-u ' : ''}${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}

// ─── Linux PC local — iptables INPUT + routage des réponses (IP réelle) ───────

export function generateLinuxClientRules(input: PortCommandInput): string[] {
  const rules: string[] = []

  if (input.preserveClientIp) {
    const hooks = linuxClientRoutingHooks()
    rules.push('# IP réelle des visiteurs : renvoyer les réponses dans le tunnel (à refaire après chaque redémarrage)')
    rules.push('# setup-client.sh le fait automatiquement via wg0.conf (PostUp) — inutile si vous l\'avez utilisé')
    rules.push('# Le peer du VPS doit avoir AllowedIPs = 0.0.0.0/0 et l\'interface Table = off')
    for (const h of hooks.up) rules.push(h.replace(/%i/g, 'wg0'))
    rules.push('')
  }

  if (input.openAll) {
    rules.push(ALL_PORTS_NOTE)
    rules.push('iptables -A INPUT -i wg0 -j ACCEPT')
  } else {
    rules.push('# Autoriser les connexions entrantes via le tunnel WireGuard (interface wg0)')
    for (const entry of validPorts(input)) {
      const dport = isRange(entry) ? `${entry.port}:${entry.endPort}` : String(localPort(entry))
      for (const proto of protocolsOf(entry)) {
        rules.push(`iptables -A INPUT -i wg0 -p ${proto} --dport ${dport} -j ACCEPT  # ${sanitizeLabel(entry.label)}`)
      }
    }
  }
  rules.push('')
  rules.push('# Sauvegarder les règles')
  rules.push('# Debian / Ubuntu :  netfilter-persistent save')
  rules.push('# Fedora / CentOS :  service iptables save')
  rules.push('# Alpine / Arch   :  iptables-save > /etc/iptables/rules.v4')
  return rules
}

export function generateLinuxClientVerification(input: PortCommandInput): string[] {
  const lines: string[] = [
    '# Vérifier les règles appliquées',
    'iptables -L INPUT -n -v',
    '',
  ]
  if (input.preserveClientIp) {
    lines.push('# Routage IP réelle : doit afficher une règle "fwmark … lookup 4242"')
    lines.push('ip rule')
    lines.push('# Connexions en cours avec l\'IP réelle des visiteurs')
    lines.push('ss -tn state established')
    lines.push('')
  }
  const ip = testTarget(input)
  if (input.openAll) {
    lines.push('# Tous les ports sont ouverts — testez le port réellement utilisé par votre service')
    lines.push(`nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`)
    return lines
  }
  lines.push('# Tests depuis l\'extérieur')
  for (const entry of validPorts(input)) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${proto === 'udp' ? '-u ' : ''}${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}

// ─── Windows PC local — PowerShell New-NetFirewallRule ───────────────────────

export function generateWindowsRules(input: PortCommandInput): string[] {
  if (input.openAll) {
    return [
      '# Ouvrir tous les ports entrants (PowerShell en Administrateur)',
      '# Limité au tunnel WireGuard (interface wg0) : le PC reste fermé sur le réseau local / Wi-Fi public',
      'New-NetFirewallRule -DisplayName "WG-AllPorts-TCP" -Direction Inbound -Protocol TCP -LocalPort 1-65535 -InterfaceAlias wg0 -Action Allow',
      'New-NetFirewallRule -DisplayName "WG-AllPorts-UDP" -Direction Inbound -Protocol UDP -LocalPort 1-65535 -InterfaceAlias wg0 -Action Allow',
    ]
  }
  const lines: string[] = ['# Ouvrir les ports entrants (PowerShell en Administrateur)']
  for (const entry of validPorts(input)) {
    const label = sanitizeLabel(entry.label).replace(/"/g, '')
    const local = isRange(entry) ? `${entry.port}-${entry.endPort}` : String(localPort(entry))
    for (const proto of protocolsOf(entry)) {
      const P = proto.toUpperCase()
      lines.push(
        `New-NetFirewallRule -DisplayName "${label} ${P} ${local}" -Direction Inbound -Protocol ${P} -LocalPort ${local} -Action Allow`
      )
    }
  }
  return lines
}

export function generateWindowsVerification(input: PortCommandInput): string[] {
  const ip = testTarget(input)
  if (input.openAll) {
    return [
      '# Tests de connectivité (PowerShell)',
      '# Tous les ports sont ouverts — testez le port réellement utilisé par votre service',
      `Test-NetConnection -ComputerName ${ip} -Port <PORT>  # ex: 8000 pour le dashboard Coolify`,
    ]
  }
  const lines: string[] = ['# Tests de connectivité (PowerShell)']
  for (const entry of validPorts(input)) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    if (proto !== 'udp') {
      lines.push(`Test-NetConnection -ComputerName ${ip} -Port ${entry.port}  # ${sanitizeLabel(entry.label)}`)
    } else {
      lines.push(`# UDP ${entry.port} (${sanitizeLabel(entry.label)}) — test UDP non disponible nativement sous Windows`)
    }
  }
  return lines
}

// ─── macOS PC local — pfctl ───────────────────────────────────────────────────

export function generateMacOSRules(input: PortCommandInput): string[] {
  if (input.openAll) {
    // Sans IP réelle, tout arrive depuis le VPS (10.10.0.1) : on peut restreindre au tunnel.
    // Avec IP réelle, les sources sont des IP internet et pf ne peut pas viser l'interface utun (nom dynamique).
    const from = input.preserveClientIp ? 'any' : WG_SUBNET
    return [
      '# Ajouter dans /etc/pf.conf (section "pass rules") :',
      '',
      ALL_PORTS_NOTE,
      input.preserveClientIp
        ? '# IP réelle conservée : les sources sont des IP internet — tous les ports sont ouverts sur toutes les interfaces'
        : '# Limité au tunnel WireGuard : le Mac reste fermé sur le réseau local / Wi-Fi public',
      `pass in proto tcp from ${from} to any port 1:65535`,
      `pass in proto udp from ${from} to any port 1:65535`,
      '',
      '# Appliquer les règles :',
      'sudo pfctl -f /etc/pf.conf -e',
    ]
  }
  const lines: string[] = [
    '# Ajouter dans /etc/pf.conf (section "pass rules") :',
    '',
  ]
  for (const entry of validPorts(input)) {
    const port = isRange(entry) ? `${entry.port}:${entry.endPort}` : String(localPort(entry))
    for (const proto of protocolsOf(entry)) {
      lines.push(`pass in proto ${proto} from any to any port ${port}  # ${sanitizeLabel(entry.label)} (${formatPortEntry(entry)})`)
    }
  }
  lines.push('')
  lines.push('# Appliquer les règles :')
  lines.push('sudo pfctl -f /etc/pf.conf -e')
  return lines
}

export function generateMacOSVerification(input: PortCommandInput): string[] {
  const ip = testTarget(input)
  if (input.openAll) {
    return [
      '# Tests de connectivité (macOS / Linux)',
      '# Tous les ports sont ouverts — testez le port réellement utilisé par votre service',
      `nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`,
    ]
  }
  const lines: string[] = ['# Tests de connectivité (macOS / Linux)']
  for (const entry of validPorts(input)) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${proto === 'udp' ? '-u ' : ''}${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}
