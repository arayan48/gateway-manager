import type { PortEntry } from '../types'

/** Strip characters that could break shell comments or inject commands */
function sanitizeLabel(label: string): string {
  return label.replace(/[\r\n`$\\;|&<>]/g, '').slice(0, 60)
}

export function generateIptablesRules(
  ports: PortEntry[],
  _vpsIp: string,
  localWgIp: string
): string[] {
  const local = localWgIp || '<LOCAL_WG_IP>'
  const rules: string[] = []

  for (const entry of ports) {
    const protos =
      entry.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [entry.protocol]
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
    '# Tests de connectivité',
  ]

  for (const entry of ports) {
    const proto = entry.protocol === 'tcp+udp' ? 'tcp' : entry.protocol
    lines.push(`nc -zv ${ip} ${entry.port}  # ${sanitizeLabel(entry.label)} (${proto})`)
  }

  return lines
}

export function generateFullBlock(
  ports: PortEntry[],
  _vpsIp: string,
  localWgIp: string
): string {
  return generateIptablesRules(ports, _vpsIp, localWgIp).join('\n')
}
