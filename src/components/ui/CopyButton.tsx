import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  onCopy?: () => void
  size?: 'sm' | 'md'
}

export function CopyButton({ text, onCopy, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }

  return (
    <button
      onClick={handleCopy}
      title="Copier"
      className={`flex items-center gap-1 border rounded transition-all duration-200
        ${size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'}
        ${copied
          ? 'border-accent-green/40 text-accent-green bg-accent-green/10'
          : 'border-bg-border text-slate-400 hover:text-accent-green hover:border-accent-green/40 bg-bg-elevated'
        }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  )
}
