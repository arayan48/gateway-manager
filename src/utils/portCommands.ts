import type { PortEntry } from '../types'

export type PortOS = 'linux-vps' | 'linux-client' | 'windows' | 'macos'

/** Strip characters that could break shell comments or inject commands */
function sanitizeLabel(label: string): string {
  return label.replace(/[\r\n`$\\;|&<>]/g, '').slice(0, 60)
}

// ─── Linux VPS — iptables DNAT (redirection vers le PC local via WireGuard) ──

export function generateIptablesRules(
  ports: PortEntry[],
  _vpsIp: string,
  localWgIp: string
): string[] {
  const local = localWgIp || '10.10.0.2'
  const rules: string[] = []

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
  vpsIp: string
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
    '# Tests de connectivité (depuis n\'importe quelle machine)',
  ]

  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }

  return lines
}

export function generateFullBlock(
  ports: PortEntry[],
  vpsIp: string,
  localWgIp: string
): string {
  return generateIptablesRules(ports, vpsIp, localWgIp).join('\n')
}

// ─── Linux PC local — iptables INPUT (autoriser via wg0) ─────────────────────

export function generateLinuxClientRules(ports: PortEntry[]): string[] {
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
  vpsIp: string
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  const lines: string[] = [
    '# Vérifier les règles appliquées',
    'iptables -L INPUT -n -v',
    '',
    '# Tests depuis l\'extérieur (remplacez <VPS_PUBLIC_IP> si besoin)',
  ]
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}

// ─── Windows PC local — PowerShell New-NetFirewallRule ───────────────────────

export function generateWindowsRules(ports: PortEntry[]): string[] {
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
  vpsIp: string
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
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

export function generateMacOSRules(ports: PortEntry[]): string[] {
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
  vpsIp: string
): string[] {
  const ip = vpsIp || '<VPS_PUBLIC_IP>'
  const lines: string[] = ['# Tests de connectivité (macOS / Linux)']
  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }
  return lines
}
