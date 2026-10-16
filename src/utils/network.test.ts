import { describe, it, expect } from 'vitest'
import { vpsRedirectRules, portsOverlap, isValidPortEntry, linuxClientRoutingHooks } from './network'
import type { VpsRulesInput } from './network'
import type { PortEntry } from '../types'

const base: VpsRulesInput = { ports: [], localIp: '10.10.0.2', wgPort: 51820, openAll: false, preserveClientIp: true }
const entry = (e: Partial<PortEntry>): PortEntry => ({ id: 'x', port: 80, protocol: 'tcp', label: 'Web', ...e })

describe('vpsRedirectRules', () => {
  it('translates the public port to a different local port', () => {
    const [rule] = vpsRedirectRules({ ...base, ports: [entry({ port: 2222, targetPort: 22, label: 'SSH PC' })] })
    expect(rule).toContain('--dport 2222')
    expect(rule).toContain('--to-destination 10.10.0.2:22')
  })

  it('forwards a range as-is', () => {
    const [rule] = vpsRedirectRules({ ...base, ports: [entry({ port: 27015, endPort: 27030, protocol: 'udp' })] })
    expect(rule).toContain('-p udp --dport 27015:27030')
    expect(rule).toContain('--to-destination 10.10.0.2:27015-27030')
  })

  it('restricts an entry to the allowed source addresses', () => {
    const [rule] = vpsRedirectRules({ ...base, ports: [entry({ port: 3389, allowedSources: '203.0.113.4, 198.51.100.0/24' })] })
    expect(rule).toContain('-s 203.0.113.4,198.51.100.0/24 --dport 3389')
  })

  it('drops entries whose allowed sources are malformed instead of opening them to everyone', () => {
    const rules = vpsRedirectRules({ ...base, ports: [entry({ port: 3389, allowedSources: '1.2.3.4; rm -rf /' })] })
    expect(rules.join('\n')).not.toContain('3389')
  })

  it('strips quotes from labels used as iptables comments', () => {
    const [rule] = vpsRedirectRules({ ...base, ports: [entry({ label: "Joe's \"web\"" })] })
    expect(rule).toContain("--comment 'Joes web'")
  })

  it('emits one rule per protocol for tcp+udp', () => {
    expect(vpsRedirectRules({ ...base, ports: [entry({ protocol: 'tcp+udp' })] })).toHaveLength(2)
  })
})

describe('isValidPortEntry', () => {
  it('rejects descending ranges and out-of-range target ports', () => {
    expect(isValidPortEntry(entry({ port: 100, endPort: 90 }))).toBe(false)
    expect(isValidPortEntry(entry({ targetPort: 70000 }))).toBe(false)
    expect(isValidPortEntry(entry({ port: 100, endPort: 110 }))).toBe(true)
  })
})

describe('portsOverlap', () => {
  it('detects overlapping ranges on a shared protocol only', () => {
    expect(portsOverlap(entry({ port: 27015, endPort: 27030 }), entry({ port: 27020 }))).toBe(true)
    expect(portsOverlap(entry({ port: 27015, endPort: 27030, protocol: 'udp' }), entry({ port: 27020 }))).toBe(false)
    expect(portsOverlap(entry({ protocol: 'tcp+udp' }), entry({ protocol: 'udp' }))).toBe(true)
    expect(portsOverlap(entry({ port: 80 }), entry({ port: 81 }))).toBe(false)
  })
})

describe('linuxClientRoutingHooks', () => {
  it('never lets an intermediate command abort a hook (wg-quick runs them under set -e)', () => {
    const { up, down } = linuxClientRoutingHooks()
    for (const hook of [...up, ...down]) {
      const steps = hook.split(';').map((x) => x.trim())
      for (const step of steps.slice(0, -1)) expect(step).toMatch(/\|\| true$/)
    }
  })

  it('removes in PostDown everything PostUp adds', () => {
    const { up, down } = linuxClientRoutingHooks()
    const added = up.filter((h) => h.startsWith('iptables')).map((h) => h.split('; ').pop()!.replace(' -A ', ' -D '))
    for (const rule of added) expect(down.some((d) => d.startsWith(rule))).toBe(true)
    expect(down.some((d) => d.startsWith('ip rule del fwmark 4242'))).toBe(true)
  })
})
