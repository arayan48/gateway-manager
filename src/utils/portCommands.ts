import type { PortEntry } from '../types'
import { sanitizeLabel } from './helpers'

export type PortOS = 'linux-vps' | 'linux-client' | 'windows' | 'macos'

const ALL_PORTS_NOTE = '# Tous les ports (1-65535) sont redirigés — utile pour les services à ports dynamiques (ex: Coolify)'

// ─── Linux VPS — iptables DNAT (redirection vers le PC local via WireGuard) ──

export function generateIptablesRules(
  ports: PortEntry[],
  _vpsIp: string,
  localWgIp: string,
  openAll = false,
  wgPort = 51820
): string[] {
  const local = localWgIp || '10.10.0.2'
  const rules: string[] = []

  if (openAll) {
    rules.push(ALL_PORTS_NOTE)
    rules.push('# SSH (22) et le port WireGuard lui-même restent servis par le VPS — sinon vous perdez SSH et le tunnel ne peut plus se monter')
    rules.push(`iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 22 -j RETURN`)
    rules.push(`iptables -t nat -A PREROUTING -i eth0 -p udp --dport ${wgPort} -j RETURN`)
    for (const proto of ['tcp', 'udp']) {
      rules.push(`iptables -t nat -A PREROUTING -i eth0 -p ${proto} --dport 1:65535 -j DNAT --to-destination ${local}`)
      rules.push(`iptables -A FORWARD -p ${proto} -d ${local} -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT`)
    }
    rules.push(`iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o eth0 -j MASQUERADE`)
    return rules
  }

  for (const entry of ports) {
    const protos = entry.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [entry.protocol]
    for (const proto of protos) {
      rules.push(
        `iptables -t nat -A PREROUTING -i eth0 -p ${proto} --dport ${entry.port} -j DNAT --to-destination ${local}:${entry.port}  # ${sanitizeLabel(entry.label)}`
      )
      rules.push(
        `iptables -A FORWARD -p ${proto} -d ${local} --dport ${entry.port} -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT`
      )
    }
  }

  rules.push(`iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o eth0 -j MASQUERADE`)
  return rules
}

export function generateVerificationCommands(
  ports: PortEntry[],
  vpsIp: string,
  openAll = false
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  const lines: string[] = [
    '# Vérification des règles iptables',
    'iptables -t nat -L PREROUTING -n -v',
    'iptables -L FORWARD -n -v',
    '',
    '# Vérification WireGuard',
    'wg show',
    '',
  ]

  if (openAll) {
    lines.push('# Tous les ports sont ouverts — testez le port réellement utilisé par votre service')
    lines.push(`nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`)
    return lines
  }

  lines.push('# Tests de connectivité (depuis n\'importe quelle machine)')
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }

  return lines
}

export function generateFullBlock(
  ports: PortEntry[],
  vpsIp: string,
  localWgIp: string,
  openAll = false,
  wgPort = 51820
): string {
  return generateIptablesRules(ports, vpsIp, localWgIp, openAll, wgPort).join('\n')
}

// ─── Linux PC local — iptables INPUT (autoriser via wg0) ─────────────────────

export function generateLinuxClientRules(ports: PortEntry[], openAll = false): string[] {
  if (openAll) {
    return [
      ALL_PORTS_NOTE,
      'iptables -A INPUT -i wg0 -j ACCEPT',
      '',
      '# Sauvegarder les règles',
      '# Debian / Ubuntu :  netfilter-persistent save',
      '# Fedora / CentOS :  service iptables save',
      '# Alpine / Arch   :  iptables-save > /etc/iptables/rules.v4',
    ]
  }
  const rules: string[] = ['# Autoriser les connexions entrantes via le tunnel WireGuard (interface wg0)']
  for (const entry of ports) {
    const protos = entry.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [entry.protocol]
    for (const proto of protos) {
      rules.push(
        `iptables -A INPUT -i wg0 -p ${proto} --dport ${entry.port} -j ACCEPT  # ${sanitizeLabel(entry.label)}`
      )
    }
  }
  rules.push('')
  rules.push('# Sauvegarder les règles')
  rules.push('# Debian / Ubuntu :  netfilter-persistent save')
  rules.push('# Fedora / CentOS :  service iptables save')
  rules.push('# Alpine / Arch   :  iptables-save > /etc/iptables/rules.v4')
  return rules
}

export function generateLinuxClientVerification(
  ports: PortEntry[],
  vpsIp: string,
  openAll = false
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  const lines: string[] = [
    '# Vérifier les règles appliquées',
    'iptables -L INPUT -n -v',
    '',
  ]
  if (openAll) {
    lines.push('# Tous les ports sont ouverts — testez le port réellement utilisé par votre service')
    lines.push(`nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`)
    return lines
  }
  lines.push('# Tests depuis l\'extérieur (remplacez <VPS_PUBLIC_IP> si besoin)')
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}

// ─── Windows PC local — PowerShell New-NetFirewallRule ───────────────────────

export function generateWindowsRules(ports: PortEntry[], openAll = false): string[] {
  if (openAll) {
    return [
      '# Ouvrir tous les ports entrants (PowerShell en Administrateur)',
      'New-NetFirewallRule -DisplayName "WG-AllPorts-TCP" -Direction Inbound -Protocol TCP -LocalPort 1-65535 -Action Allow',
      'New-NetFirewallRule -DisplayName "WG-AllPorts-UDP" -Direction Inbound -Protocol UDP -LocalPort 1-65535 -Action Allow',
    ]
  }
  const lines: string[] = ['# Ouvrir les ports entrants (PowerShell en Administrateur)']
  for (const entry of ports) {
    const label = sanitizeLabel(entry.label)
    const protos = entry.protocol === 'tcp+udp' ? ['TCP', 'UDP'] : [entry.protocol.toUpperCase()]
    for (const proto of protos) {
      lines.push(
        `New-NetFirewallRule -DisplayName "${label} ${proto} ${entry.port}" -Direction Inbound -Protocol ${proto} -LocalPort ${entry.port} -Action Allow`
      )
    }
  }
  return lines
}

export function generateWindowsVerification(
  ports: PortEntry[],
  vpsIp: string,
  openAll = false
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  if (openAll) {
    return [
      '# Tests de connectivité (PowerShell)',
      '# Tous les ports sont ouverts — testez le port réellement utilisé par votre service',
      `Test-NetConnection -ComputerName ${ip} -Port <PORT>  # ex: 8000 pour le dashboard Coolify`,
    ]
  }
  const lines: string[] = ['# Tests de connectivité (PowerShell)']
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    if (proto !== 'udp') {
      lines.push(
        `Test-NetConnection -ComputerName ${ip} -Port ${entry.port}  # ${sanitizeLabel(entry.label)}`
      )
    } else {
      lines.push(
        `# UDP ${entry.port} (${sanitizeLabel(entry.label)}) — test UDP non disponible nativement sous Windows`
      )
    }
  }
  return lines
}

// ─── macOS PC local — pfctl ───────────────────────────────────────────────────

export function generateMacOSRules(ports: PortEntry[], openAll = false): string[] {
  if (openAll) {
    return [
      '# Ajouter dans /etc/pf.conf (section "pass rules") :',
      '',
      ALL_PORTS_NOTE,
      'pass in proto tcp from any to any port 1:65535',
      'pass in proto udp from any to any port 1:65535',
      '',
      '# Appliquer les règles :',
      'sudo pfctl -f /etc/pf.conf -e',
    ]
  }
  const lines: string[] = [
    '# Ajouter dans /etc/pf.conf (section "pass rules") :',
    '',
  ]
  for (const entry of ports) {
    const protos = entry.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [entry.protocol]
    for (const proto of protos) {
      lines.push(
        `pass in proto ${proto} from any to any port ${entry.port}  # ${sanitizeLabel(entry.label)}`
      )
    }
  }
  lines.push('')
  lines.push('# Appliquer les règles :')
  lines.push('sudo pfctl -f /etc/pf.conf -e')
  return lines
}

export function generateMacOSVerification(
  ports: PortEntry[],
  vpsIp: string,
  openAll = false
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  if (openAll) {
    return [
      '# Tests de connectivité (macOS / Linux)',
      '# Tous les ports sont ouverts — testez le port réellement utilisé par votre service',
      `nc -zv ${ip} <PORT>  # ex: 8000 pour le dashboard Coolify`,
    ]
  }
  const lines: string[] = ['# Tests de connectivité (macOS / Linux)']
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}
