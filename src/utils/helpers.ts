export function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function isValidIp(v: string): boolean {
  const parts = v.trim().split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return /^\d{1,3}$/.test(p) && n >= 0 && n <= 255
  })
}

export function sanitizeLabel(label: string): string {
  return label.replace(/[\r\n`$\\;|&<>]/g, '').slice(0, 60)
}

/** Port réseau valide : entier compris entre 1 et 65535 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/** Clé WireGuard valide : 32 octets encodés en base64 (44 caractères, terminés par '=') */
export function isValidWgKey(v: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(v.trim())
}

/** IPv4 seule ou réseau CIDR (ex: 203.0.113.4 ou 198.51.100.0/24) */
export function isValidCidr(v: string): boolean {
  const [ip, mask, ...rest] = v.trim().split('/')
  if (rest.length > 0 || !isValidIp(ip)) return false
  if (mask === undefined) return true
  return /^\d{1,2}$/.test(mask) && Number(mask) <= 32
}

/** Découpe une liste "a, b c" en entrées ; renvoie null si l'une d'elles est invalide */
export function parseSources(v: string | undefined): string[] | null {
  const items = (v ?? '').split(/[\s,;]+/).filter(Boolean)
  return items.every(isValidCidr) ? items : null
}

/** Port affiché d'une entrée : "8080", "27015-27030" ou "2222 → 22" */
export function formatPortEntry(e: { port: number; endPort?: number; targetPort?: number }): string {
  if (e.endPort && e.endPort > e.port) return `${e.port}-${e.endPort}`
  if (e.targetPort && e.targetPort !== e.port) return `${e.port} → ${e.targetPort}`
  return String(e.port)
}

/** Libellé pour les notifications : n'ajoute le port que s'il n'est pas déjà dans le label */
export function describePortEntry(e: { label: string; port: number; endPort?: number; targetPort?: number }): string {
  const ports = formatPortEntry(e)
  return e.label.includes(ports) ? e.label : `${e.label} (${ports})`
}
