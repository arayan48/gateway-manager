import JSZip from 'jszip'
import type { GeneratedFiles } from '../types'

/** Normalise les fins de ligne en LF pur (évite le problème CRLF sur Windows → Linux) */
function toLF(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export async function exportToZip(files: GeneratedFiles, projectName: string): Promise<void> {
  const zip = new JSZip()
  const folderName = (projectName || 'gateway-manager')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 64) || 'gateway-manager'
  const folder = zip.folder(folderName)!

  for (const [filename, content] of Object.entries(files)) {
    if (!content) continue

    if (filename.endsWith('.sh')) {
      // LF obligatoire + permission exécutable (rwxr-xr-x = 0o755)
      folder.file(filename, toLF(content), { unixPermissions: 0o755 })
    } else {
      folder.file(filename, content)
    }
  }

  // platform: 'UNIX' est nécessaire pour que JSZip inclue les unixPermissions dans le ZIP
  const blob = await zip.generateAsync({ type: 'blob', platform: 'UNIX' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${folderName}-wireguard.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportSingleFile(filename: string, content: string): Promise<void> {
  // Pour les scripts shell téléchargés individuellement, forcer LF
  const normalized = filename.endsWith('.sh') ? toLF(content) : content
  const blob = new Blob([normalized], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
