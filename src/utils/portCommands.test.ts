import { describe, it, expect } from 'vitest'
import { generateIptablesRules } from './portCommands'
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

  it('excludes SSH and the WireGuard listen port when openAll redirects the full range', () => {
    const rules = generateIptablesRules(ports, '185.142.21.45', '10.10.0.2', true, 51820)
    const dnatIndex = rules.findIndex((r) => r.includes('--dport 1:65535 -j DNAT'))
    const sshReturnIndex = rules.findIndex((r) => r.includes('--dport 22 -j RETURN'))
    const wgReturnIndex = rules.findIndex((r) => r.includes('--dport 51820 -j RETURN'))
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
