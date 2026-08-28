import type { ProjectConfig, GeneratedFiles } from '../types'
import { sanitizeLabel, isValidPort, isValidWgKey, isValidIp } from './helpers'

// Bash ANSI color variable references used in generated shell scripts.
// Stored as regular JS constants (single-quoted strings) so TypeScript does NOT
// interpret the ${VAR} syntax as template expressions when they appear in backtick
// template literals via ${_C}, ${_N}, etc.
const _R = '${RED}'
const _G = '${GREEN}'
const _Y = '${YELLOW}'
const _C = '${CYAN}'
const _B = '${BOLD}'
const _N = '${NC}'

function sanitizeWgKey(val: string, fallback: string): string {
  const trimmed = val.trim()
  return trimmed && isValidWgKey(trimmed) ? trimmed : `<${fallback}>`
}

function escapeBash(str: string): string {
  if (!str || typeof str !== 'string') return ''
  // [ ] plutôt que \s : \s inclut \n/\r, ce qui permettrait d'échapper d'un
  // commentaire bash (le nom de projet est injecté dans l'en-tête du script)
  return str.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 100)
}

function sanitizeIp(val: string, fallback: string): string {
  const trimmed = val.trim()
  return trimmed && isValidIp(trimmed) ? trimmed : `<${fallback}>`
}

function sanitizePort(val: number): number {
  const p = Math.floor(val)
  return p >= 1 && p <= 65535 ? p : 51820
}

// ─── Génère les règles iptables pour les scripts (utilise $IFACE) ───────────
function buildIptablesRules(cfg: ProjectConfig, localIp: string): string {
  if (cfg.openAllPorts) {
    const wgPort = sanitizePort(cfg.wireguardPort || 51820)
    const rules: string[] = [
      '# Tous les ports (1-65535) sont redirigés vers le PC local — utile pour les services à ports dynamiques (ex: Coolify)',
      '# SSH (22) et le port WireGuard lui-même restent servis par le VPS — sinon vous perdez SSH et le tunnel ne peut plus se monter',
      'iptables -t nat -A PREROUTING -i "$IFACE" -p tcp --dport 22 -j RETURN',
      `iptables -t nat -A PREROUTING -i "$IFACE" -p udp --dport ${wgPort} -j RETURN`,
    ]
    for (const proto of ['tcp', 'udp']) {
      rules.push(`iptables -t nat -A PREROUTING -i "$IFACE" -p ${proto} --dport 1:65535 -j DNAT --to-destination ${localIp}`)
      rules.push(`iptables -A FORWARD -p ${proto} -d ${localIp} -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT`)
    }
    return rules.join('\n')
  }
  if (cfg.ports.length === 0) {
    return '# Aucun port configuré — ajoutez vos redirections ici'
  }
  const rules: string[] = []
  for (const entry of cfg.ports) {
    if (!isValidPort(entry.port)) continue
    const protos = entry.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [entry.protocol]
    const label = sanitizeLabel(entry.label)
    for (const proto of protos) {
      rules.push(`# ${label} — ${proto.toUpperCase()} ${entry.port}`)
      rules.push(`iptables -t nat -A PREROUTING -i "$IFACE" -p ${proto} --dport ${entry.port} -j DNAT --to-destination ${localIp}:${entry.port}`)
      rules.push(`iptables -A FORWARD -p ${proto} -d ${localIp} --dport ${entry.port} -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT`)
    }
  }
  return rules.join('\n')
}

// ─── Configs WireGuard ────────────────────────────────────────────────────────

export function generateWg0Server(cfg: ProjectConfig): string {
  const privKey  = sanitizeWgKey(cfg.keys.serverPrivateKey, 'SERVER_PRIVATE_KEY')
  const pubClient = sanitizeWgKey(cfg.keys.clientPublicKey,  'CLIENT_PUBLIC_KEY')
  const wgPort   = sanitizePort(cfg.wireguardPort || 51820)
  const localIp  = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')

  return `[Interface]
PrivateKey = ${privKey}
Address    = 10.10.0.1/24
ListenPort = ${wgPort}

[Peer]
PublicKey  = ${pubClient}
AllowedIPs = ${localIp}/32
`
}

export function generateWg0Client(cfg: ProjectConfig): string {
  const privKey   = sanitizeWgKey(cfg.keys.clientPrivateKey, 'CLIENT_PRIVATE_KEY')
  const pubServer = sanitizeWgKey(cfg.keys.serverPublicKey,  'SERVER_PUBLIC_KEY')
  const vpsIp     = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const wgPort    = sanitizePort(cfg.wireguardPort || 51820)
  const localIp   = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')

  return `[Interface]
PrivateKey = ${privKey}
Address    = ${localIp}/24

[Peer]
PublicKey          = ${pubServer}
Endpoint           = ${vpsIp}:${wgPort}
AllowedIPs         = 10.10.0.1/32
PersistentKeepalive = 25
`
}

// ─── Script VPS ──────────────────────────────────────────────────────────────

export function generateSetupVps(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgConf     = generateWg0Server(cfg)
  const portRules  = buildIptablesRules(cfg, localIp)

  return `#!/bin/bash
# ==============================================================================
#  GatewayManager — Setup VPS (serveur relais WireGuard)
#  Projet      : ${projectName}
#  IP VPS      : ${vpsIp}
#  IP client   : ${localIp}
#  Port WG     : ${wgPort}/UDP
# ==============================================================================

set -euo pipefail

# ─── Couleurs ──────────────────────────────────────────────────────────────────
RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'; BOLD='\\033[1m'; NC='\\033[0m'
log()   { echo -e "${_C}[INFO]${_N}  $1"; }
ok()    { echo -e "${_G}[ OK ]${_N}  $1"; }
warn()  { echo -e "${_Y}[WARN]${_N}  $1"; }
die()   { echo -e "${_R}[ERR ]${_N}  $1" >&2; exit 1; }
step()  { echo -e "\\n${_B}${_C}──────────────────────────────────────────${_N}"; echo -e "${_B}${_C}  $1${_N}"; echo -e "${_B}${_C}──────────────────────────────────────────${_N}"; }

# ─── Bannière ──────────────────────────────────────────────────────────────────
clear
echo -e "${_B}${_C}"
cat << 'BANNER'
  ╔══════════════════════════════════════════════╗
  ║        GatewayManager — Setup VPS            ║
  ║   Configuration du serveur relais WireGuard  ║
  ╚══════════════════════════════════════════════╝
BANNER
echo -e "${_N}"
echo -e "  Projet  : ${_B}${projectName}${_N}"
echo -e "  IP VPS  : ${_B}${vpsIp}${_N}"
echo -e "  Client  : ${_B}${localIp}${_N}"
echo -e "  Port WG : ${_B}${wgPort}/UDP${_N}"
echo ""

# ─── Vérifications préalables ──────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Ce script doit être exécuté en tant que root.\\n  Relancez avec : sudo bash $0"

# Détection du gestionnaire de paquets
if   command -v apt-get &>/dev/null; then PKG="apt"
elif command -v dnf     &>/dev/null; then PKG="dnf"
elif command -v apk     &>/dev/null; then PKG="apk"
elif command -v pacman  &>/dev/null; then PKG="pacman"
else die "Gestionnaire de paquets non supporté (apt / dnf / apk / pacman requis)"
fi
log "Gestionnaire de paquets : $PKG"

# Détection de l'interface réseau principale (eth0, ens3, enp1s0, etc.)
IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") {print $(i+1); exit}}')
[[ -z "$IFACE" ]] && IFACE=$(ip -o link show up | awk -F': ' '!/lo/{print $2; exit}')
[[ -z "$IFACE" ]] && die "Impossible de détecter l'interface réseau principale.\\n  Vérifiez avec : ip link show"
log "Interface réseau détectée : $IFACE"

# ─── Étape 1 : Installation WireGuard ─────────────────────────────────────────
step "1/5  Installation WireGuard"

if command -v wg &>/dev/null; then
  ok "WireGuard déjà installé — $(wg --version 2>&1 | head -1)"
else
  log "Installation de WireGuard..."
  case $PKG in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -q wireguard wireguard-tools iptables-persistent netfilter-persistent
      ;;
    dnf)
      dnf install -y wireguard-tools iptables-services
      systemctl enable iptables 2>/dev/null || true
      ;;
    apk)
      apk add --no-cache wireguard-tools iptables
      ;;
    pacman)
      pacman -Sy --noconfirm wireguard-tools iptables
      ;;
  esac
  ok "WireGuard installé"
fi

# ─── Étape 2 : Configuration WireGuard ────────────────────────────────────────
step "2/5  Configuration WireGuard (serveur)"

mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [[ -f /etc/wireguard/wg0.conf ]]; then
  warn "Fichier wg0.conf existant — sauvegarde dans wg0.conf.bak"
  cp /etc/wireguard/wg0.conf /etc/wireguard/wg0.conf.bak
fi

cat > /etc/wireguard/wg0.conf << 'WGEOF'
${wgConf}
WGEOF

chmod 600 /etc/wireguard/wg0.conf
ok "wg0.conf écrit dans /etc/wireguard/wg0.conf"

# Avertissement si les clés sont encore des placeholders
if grep -q '<SERVER_PRIVATE_KEY>\\|<CLIENT_PUBLIC_KEY>' /etc/wireguard/wg0.conf; then
  warn "ATTENTION : wg0.conf contient des clés placeholder !"
  warn "Éditez /etc/wireguard/wg0.conf avec les vraies clés avant de démarrer WireGuard."
  warn "Générez des clés avec :  wg genkey | tee /tmp/priv | wg pubkey > /tmp/pub"
fi

# ─── Étape 3 : Forwarding IP ──────────────────────────────────────────────────
step "3/5  Activation du forwarding IP"

sysctl -w net.ipv4.ip_forward=1 > /dev/null
if grep -q "^net.ipv4.ip_forward" /etc/sysctl.conf 2>/dev/null; then
  sed -i 's/^net.ipv4.ip_forward.*/net.ipv4.ip_forward=1/' /etc/sysctl.conf
elif [[ -d /etc/sysctl.d ]]; then
  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
else
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
ok "Forwarding IP activé de façon permanente"

# ─── Étape 4 : Règles iptables ────────────────────────────────────────────────
step "4/5  Configuration iptables"

# Supprimer les règles existantes pour éviter les doublons
iptables -t nat -F PREROUTING  2>/dev/null || true
iptables -t nat -F POSTROUTING 2>/dev/null || true
iptables -F FORWARD             2>/dev/null || true

# Masquerade sortant : permet au trafic WireGuard d'utiliser l'IP du VPS
iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o "$IFACE" -j MASQUERADE
# Masquerade entrant : les réponses aux paquets DNAT repassent par le tunnel WireGuard
iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE

# Autoriser le trafic WireGuard entrant
iptables -A INPUT -p udp --dport ${wgPort} -j ACCEPT
iptables -A INPUT -i wg0 -j ACCEPT

# Redirections de ports vers le PC client (${localIp})
${portRules}

# Sauvegarder les règles
case $PKG in
  apt)    netfilter-persistent save ;;
  dnf)    service iptables save 2>/dev/null || iptables-save > /etc/sysconfig/iptables ;;
  apk)    mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4 ;;
  pacman) mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4 ;;
esac
ok "Règles iptables appliquées et sauvegardées (interface : $IFACE)"

# ─── Étape 5 : Démarrage WireGuard ────────────────────────────────────────────
step "5/5  Démarrage du service WireGuard"

if command -v systemctl &>/dev/null; then
  systemctl enable wg-quick@wg0
  if systemctl restart wg-quick@wg0; then
    sleep 1
    systemctl is-active --quiet wg-quick@wg0 \
      && ok "Service wg-quick@wg0 démarré (systemd)" \
      || die "WireGuard instable. Logs : journalctl -u wg-quick@wg0 -n 30"
  else
    echo "" >&2
    warn "Derniers logs WireGuard :"
    journalctl -u wg-quick@wg0 -n 20 --no-pager 2>/dev/null || true
    echo "" >&2
    die "Le service WireGuard n'a pas démarré.\\n  Cause probable : clés invalides dans /etc/wireguard/wg0.conf\\n  Vérifiez : cat /etc/wireguard/wg0.conf"
  fi
elif command -v rc-update &>/dev/null; then
  rc-update add wg-quick default 2>/dev/null || true
  wg-quick down wg0 2>/dev/null || true
  wg-quick up wg0 || die "WireGuard n'a pas démarré. Vérifiez : wg show"
  ok "Tunnel WireGuard démarré (OpenRC)"
else
  wg-quick up /etc/wireguard/wg0.conf || die "WireGuard n'a pas démarré. Vérifiez : cat /etc/wireguard/wg0.conf"
  ok "Tunnel WireGuard démarré"
fi

# ─── Résumé final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${_B}${_G}"
cat << 'DONE'
  ╔══════════════════════════════════════════════╗
  ║    ✓  Setup VPS terminé avec succès !        ║
  ╚══════════════════════════════════════════════╝
DONE
echo -e "${_N}"
echo -e "  IP VPS      : ${_B}${vpsIp}${_N}"
echo -e "  IP client   : ${_B}${localIp}${_N}"
echo -e "  Port WG     : ${_B}${wgPort}/UDP${_N}"
echo -e "  Interface   : ${_B}$IFACE${_N}"
echo ""
echo -e "  ${_Y}Prochaine étape :${_N}"
echo -e "  Exécutez ${_B}setup-client.sh${_N} sur votre PC local (serveur de jeux / RDP...)"
echo ""
echo -e "  ${_C}Vérification WireGuard :${_N}  wg show"
echo -e "  ${_C}Vérification iptables  :${_N}  iptables -t nat -L PREROUTING -n -v"
echo ""
`
}

// ─── Script Client Linux ──────────────────────────────────────────────────────

const osInstallInfo: Record<string, { label: string; installCmd: string; iptablesPkg: string }> = {
  'linux-debian': {
    label:       'Debian 12',
    installCmd:  'export DEBIAN_FRONTEND=noninteractive\napt-get update -qq\napt-get install -y -q wireguard wireguard-tools',
    iptablesPkg: '',
  },
  'linux-ubuntu': {
    label:       'Ubuntu 22.04 / 24.04',
    installCmd:  'export DEBIAN_FRONTEND=noninteractive\napt-get update -qq\napt-get install -y -q wireguard wireguard-tools',
    iptablesPkg: '',
  },
  'linux-fedora': {
    label:       'Fedora / CentOS / RHEL',
    installCmd:  'dnf install -y wireguard-tools',
    iptablesPkg: '',
  },
  'linux-alpine': {
    label:       'Alpine Linux',
    installCmd:  'apk add --no-cache wireguard-tools',
    iptablesPkg: '',
  },
  'linux-arch': {
    label:       'Arch Linux / Manjaro',
    installCmd:  'pacman -Sy --noconfirm wireguard-tools',
    iptablesPkg: '',
  },
}

export function generateSetupClientLinux(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgConf     = generateWg0Client(cfg)
  const info       = osInstallInfo[cfg.targetOS] ?? osInstallInfo['linux-debian']

  const isAlpine   = cfg.targetOS === 'linux-alpine'
  const startCmd   = isAlpine
    ? 'rc-update add wg-quick default 2>/dev/null || true\nwg-quick up wg0'
    : 'systemctl enable wg-quick@wg0\nsystemctl restart wg-quick@wg0'
  const checkCmd   = isAlpine
    ? 'wg show wg0 &>/dev/null && ok "Tunnel WireGuard actif" || die "WireGuard ne répond pas. Vérifiez : wg show"'
    : 'sleep 1\nsystemctl is-active --quiet wg-quick@wg0 && ok "Service wg-quick@wg0 démarré" || die "WireGuard n\'a pas démarré. Logs : journalctl -u wg-quick@wg0 -n 30"'

  return `#!/bin/bash
# ==============================================================================
#  GatewayManager — Setup PC Client (${info.label})
#  Projet      : ${projectName}
#  Se connecte : ${vpsIp}:${wgPort}
#  IP tunnel   : ${localIp}
# ==============================================================================

set -euo pipefail

# ─── Couleurs ──────────────────────────────────────────────────────────────────
RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'; BOLD='\\033[1m'; NC='\\033[0m'
log()  { echo -e "${_C}[INFO]${_N}  $1"; }
ok()   { echo -e "${_G}[ OK ]${_N}  $1"; }
warn() { echo -e "${_Y}[WARN]${_N}  $1"; }
die()  { echo -e "${_R}[ERR ]${_N}  $1" >&2; exit 1; }
step() { echo -e "\\n${_B}${_C}──────────────────────────────────────────${_N}"; echo -e "${_B}${_C}  $1${_N}"; echo -e "${_B}${_C}──────────────────────────────────────────${_N}"; }

# ─── Bannière ──────────────────────────────────────────────────────────────────
clear
echo -e "${_B}${_C}"
cat << 'BANNER'
  ╔══════════════════════════════════════════════╗
  ║      GatewayManager — Setup PC Client        ║
  ║   Configuration du client WireGuard local    ║
  ╚══════════════════════════════════════════════╝
BANNER
echo -e "${_N}"
echo -e "  Projet     : ${_B}${projectName}${_N}"
echo -e "  VPS cible  : ${_B}${vpsIp}:${wgPort}${_N}"
echo -e "  IP tunnel  : ${_B}${localIp}${_N}"
echo ""

# ─── Vérifications préalables ──────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Ce script doit être exécuté en tant que root.\\n  Relancez avec : sudo bash $0"

# ─── Étape 1 : Installation WireGuard ─────────────────────────────────────────
step "1/3  Installation WireGuard (${info.label})"

if command -v wg &>/dev/null; then
  ok "WireGuard déjà installé — $(wg --version 2>&1 | head -1)"
else
  log "Installation de WireGuard..."
  ${info.installCmd}
  ok "WireGuard installé"
fi

# ─── Étape 2 : Configuration du tunnel ────────────────────────────────────────
step "2/3  Configuration du tunnel WireGuard"

mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [[ -f /etc/wireguard/wg0.conf ]]; then
  warn "Fichier wg0.conf existant — sauvegarde dans wg0.conf.bak"
  cp /etc/wireguard/wg0.conf /etc/wireguard/wg0.conf.bak
fi

cat > /etc/wireguard/wg0.conf << 'WGEOF'
${wgConf}
WGEOF

chmod 600 /etc/wireguard/wg0.conf
ok "wg0.conf écrit dans /etc/wireguard/wg0.conf"

# ─── Étape 3 : Démarrage du tunnel ────────────────────────────────────────────
step "3/3  Démarrage du tunnel WireGuard"

${startCmd}
${checkCmd}

# ─── Résumé final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${_B}${_G}"
cat << 'DONE'
  ╔══════════════════════════════════════════════╗
  ║  ✓  Setup PC Client terminé avec succès !   ║
  ╚══════════════════════════════════════════════╝
DONE
echo -e "${_N}"
echo -e "  VPS cible  : ${_B}${vpsIp}:${wgPort}${_N}"
echo -e "  IP tunnel  : ${_B}${localIp}${_N}"
echo ""
echo -e "  ${_C}Vérification tunnel  :${_N}  wg show"
echo -e "  ${_C}Ping vers le VPS     :${_N}  ping -c 3 10.10.0.1"
echo ""
`
}

// ─── Script Client macOS ──────────────────────────────────────────────────────

export function generateSetupClientMacos(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgConf     = generateWg0Client(cfg)

  return `#!/bin/bash
# ==============================================================================
#  GatewayManager — Setup PC Client (macOS)
#  Projet      : ${projectName}
#  Se connecte : ${vpsIp}:${wgPort}
#  IP tunnel   : ${localIp}
# ==============================================================================

set -euo pipefail

RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'; BOLD='\\033[1m'; NC='\\033[0m'
log()  { echo -e "${_C}[INFO]${_N}  $1"; }
ok()   { echo -e "${_G}[ OK ]${_N}  $1"; }
warn() { echo -e "${_Y}[WARN]${_N}  $1"; }
die()  { echo -e "${_R}[ERR ]${_N}  $1" >&2; exit 1; }
step() { echo -e "\\n${_B}${_C}──────────────────────────────────────────${_N}"; echo -e "${_B}${_C}  $1${_N}"; echo -e "${_B}${_C}──────────────────────────────────────────${_N}"; }

clear
echo -e "${_B}${_C}"
cat << 'BANNER'
  ╔══════════════════════════════════════════════╗
  ║    GatewayManager — Setup PC Client macOS    ║
  ╚══════════════════════════════════════════════╝
BANNER
echo -e "${_N}"
echo -e "  VPS cible  : ${_B}${vpsIp}:${wgPort}${_N}"
echo -e "  IP tunnel  : ${_B}${localIp}${_N}"
echo ""

step "1/3  Vérification Homebrew + Installation WireGuard"

command -v brew &>/dev/null || die "Homebrew non trouvé.\\n  Installez-le depuis https://brew.sh avant de relancer ce script."

if command -v wg &>/dev/null; then
  ok "wireguard-tools déjà installé"
else
  log "Installation via Homebrew..."
  brew install wireguard-tools
  ok "wireguard-tools installé"
fi

step "2/3  Configuration du tunnel"

WG_DIR="/usr/local/etc/wireguard"
mkdir -p "$WG_DIR"
chmod 700 "$WG_DIR"

[[ -f "$WG_DIR/wg0.conf" ]] && { warn "Config existante — sauvegarde dans wg0.conf.bak"; cp "$WG_DIR/wg0.conf" "$WG_DIR/wg0.conf.bak"; }

cat > "$WG_DIR/wg0.conf" << 'WGEOF'
${wgConf}
WGEOF

chmod 600 "$WG_DIR/wg0.conf"
ok "wg0.conf écrit dans $WG_DIR/wg0.conf"

step "3/3  Démarrage du tunnel"

wg-quick down "$WG_DIR/wg0.conf" 2>/dev/null || true
wg-quick up   "$WG_DIR/wg0.conf"
ok "Tunnel WireGuard démarré"

echo ""
echo -e "${_B}${_G}  ✓  Setup macOS terminé !${_N}"
echo -e "  Ping VPS : ${_C}ping -c 3 10.10.0.1${_N}"
echo -e "  Statut   : ${_C}sudo wg show${_N}"
echo ""
`
}

// ─── Script Client Windows (PowerShell) ──────────────────────────────────────

export function generateSetupClientWindows(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgConf     = generateWg0Client(cfg)

  return `# ==============================================================================
#  GatewayManager — Setup PC Client (Windows)
#  Projet      : ${projectName}
#  Se connecte : ${vpsIp}:${wgPort}
#  IP tunnel   : ${localIp}
#  EXÉCUTER EN TANT QU'ADMINISTRATEUR (PowerShell)
# ==============================================================================

#Requires -RunAsAdministrator

function Write-Step  { param($msg) Write-Host ""; Write-Host "  ── $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  [ OK ] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [ERR ] $msg" -ForegroundColor Red; exit 1 }

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║    GatewayManager — Setup PC Client Windows  ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Projet     : ${projectName}"
Write-Host "  VPS cible  : ${vpsIp}:${wgPort}"
Write-Host "  IP tunnel  : ${localIp}"
Write-Host ""

# ─── Étape 1 : Installation WireGuard ─────────────────────────────────────────
Write-Step "1/3  Installation WireGuard"

$wgExe = "C:\\Program Files\\WireGuard\\wireguard.exe"

if (Test-Path $wgExe) {
    Write-Ok "WireGuard déjà installé"
} else {
    Write-Host "  Téléchargement de WireGuard..." -ForegroundColor Gray
    $url       = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
    $installer = Join-Path $env:TEMP "wireguard-installer.exe"
    try {
        Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
        Start-Process $installer -ArgumentList "/S" -Wait
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Fail "Échec du téléchargement : $_"
    }
    if (Test-Path $wgExe) { Write-Ok "WireGuard installé" }
    else                  { Write-Fail "L'installation a échoué. Installez manuellement depuis https://wireguard.com" }
}

# ─── Étape 2 : Configuration du tunnel ────────────────────────────────────────
Write-Step "2/3  Écriture de la configuration WireGuard"

$configContent = @'
${wgConf}
'@

$configPath = Join-Path $env:USERPROFILE "wg0-client.conf"
$configContent | Out-File -FilePath $configPath -Encoding UTF8 -Force
Write-Ok "Fichier de config écrit : $configPath"

# ─── Étape 3 : Installation du service tunnel ─────────────────────────────────
Write-Step "3/3  Installation du service tunnel Windows"

# Arrêter le tunnel si déjà actif
$serviceName = "WireGuardTunnel" + '$' + "wg0"
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    Write-Warn "Tunnel déjà installé — réinstallation..."
    & $wgExe /uninstalltunnelservice wg0 2>$null
    Start-Sleep -Seconds 2
}

& $wgExe /installtunnelservice $configPath
Start-Sleep -Seconds 2

$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Ok "Service WireGuard démarré"
} else {
    Write-Warn "Service créé mais pas encore Running. Vérifiez dans l'interface WireGuard."
}

# ─── Résumé ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  ✓  Setup Windows terminé avec succès !      ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  VPS cible  : ${vpsIp}:${wgPort}"
Write-Host "  IP tunnel  : ${localIp}"
Write-Host ""
Write-Host "  Vérification : ouvrez l'interface WireGuard ou lancez :" -ForegroundColor Gray
Write-Host "    ping 10.10.0.1" -ForegroundColor Cyan
Write-Host "    Test-NetConnection -ComputerName 10.10.0.1 -Port ${wgPort}" -ForegroundColor Cyan
Write-Host ""
`
}

// ─── README ───────────────────────────────────────────────────────────────────

export function generateReadme(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const osLabel: Record<string, string> = {
    windows: 'Windows', 'linux-debian': 'Debian 12', 'linux-ubuntu': 'Ubuntu 22.04/24.04',
    'linux-fedora': 'Fedora/CentOS/RHEL', 'linux-alpine': 'Alpine Linux',
    'linux-arch': 'Arch Linux/Manjaro', macos: 'macOS',
  }
  const portLines = cfg.openAllPorts
    ? '  - Tous les ports    1-65535     TCP+UDP  (usage avancé — ex: Coolify)'
    : cfg.ports
        .map((p) => `  - ${p.label.padEnd(15)} port ${String(p.port).padEnd(6)} ${p.protocol.toUpperCase()}`)
        .join('\n')
  const clientScript = cfg.targetOS === 'windows' ? 'setup-client.ps1' : 'setup-client.sh'

  return `==============================================================================
  GatewayManager — ${cfg.projectName || 'Passerelle VPS WireGuard'}
==============================================================================

ARCHITECTURE
------------
  Internet → VPS public (${vpsIp})
           → Tunnel WireGuard (port ${wgPort}/UDP)
           → PC local / serveur (${localIp})

INFORMATIONS
------------
  Projet       : ${cfg.projectName || '<NOM_PROJET>'}
  IP VPS       : ${vpsIp}
  IP client WG : ${localIp}
  Port WG      : ${wgPort}/UDP
  OS client    : ${osLabel[cfg.targetOS] || cfg.targetOS}

PORTS REDIRIGÉS (VPS → PC local)
---------------------------------
${portLines || '  (aucun port configuré)'}

FICHIERS INCLUS
---------------
  wg0-server.conf  → Config WireGuard à placer sur le VPS
  wg0-client.conf  → Config WireGuard à placer sur le PC local
  setup-vps.sh     → Script d'installation complet du VPS       [[VPS]VPS]
  ${clientScript.padEnd(16)} → Script d'installation du PC local  [[PC]PC LOCAL]

ORDRE D'INSTALLATION
--------------------
  ÉTAPE 1 — Sur le VPS (connexion SSH) :
    scp setup-vps.sh root@${vpsIp}:/root/
    ssh root@${vpsIp}
    sudo bash /root/setup-vps.sh

  ÉTAPE 2 — Sur le PC local :
${cfg.targetOS === 'windows'
  ? '    Copier setup-client.ps1 sur le PC\n    Ouvrir PowerShell en Administrateur\n    Exécuter : .\\setup-client.ps1'
  : `    scp setup-client.sh user@<IP_PC>:/tmp/\n    ssh user@<IP_PC>\n    sudo bash /tmp/setup-client.sh`}

VÉRIFICATION
------------
  Sur le VPS :
    wg show
    iptables -t nat -L PREROUTING -n -v

  Depuis n'importe où :
${cfg.openAllPorts
  ? `    nc -zv ${vpsIp} <PORT>  # remplacez <PORT> par le port réellement utilisé (ex: 8000 pour Coolify)`
  : cfg.ports.map((p) => `    nc -zv ${vpsIp} ${String(p.port).padEnd(6)}# ${p.label}`).join('\n') || `    nc -zv ${vpsIp} <PORT>`}

DÉPANNAGE
---------
  - WireGuard ne démarre pas  → vérifiez les clés (base64, 44 caractères)
  - Tunnel inactif            → vérifiez que le port ${wgPort}/UDP est ouvert sur le VPS
  - Ports inaccessibles       → vérifiez ip_forward=1 et les règles iptables
  - Interface réseau          → adaptez si votre VPS n'utilise pas eth0

==============================================================================
  Généré par GatewayManager
==============================================================================
`
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function generateAllFiles(cfg: ProjectConfig): GeneratedFiles {
  const files: GeneratedFiles = {
    'wg0-server.conf': generateWg0Server(cfg),
    'wg0-client.conf': generateWg0Client(cfg),
    'setup-vps.sh':    generateSetupVps(cfg),
    'README.txt':      generateReadme(cfg),
  }

  if (cfg.targetOS === 'windows') {
    files['setup-client.ps1'] = generateSetupClientWindows(cfg)
  } else if (cfg.targetOS === 'macos') {
    files['setup-client.sh'] = generateSetupClientMacos(cfg)
  } else {
    files['setup-client.sh'] = generateSetupClientLinux(cfg)
  }

  return files
}
