import { describe, it, expect } from 'vitest'
import { generateWg0Server, generateWg0Client, generateAllFiles } from './generateConfigs'
import type { ProjectConfig } from '../types'

const baseConfig: ProjectConfig = {
  projectName: 'Test Project',
  vpsPublicIp: '185.142.21.45',
  localWireguardIp: '10.10.0.2',
  wireguardPort: 51820,
  targetOS: 'linux-debian',
  keys: {
    serverPrivateKey: 'sErvErPrIvAtEkEy1234567890abcdefghijklm=',
    serverPublicKey: 'sErvErPuBlIcKeY1234567890abcdefghijklmn=',
    clientPrivateKey: 'cLiEnTpRiVaTeKeY1234567890abcdefghijklm=',
    clientPublicKey: 'cLiEnTpUbLiCkEy1234567890abcdefghijklmn=',
  },
  ports: [
    { id: '1', port: 30120, protocol: 'tcp+udp', label: 'FiveM' },
    { id: '2', port: 3389, protocol: 'tcp', label: 'RDP' },
  ],
}

describe('generateWg0Server', () => {
  it('generates valid server config', () => {
    const conf = generateWg0Server(baseConfig)
    expect(conf).toContain('[Interface]')
    expect(conf).toContain('[Peer]')
    expect(conf).toContain('PrivateKey = sErvErPrIvAtEkEy1234567890abcdefghijklm=')
    expect(conf).toContain('ListenPort = 51820')
    expect(conf).toContain('PublicKey  = cLiEnTpUbLiCkEy1234567890abcdefghijklmn=')
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
    expect(conf).toContain('PrivateKey = cLiEnTpRiVaTeKeY1234567890abcdefghijklm=')
    expect(conf).toContain('Endpoint           = 185.142.21.45:51820')
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

  it('sanitizes project name in scripts', () => {
    const files = generateAllFiles({ ...baseConfig, projectName: 'Test; rm -rf /' })
    const vpsScript = files['setup-vps.sh']
    expect(vpsScript).toContain('Projet      : Test rm -rf ')
    expect(vpsScript).not.toContain('Projet      : Test;')
  })
})
