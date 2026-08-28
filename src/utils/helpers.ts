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
