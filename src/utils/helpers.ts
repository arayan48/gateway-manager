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
