import type { PortEntry } from '../types'
import { isValidPort, parseSources, sanitizeLabel } from './helpers'

// ─── Constantes réseau partagées par tous les générateurs ────────────────────

export const WG_SUBNET = '10.10.0.0/24'
export const VPS_WG_IP = '10.10.0.1'
/** Table de routage + marque de connexion utilisées côté PC local Linux pour renvoyer les réponses dans le tunnel */
export const CLIENT_ROUTE_TABLE = 4242
/** Dossier où setup-vps.sh installe les scripts appelés par wg-quick */
export const GM_DIR = '/etc/gateway-manager'

// Même détection partout : l'interface publique s'appelle eth0, ens3, ens6, enp1s0… selon l'hébergeur
export const DETECT_IFACE = `IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") {print $(i+1); exit}}' || true)`

// Port(s) SSH réellement écoutés — un SSH déplacé (ex: 2222) serait sinon redirigé vers le PC local
export const DETECT_SSH_PORTS = `SSH_PORTS=$(sshd -T 2>/dev/null | awk '$1=="port"{print $2}' || true); SSH_PORTS=\${SSH_PORTS:-22}`

export interface VpsRulesInput {
  ports: PortEntry[]
  localIp: string
  wgPort: number
  openAll: boolean
  preserveClientIp: boolean
}

/** Entrée exploitable : ports dans 1-65535, plage croissante, sources valides */
export function isValidPortEntry(e: PortEntry): boolean {
  if (!isValidPort(e.port)) return false
  if (e.endPort !== undefined && (!isValidPort(e.endPort) || e.endPort < e.port)) return false
  if (e.targetPort !== undefined && !isValidPort(e.targetPort)) return false
  return parseSources(e.allowedSources) !== null
}

export function isRange(e: PortEntry): boolean {
  return e.endPort !== undefined && e.endPort > e.port
}

/** Port côté PC local pour une entrée simple (le port public si aucune traduction) */
export function localPort(e: PortEntry): number {
  return !isRange(e) && e.targetPort ? e.targetPort : e.port
}

export function protocolsOf(e: PortEntry): ('tcp' | 'udp')[] {
  return e.protocol === 'tcp+udp' ? ['tcp', 'udp'] : [e.protocol]
}

/** Texte sûr pour `-m comment --comment '…'` (entre quotes simples) */
function iptablesComment(label: string): string {
  return sanitizeLabel(label).replace(/['"]/g, '') || 'GatewayManager'
}

// ─── VPS : règles de redirection (chaîne nat GM_PREROUTING) ──────────────────

export function vpsRedirectRules(input: VpsRulesInput): string[] {
  const { localIp, wgPort } = input
  const lines: string[] = []

  if (input.openAll) {
    lines.push('# Tous les ports (1-65535) sont redirigés — utile pour les services à ports dynamiques (ex: Coolify)')
    lines.push('# SSH et le port WireGuard restent servis par le VPS — sinon vous perdez SSH et le tunnel ne peut plus se monter')
    lines.push(DETECT_SSH_PORTS)
    lines.push('for p in $SSH_PORTS; do iptables -t nat -A GM_PREROUTING -i "$IFACE" -p tcp --dport "$p" -j RETURN; done')
    lines.push(`iptables -t nat -A GM_PREROUTING -i "$IFACE" -p udp --dport ${wgPort} -j RETURN`)
    for (const proto of ['tcp', 'udp']) {
      lines.push(`iptables -t nat -A GM_PREROUTING -i "$IFACE" -p ${proto} -m addrtype --dst-type LOCAL -m comment --comment 'Tous les ports' -j DNAT --to-destination ${localIp}`)
    }
    return lines
  }

  const valid = input.ports.filter(isValidPortEntry)
  if (valid.length === 0) {
    lines.push('# Aucun port configuré — ajoutez vos redirections dans GatewayManager')
    return lines
  }

  for (const e of valid) {
    const sources = parseSources(e.allowedSources) ?? []
    const src = sources.length > 0 ? ` -s ${sources.join(',')}` : ''
    const dport = isRange(e) ? `${e.port}:${e.endPort}` : String(e.port)
    const to = isRange(e) ? `${localIp}:${e.port}-${e.endPort}` : `${localIp}:${localPort(e)}`
    const comment = iptablesComment(e.label)
    for (const proto of protocolsOf(e)) {
      lines.push(`iptables -t nat -A GM_PREROUTING -i "$IFACE" -p ${proto}${src} --dport ${dport} -m comment --comment '${comment}' -j DNAT --to-destination ${to}`)
    }
  }
  return lines
}

/**
 * Corps complet des règles VPS, dans des chaînes dédiées (GM_*) :
 * - idempotent (on repart toujours de zéro), donc relançable sans doublons ;
 * - ne touche jamais aux autres règles (Docker, ufw…) — aucune chaîne système n'est vidée.
 * `wgVar` est le nom de l'interface WireGuard tel qu'il apparaît dans le script ("$WG" ou "wg0").
 */
export function vpsApplyRules(input: VpsRulesInput, wgVar = '"$WG"'): string[] {
  const { localIp, wgPort } = input
  return [
    '# Chaînes dédiées GatewayManager, branchées en tête des chaînes système',
    'iptables -t nat -N GM_PREROUTING',
    'iptables -t nat -N GM_POSTROUTING',
    'iptables -N GM_FORWARD',
    'iptables -N GM_INPUT',
    'iptables -t nat -I PREROUTING 1 -j GM_PREROUTING',
    'iptables -t nat -I POSTROUTING 1 -j GM_POSTROUTING',
    'iptables -I FORWARD 1 -j GM_FORWARD',
    'iptables -I INPUT 1 -j GM_INPUT',
    '',
    '# Tunnel WireGuard',
    `iptables -A GM_INPUT -i "$IFACE" -p udp --dport ${wgPort} -j ACCEPT`,
    `iptables -A GM_INPUT -i ${wgVar} -j ACCEPT`,
    '',
    '# Redirections de ports',
    ...vpsRedirectRules(input),
    '',
    '# Forward : uniquement ce qui a été redirigé ci-dessus (+ les réponses)',
    `iptables -A GM_FORWARD -i "$IFACE" -o ${wgVar} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
    `iptables -A GM_FORWARD -i "$IFACE" -o ${wgVar} -d ${localIp} -m conntrack --ctstate DNAT -j ACCEPT`,
    `iptables -A GM_FORWARD -i ${wgVar} -o "$IFACE" -s ${WG_SUBNET} -j ACCEPT`,
    `iptables -A GM_FORWARD -i "$IFACE" -o ${wgVar} -j DROP`,
    '',
    '# Sortie internet du tunnel (mises à jour, DNS… du PC local en tunnel complet)',
    `iptables -t nat -A GM_POSTROUTING -s ${WG_SUBNET} -o "$IFACE" -j MASQUERADE`,
    ...(input.preserveClientIp
      ? [
          '# IP réelle conservée : pas de MASQUERADE vers le tunnel — le PC local voit l\'IP du visiteur',
          '# (il renvoie ses réponses par le tunnel grâce à sa propre config WireGuard)',
        ]
      : [
          '# Les visiteurs apparaissent avec l\'IP du VPS (10.10.0.1) — simple, mais l\'IP réelle est perdue',
          `iptables -t nat -A GM_POSTROUTING -o ${wgVar} -j MASQUERADE`,
        ]),
  ]
}

/** Retire proprement tout ce que vpsApplyRules a créé (sans erreur si rien n'existe) */
export function vpsRemoveRules(): string[] {
  return [
    'while iptables -t nat -D PREROUTING -j GM_PREROUTING 2>/dev/null; do :; done',
    'while iptables -t nat -D POSTROUTING -j GM_POSTROUTING 2>/dev/null; do :; done',
    'while iptables -D FORWARD -j GM_FORWARD 2>/dev/null; do :; done',
    'while iptables -D INPUT -j GM_INPUT 2>/dev/null; do :; done',
    'for c in GM_PREROUTING GM_POSTROUTING; do iptables -t nat -F $c 2>/dev/null || true; iptables -t nat -X $c 2>/dev/null || true; done',
    'for c in GM_FORWARD GM_INPUT; do iptables -F $c 2>/dev/null || true; iptables -X $c 2>/dev/null || true; done',
  ]
}

/** /etc/gateway-manager/up.sh — appelé par wg-quick (PostUp = … %i) */
export function vpsUpScript(input: VpsRulesInput): string {
  return [
    '#!/bin/bash',
    '# GatewayManager — règles réseau du VPS, appliquées par wg-quick à chaque démarrage du tunnel (PostUp)',
    '# Ne pas éditer à la main : régénérez depuis GatewayManager puis relancez setup-vps.sh',
    'set -euo pipefail',
    'WG="${1:-wg0}"',
    DETECT_IFACE,
    '[[ -n "$IFACE" ]] || { echo "GatewayManager : interface publique introuvable" >&2; exit 1; }',
    '',
    '# Repartir d\'un état propre (idempotent)',
    `"${GM_DIR}/down.sh" "$WG"`,
    '',
    ...vpsApplyRules(input),
    '',
  ].join('\n')
}

/** /etc/gateway-manager/down.sh — appelé par wg-quick (PostDown = … %i) */
export function vpsDownScript(): string {
  return [
    '#!/bin/bash',
    '# GatewayManager — retire les règles réseau du VPS (PostDown) — sans effet si elles sont absentes',
    ...vpsRemoveRules(),
    'exit 0',
    '',
  ].join('\n')
}

/** /usr/local/bin/gm-status — diagnostic en une commande */
export function vpsStatusScript(localIp: string): string {
  return [
    '#!/bin/bash',
    '# GatewayManager — état de la passerelle : sudo gm-status',
    'WG="${1:-wg0}"',
    `LOCAL="${localIp}"`,
    "G='\\033[0;32m'; R='\\033[0;31m'; Y='\\033[1;33m'; B='\\033[1m'; N='\\033[0m'",
    'good() { echo -e "  $G✓$N $1"; }',
    'bad()  { echo -e "  $R✗$N $1"; }',
    'meh()  { echo -e "  $Y!$N $1"; }',
    '[[ $EUID -ne 0 ]] && { echo "Lancez : sudo gm-status"; exit 1; }',
    '',
    'echo -e "\\n$B GatewayManager — état de la passerelle$N\\n"',
    DETECT_IFACE,
    '[[ -n "$IFACE" ]] && good "Interface publique : $IFACE" || bad "Interface publique introuvable"',
    '[[ "$(cat /proc/sys/net/ipv4/ip_forward)" == 1 ]] && good "IP forwarding actif" || bad "IP forwarding désactivé — sysctl -w net.ipv4.ip_forward=1"',
    '',
    'if ! wg show "$WG" &>/dev/null; then',
    '  bad "Tunnel $WG arrêté — systemctl restart wg-quick@$WG"',
    'else',
    '  HS=$(wg show "$WG" latest-handshakes | awk \'NR==1{print $2}\')',
    '  if [[ -z "$HS" || "$HS" == 0 ]]; then',
    '    bad "Aucun handshake : le PC local ne s\'est jamais connecté (clés, port UDP, pare-feu de l\'hébergeur)"',
    '  else',
    '    AGE=$(( $(date +%s) - HS ))',
    '    if (( AGE < 180 )); then good "PC local connecté (dernier handshake il y a $AGE s)"',
    '    else meh "Dernier handshake il y a $AGE s — le PC local semble déconnecté"; fi',
    '    wg show "$WG" transfer | awk \'NR==1{printf "  ·  Trafic tunnel : %.1f Mo reçus / %.1f Mo envoyés\\n", $2/1048576, $3/1048576}\'',
    '  fi',
    'fi',
    '',
    'ping -c1 -W2 "$LOCAL" &>/dev/null && good "Ping $LOCAL OK" || meh "Ping $LOCAL sans réponse (normal si le pare-feu du PC bloque l\'ICMP)"',
    '',
    'if iptables -t nat -S GM_PREROUTING &>/dev/null; then',
    '  good "Règles GatewayManager chargées"',
    '  echo -e "\\n$B Redirections (compteurs de paquets / octets)$N"',
    '  iptables -t nat -L GM_PREROUTING -n -v',
    '  iptables -t nat -S GM_POSTROUTING | grep -q -- "-o $WG -j MASQUERADE" \\',
    '    && echo -e "\\n  Mode : les services voient l\'IP du VPS" \\',
    '    || echo -e "\\n  Mode : les services voient l\'IP réelle des visiteurs"',
    'else',
    '  bad "Règles absentes — systemctl restart wg-quick@$WG"',
    'fi',
    'echo ""',
    '',
  ].join('\n')
}

// ─── PC local Linux : renvoyer les réponses dans le tunnel (IP réelle conservée) ──

/**
 * Hooks wg-quick (`%i` = interface) pour le PC local Linux quand l'IP réelle est conservée.
 * Les connexions arrivées par le tunnel sont marquées ; leurs réponses (y compris celles des
 * conteneurs Docker / Coolify) sont routées vers le tunnel via une table dédiée. Le reste du
 * trafic du PC continue de sortir normalement par la box.
 */
export function linuxClientRoutingHooks(): { up: string[]; down: string[] } {
  const t = CLIENT_ROUTE_TABLE
  const mangle = [
    `PREROUTING -i %i -m conntrack --ctstate NEW -j CONNMARK --set-mark ${t}`,
    `PREROUTING ! -i %i -m connmark --mark ${t} -j CONNMARK --restore-mark`,
    `OUTPUT -m connmark --mark ${t} -j CONNMARK --restore-mark`,
  ]
  return {
    up: [
      'sysctl -q -w net.ipv4.conf.%i.rp_filter=2',
      `ip route replace default dev %i table ${t}`,
      // wg-quick exécute chaque hook sous `set -e` : une commande qui peut échouer doit finir par `|| true`
      `ip rule del fwmark ${t} lookup ${t} 2>/dev/null || true; ip rule add fwmark ${t} lookup ${t} priority ${t}`,
      // Retrait préalable : un `wg-quick up` répété ne crée jamais de doublon
      ...mangle.map((r) => `iptables -t mangle -D ${r} 2>/dev/null || true; iptables -t mangle -A ${r}`),
    ],
    down: [
      ...mangle.map((r) => `iptables -t mangle -D ${r} 2>/dev/null || true`),
      `ip rule del fwmark ${t} lookup ${t} 2>/dev/null || true`,
      `ip route flush table ${t} 2>/dev/null || true`,
    ],
  }
}

/** Deux entrées se recouvrent si elles partagent un protocole et au moins un port public */
export function portsOverlap(a: PortEntry, b: PortEntry): boolean {
  const shared = protocolsOf(a).some((p) => protocolsOf(b).includes(p))
  const aEnd = isRange(a) ? a.endPort! : a.port
  const bEnd = isRange(b) ? b.endPort! : b.port
  return shared && a.port <= bEnd && b.port <= aEnd
}
