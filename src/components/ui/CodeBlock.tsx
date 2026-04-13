import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'

interface CodeBlockProps {
  code: string
  filename?: string
  language?: string
  onCopy?: () => void
  onDownload?: () => void
  maxHeight?: string
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function highlightCode(code: string, language: string): string {
  if (language === 'ini' || language === 'conf') {
    return escapeHtml(code)
      .replace(/^(\[.+\])$/gm, '<span class="text-accent-cyan font-semibold">$1</span>')
      .replace(/^(#.*)$/gm, '<span class="text-slate-500 italic">$1</span>')
      .replace(/^(\w+)\s*=/gm, '<span class="text-accent-orange">$1</span> =')
  }
  if (language === 'bash' || language === 'sh') {
    return escapeHtml(code)
      .replace(/(^#.*$)/gm, '<span class="text-slate-500 italic">$1</span>')
      .replace(/(echo\s+"[^"]*")/g, '<span class="text-accent-green">$1</span>')
      .replace(/\b(apt|systemctl|sysctl|iptables|wg|wg-quick|netfilter-persistent|cat|chmod|mkdir|set)\b/g, '<span class="text-accent-cyan">$1</span>')
      .replace(/'[^']*'/g, '<span class="text-accent-orange">$&</span>')
  }
  if (language === 'powershell' || language === 'ps1') {
    return escapeHtml(code)
      .replace(/(^#.*$)/gm, '<span class="text-slate-500 italic">$1</span>')
      .replace(/\b(Write-Host|Invoke-WebRequest|Start-Process|Remove-Item|Out-File|Test-Path)\b/g, '<span class="text-accent-cyan">$1</span>')
      .replace(/-ForegroundColor\s+\w+/g, '<span class="text-accent-purple">$&</span>')
      .replace(/"[^"]*"/g, '<span class="text-accent-green">$&</span>')
  }
  return escapeHtml(code)
}

export function CodeBlock({ code, filename, language = 'bash', onCopy, onDownload, maxHeight }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.()
    } catch {
      // Clipboard API unavailable (non-HTTPS or denied permission) — silent fail
    }
  }

  const highlighted = highlightCode(code, language)

  return (
    <div className="rounded-lg overflow-hidden border border-bg-border bg-bg-base">
      {/* Header macOS style */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-elevated border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-green-500/70" />
          {filename && (
            <span className="ml-2 text-xs text-slate-400 font-mono">{filename}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent-cyan transition-colors px-2 py-1 rounded hover:bg-bg-base"
            >
              <Download size={12} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent-green transition-colors px-2 py-1 rounded hover:bg-bg-base"
          >
            {copied ? (
              <>
                <Check size={12} className="text-accent-green" />
                <span className="text-accent-green">Copié</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copier</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div
        className="overflow-auto"
        style={{ maxHeight: maxHeight || '400px' }}
      >
        <pre className="p-4 text-sm font-mono leading-relaxed text-slate-300">
          <code
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  )
}
