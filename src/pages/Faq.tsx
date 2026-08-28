import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react'

interface FaqItem {
  q: string
  a: string
  tags: string[]
}

const faqItems: FaqItem[] = [
  {
    q: 'WireGuard ne démarre pas sur le VPS',
    a: 'Vérifiez que les clés sont en base64 valide (44 caractères terminés par `=`). Régénérez avec :\n`wg genkey | tee priv.key | wg pubkey > pub.key`\nVérifiez aussi les permissions : `chmod 600 /etc/wireguard/wg0.conf`.',
    tags: ['vps', 'linux', 'clés'],
  },
  {
    q: 'Le tunnel est actif mais les ports ne sont pas accessibles',
    a: 'Vérifiez le forwarding IP :\n`cat /proc/sys/net/ipv4/ip_forward`\nDoit afficher `1`. Vérifiez les règles iptables :\n`iptables -t nat -L PREROUTING -n -v`\nSi vous utilisez un hébergeur cloud, vérifiez aussi les Security Groups / Firewall Rules du provider.',
    tags: ['vps', 'iptables', 'ports'],
  },
  {
    q: 'Port 51820 inaccessible depuis l\'extérieur',
    a: 'Le port `51820/UDP` doit être ouvert dans le pare-feu de votre hébergeur VPS (OVH, Hetzner, DigitalOcean...). Ce n\'est pas le pare-feu système — c\'est le firewall réseau du provider. Vérifiez dans le panel d\'administration.',
    tags: ['vps', 'réseau'],
  },
  {
    q: 'Ping 10.10.0.1 ne répond pas depuis le client',
    a: 'Le tunnel n\'est pas établi. Vérifiez :\n1. `wg show` sur les deux machines — le peer doit apparaître\n2. La clé publique du VPS est bien dans la config client (et inversement)\n3. L\'Endpoint pointe vers l\'IP publique du VPS\n4. Le port 51820/UDP est ouvert',
    tags: ['client', 'tunnel'],
  },
  {
    q: 'Erreur "RTNETLINK answers: Operation not supported"',
    a: 'Le module WireGuard n\'est pas chargé. Exécutez :\n`sudo modprobe wireguard`\nSi ça échoue, votre noyau est probablement trop ancien (< 5.6). Vérifiez avec `uname -r` et installez le module DKMS :\n`apt install wireguard-dkms`',
    tags: ['client', 'linux'],
  },
  {
    q: 'Windows : le service WireGuard ne démarre pas',
    a: 'Vérifiez que vous exécutez PowerShell en tant qu\'Administrateur. Vérifiez la clé privée (44 caractères base64). Consultez les logs :\n`Get-Service "WireGuardTunnel$wg0"`\nOu dans l\'interface WireGuard > onglet Log.',
    tags: ['client', 'windows'],
  },
  {
    q: 'macOS : permission réseau refusée',
    a: 'Au premier lancement, macOS demande d\'autoriser l\'extension réseau. Allez dans Réglages Système → Confidentialité et sécurité et autorisez WireGuard. Un redémarrage peut être nécessaire.',
    tags: ['client', 'macos'],
  },
  {
    q: 'Les règles iptables disparaissent au redémarrage',
    a: 'Les règles iptables sont en mémoire par défaut. Pour les rendre persistantes :\n- Debian/Ubuntu : `netfilter-persistent save`\n- Fedora : `service iptables save`\n- Alpine/Arch : `iptables-save > /etc/iptables/rules.v4`\nLe script `setup-vps.sh` fait ça automatiquement.',
    tags: ['vps', 'iptables'],
  },
  {
    q: 'Quelle est la différence entre le VPS et le PC client ?',
    a: 'Le **VPS** est un serveur Linux avec une IP publique — il sert de relais. Le **PC client** est votre machine locale (derrière un NAT, sans IP publique) qui héberge vos services (jeux, RDP, bases de données...). Le VPS reçoit le trafic d\'internet et le redirige vers votre PC via le tunnel WireGuard.',
    tags: ['concept'],
  },
  {
    q: 'Puis-je connecter plusieurs clients au même VPS ?',
    a: 'Oui. Ajoutez un bloc `[Peer]` supplémentaire dans la config du VPS pour chaque client, avec une IP WireGuard différente (`10.10.0.3`, `10.10.0.4`, etc.). Chaque client a sa propre paire de clés.',
    tags: ['avancé'],
  },
  {
    q: 'Comment changer l\'interface réseau (eth0 → ens3) ?',
    a: 'Le script `setup-vps.sh` détecte automatiquement l\'interface principale. Si vous configurez manuellement, trouvez le nom avec :\n`ip route get 8.8.8.8 | awk \'{print $5}\'`\nRemplacez `eth0` par le résultat dans vos règles iptables.',
    tags: ['vps', 'réseau'],
  },
  {
    q: 'Comment vérifier que tout fonctionne ?',
    a: 'Sur le VPS :\n`wg show`\n`iptables -t nat -L PREROUTING -n -v`\nDepuis n\'importe où :\n`nc -zv <IP_VPS> <PORT>`\nSi `wg show` affiche un peer avec un "latest handshake", le tunnel est actif.',
    tags: ['vps', 'client', 'vérification'],
  },
]

const allTags = [...new Set(faqItems.flatMap(f => f.tags))].sort()

function renderAnswer(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1)
      return (
        <code
          key={i}
          className="font-mono text-xs bg-bg-base border border-bg-border rounded px-1.5 py-0.5 text-accent-cyan cursor-pointer hover:text-white transition-colors"
          onClick={() => navigator.clipboard.writeText(code)}
          title="Cliquer pour copier"
        >
          {code}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-bg-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-bg-elevated transition-colors"
      >
        <span className="text-sm font-medium text-white">{item.q}</span>
        <ChevronDown
          size={16}
          className={`text-slate-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
            {renderAnswer(item.a)}
          </div>
          <div className="flex gap-1.5 mt-3">
            {item.tags.map(tag => (
              <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-elevated border border-bg-border text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Faq() {
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const filtered = faqItems.filter(item => {
    const matchSearch = !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
    const matchTag = !activeTag || item.tags.includes(activeTag)
    return matchSearch && matchTag
  })

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
          FAQ & Dépannage
        </h1>
        <p className="text-slate-500 text-sm">
          Les questions et problèmes les plus fréquents. Cliquez sur une commande <code className="text-accent-cyan font-mono text-xs">comme celle-ci</code> pour la copier.
        </p>
      </div>

      {/* Search */}
      <label className="sr-only" htmlFor="faq-search">Rechercher un problème</label>
      <input
        id="faq-search"
        className="input-field mb-4"
        placeholder="Rechercher un problème..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setActiveTag(null)}
          className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-all
            ${!activeTag ? 'border-accent-purple/40 text-accent-purple bg-accent-purple/10' : 'border-bg-border text-slate-500 hover:text-slate-300'}`}
        >
          Tout
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-all
              ${activeTag === tag ? 'border-accent-purple/40 text-accent-purple bg-accent-purple/10' : 'border-bg-border text-slate-500 hover:text-slate-300'}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((item) => <FaqAccordion key={item.q} item={item} />)
        ) : (
          <div className="text-center py-10">
            <HelpCircle size={28} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucun résultat pour "{search}"</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-2xl border border-bg-border bg-bg-surface p-6 text-center">
        <p className="text-white font-semibold mb-1">Problème non résolu ?</p>
        <p className="text-slate-500 text-sm mb-4">Consultez la documentation complète par OS ou lancez le générateur de config.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/docs" className="btn-ghost flex items-center justify-center gap-2 text-sm">
            Documentation complète
          </Link>
          <Link to="/config" className="btn-primary flex items-center justify-center gap-2 text-sm">
            Générateur de config
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
