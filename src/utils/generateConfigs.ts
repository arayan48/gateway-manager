import type { ProjectConfig, GeneratedFiles } from '../types'
import { generateIptablesRules } from './portCommands'

function placeholder(val: string, fallback: string): string {
  return val.trim() || `<${fallback}>`
}

/**
 * Escape special characters for bash scripts to prevent command injection
 */
function escapeBash(str: string): string {
  if (!str || typeof str !== 'string') return ''
  // Allow only alphanumeric, hyphens, underscores, and spaces
  return str.replace(/[^a-zA-Z0-9\s_-]/g, '').slice(0, 100)
}

export function generateWg0Server(cfg: ProjectConfig): string {
  const privKey = placeholder(cfg.keys.serverPrivateKey, 'SERVER_PRIVATE_KEY')
  const pubClient = placeholder(cfg.keys.clientPublicKey, 'CLIENT_PUBLIC_KEY')
  const wgPort = cfg.wireguardPort || 51820
  const localIp = placeholder(cfg.localWireguardIp, 'LOCAL_WG_IP')

  return `[Interface]
PrivateKey = ${privKey}
Address = 10.10.0.1/24
ListenPort = ${wgPort}

[Peer]
PublicKey = ${pubClient}
AllowedIPs = ${localIp}/32
`
}

export function generateWg0Client(cfg: ProjectConfig): string {
  const privKey = placeholder(cfg.keys.clientPrivateKey, 'CLIENT_PRIVATE_KEY')
  const pubServer = placeholder(cfg.keys.serverPublicKey, 'SERVER_PUBLIC_KEY')
  const vpsIp = placeholder(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const wgPort = cfg.wireguardPort || 51820
  const localIp = placeholder(cfg.localWireguardIp, 'LOCAL_WG_IP')

  return `[Interface]
PrivateKey = ${privKey}
Address = ${localIp}/24

[Peer]
PublicKey = ${pubServer}
Endpoint = ${vpsIp}:${wgPort}
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
`
}

export function generateSetupVps(cfg: ProjectConfig): string {
  const vpsIp = placeholder(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp = placeholder(cfg.localWireguardIp, 'LOCAL_WG_IP')
  const wgConf = generateWg0Server(cfg)
  const iptablesRules = generateIptablesRules(cfg.ports, vpsIp, localIp)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgPort = cfg.wireguardPort || 51820

  return `#!/bin/bash
# GatewayManager — Setup VPS
# Projet : ${projectName}
# Généré automatiquement le $(date '+%Y-%m-%d')
# ============================================

set -e

echo "=== [1/5] Installation des dépendances ==="
apt update && apt install -y wireguard iptables-persistent netfilter-persistent

echo "=== [2/5] Configuration WireGuard ==="
cat > /etc/wireguard/wg0.conf << 'WGEOF'
${wgConf}
WGEOF

chmod 600 /etc/wireguard/wg0.conf

echo "=== [3/5] Activation du forwarding IP ==="
sysctl -w net.ipv4.ip_forward=1
if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi

echo "=== [4/5] Règles iptables ==="
# Vider les règles existantes si nécessaire
# iptables -F && iptables -t nat -F

${iptablesRules.join('\n')}

netfilter-persistent save

echo "=== [5/5] Démarrage WireGuard ==="
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

echo ""
echo "✓ Setup VPS terminé !"
echo "  IP VPS     : ${vpsIp}"
echo "  IP locale  : ${localIp}"
echo "  Port WG    : ${wgPort}"
echo ""
echo "Vérification : wg show"
`
}

const osInstallInfo: Record<string, { label: string; installCmd: string; startCmd: string }> = {
  'linux-debian': {
    label: 'Debian 12',
    installCmd: 'apt update && apt install -y wireguard wireguard-tools',
    startCmd: 'systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0',
  },
  'linux-ubuntu': {
    label: 'Ubuntu 22.04 / 24.04',
    installCmd: 'apt update && apt install -y wireguard wireguard-tools',
    startCmd: 'systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0',
  },
  'linux-fedora': {
    label: 'Fedora / CentOS / RHEL',
    installCmd: 'dnf install -y wireguard-tools',
    startCmd: 'systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0',
  },
  'linux-alpine': {
    label: 'Alpine Linux',
    installCmd: 'apk add --no-cache wireguard-tools',
    startCmd: 'rc-update add wg-quick default && wg-quick up wg0',
  },
  'linux-arch': {
    label: 'Arch Linux / Manjaro',
    installCmd: 'pacman -Sy --noconfirm wireguard-tools',
    startCmd: 'systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0',
  },
}

export function generateSetupClientLinux(cfg: ProjectConfig): string {
  const wgConf = generescapeBash(cfg.projectName || 'GatewayManager')
  const projectName = cfg.projectName || 'GatewayManager'
  const info = osInstallInfo[cfg.targetOS] ?? osInstallInfo['linux-debian']

  return `#!/bin/bash
# GatewayManager — Setup Client ${info.label}
# Projet : ${projectName}
# Généré automatiquement
# ============================================

set -e

echo "=== [1/3] Installation WireGuard ==="
${info.installCmd}

echo "=== [2/3] Configuration du tunnel ==="
mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << 'WGEOF'
${wgConf}
WGEOF

chmod 600 /etc/wireguard/wg0.conf

echo "=== [3/3] Démarrage WireGuard ==="
${info.startCmd}

echo ""
echo "✓ Setup client terminé !"
echo "Vérification : wg show"
`
}

export function generateSetupClientMacos(cfg: ProjectConfig): string {
  const wgConf = generescapeBash(cfg.projectName || 'GatewayManager')
  const projectName = cfg.projectName || 'GatewayManager'

  return `#!/bin/bash
# GatewayManager — Setup Client macOS
# Projet : ${projectName}
# Généré automatiquement
# ============================================

set -e

echo "=== [1/3] Installation WireGuard via Homebrew ==="
if ! command -v brew &> /dev/null; then
  echo "Homebrew non trouvé. Installez-le depuis https://brew.sh"
  exit 1
fi
brew install wireguard-tools

echo "=== [2/3] Configuration du tunnel ==="
mkdir -p /usr/local/etc/wireguard
cat > /usr/local/etc/wireguard/wg0.conf << 'WGEOF'
${wgConf}
WGEOF

chmod 600 /usr/local/etc/wireguard/wg0.conf

echo "=== [3/3] Démarrage WireGuard ==="
wg-quick up /usr/local/etc/wireguard/wg0.conf

echo ""
echo "✓ Setup client macOS terminé !"
echo "Vérification : wg show"
`
}

export function generateSetupClientWindows(cfg: ProjectConfig): string {
  const wgConf = generateWg0Client(cfg)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')

  return `# GatewayManager — Setup Client Windows
# Projet : ${projectName}
# Généré automatiquement
# À exécuter en tant qu'Administrateur (PowerShell)
# ============================================

Write-Host "=== [1/3] Installation WireGuard ===" -ForegroundColor Cyan
$url = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$installer = "$env:TEMP\\wireguard-installer.exe"
Invoke-WebRequest -Uri $url -OutFile $installer
Start-Process $installer -ArgumentList "/S" -Wait
Remove-Item $installer -Force

Write-Host "=== [2/3] Configuration du tunnel ===" -ForegroundColor Cyan
$config = @"
${wgConf}
"@
$configPath = "$env:USERPROFILE\\wg0-client.conf"
$config | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "=== [3/3] Installation du service tunnel ===" -ForegroundColor Cyan
$wgExe = "C:\\Program Files\\WireGuard\\wireguard.exe"
if (Test-Path $wgExe) {
    & $wgExe /installtunnelservice $configPath
    Write-Host "Tunnel installé comme service Windows." -ForegroundColor Green
} else {
    Write-Host "WireGuard non trouvé. Installez-le manuellement depuis https://wireguard.com" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Setup client Windows terminé !" -ForegroundColor Green
Write-Host "  Vérification : wg show (via WireGuard GUI ou PowerShell admin)"
`
}

export function generateReadme(cfg: ProjectConfig): string {
  const vpsIp = placeholder(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp = placeholder(cfg.localWireguardIp, 'LOCAL_WG_IP')
  const wgPort = cfg.wireguardPort || 51820
  const osLabel: Record<string, string> = {
    windows: 'Windows',
    'linux-debian': 'Debian 12',
    'linux-ubuntu': 'Ubuntu 22.04 / 24.04',
    'linux-fedora': 'Fedora / CentOS / RHEL',
    'linux-alpine': 'Alpine Linux',
    'linux-arch': 'Arch Linux / Manjaro',
    macos: 'macOS',
  }

  const portLines = cfg.ports
    .map((p) => `  - ${p.label.padEnd(15)} ${String(p.port).padEnd(6)} ${p.protocol.toUpperCase()}`)
    .join('\n')

  return `===================================
GatewayManager — ${cfg.projectName || 'Passerelle VPS'}
Généré automatiquement
===================================

INFORMATIONS GÉNÉRALES
----------------------
  Projet       : ${cfg.projectName || '<NOM_PROJET>'}
  IP VPS       : ${vpsIp}
  IP locale WG : ${localIp}
  Port WG      : ${wgPort}
  OS client    : ${osLabel[cfg.targetOS] || cfg.targetOS}

PORTS REDIRIGÉS
---------------
${portLines || '  (aucun port configuré)'}

FICHIERS INCLUS
---------------
  wg0-server.conf     Config WireGuard du VPS
  wg0-client.conf     Config WireGuard du client
  setup-vps.sh        Script d'installation VPS (bash)
  ${cfg.targetOS === 'windows' ? 'setup-client.ps1    Script d\'installation client (PowerShell)' : 'setup-client.sh     Script d\'installation client (bash)'}

ÉTAPES D'INSTALLATION
---------------------
  1. Sur le VPS :
     scp setup-vps.sh root@${vpsIp}:/root/
     ssh root@${vpsIp} 'bash /root/setup-vps.sh'

  2. Sur le client :
${cfg.targetOS === 'windows'
  ? '     Exécuter setup-client.ps1 en tant qu\'Administrateur dans PowerShell'
  : `     scp setup-client.sh user@<CLIENT_IP>:/tmp/\n     ssh user@<CLIENT_IP> 'sudo bash /tmp/setup-client.sh'`}

VÉRIFICATION
------------
  Sur le VPS :
    wg show
    iptables -t nat -L PREROUTING -n -v

  Test de connectivité :
${cfg.ports.map((p) => `    nc -zv ${vpsIp} ${p.port}  # ${p.label}`).join('\n') || `    nc -zv ${vpsIp} <PORT>`}

DÉPANNAGE
---------
  - WireGuard ne démarre pas : vérifiez les clés (doivent être en base64)
  - Ports non accessibles : vérifiez ip_forward et les règles iptables
  - Pas de connectivité VPN : vérifiez que le port ${wgPort}/UDP est ouvert sur le VPS

===================================
Généré par GatewayManager
===================================
`
}

export function generateAllFiles(cfg: ProjectConfig): GeneratedFiles {
  const files: GeneratedFiles = {
    'wg0-server.conf': generateWg0Server(cfg),
    'wg0-client.conf': generateWg0Client(cfg),
    'setup-vps.sh': generateSetupVps(cfg),
    'README.txt': generateReadme(cfg),
  }

  if (cfg.targetOS === 'windows') {
    files['setup-client.ps1'] = generateSetupClientWindows(cfg)
  } else if (cfg.targetOS === 'macos') {
    files['setup-client.sh'] = generateSetupClientMacos(cfg)
  } else {
    // linux-debian, linux-ubuntu, linux-fedora, linux-alpine, linux-arch
    files['setup-client.sh'] = generateSetupClientLinux(cfg)
  }

  return files
}
