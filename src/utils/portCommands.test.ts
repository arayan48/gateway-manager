import { describe, it, expect } from 'vitest'
import { generateVpsCommands, generateWindowsRules, generateMacOSRules, generateLinuxClientRules } from './portCommands'
import type { PortCommandInput } from './portCommands'

const input: PortCommandInput = {
  ports: [{ id: '1', port: 30120, protocol: 'tcp+udp', label: 'FiveM' }],
  vpsIp: '185.142.21.45',
  localWgIp: '10.10.0.2',
  openAll: false,
  wgPort: 51820,
  preserveClientIp: true,
}

describe('generateVpsCommands', () => {
  it('redirects individual ports without touching SSH or the WireGuard port', () => {
    const rules = generateVpsCommands(input).join('\n')
    expect(rules).toContain('--dport 30120')
    expect(rules).not.toContain('--dport 22')
  })

  it('uses the auto-detected interface instead of a hardcoded eth0', () => {
    const rules = generateVpsCommands(input).join('\n')
    expect(rules).toContain('IFACE=$(ip route get 8.8.8.8')
    expect(rules).toContain('-i "$IFACE"')
    expect(rules).not.toContain('eth0')
  })

  it('resets its own chains first so pasting the block twice does not duplicate rules', () => {
    const rules = generateVpsCommands(input)
    const reset = rules.findIndex((r) => r.includes('-D PREROUTING -j GM_PREROUTING'))
    const create = rules.findIndex((r) => r === 'iptables -t nat -N GM_PREROUTING')
    expect(reset).toBeGreaterThan(-1)
    expect(reset).toBeLessThan(create)
  })

  it('never flushes the system chains (Docker / ufw rules survive)', () => {
    for (const openAll of [false, true]) {
      const rules = generateVpsCommands({ ...input, openAll }).join('\n')
      expect(rules).not.toMatch(/-F (PREROUTING|POSTROUTING|FORWARD|INPUT)\b/)
    }
  })

  it('masquerades towards the tunnel only when the real visitor IP is not preserved', () => {
    expect(generateVpsCommands({ ...input, preserveClientIp: true }).join('\n')).not.toContain('-o wg0 -j MASQUERADE')
    expect(generateVpsCommands({ ...input, preserveClientIp: false })).toContain('iptables -t nat -A GM_POSTROUTING -o wg0 -j MASQUERADE')
  })

  it('excludes the detected SSH port(s) and the WireGuard port before redirecting the full range', () => {
    const rules = generateVpsCommands({ ...input, openAll: true, wgPort: 12345 })
    const dnat = rules.findIndex((r) => r.includes('-p tcp -m addrtype --dst-type LOCAL'))
    const detect = rules.findIndex((r) => r.startsWith('SSH_PORTS=$(sshd -T'))
    const ssh = rules.findIndex((r) => r.includes('--dport "$p" -j RETURN'))
    const wg = rules.findIndex((r) => r.includes('--dport 12345 -j RETURN'))
    expect(detect).toBeGreaterThan(-1)
    expect(detect).toBeLessThan(ssh)
    expect(ssh).toBeLessThan(dnat)
    expect(wg).toBeGreaterThan(-1)
    expect(wg).toBeLessThan(dnat)
    expect(rules.some((r) => r.includes('--dport 51820 -j RETURN'))).toBe(false)
  })
})

describe('local PC firewall rules', () => {
  it('limits open-all to the WireGuard interface on Windows', () => {
    const rules = generateWindowsRules({ ...input, openAll: true }).filter((r) => r.startsWith('New-NetFirewallRule'))
    expect(rules).toHaveLength(2)
    for (const r of rules) expect(r).toContain('-InterfaceAlias wg0')
  })

  it('limits open-all to the tunnel subnet on macOS unless real IPs come through', () => {
    const tunnelOnly = generateMacOSRules({ ...input, openAll: true, preserveClientIp: false }).filter((r) => r.startsWith('pass in'))
    expect(tunnelOnly).toHaveLength(2)
    for (const r of tunnelOnly) expect(r).toContain('from 10.10.0.0/24')
    const realIp = generateMacOSRules({ ...input, openAll: true, preserveClientIp: true }).filter((r) => r.startsWith('pass in'))
    for (const r of realIp) expect(r).toContain('from any')
  })

  it('opens the local port of a translated entry and the full span of a range', () => {
    const ports = [
      { id: 'a', port: 2222, targetPort: 22, protocol: 'tcp' as const, label: 'SSH PC' },
      { id: 'b', port: 27015, endPort: 27030, protocol: 'udp' as const, label: 'Source' },
    ]
    const linux = generateLinuxClientRules({ ...input, ports, preserveClientIp: false }).join('\n')
    expect(linux).toContain('-p tcp --dport 22 -j ACCEPT')
    expect(linux).toContain('-p udp --dport 27015:27030 -j ACCEPT')
    const win = generateWindowsRules({ ...input, ports }).join('\n')
    expect(win).toContain('-Protocol TCP -LocalPort 22 ')
    expect(win).toContain('-Protocol UDP -LocalPort 27015-27030 ')
  })

  it('adds the reply routing on Linux when the real visitor IP is preserved', () => {
    const rules = generateLinuxClientRules(input).join('\n')
    expect(rules).toContain('ip route replace default dev wg0 table 4242')
    expect(rules).toContain('CONNMARK --set-mark 4242')
    expect(rules).not.toContain('%i')
    expect(generateLinuxClientRules({ ...input, preserveClientIp: false }).join('\n')).not.toContain('CONNMARK')
  })
})
