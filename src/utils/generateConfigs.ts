import type { ProjectConfig, GeneratedFiles, AdvancedOptions } from '../types'
import { DEFAULT_OPTIONS } from '../types'
import { isValidWgKey, isValidIp, formatPortEntry } from './helpers'
import {
  CLIENT_ROUTE_TABLE, DETECT_IFACE, GM_DIR, VPS_WG_IP, isValidPortEntry, linuxClientRoutingHooks,
  vpsDownScript, vpsRemoveRules, vpsStatusScript, vpsUpScript,
} from './network'
import type { VpsRulesInput } from './network'

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

function optionsOf(cfg: ProjectConfig): AdvancedOptions {
  return { ...DEFAULT_OPTIONS, ...cfg.options }
}

function sanitizeMtu(val: number | null): number | null {
  return val !== null && Number.isInteger(val) && val >= 1280 && val <= 1500 ? val : null
}

function sanitizeKeepalive(val: number): number {
  return Number.isInteger(val) && val >= 0 && val <= 600 ? val : 25
}

/** Windows / macOS n'ont pas de routage par marque : conserver l'IP réelle = tunnel complet */
export function usesFullTunnel(cfg: ProjectConfig): boolean {
  return optionsOf(cfg).preserveClientIp && (cfg.targetOS === 'windows' || cfg.targetOS === 'macos')
}

function rulesInput(cfg: ProjectConfig, localIp: string): VpsRulesInput {
  return {
    ports: cfg.ports,
    localIp,
    wgPort: sanitizePort(cfg.wireguardPort || 51820),
    openAll: cfg.openAllPorts,
    preserveClientIp: optionsOf(cfg).preserveClientIp,
  }
}

// ─── Configs WireGuard ────────────────────────────────────────────────────────

export function generateWg0Server(cfg: ProjectConfig): string {
  const privKey  = sanitizeWgKey(cfg.keys.serverPrivateKey, 'SERVER_PRIVATE_KEY')
  const pubClient = sanitizeWgKey(cfg.keys.clientPublicKey,  'CLIENT_PUBLIC_KEY')
  const wgPort   = sanitizePort(cfg.wireguardPort || 51820)
  const localIp  = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const mtu      = sanitizeMtu(optionsOf(cfg).mtu)

  return `[Interface]
PrivateKey = ${privKey}
Address    = ${VPS_WG_IP}/24
ListenPort = ${wgPort}
${mtu ? `MTU        = ${mtu}\n` : ''}# Règles iptables (redirections, NAT) installées par setup-vps.sh — appliquées / retirées avec le tunnel
PostUp     = ${GM_DIR}/up.sh %i
PostDown   = ${GM_DIR}/down.sh %i

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
  const opts      = optionsOf(cfg)
  const mtu       = sanitizeMtu(opts.mtu)
  const keepalive = sanitizeKeepalive(opts.keepalive)
  const isLinux   = cfg.targetOS.startsWith('linux-')

  const iface: string[] = [`PrivateKey = ${privKey}`, `Address    = ${localIp}/24`]
  if (mtu) iface.push(`MTU        = ${mtu}`)

  let allowedIps = `${VPS_WG_IP}/32`
  if (opts.preserveClientIp && isLinux) {
    // Le VPS transmet les paquets avec l'IP du visiteur : WireGuard doit les accepter (0.0.0.0/0)
    // sans pour autant faire passer tout le trafic du PC par le VPS (Table = off + routage par marque)
    allowedIps = '0.0.0.0/0'
    const hooks = linuxClientRoutingHooks()
    iface.push('# IP réelle des visiteurs : seules les réponses aux connexions venues du tunnel y retournent')
    iface.push('Table      = off')
    for (const h of hooks.up) iface.push(`PostUp     = ${h}`)
    for (const h of hooks.down) iface.push(`PostDown   = ${h}`)
  } else if (usesFullTunnel(cfg)) {
    // Équivalent de 0.0.0.0/0 sans le « kill switch » WireGuard : l'accès au réseau local est conservé
    allowedIps = '0.0.0.0/1, 128.0.0.0/1'
  }

  return `[Interface]
${iface.join('\n')}

[Peer]
PublicKey           = ${pubServer}
Endpoint            = ${vpsIp}:${wgPort}
AllowedIPs          = ${allowedIps}
PersistentKeepalive = ${keepalive}
`
}

// ─── Script VPS ──────────────────────────────────────────────────────────────

export function generateSetupVps(cfg: ProjectConfig): string {
  const vpsIp      = sanitizeIp(cfg.vpsPublicIp, 'VPS_PUBLIC_IP')
  const localIp    = sanitizeIp(cfg.localWireguardIp || '10.10.0.2', 'LOCAL_WG_IP')
  const wgPort     = sanitizePort(cfg.wireguardPort || 51820)
  const projectName = escapeBash(cfg.projectName || 'GatewayManager')
  const wgConf     = generateWg0Server(cfg)
  const input      = rulesInput(cfg, localIp)
  const localRe    = localIp.replace(/\./g, '\\.')
  const modeLabel  = input.preserveClientIp ? 'IP réelle des visiteurs conservée' : 'visiteurs vus avec l\'IP du VPS'

  return `#!/bin/bash
# ==============================================================================
#  GatewayManager — Setup VPS (serveur relais WireGuard)
#  Projet      : ${projectName}
#  IP VPS      : ${vpsIp}
#  IP client   : ${localIp}
#  Port WG     : ${wgPort}/UDP
#  Relançable sans risque : remplace la configuration précédente
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
clear 2>/dev/null || true
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
echo -e "  Mode    : ${_B}${modeLabel}${_N}"
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

# Détection de l'interface réseau principale (eth0, ens3, ens6, enp1s0, etc.)
${DETECT_IFACE}
[[ -z "$IFACE" ]] && die "Impossible de détecter l'interface réseau principale.\\n  Vérifiez avec : ip link show"
log "Interface réseau détectée : $IFACE"

# ─── Étape 1 : Installation WireGuard ─────────────────────────────────────────
step "1/5  Installation WireGuard"

if command -v wg &>/dev/null && command -v iptables &>/dev/null; then
  ok "WireGuard déjà installé — $(wg --version 2>&1 | head -1)"
else
  log "Installation de WireGuard..."
  case $PKG in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -q wireguard wireguard-tools iptables
      ;;
    dnf)
      dnf install -y wireguard-tools iptables
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

# ─── Étape 2 : Scripts GatewayManager ─────────────────────────────────────────
step "2/5  Installation des règles réseau GatewayManager"

mkdir -p ${GM_DIR}
chmod 700 ${GM_DIR}

cat > ${GM_DIR}/up.sh << 'GMEOF'
${vpsUpScript(input)}GMEOF

cat > ${GM_DIR}/down.sh << 'GMEOF'
${vpsDownScript()}GMEOF

cat > /usr/local/bin/gm-status << 'GMEOF'
${vpsStatusScript(localIp)}GMEOF

chmod 700 ${GM_DIR}/up.sh ${GM_DIR}/down.sh
chmod 755 /usr/local/bin/gm-status
ok "Règles installées dans ${GM_DIR} (appliquées automatiquement avec le tunnel)"
ok "Commande de diagnostic installée : gm-status"

# Nettoyage des règles écrites directement dans les chaînes système par les anciennes
# versions de GatewayManager (elles feraient doublon avec les chaînes GM_*)
cleanup_legacy() { # $1 = table, $2 = chaîne, $3 = motif des règles à retirer
  iptables -t "$1" -S "$2" 2>/dev/null | grep -E -- "$3" | sed 's/^-A /-D /' | while read -r rule; do
    eval "iptables -t $1 $rule" 2>/dev/null || true
  done || true
}
cleanup_legacy nat    PREROUTING  '--to-destination ${localRe}(:| |$)|-j RETURN$'
cleanup_legacy nat    POSTROUTING '-s 10\\.10\\.0\\.0/24 .*-j MASQUERADE$|-o wg0 -j MASQUERADE$'
cleanup_legacy filter FORWARD     '-d ${localRe}/32 '
cleanup_legacy filter INPUT       '--dport ${wgPort} -j ACCEPT$|-i wg0 -j ACCEPT$'
if command -v netfilter-persistent &>/dev/null; then
  netfilter-persistent save &>/dev/null || true
fi

# ─── Étape 3 : Configuration WireGuard ────────────────────────────────────────
step "3/5  Configuration WireGuard (serveur)"

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

# ─── Étape 4 : Forwarding IP ──────────────────────────────────────────────────
step "4/5  Activation du forwarding IP"

sysctl -w net.ipv4.ip_forward=1 > /dev/null
if grep -q "^net.ipv4.ip_forward" /etc/sysctl.conf 2>/dev/null; then
  sed -i 's/^net.ipv4.ip_forward.*/net.ipv4.ip_forward=1/' /etc/sysctl.conf
elif [[ -d /etc/sysctl.d ]]; then
  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
else
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
ok "Forwarding IP activé de façon permanente"

# ─── Étape 5 : Démarrage WireGuard ────────────────────────────────────────────
step "5/5  Démarrage du service WireGuard"

if command -v systemctl &>/dev/null; then
  systemctl enable wg-quick@wg0
  if systemctl restart wg-quick@wg0; then
    sleep 1
    systemctl is-active --quiet wg-quick@wg0 \\
      && ok "Service wg-quick@wg0 démarré (systemd)" \\
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
  wg-quick down wg0 2>/dev/null || true
  wg-quick up wg0 || die "WireGuard n'a pas démarré. Vérifiez : cat /etc/wireguard/wg0.conf"
  ok "Tunnel WireGuard démarré"
fi
iptables -t nat -S GM_PREROUTING &>/dev/null && ok "Règles de redirection actives (interface : $IFACE)" \\
  || die "Les règles GatewayManager ne sont pas chargées. Logs : journalctl -u wg-quick@wg0 -n 30"

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
echo -e "  Exécutez ${_B}setup-client${_N} sur votre PC local (serveur de jeux / RDP...)"
echo ""
echo -e "  ${_Y}Pare-feu de l'hébergeur :${_N} ouvrez ${wgPort}/UDP et vos ports redirigés"
echo -e "  dans le panel (IONOS, OVH, Hetzner…) — ce script ne peut pas le faire pour vous."
echo ""
echo -e "  ${_C}État de la passerelle :${_N}  sudo gm-status"
echo ""
`
}

export function generateUninstallVps(): string {
  return `#!/bin/bash
# ==============================================================================
#  GatewayManager — Désinstallation du VPS
#  Arrête le tunnel, retire toutes les règles GatewayManager et les fichiers installés.
#  Vos autres règles iptables (Docker, ufw…) ne sont pas touchées.
# ==============================================================================

set -uo pipefail
[[ $EUID -ne 0 ]] && { echo "Relancez avec : sudo bash $0"; exit 1; }

if command -v systemctl &>/dev/null; then
  systemctl disable --now wg-quick@wg0 2>/dev/null || true
else
  wg-quick down wg0 2>/dev/null || true
fi

# Au cas où le tunnel était déjà arrêté sans avoir nettoyé
${vpsRemoveRules().join('\n')}

rm -rf ${GM_DIR} /usr/local/bin/gm-status
[[ -f /etc/wireguard/wg0.conf ]] && mv /etc/wireguard/wg0.conf /etc/wireguard/wg0.conf.removed
rm -f /etc/sysctl.d/99-wireguard.conf

echo "GatewayManager désinstallé. Config WireGuard conservée dans /etc/wireguard/wg0.conf.removed"
echo "Le forwarding IP reste actif jusqu'au prochain redémarrage."
`
}

// ─── Script Client Linux ──────────────────────────────────────────────────────

const osInstallInfo: Record<string, { label: string; installCmd: string }> = {
  'linux-debian': {
    label:       'Debian 12',
    installCmd:  'export DEBIAN_FRONTEND=noninteractive\napt-get update -qq\napt-get install -y -q wireguard wireguard-tools iptables',
  },
  'linux-ubuntu': {
    label:       'Ubuntu 22.04 / 24.04',
    installCmd:  'export DEBIAN_FRONTEND=noninteractive\napt-get update -qq\napt-get install -y -q wireguard wireguard-tools iptables',
  },
  'linux-fedora': {
    label:       'Fedora / CentOS / RHEL',
    installCmd:  'dnf install -y wireguard-tools iptables',
  },
  'linux-alpine': {
    label:       'Alpine Linux',
    installCmd:  'apk add --no-cache wireguard-tools iptables',
  },
  'linux-arch': {
    label:       'Arch Linux / Manjaro',
    installCmd:  'pacman -Sy --noconfirm wireguard-tools iptables',
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
clear 2>/dev/null || true
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

# Arrêter le tunnel AVANT de remplacer sa config : l'arrêt doit lire l'ancienne
# (ses PostDown retirent proprement le routage de l'ancien mode)
if wg show wg0 &>/dev/null; then
  log "Arrêt du tunnel existant (avec son ancienne configuration)"
  if command -v systemctl &>/dev/null; then systemctl stop wg-quick@wg0 2>/dev/null || true; fi
  if wg show wg0 &>/dev/null; then wg-quick down wg0 || true; fi
fi

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
${optionsOf(cfg).preserveClientIp
  ? `ip rule | grep -q 'lookup ${CLIENT_ROUTE_TABLE}' \\
  && ok "Routage IP réelle actif : vos services voient l'IP des visiteurs" \\
  || warn "Routage IP réelle absent — vérifiez : journalctl -u wg-quick@wg0 -n 30"`
  : 'log "Mode IP du VPS : vos services verront 10.10.0.1 comme source des connexions"'}

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

clear 2>/dev/null || true
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
echo -e "${_B}${_G}  ✓  Setup macOS terminé !${_N}"${usesFullTunnel(cfg)
  ? `
echo -e "  ${_Y}Tunnel complet :${_N} tout le trafic internet du Mac passe par le VPS"
echo -e "  (nécessaire sous macOS pour que vos services voient l'IP réelle des visiteurs)"`
  : ''}
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

# Le nom du fichier donne le nom du tunnel (wg0) — dossier réservé aux administrateurs
$configDir  = Join-Path $env:ProgramData "GatewayManager"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$configPath = Join-Path $configDir "wg0.conf"
[System.IO.File]::WriteAllText($configPath, $configContent.Replace("\`r\`n", "\`n"), (New-Object System.Text.UTF8Encoding $false))
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
${usesFullTunnel(cfg)
  ? `Write-Host "  Tunnel complet : tout le trafic internet du PC passe par le VPS" -ForegroundColor Yellow
Write-Host "  (nécessaire sous Windows pour que vos services voient l'IP réelle des visiteurs)" -ForegroundColor Yellow
Write-Host ""
`
  : ''}Write-Host "  Vérification : ouvrez l'interface WireGuard ou lancez :" -ForegroundColor Gray
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
  const opts       = optionsOf(cfg)
  const osLabel: Record<string, string> = {
    windows: 'Windows', 'linux-debian': 'Debian 12', 'linux-ubuntu': 'Ubuntu 22.04/24.04',
    'linux-fedora': 'Fedora/CentOS/RHEL', 'linux-alpine': 'Alpine Linux',
    'linux-arch': 'Arch Linux/Manjaro', macos: 'macOS',
  }
  const validPorts = cfg.ports.filter(isValidPortEntry)
  const portLines = cfg.openAllPorts
    ? '  - Tous les ports    1-65535     TCP+UDP  (sauf SSH et le port WireGuard — ex: Coolify)'
    : validPorts
        .map((p) => {
          const restrict = p.allowedSources?.trim() ? `  [limité à : ${p.allowedSources.trim()}]` : ''
          return `  - ${p.label.padEnd(15)} port ${formatPortEntry(p).padEnd(13)} ${p.protocol.toUpperCase()}${restrict}`
        })
        .join('\n')
  const clientScript = cfg.targetOS === 'windows' ? 'setup-client.ps1' : 'setup-client.sh'
  const modeText = !opts.preserveClientIp
    ? `  Vos services voient toutes les connexions venir de ${VPS_WG_IP} (IP du VPS dans le tunnel).
  Simple et compatible partout, mais les logs, bans et anti-DDoS ne voient pas l'IP réelle.`
    : usesFullTunnel(cfg)
      ? `  Vos services voient l'IP réelle des visiteurs.
  Sous ${osLabel[cfg.targetOS]}, cela passe par un tunnel complet : tout le trafic internet du PC
  sort par le VPS (le réseau local reste accessible).`
      : `  Vos services voient l'IP réelle des visiteurs (logs, bans, txAdmin, Coolify/Traefik…).
  Seules les réponses aux connexions venues du tunnel y retournent : le reste du trafic
  du PC sort normalement par votre box.`

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

IP DES VISITEURS
----------------
${modeText}

PORTS REDIRIGÉS (VPS → PC local)
---------------------------------
${portLines || '  (aucun port configuré)'}

FICHIERS INCLUS
---------------
  wg0-server.conf  → Config WireGuard du VPS (installée par setup-vps.sh)
  wg0-client.conf  → Config WireGuard du PC local
  setup-vps.sh     → Installation complète du VPS — relançable sans risque  [VPS]
  ${clientScript.padEnd(16)} → Installation du PC local                            [PC LOCAL]
  uninstall-vps.sh → Retire tout ce que GatewayManager a installé sur le VPS [VPS]

ORDRE D'INSTALLATION
--------------------
  ÉTAPE 0 — Panel de l'hébergeur (IONOS, OVH, Hetzner…) :
    Ouvrez ${wgPort}/UDP et vos ports redirigés dans le pare-feu réseau du VPS.

  ÉTAPE 1 — Sur le VPS (connexion SSH) :
    scp setup-vps.sh root@${vpsIp}:/root/
    ssh root@${vpsIp}
    sudo bash /root/setup-vps.sh

  ÉTAPE 2 — Sur le PC local :
${cfg.targetOS === 'windows'
  ? '    Copier setup-client.ps1 sur le PC\n    Ouvrir PowerShell en Administrateur\n    Exécuter : .\\setup-client.ps1'
  : `    scp setup-client.sh user@<IP_PC>:/tmp/\n    ssh user@<IP_PC>\n    sudo bash /tmp/setup-client.sh`}

MODIFIER LA CONFIGURATION (ajout de port, changement de mode…)
--------------------------------------------------------------
  Régénérez les fichiers dans GatewayManager puis relancez setup-vps.sh :
  les anciennes règles sont remplacées, rien n'est dupliqué, Docker/ufw ne sont pas touchés.
  Si le mode « IP des visiteurs » ou l'OS change, relancez aussi le script du PC local.

VÉRIFICATION
------------
  Sur le VPS — diagnostic complet (tunnel, handshake, compteurs par port) :
    sudo gm-status

  Depuis n'importe où :
${cfg.openAllPorts
  ? `    nc -zv ${vpsIp} <PORT>  # remplacez <PORT> par le port réellement utilisé (ex: 8000 pour Coolify)`
  : validPorts.map((p) => `    nc -zv ${vpsIp} ${String(p.port).padEnd(6)}# ${p.label}`).join('\n') || `    nc -zv ${vpsIp} <PORT>`}

DÉPANNAGE
---------
  - WireGuard ne démarre pas  → vérifiez les clés (base64, 44 caractères)
  - Aucun handshake           → ${wgPort}/UDP fermé dans le pare-feu de l'hébergeur
  - Ports inaccessibles       → sudo gm-status : les compteurs du port augmentent-ils ?
                                 oui → pare-feu du PC local ; non → pare-feu de l'hébergeur
  - Interface réseau          → détectée automatiquement (eth0, ens3, ens6…)

DÉSINSTALLATION
---------------
  VPS      : sudo bash uninstall-vps.sh
  PC local : ${cfg.targetOS === 'windows'
    ? '"C:\\Program Files\\WireGuard\\wireguard.exe" /uninstalltunnelservice wg0'
    : cfg.targetOS === 'macos'
      ? 'sudo wg-quick down /usr/local/etc/wireguard/wg0.conf'
      : 'sudo systemctl disable --now wg-quick@wg0'}

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
    'uninstall-vps.sh': generateUninstallVps(),
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
