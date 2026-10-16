import { describe, it, expect } from 'vitest'
import { generateIptablesRules, generateWindowsRules, generateMacOSRules } from './portCommands'
import type { PortEntry } from '../types'

const ports: PortEntry[] = [
  { id: '1', port: 30120, protocol: 'tcp+udp', label: 'FiveM' },
]

describe('generateIptablesRules', () => {
  it('redirects individual ports without touching SSH or the WireGuard port', () => {
    const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2').join('\n')
    expect(rules).toContain('--dport 30120')
    expect(rules).not.toContain('--dport 22')
  })

  it('uses the auto-detected interface instead of a hardcoded eth0', () => {
    const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2').join('\n')
    expect(rules).toContain('IFACE=$(ip route get 8.8.8.8')
    expect(rules).toContain('-i "$IFACE"')
    expect(rules).not.toContain('eth0')
  })

  it('masquerades on wg0 so replies from the local PC go back through the tunnel', () => {
    for (const openAll of [false, true]) {
      const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2', openAll)
      expect(rules).toContain('iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE')
    }
  })

  it('excludes SSH and the WireGuard listen port when openAll redirects the full range', () => {
    const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2', true, 51820)
    const dnatIndex = rules.findIndex((r) => r.includes('--dport 1:65535 -j DNAT'))
    const sshDetectIndex = rules.findIndex((r) => r.startsWith('SSH_PORTS=$(sshd -T'))
    const sshReturnIndex = rules.findIndex((r) => r.includes('--dport "$p" -j RETURN'))
    const wgReturnIndex = rules.findIndex((r) => r.includes('--dport 51820 -j RETURN'))
    expect(sshDetectIndex).toBeGreaterThan(-1)
    expect(sshDetectIndex).toBeLessThan(sshReturnIndex)
    expect(sshReturnIndex).toBeGreaterThan(-1)
    expect(wgReturnIndex).toBeGreaterThan(-1)
    expect(sshReturnIndex).toBeLessThan(dnatIndex)
    expect(wgReturnIndex).toBeLessThan(dnatIndex)
  })

  it('respects a custom WireGuard port when excluding it from openAll', () => {
    const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2', true, 12345)
    expect(rules.some((r) => r.includes('--dport 12345 -j RETURN'))).toBe(true)
    expect(rules.some((r) => r.includes('--dport 51820 -j RETURN'))).toBe(false)
  })
})

describe('openAll firewall rules on the local PC', () => {
  it('only accepts traffic coming from the WireGuard subnet on Windows', () => {
    const rules = generateWindowsRules(ports, true).filter((r) => r.startsWith('New-NetFirewallRule'))
    expect(rules).toHaveLength(2)
    for (const r of rules) expect(r).toContain('-RemoteAddress 10.10.0.0/24')
  })

  it('only accepts traffic coming from the WireGuard subnet on macOS', () => {
    const rules = generateMacOSRules(ports, true).filter((r) => r.startsWith('pass in'))
    expect(rules).toHaveLength(2)
    for (const r of rules) expect(r).toContain('from 10.10.0.0/24')
  })
})
