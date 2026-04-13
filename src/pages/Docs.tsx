import React, { useState } from 'react'
import { Monitor, Terminal, Server, Apple, ChevronRight, CheckCircle, ExternalLink } from 'lucide-react'
import { CodeBlock } from '../components/ui/CodeBlock'
import { NoteBox } from '../components/ui/NoteBox'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'

/* ─── Composant carte de téléchargement ─────────────────────── */
interface DownloadCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  href: string
  tag?: string          // badge ex: "Recommandé"
  tagColor?: string
  secondary?: boolean   // style moins mis en avant
}

function DownloadCard({ icon, title, subtitle, href, tag, tagColor = 'text-accent-green border-accent-green/30 bg-accent-green/10', secondary }: DownloadCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all group
        ${secondary
          ? 'border-bg-border bg-bg-surface hover:border-bg-border/80 hover:bg-bg-elevated'
          : 'border-accent-cyan/30 bg-accent-cyan/5 hover:border-accent-cyan/60 hover:bg-accent-cyan/10'
        }`}
    >
      <div className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg shrink-0 ${secondary ? 'bg-bg-elevated' : 'bg-accent-cyan/10'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-sm ${secondary ? 'text-slate-300' : 'text-white'}`}>{title}</span>
          {tag && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${tagColor}`}>{tag}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
      </div>
      <ExternalLink size={14} className={`shrink-0 ${secondary ? 'text-slate-600 group-hover:text-slate-400' : 'text-accent-cyan/50 group-hover:text-accent-cyan'} transition-colors`} />
    </a>
  )
}

type MachineType = 'vps' | 'client' | 'both'

function MachineBadge({ type }: { type: MachineType }) {
  if (type === 'vps') return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan">
      🖥️ VPS
    </span>
  )
  if (type === 'client') return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-accent-orange/40 bg-accent-orange/10 text-accent-orange">
      💻 PC Client
    </span>
  )
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-slate-500/40 bg-slate-500/10 text-slate-400">
      🖥️ VPS + 💻 Client
    </span>
  )
}

function StepTitle({ n, label, color, machine }: { n: number; label: string; color: string; machine?: MachineType }) {
  return (
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 flex-wrap">
      <span className={`w-6 h-6 rounded text-xs flex items-center justify-center font-bold border ${color}`}>{n}</span>
      {label}
      {machine && <MachineBadge type={machine} />}
    </h3>
  )
}

function ArchitectureOverview() {
  return (
    <div className="mb-8 rounded-xl border border-bg-border bg-bg-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-bg-border bg-bg-elevated">
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Avant de commencer — Architecture</p>
      </div>
      <div className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="flex-1 border border-accent-cyan/30 rounded-lg p-3 bg-accent-cyan/5">
            <div className="text-accent-cyan font-bold text-sm mb-1.5 flex items-center gap-1.5">🖥️ VPS <span className="text-[10px] font-normal text-accent-cyan/70">(Serveur relais)</span></div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• Toujours <strong className="text-white">Linux</strong> (Debian / Ubuntu recommandé)</li>
              <li>• Possède une <strong className="text-white">IP publique</strong> accessible depuis internet</li>
              <li>• Écoute le port <strong className="text-white">51820/UDP</strong> (WireGuard)</li>
              <li>• Redirige les ports vers votre PC via iptables</li>
            </ul>
            <div className="mt-2 text-[10px] text-accent-cyan/60 font-mono">→ Exécutez <strong>setup-vps.sh</strong> ici</div>
          </div>

          <div className="hidden sm:flex items-center text-accent-green font-mono text-xl self-center">⟷</div>
          <div className="sm:hidden flex justify-center text-accent-green font-mono text-lg">↕</div>

          <div className="flex-1 border border-accent-orange/30 rounded-lg p-3 bg-accent-orange/5">
            <div className="text-accent-orange font-bold text-sm mb-1.5 flex items-center gap-1.5">💻 PC Client <span className="text-[10px] font-normal text-accent-orange/70">(Votre machine)</span></div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• Peut être <strong className="text-white">Windows, Linux ou macOS</strong></li>
              <li>• Derrière un routeur/NAT, <strong className="text-white">sans IP publique</strong></li>
              <li>• Se connecte au VPS via le tunnel WireGuard</li>
              <li>• Héberge vos services (jeux, RDP, base de données…)</li>
            </ul>
            <div className="mt-2 text-[10px] text-accent-orange/60 font-mono">→ Exécutez <strong>setup-client.sh / .ps1</strong> ici</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center mt-3">
          Les étapes <MachineBadge type="vps" /> s'exécutent sur le VPS &bull; Les étapes <MachineBadge type="client" /> s'exécutent sur votre machine locale
        </p>
      </div>
    </div>
  )
}

type OS = 'windows' | 'linux-debian' | 'linux-other' | 'macos'

interface DocOS {
  id: OS
  label: string
  subtitle: string
  icon: typeof Monitor
  badge: string
  badgeVariant: 'blue' | 'orange' | 'purple' | 'gray'
  color: string
  borderColor: string
}

const osList: DocOS[] = [
  { id: 'windows',      label: 'Windows',          subtitle: 'Windows 10 / 11 / Server',   icon: Monitor,  badge: 'PowerShell',    badgeVariant: 'blue',   color: 'text-blue-400',       borderColor: 'border-blue-500/40' },
  { id: 'linux-debian', label: 'Debian / Ubuntu',  subtitle: 'Distros à base de apt',       icon: Terminal, badge: 'apt install',   badgeVariant: 'orange', color: 'text-accent-orange',  borderColor: 'border-accent-orange/40' },
  { id: 'linux-other',  label: 'Fedora / Alpine / Arch', subtitle: 'Autres distros Linux', icon: Server,   badge: 'dnf/apk/pacman',badgeVariant: 'purple', color: 'text-accent-purple',  borderColor: 'border-accent-purple/40' },
  { id: 'macos',        label: 'macOS',            subtitle: 'macOS 12+ via Homebrew',      icon: Apple,    badge: 'Homebrew',      badgeVariant: 'gray',   color: 'text-slate-300',      borderColor: 'border-slate-500/40' },
]

const sections = [
  { id: 'install', label: 'Installation' },
  { id: 'wireguard', label: 'Configuration WireGuard' },
  { id: 'iptables', label: 'iptables / Pare-feu' },
  { id: 'verify', label: 'Vérification' },
  { id: 'troubleshoot', label: 'Dépannage' },
]

function WindowsDocs() {
  const { toasts, addToast, removeToast } = useToast()
  const copy = () => addToast('Commande copiée !')
  const C = 'bg-blue-500/20 border-blue-500/30 text-blue-400'

  return (
    <div className="space-y-8">
      <Toast toasts={toasts} onRemove={removeToast} />

      <ArchitectureOverview />

      <div id="install">
        <StepTitle n={1} label="Installation de WireGuard" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          À effectuer sur votre <strong className="text-white">PC Windows</strong> (la machine locale, pas le VPS).
        </p>

        <div className="space-y-2 mb-5">
          <DownloadCard
            icon="🪟"
            title="WireGuard pour Windows (.exe)"
            subtitle="Installateur graphique officiel — wireguard.com"
            href="https://download.wireguard.com/windows-client/wireguard-installer.exe"
            tag="Recommandé"
          />
          <DownloadCard
            icon="🌐"
            title="Page officielle wireguard.com"
            subtitle="Toutes les versions, notes de release, vérification de signature"
            href="https://www.wireguard.com/install/"
            secondary
          />
        </div>

        <NoteBox type="ok" title="Interface graphique incluse">
          Le fichier .exe installe WireGuard avec une interface graphique complète. Pas de ligne de commande nécessaire pour l'installation.
        </NoteBox>

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">Alternative — installation silencieuse via PowerShell (Admin) :</p>
          <CodeBlock
            code={`$installer = "$env:TEMP\\wireguard-installer.exe"
Invoke-WebRequest -Uri "https://download.wireguard.com/windows-client/wireguard-installer.exe" -OutFile $installer
Start-Process $installer -ArgumentList "/S" -Wait
Remove-Item $installer -Force`}
            filename="💻 PC Client — PowerShell (Admin) — optionnel"
            language="powershell"
            onCopy={copy}
          />
        </div>

        <div className="mt-4">
          <NoteBox type="info" title="Et le VPS ?">
            Le VPS doit lui aussi être configuré — il tourne toujours sous <strong>Linux</strong>.
            Utilisez le script <code className="font-mono text-xs text-accent-cyan">setup-vps.sh</code> généré par le{' '}
            <a href="/config" className="text-accent-cyan underline">Générateur de config</a>, ou suivez la documentation
            Linux (onglet Debian/Ubuntu) pour la partie VPS, sections Installation et Configuration WireGuard.
          </NoteBox>
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration du tunnel WireGuard" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          Sur votre <strong className="text-white">PC Windows</strong> : dans l'interface WireGuard, cliquez sur{' '}
          <strong className="text-white">Ajouter un tunnel</strong> puis collez ou importez votre fichier{' '}
          <code className="font-mono text-xs text-accent-cyan bg-bg-elevated px-1.5 py-0.5 rounded">wg0-client.conf</code>.
        </p>
        <CodeBlock
          code={`[Interface]
PrivateKey = <VOTRE_CLE_PRIVEE_BASE64>   # clé privée du PC client (générée pour vous)
Address = 10.10.0.2/24                  # IP du client dans le tunnel VPN

[Peer]
PublicKey = <CLE_PUBLIQUE_SERVEUR_VPS>   # clé publique du VPS
Endpoint = <IP_VPS>:51820               # IP publique du VPS + port WireGuard
AllowedIPs = 10.10.0.1/32               # seul le trafic vers le VPS passe par le tunnel
PersistentKeepalive = 25`}
          filename="💻 PC Client — wg0-client.conf"
          language="ini"
          onCopy={copy}
        />
        <div className="mt-4 space-y-3">
          <NoteBox type="warn">
            La clé privée (<code className="font-mono text-xs">PrivateKey</code>) ne doit jamais être partagée. Elle reste uniquement sur votre PC.
            La clé publique (<code className="font-mono text-xs">PublicKey</code> du Peer) est celle du VPS — pas la vôtre.
          </NoteBox>
        </div>

        <div className="mt-5">
          <p className="text-xs text-slate-500 font-mono mb-2">Installer le tunnel comme service Windows (démarrage automatique) :</p>
          <CodeBlock
            code={`& "C:\Program Files\WireGuard\wireguard.exe" /installtunnelservice "C:\chemin\wg0-client.conf"

# Vérifier l'état du service
Get-Service -Name "WireGuardTunnel$wg0" | Select-Object Status, DisplayName`}
            filename="💻 PC Client — PowerShell (Admin)"
            language="powershell"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Pare-feu Windows" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          Sur votre <strong className="text-white">PC Windows</strong> : autoriser le trafic entrant sur les ports de vos services (les ports que vous souhaitez exposer via le VPS).
        </p>
        <NoteBox type="info" title="Pourquoi configurer le pare-feu Windows ?">
          Le VPS redirige le trafic entrant vers votre PC via le tunnel. Votre PC doit donc autoriser ce trafic sur les ports concernés, sinon Windows le bloquera.
        </NoteBox>
        <div className="mt-4">
          <CodeBlock
            code={`# Port TCP (ex: RDP 3389)
New-NetFirewallRule -DisplayName "WG-RDP" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow

# Port UDP (ex: FiveM 30120)
New-NetFirewallRule -DisplayName "WG-FiveM" -Direction Inbound -Protocol UDP -LocalPort 30120 -Action Allow

# Lister les règles WG créées
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "WG-*"} | Select-Object DisplayName, Enabled`}
            filename="💻 PC Client — PowerShell (Admin)"
            language="powershell"
            onCopy={copy}
          />
        </div>
        <div className="mt-3">
          <NoteBox type="tip" title="Via l'interface graphique">
            Panneau de configuration → Système et sécurité → Pare-feu Windows Defender → Règles de trafic entrant → Nouvelle règle
          </NoteBox>
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} machine="both" />

        <p className="text-slate-400 text-sm mb-3">Vérifications à faire <strong className="text-white">une fois le tunnel démarré</strong> des deux côtés (VPS configuré + client démarré).</p>

        <p className="text-xs text-slate-500 font-mono mb-2">Sur votre 💻 PC Windows :</p>
        <CodeBlock
          code={`# Statut du service WireGuard (doit afficher "Running")
Get-Service "WireGuardTunnel$wg0"

# Ping vers le VPS via le tunnel (doit répondre si les deux côtés sont up)
ping 10.10.0.1

# Test d'un port exposé (exemple RDP)
Test-NetConnection -ComputerName <IP_VPS_PUBLIQUE> -Port 3389`}
          filename="💻 PC Client — PowerShell"
          language="powershell"
          onCopy={copy}
        />

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">Sur le 🖥️ VPS (via SSH) :</p>
          <CodeBlock
            code={`# Affiche les peers connectés et le trafic échangé
wg show

# Vérifie les règles de redirection iptables
iptables -t nat -L PREROUTING -n -v`}
            filename="🖥️ VPS — bash"
            language="bash"
            onCopy={copy}
          />
        </div>

        <div className="mt-3">
          <NoteBox type="ok" title="Tunnel fonctionnel">
            Si <code className="font-mono text-xs">ping 10.10.0.1</code> répond depuis le PC Windows, le tunnel est opérationnel.
            Si <code className="font-mono text-xs">wg show</code> sur le VPS affiche votre PC comme peer avec un <em>latest handshake</em>, la connexion est établie.
          </NoteBox>
        </div>
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="💻 Client — Tunnel ne démarre pas">
            Vérifiez que la clé privée est en base64 valide (44 caractères) et que l'adresse IP du VPS est correcte.
          </NoteBox>
          <NoteBox type="warn" title="🖥️ VPS — Port 51820 inaccessible">
            Vérifiez que le port 51820/UDP est ouvert dans le pare-feu de votre hébergeur (règles de sécurité du VPS).
          </NoteBox>
          <NoteBox type="warn" title="💻 Client — Pas de connectivité réseau après connexion">
            Vérifiez que le service <strong>IP Helper</strong> est démarré dans les Services Windows (<code className="font-mono text-xs">services.msc</code>).
          </NoteBox>
          <NoteBox type="info" title="💻 Client — Logs WireGuard">
            Accessibles dans l'interface graphique WireGuard → onglet Log, ou via l'Observateur d'événements Windows.
          </NoteBox>
        </div>
      </div>
    </div>
  )
}

function LinuxDebianDocs() {
  const { toasts, addToast, removeToast } = useToast()
  const copy = () => addToast('Commande copiée !')
  const C = 'bg-accent-orange/20 border-accent-orange/30 text-accent-orange'

  return (
    <div className="space-y-8">
      <Toast toasts={toasts} onRemove={removeToast} />

      <ArchitectureOverview />

      <div id="install">
        <StepTitle n={1} label="Installation de WireGuard" color={C} machine="both" />
        <p className="text-slate-400 text-sm mb-4">
          Cette commande s'exécute <strong className="text-white">à la fois sur votre PC client Debian/Ubuntu ET sur le VPS</strong> si ce dernier tourne aussi sous Debian/Ubuntu.
        </p>

        <div className="space-y-2 mb-5">
          <DownloadCard
            icon="🐧"
            title="WireGuard via apt — Debian 12 / Ubuntu 22.04+"
            subtitle="Paquet officiel dans les dépôts — aucun dépôt tiers nécessaire"
            href="https://www.wireguard.com/install/#ubuntu-module-tools"
            tag="Recommandé"
          />
        </div>

        <CodeBlock
          code={`# À exécuter sur le PC client ET sur le VPS (si Debian/Ubuntu)
sudo apt update && sudo apt install -y wireguard wireguard-tools iptables-persistent netfilter-persistent

# Vérifier
wg --version`}
          filename="🖥️ VPS + 💻 PC Client — bash"
          language="bash"
          onCopy={copy}
        />
        <div className="mt-3">
          <NoteBox type="info" title="Ubuntu Desktop (PC Client uniquement)">
            Sur Ubuntu avec interface graphique, vous pouvez aussi installer le paquet <strong>network-manager-wireguard-gnome</strong> pour gérer le tunnel depuis les Paramètres réseau.
          </NoteBox>
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration du tunnel WireGuard" color={C} machine="both" />

        <p className="text-xs text-slate-500 font-mono mb-2">🖥️ VPS — Générer les clés du serveur :</p>
        <CodeBlock
          code={`# Sur le VPS : générer la paire de clés du serveur
sudo wg genkey | tee /etc/wireguard/server_privatekey | wg pubkey > /etc/wireguard/server_publickey

# Afficher la clé publique du VPS (à copier dans le fichier client)
cat /etc/wireguard/server_publickey`}
          filename="🖥️ VPS — bash"
          language="bash"
          onCopy={copy}
        />

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">💻 PC Client — Générer les clés du client :</p>
          <CodeBlock
            code={`# Sur le PC client : générer la paire de clés du client
sudo wg genkey | tee /etc/wireguard/privatekey | wg pubkey > /etc/wireguard/publickey

# Afficher la clé publique du client (à copier dans la config du VPS)
cat /etc/wireguard/publickey`}
            filename="💻 PC Client — bash"
            language="bash"
            onCopy={copy}
          />
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">🖥️ VPS — Fichier /etc/wireguard/wg0.conf :</p>
          <CodeBlock
            code={`[Interface]
PrivateKey = <CLE_PRIVEE_DU_VPS>   # contenu de server_privatekey
Address = 10.10.0.1/24             # IP du VPS dans le tunnel
ListenPort = 51820                 # port d'écoute (UDP)

[Peer]
PublicKey = <CLE_PUBLIQUE_CLIENT>  # contenu de publickey sur le PC client
AllowedIPs = 10.10.0.2/32          # IP autorisée pour ce client`}
            filename="🖥️ VPS — /etc/wireguard/wg0.conf"
            language="ini"
            onCopy={copy}
          />
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">💻 PC Client — Fichier /etc/wireguard/wg0.conf :</p>
          <CodeBlock
            code={`[Interface]
PrivateKey = <CLE_PRIVEE_DU_CLIENT>  # contenu de privatekey sur le PC client
Address = 10.10.0.2/24              # IP du client dans le tunnel

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>       # contenu de server_publickey sur le VPS
Endpoint = <IP_VPS>:51820           # IP publique du VPS + port WireGuard
AllowedIPs = 10.10.0.1/32           # seul le trafic vers le VPS passe par le tunnel
PersistentKeepalive = 25`}
            filename="💻 PC Client — /etc/wireguard/wg0.conf"
            language="ini"
            onCopy={copy}
          />
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">Démarrer le tunnel (sur chaque machine séparément) :</p>
          <CodeBlock
            code={`sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
sudo systemctl status wg-quick@wg0`}
            filename="🖥️ VPS + 💻 PC Client — bash (à faire sur les deux)"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="iptables et forwarding" color={C} machine="vps" />
        <NoteBox type="warn" title="Ces commandes sont UNIQUEMENT pour le VPS">
          Le PC client n'a pas besoin de règles iptables pour le tunnel. Ces règles permettent au VPS de rediriger le trafic entrant vers votre PC via le tunnel WireGuard.
        </NoteBox>
        <div className="mt-4">
          <CodeBlock
            code={`# 1. Activer le forwarding IP (autorise le VPS à router les paquets)
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# 2. Rediriger le trafic entrant vers le PC client via le tunnel
#    Remplacez eth0 par le nom de votre interface réseau (voir : ip link show)
#    10.10.0.2 = IP WireGuard du PC client

# Exemple : RDP port 3389
sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 3389 -j DNAT --to-destination 10.10.0.2:3389
sudo iptables -A FORWARD -p tcp -d 10.10.0.2 --dport 3389 -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT

# Masquerade : permet au PC client de répondre via le VPS
sudo iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o eth0 -j MASQUERADE

# 3. Sauvegarder les règles (persistent au redémarrage)
sudo netfilter-persistent save`}
            filename="🖥️ VPS UNIQUEMENT — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
        <div className="mt-3">
          <NoteBox type="tip" title="Trouver le nom de l'interface réseau du VPS">
            Lancez <code className="font-mono text-xs">ip link show</code> sur le VPS pour identifier l'interface principale.
            Elle peut s'appeler <code className="font-mono text-xs">eth0</code>, <code className="font-mono text-xs">ens3</code>, <code className="font-mono text-xs">enp1s0</code>, etc.
          </NoteBox>
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} machine="both" />

        <p className="text-xs text-slate-500 font-mono mb-2">🖥️ VPS :</p>
        <CodeBlock
          code={`# Affiche les peers connectés et le trafic
sudo wg show

# Vérifie les règles de redirection
sudo iptables -t nat -L PREROUTING -n -v`}
          filename="🖥️ VPS — bash"
          language="bash"
          onCopy={copy}
        />

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">💻 PC Client :</p>
          <CodeBlock
            code={`# Statut du tunnel
sudo wg show

# Ping vers le VPS via le tunnel (10.10.0.1 = IP WireGuard du VPS)
ping -c 3 10.10.0.1

# Test d'accessibilité d'un port exposé depuis l'extérieur
nc -zv <IP_VPS_PUBLIQUE> <PORT>`}
            filename="💻 PC Client — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="💻 Client — Clé invalide">
            Si WireGuard affiche "Invalid key length", la clé n'est pas en base64 valide (44 caractères attendus).
            Régénérez les clés avec <code className="font-mono text-xs">wg genkey | wg pubkey</code>.
          </NoteBox>
          <NoteBox type="warn" title="🖥️ VPS — Forwarding non activé">
            Si les ports sont redirigés mais inaccessibles, vérifiez : <code className="font-mono text-xs">cat /proc/sys/net/ipv4/ip_forward</code> — doit afficher <code className="font-mono text-xs">1</code>.
          </NoteBox>
          <NoteBox type="info" title="Logs en temps réel (sur chaque machine)">
            <code className="text-accent-cyan font-mono text-xs">journalctl -f -u wg-quick@wg0</code>
          </NoteBox>
        </div>
      </div>
    </div>
  )
}

function LinuxGenericDocs() {
  const { toasts, addToast, removeToast } = useToast()
  const copy = () => addToast('Commande copiée !')
  const C = 'bg-accent-purple/20 border-accent-purple/30 text-accent-purple'

  return (
    <div className="space-y-8">
      <Toast toasts={toasts} onRemove={removeToast} />

      <ArchitectureOverview />

      <div id="install">
        <StepTitle n={1} label="Installation selon votre distribution" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          À effectuer sur votre <strong className="text-white">PC client</strong>. Si votre VPS tourne aussi sous une de ces distros, installez WireGuard dessus également.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          <DownloadCard icon="🏔️" title="Fedora / RHEL / CentOS" subtitle="dnf install wireguard-tools" href="https://www.wireguard.com/install/#fedora-tools" tag="dnf" tagColor="text-blue-400 border-blue-400/30 bg-blue-400/10" />
          <DownloadCard icon="❄️" title="Alpine Linux" subtitle="apk add wireguard-tools" href="https://www.wireguard.com/install/#alpine-tools" tag="apk" tagColor="text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10" />
          <DownloadCard icon="🎯" title="Arch / Manjaro" subtitle="pacman -S wireguard-tools" href="https://wiki.archlinux.org/title/WireGuard" tag="pacman" tagColor="text-accent-purple border-accent-purple/30 bg-accent-purple/10" />
        </div>

        <CodeBlock
          code={`# Fedora / RHEL / CentOS Stream / AlmaLinux
sudo dnf install -y wireguard-tools

# Alpine Linux
sudo apk add --no-cache wireguard-tools

# Arch Linux / Manjaro
sudo pacman -Sy wireguard-tools

# openSUSE
sudo zypper install wireguard-tools`}
          filename="💻 PC Client — bash (choisissez votre distro)"
          language="bash"
          onCopy={copy}
        />
        <div className="mt-3">
          <NoteBox type="info" title="Noyau Linux">
            WireGuard est intégré au noyau depuis Linux 5.6. Vérifiez avec <code className="font-mono text-xs">uname -r</code> — si vous êtes en dessous de 5.6, installez aussi le module DKMS.
          </NoteBox>
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration du tunnel WireGuard" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          Toutes ces commandes sont à exécuter sur votre <strong className="text-white">PC client</strong>.
          La clé publique générée devra être ajoutée dans la config du VPS (section Peer).
        </p>
        <CodeBlock
          code={`# Générer les clés du client
wg genkey | tee privatekey | wg pubkey > publickey
chmod 600 privatekey

# Afficher la clé publique (à copier dans la config [Peer] du VPS)
cat publickey

mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << 'EOF'
[Interface]
PrivateKey = <COLLER_LE_CONTENU_DE_privatekey>
Address = 10.10.0.2/24              # IP du client dans le tunnel

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>      # clé publique du VPS (pas du client)
Endpoint = <IP_VPS>:51820          # IP publique du VPS + port WireGuard
AllowedIPs = 10.10.0.1/32          # seul le trafic vers le VPS passe par le tunnel
PersistentKeepalive = 25
EOF

chmod 600 /etc/wireguard/wg0.conf`}
          filename="💻 PC Client — bash"
          language="bash"
          onCopy={copy}
        />
        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">Démarrage du tunnel selon le système d'init :</p>
          <CodeBlock
            code={`# Systemd — Fedora, Arch et la plupart des distros modernes
systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0

# OpenRC — Alpine Linux
rc-update add wg-quick default && wg-quick up wg0

# Manuel (fonctionne partout)
wg-quick up /etc/wireguard/wg0.conf`}
            filename="💻 PC Client — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Forwarding IP et iptables" color={C} machine="vps" />
        <NoteBox type="warn" title="Ces commandes sont UNIQUEMENT pour le VPS">
          Le PC client n'a pas besoin de ces règles. Elles permettent au VPS de rediriger le trafic entrant vers votre PC via le tunnel.
        </NoteBox>
        <div className="mt-4">
          <CodeBlock
            code={`# Activer le forwarding IP
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/99-wireguard.conf
sysctl --system

# Rediriger les ports (exemple : port 3389 vers le PC client 10.10.0.2)
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 3389 -j DNAT --to-destination 10.10.0.2:3389
iptables -A FORWARD -p tcp -d 10.10.0.2 --dport 3389 -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT
iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -j MASQUERADE

# Sauvegarder les règles selon la distro du VPS
iptables-save > /etc/iptables/rules.v4   # Fedora / Arch
rc-service iptables save                 # Alpine`}
            filename="🖥️ VPS UNIQUEMENT — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} machine="both" />

        <p className="text-xs text-slate-500 font-mono mb-2">💻 PC Client :</p>
        <CodeBlock
          code={`# Statut du tunnel et peers connectés
wg show
ip addr show wg0

# Ping vers le VPS via le tunnel
ping -c 3 10.10.0.1`}
          filename="💻 PC Client — bash"
          language="bash"
          onCopy={copy}
        />

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">🖥️ VPS :</p>
          <CodeBlock
            code={`# Vérifie les peers WireGuard connectés
wg show

# Vérifie les règles de redirection iptables
iptables -t nat -L PREROUTING -n -v`}
            filename="🖥️ VPS — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="💻 Client — Module non chargé">
            Si WireGuard renvoie "Operation not supported", chargez le module manuellement : <code className="font-mono text-xs">sudo modprobe wireguard</code>
          </NoteBox>
          <NoteBox type="warn" title="🖥️ VPS — Forwarding non activé">
            Vérifiez : <code className="font-mono text-xs">cat /proc/sys/net/ipv4/ip_forward</code> — doit afficher <code className="font-mono text-xs">1</code>.
          </NoteBox>
          <NoteBox type="info" title="Logs (sur chaque machine)">
            Systemd : <code className="font-mono text-xs">journalctl -f -u wg-quick@wg0</code> — Alpine : <code className="font-mono text-xs">wg show</code>
          </NoteBox>
        </div>
      </div>
    </div>
  )
}

function MacOSDocs() {
  const { toasts, addToast, removeToast } = useToast()
  const copy = () => addToast('Commande copiée !')
  const C = 'bg-slate-500/20 border-slate-500/30 text-slate-300'

  return (
    <div className="space-y-8">
      <Toast toasts={toasts} onRemove={removeToast} />

      <ArchitectureOverview />

      <div id="install">
        <StepTitle n={1} label="Installation de WireGuard" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-4">
          À effectuer sur votre <strong className="text-white">Mac</strong> (la machine locale, pas le VPS).
        </p>

        <div className="space-y-2 mb-5">
          <DownloadCard
            icon={<Apple size={20} className="text-slate-300" />}
            title="WireGuard — App Store macOS"
            subtitle="Application officielle gratuite — gestion graphique des tunnels, permissions automatiques"
            href="https://apps.apple.com/fr/app/wireguard/id1451685025"
            tag="Recommandé"
          />
          <DownloadCard
            icon="🍺"
            title="Homebrew — wireguard-tools (ligne de commande)"
            subtitle="Pour les utilisateurs avancés — wg-quick, wg show, scripts"
            href="https://brew.sh"
            secondary
            tag="CLI"
            tagColor="text-slate-400 border-slate-400/30 bg-slate-400/10"
          />
        </div>

        <p className="text-xs text-slate-500 font-mono mb-2">Installation via Homebrew :</p>
        <CodeBlock
          code={`# Installer Homebrew si besoin (une seule fois)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer WireGuard outils CLI
brew install wireguard-tools

wg --version`}
          filename="💻 PC Client (Mac) — bash"
          language="bash"
          onCopy={copy}
        />

        <div className="mt-4">
          <NoteBox type="info" title="Et le VPS ?">
            Le VPS doit lui aussi être configuré — il tourne toujours sous <strong>Linux</strong>.
            Utilisez le script <code className="font-mono text-xs text-accent-cyan">setup-vps.sh</code> généré par le{' '}
            <a href="/config" className="text-accent-cyan underline">Générateur de config</a>, ou suivez la documentation
            Linux (onglet Debian/Ubuntu) pour la partie VPS.
          </NoteBox>
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration du tunnel WireGuard" color={C} machine="client" />
        <p className="text-slate-400 text-sm mb-3">
          Toutes ces étapes se font sur votre <strong className="text-white">Mac</strong>.<br />
          Via l'<strong className="text-white">App Store</strong> : ouvrez WireGuard → "+" → "Créer depuis zéro" ou "Importer depuis fichier ou archive".<br />
          Via <strong className="text-white">CLI (Homebrew)</strong> :
        </p>
        <CodeBlock
          code={`# Générer les clés du client Mac
wg genkey | tee privatekey | wg pubkey > publickey
chmod 600 privatekey

# Afficher la clé publique (à copier dans la config [Peer] du VPS)
cat publickey

mkdir -p /usr/local/etc/wireguard
cat > /usr/local/etc/wireguard/wg0.conf << 'EOF'
[Interface]
PrivateKey = <COLLER_LE_CONTENU_DE_privatekey>
Address = 10.10.0.2/24              # IP du Mac dans le tunnel

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>      # clé publique du VPS (pas du Mac)
Endpoint = <IP_VPS>:51820          # IP publique du VPS + port WireGuard
AllowedIPs = 10.10.0.1/32          # seul le trafic vers le VPS passe par le tunnel
PersistentKeepalive = 25
EOF

chmod 600 /usr/local/etc/wireguard/wg0.conf

# Démarrer / arrêter le tunnel
sudo wg-quick up /usr/local/etc/wireguard/wg0.conf
sudo wg-quick down /usr/local/etc/wireguard/wg0.conf`}
          filename="💻 PC Client (Mac) — bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Pare-feu et redirections" color={C} machine="vps" />
        <NoteBox type="info" title="Rien à faire sur le Mac côté iptables">
          Les règles iptables s'appliquent uniquement sur le <strong>VPS Linux</strong> — pas sur votre Mac.
          C'est le VPS qui reçoit les connexions depuis internet et les redirige vers votre Mac via le tunnel.
          Le pare-feu macOS est généralement transparent pour WireGuard.
        </NoteBox>
        <div className="mt-3">
          <NoteBox type="tip" title="Configuration iptables du VPS">
            Pour configurer les redirections de ports sur le VPS, référez-vous à la section iptables de la documentation Linux (onglet Debian/Ubuntu ou Fedora/Alpine/Arch selon votre VPS).
          </NoteBox>
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} machine="both" />

        <p className="text-xs text-slate-500 font-mono mb-2">💻 Mac :</p>
        <CodeBlock
          code={`# Statut du tunnel
sudo wg show

# Ping vers le VPS via le tunnel (10.10.0.1 = IP WireGuard du VPS)
ping -c 3 10.10.0.1

# Traceroute pour diagnostiquer le chemin
traceroute 10.10.0.1`}
          filename="💻 PC Client (Mac) — bash"
          language="bash"
          onCopy={copy}
        />

        <div className="mt-4">
          <p className="text-xs text-slate-500 font-mono mb-2">🖥️ VPS (via SSH) :</p>
          <CodeBlock
            code={`# Vérifie les peers connectés et le trafic
wg show

# Vérifie les règles de redirection iptables
iptables -t nat -L PREROUTING -n -v`}
            filename="🖥️ VPS — bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="💻 Mac — Permissions réseau">
            macOS demande d'autoriser l'extension réseau au premier lancement. Allez dans Réglages Système → Confidentialité et sécurité → autoriser WireGuard.
          </NoteBox>
          <NoteBox type="warn" title="🖥️ VPS — Port 51820 inaccessible">
            Vérifiez que le port 51820/UDP est ouvert dans les règles de sécurité de votre hébergeur VPS.
          </NoteBox>
          <NoteBox type="tip" title="Conseil — App Store">
            Avec l'App Store WireGuard, importez directement le fichier <code className="font-mono text-xs">.conf</code> généré par le Générateur de config de cet outil. Plus simple que la CLI.
          </NoteBox>
        </div>
      </div>
    </div>
  )
}

const docsMap: Record<OS, () => React.ReactElement> = {
  windows: WindowsDocs,
  'linux-debian': LinuxDebianDocs,
  'linux-other': LinuxGenericDocs,
  macos: MacOSDocs,
}

export function Docs() {
  const [activeOS, setActiveOS] = useState<OS>('windows')
  const [activeSection, setActiveSection] = useState('install')
  const DocComponent = docsMap[activeOS]

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const currentOS = osList.find((o) => o.id === activeOS)!

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-2">Documentation</h1>
        <p className="text-slate-400 text-sm">
          Guide d'installation WireGuard pour chaque système d'exploitation.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-6">
            {/* OS selector */}
            <div>
              <p className="text-xs text-slate-600 font-mono uppercase tracking-widest mb-2">Système</p>
              <div className="space-y-1">
                {osList.map((os) => {
                  const Icon = os.icon
                  return (
                    <button
                      key={os.id}
                      onClick={() => setActiveOS(os.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all duration-200
                        ${activeOS === os.id
                          ? `bg-bg-elevated border ${os.borderColor} ${os.color}`
                          : 'text-slate-500 hover:text-slate-300 hover:bg-bg-surface'
                        }`}
                    >
                      <Icon size={14} />
                      {os.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section navigator */}
            <div>
              <p className="text-xs text-slate-600 font-mono uppercase tracking-widest mb-2">Sections</p>
              <div className="space-y-1">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors
                      ${activeSection === s.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <ChevronRight size={10} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* OS header */}
          <div className={`border ${currentOS.borderColor} rounded-xl p-4 mb-6 bg-bg-surface flex items-center justify-between flex-wrap gap-3`}>
            <div className="flex items-center gap-3">
              <currentOS.icon size={20} className={currentOS.color} />
              <div>
                <h2 className={`font-bold ${currentOS.color} text-base`}>{currentOS.label}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{currentOS.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentOS.badgeVariant}>{currentOS.badge}</Badge>
              <span className="flex items-center gap-1 text-xs text-accent-green border border-accent-green/20 bg-accent-green/5 px-2 py-0.5 rounded-full">
                <CheckCircle size={10} />
                Testé
              </span>
            </div>
          </div>

          {/* Mobile OS selector */}
          <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
            {osList.map((os) => {
              const Icon = os.icon
              return (
                <button
                  key={os.id}
                  onClick={() => setActiveOS(os.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-all
                    ${activeOS === os.id
                      ? `${os.borderColor} ${os.color} bg-bg-elevated`
                      : 'border-bg-border text-slate-500'
                    }`}
                >
                  <Icon size={12} />
                  {os.label}
                </button>
              )
            })}
          </div>

          <div className="animate-fade-in">
            <DocComponent />
          </div>
        </div>
      </div>
    </div>
  )
}
