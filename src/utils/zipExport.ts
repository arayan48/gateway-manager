import JSZip from 'jszip'
import type { GeneratedFiles } from '../types'

export async function exportToZip(files: GeneratedFiles, projectName: string): Promise<void> {
  const zip = new JSZip()
  const folderName = (projectName || 'gateway-manager').replace(/\s+/g, '-').toLowerCase()
  const folder = zip.folder(folderName)!

  for (const [filename, content] of Object.entries(files)) {
    if (content) {
      folder.file(filename, content)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
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
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
