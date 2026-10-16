import { describe, it, expect } from 'vitest'
import { generateWg0Server, generateWg0Client, generateAllFiles } from './generateConfigs'
import type { ProjectConfig } from '../types'
import { DEFAULT_OPTIONS } from '../types'

const baseConfig: ProjectConfig = {
  projectName: 'Test Project',
  vpsPublicIp: '185.142.21.45',
  localWireguardIp: '10.10.0.2',
  wireguardPort: 51820,
  targetOS: 'linux-debian',
  keys: {
    serverPrivateKey: 'sErvErPrIvAtEkEy1234567890abcdefghijklmabcd=',
    serverPublicKey: 'sErvErPuBlIcKeY1234567890abcdefghijklmnabcd=',
    clientPrivateKey: 'cLiEnTpRiVaTeKeY1234567890abcdefghijklmabcd=',
    clientPublicKey: 'cLiEnTpUbLiCkEy1234567890abcdefghijklmnabcd=',
  },
  ports: [
    { id: '1', port: 30120, protocol: 'tcp+udp', label: 'FiveM' },
    { id: '2', port: 3389, protocol: 'tcp', label: 'RDP' },
  ],
  openAllPorts: false,
  options: DEFAULT_OPTIONS,
}

describe('generateWg0Server', () => {
  it('generates valid server config', () => {
    const conf = generateWg0Server(baseConfig)
    expect(conf).toContain('[Interface]')
    expect(conf).toContain('[Peer]')
    expect(conf).toContain('PrivateKey = sErvErPrIvAtEkEy1234567890abcdefghijklmabcd=')
    expect(conf).toContain('ListenPort = 51820')
    expect(conf).toContain('PublicKey  = cLiEnTpUbLiCkEy1234567890abcdefghijklmnabcd=')
    expect(conf).toContain('10.10.0.2/32')
  })

  it('uses placeholder when keys are empty', () => {
    const conf = generateWg0Server({ ...baseConfig, keys: { serverPrivateKey: '', serverPublicKey: '', clientPrivateKey: '', clientPublicKey: '' } })
    expect(conf).toContain('<SERVER_PRIVATE_KEY>')
    expect(conf).toContain('<CLIENT_PUBLIC_KEY>')
  })
})

describe('generateWg0Client', () => {
  it('generates valid client config', () => {
    const conf = generateWg0Client(baseConfig)
    expect(conf).toContain('PrivateKey = cLiEnTpRiVaTeKeY1234567890abcdefghijklmabcd=')
    expect(conf).toContain('Endpoint            = 185.142.21.45:51820')
    expect(conf).toContain('PersistentKeepalive = 25')
  })
})

describe('generateAllFiles', () => {
  it('generates all required files for linux', () => {
    const files = generateAllFiles(baseConfig)
    expect(files['wg0-server.conf']).toBeDefined()
    expect(files['wg0-client.conf']).toBeDefined()
    expect(files['setup-vps.sh']).toBeDefined()
    expect(files['setup-client.sh']).toBeDefined()
    expect(files['README.txt']).toBeDefined()
    expect(files['setup-client.ps1']).toBeUndefined()
  })

  it('generates an uninstall script for the VPS', () => {
    const files = generateAllFiles(baseConfig)
    expect(files['uninstall-vps.sh']).toContain('-D PREROUTING -j GM_PREROUTING')
    expect(files['uninstall-vps.sh']).toContain('rm -rf /etc/gateway-manager')
  })

  it('generates PowerShell script for windows', () => {
    const files = generateAllFiles({ ...baseConfig, targetOS: 'windows' })
    expect(files['setup-client.ps1']).toBeDefined()
    expect(files['setup-client.sh']).toBeUndefined()
  })

  it('generates macOS script for macos', () => {
    const files = generateAllFiles({ ...baseConfig, targetOS: 'macos' })
    expect(files['setup-client.sh']).toBeDefined()
    expect(files['setup-client.sh']).toContain('Homebrew')
  })

  it('includes port rules in VPS setup script', () => {
    const files = generateAllFiles(baseConfig)
    const vpsScript = files['setup-vps.sh']
    expect(vpsScript).toContain('30120')
    expect(vpsScript).toContain('3389')
    expect(vpsScript).toContain('FiveM')
    expect(vpsScript).toContain('RDP')
  })

  it('handles empty ports gracefully', () => {
    const files = generateAllFiles({ ...baseConfig, ports: [] })
    expect(files['setup-vps.sh']).toContain('Aucun port configuré')
  })

  it('redirects the full port range when openAllPorts is enabled, ignoring the ports list', () => {
    const files = generateAllFiles({ ...baseConfig, openAllPorts: true })
    const vpsScript = files['setup-vps.sh']
    expect(vpsScript).toContain('-p tcp -m addrtype --dst-type LOCAL -m comment --comment \'Tous les ports\' -j DNAT --to-destination 10.10.0.2')
    expect(vpsScript).not.toContain('--dport 30120')
    expect(files['README.txt']).toContain('Tous les ports')
  })

  it('excludes SSH and the WireGuard listen port from the openAllPorts redirect so the VPS stays reachable', () => {
    const files = generateAllFiles({ ...baseConfig, openAllPorts: true, wireguardPort: 51820 })
    const vpsScript = files['setup-vps.sh']
    const dnatIndex = vpsScript.indexOf('-m addrtype --dst-type LOCAL')
    const sshReturnIndex = vpsScript.indexOf('--dport "$p" -j RETURN')
    const wgReturnIndex = vpsScript.indexOf('--dport 51820 -j RETURN')
    expect(sshReturnIndex).toBeGreaterThan(-1)
    expect(wgReturnIndex).toBeGreaterThan(-1)
    expect(sshReturnIndex).toBeLessThan(dnatIndex)
    expect(wgReturnIndex).toBeLessThan(dnatIndex)
  })

  it('detects the real SSH port and falls back to 22 so a moved SSH is not redirected', () => {
    const vpsScript = generateAllFiles({ ...baseConfig, openAllPorts: true })['setup-vps.sh']
    expect(vpsScript).toContain(`SSH_PORTS=$(sshd -T 2>/dev/null | awk '$1=="port"{print $2}' || true)`)
    expect(vpsScript).toContain('SSH_PORTS=${SSH_PORTS:-22}')
  })

  it('sanitizes project name in scripts', () => {
    const files = generateAllFiles({ ...baseConfig, projectName: 'Test; rm -rf /' })
    const vpsScript = files['setup-vps.sh']
    expect(vpsScript).toContain('Projet      : Test rm -rf ')
    expect(vpsScript).not.toContain('Projet      : Test;')
  })

  it('strips newlines from project name so it cannot break out of the header comment', () => {
    const files = generateAllFiles({ ...baseConfig, projectName: 'Test\nrm -rf /\necho pwned' })
    const vpsScript = files['setup-vps.sh']
    expect(vpsScript).not.toMatch(/\n\s*rm -rf/)
    expect(vpsScript).toContain('Projet      : Testrm -rf echo pwned')
  })

  it('replaces an out-of-range IP with a placeholder instead of embedding it raw', () => {
    const files = generateAllFiles({ ...baseConfig, vpsPublicIp: '999.999.999.999' })
    expect(files['wg0-client.conf']).toContain('Endpoint            = <VPS_PUBLIC_IP>:51820')
    expect(files['wg0-client.conf']).not.toContain('999.999.999.999')
  })

  it('replaces malformed WireGuard keys with a placeholder instead of embedding them raw', () => {
    const files = generateAllFiles({
      ...baseConfig,
      keys: { ...baseConfig.keys, serverPrivateKey: "not-a-real-key\nWGEOF\necho pwned" },
    })
    expect(files['wg0-server.conf']).toContain('PrivateKey = <SERVER_PRIVATE_KEY>')
    expect(files['setup-vps.sh']).not.toContain('WGEOF\necho pwned')
  })
})

describe('real visitor IP', () => {
  it('lets the Linux client accept any source but only route tunnel replies back (no full tunnel)', () => {
    const conf = generateWg0Client(baseConfig)
    expect(conf).toContain('AllowedIPs          = 0.0.0.0/0')
    expect(conf).toContain('Table      = off')
    expect(conf).toContain('PostUp     = ip route replace default dev %i table 4242')
    expect(conf).toContain('PostDown   = ip rule del fwmark 4242 lookup 4242')
  })

  it('keeps the old behaviour when the option is off', () => {
    const cfg = { ...baseConfig, options: { ...DEFAULT_OPTIONS, preserveClientIp: false } }
    const conf = generateWg0Client(cfg)
    expect(conf).toContain('AllowedIPs          = 10.10.0.1/32')
    expect(conf).not.toContain('Table')
    expect(generateAllFiles(cfg)['setup-vps.sh']).toContain('-A GM_POSTROUTING -o "$WG" -j MASQUERADE')
  })

  it('does not masquerade towards the tunnel on the VPS when the real IP is preserved', () => {
    const vps = generateAllFiles(baseConfig)['setup-vps.sh']
    expect(vps).not.toMatch(/-o "\$WG" -j MASQUERADE/)
    expect(vps).toContain('-A GM_POSTROUTING -s 10.10.0.0/24 -o "$IFACE" -j MASQUERADE')
  })

  it('uses a full tunnel without kill switch on Windows and macOS', () => {
    for (const targetOS of ['windows', 'macos'] as const) {
      const conf = generateWg0Client({ ...baseConfig, targetOS })
      expect(conf).toContain('AllowedIPs          = 0.0.0.0/1, 128.0.0.0/1')
      expect(conf).not.toContain('PostUp')
    }
  })

  it('applies a custom MTU on both ends and the keepalive on the client', () => {
    const cfg = { ...baseConfig, options: { ...DEFAULT_OPTIONS, mtu: 1380, keepalive: 15 } }
    expect(generateWg0Server(cfg)).toContain('MTU        = 1380')
    expect(generateWg0Client(cfg)).toContain('MTU        = 1380')
    expect(generateWg0Client(cfg)).toContain('PersistentKeepalive = 15')
  })

  it('ignores an out-of-range MTU', () => {
    const cfg = { ...baseConfig, options: { ...DEFAULT_OPTIONS, mtu: 9000 } }
    expect(generateWg0Server(cfg)).not.toContain('MTU')
  })
})

describe('setup-vps.sh', () => {
  it('installs the rules as wg-quick hooks instead of flushing system chains', () => {
    const vps = generateAllFiles(baseConfig)['setup-vps.sh']
    expect(vps).toContain('PostUp     = /etc/gateway-manager/up.sh %i')
    expect(vps).toContain("cat > /etc/gateway-manager/up.sh << 'GMEOF'")
    expect(vps).toContain("cat > /usr/local/bin/gm-status << 'GMEOF'")
    expect(vps).not.toMatch(/iptables (-t nat )?-F (PREROUTING|POSTROUTING|FORWARD)/)
  })

  it('accepts only DNAT-ed traffic from the internet into the tunnel', () => {
    const vps = generateAllFiles(baseConfig)['setup-vps.sh']
    const accept = vps.indexOf('--ctstate DNAT -j ACCEPT')
    const drop = vps.indexOf('-i "$IFACE" -o "$WG" -j DROP')
    expect(accept).toBeGreaterThan(-1)
    expect(drop).toBeGreaterThan(accept)
  })
})
