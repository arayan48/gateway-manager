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

function StepTitle({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <span className={`w-6 h-6 rounded text-xs flex items-center justify-center font-bold border ${color}`}>{n}</span>
      {label}
    </h3>
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

      <div id="install">
        <StepTitle n={1} label="Installation" color={C} />

        {/* Téléchargements en évidence */}
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
            filename="PowerShell (Admin) — optionnel"
            language="powershell"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration WireGuard" color={C} />
        <p className="text-slate-400 text-sm mb-4">
          Dans l'interface WireGuard : cliquez sur <strong className="text-white">Ajouter un tunnel</strong> puis collez ou importez votre fichier <code className="font-mono text-xs text-accent-cyan bg-bg-elevated px-1.5 py-0.5 rounded">wg0-client.conf</code>.
        </p>
        <CodeBlock
          code={`[Interface]
PrivateKey = <VOTRE_CLE_PRIVEE_BASE64>
Address = 10.10.0.2/24

[Peer]
PublicKey = <CLE_PUBLIQUE_SERVEUR_VPS>
Endpoint = <IP_VPS>:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25`}
          filename="wg0-client.conf"
          language="ini"
          onCopy={copy}
        />
        <div className="mt-4 space-y-3">
          <NoteBox type="warn">
            La clé privée ne doit jamais être partagée. Elle reste uniquement sur votre machine.
          </NoteBox>
        </div>

        <div className="mt-5">
          <p className="text-xs text-slate-500 font-mono mb-2">Installer le tunnel comme service Windows (démarrage automatique) :</p>
          <CodeBlock
            code={`& "C:\Program Files\WireGuard\wireguard.exe" /installtunnelservice "C:\chemin\wg0-client.conf"

# Vérifier l'état du service
Get-Service -Name "WireGuardTunnel$wg0" | Select-Object Status, DisplayName`}
            filename="PowerShell (Admin)"
            language="powershell"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Pare-feu Windows" color={C} />
        <p className="text-slate-400 text-sm mb-4">
          Ouvrir les ports dans le pare-feu pour autoriser le trafic entrant via le tunnel.
        </p>
        <CodeBlock
          code={`# Port TCP (ex: RDP 3389)
New-NetFirewallRule -DisplayName "WG-RDP" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow

# Port UDP (ex: FiveM 30120)
New-NetFirewallRule -DisplayName "WG-FiveM" -Direction Inbound -Protocol UDP -LocalPort 30120 -Action Allow

# Lister les règles WG créées
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "WG-*"} | Select-Object DisplayName, Enabled`}
          filename="PowerShell (Admin)"
          language="powershell"
          onCopy={copy}
        />
        <div className="mt-3">
          <NoteBox type="tip" title="Via l'interface graphique">
            Panneau de configuration → Système et sécurité → Pare-feu Windows Defender → Règles de trafic entrant → Nouvelle règle
          </NoteBox>
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} />
        <CodeBlock
          code={`# Statut du service WireGuard
Get-Service "WireGuardTunnel$wg0"

# Ping vers le VPS via le tunnel
ping 10.10.0.1

# Test de port spécifique
Test-NetConnection -ComputerName 10.10.0.1 -Port 51820`}
          filename="PowerShell"
          language="powershell"
          onCopy={copy}
        />
        <div className="mt-3">
          <NoteBox type="ok" title="Succès">
            Si le ping vers 10.10.0.1 répond, le tunnel WireGuard est fonctionnel.
          </NoteBox>
        </div>
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="Tunnel ne démarre pas">
            Vérifiez que le port 51820/UDP est ouvert sur le VPS et que la clé privée est en base64 valide (44 caractères).
          </NoteBox>
          <NoteBox type="warn" title="Pas de connectivité">
            Vérifiez que le service <strong>IP Helper</strong> est démarré dans les Services Windows (services.msc).
          </NoteBox>
          <NoteBox type="info" title="Logs WireGuard">
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

      <div id="install">
        <StepTitle n={1} label="Installation" color={C} />

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
          code={`# Installation en ligne de commande
sudo apt update && sudo apt install -y wireguard wireguard-tools iptables-persistent netfilter-persistent

# Vérifier
wg --version`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
        <div className="mt-3">
          <NoteBox type="info" title="Ubuntu Desktop">
            Sur Ubuntu avec interface graphique, vous pouvez aussi installer le paquet <strong>network-manager-wireguard-gnome</strong> pour gérer le tunnel depuis les Paramètres réseau.
          </NoteBox>
        </div>
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration WireGuard" color={C} />
        <p className="text-slate-400 text-sm mb-4">Génération des clés et configuration du fichier wg0.conf :</p>
        <CodeBlock
          code={`# Générer les clés
sudo wg genkey | tee /etc/wireguard/privatekey | wg pubkey > /etc/wireguard/publickey

# Afficher les clés (privatekey = secret, publickey = à partager avec le VPS)
cat /etc/wireguard/privatekey
cat /etc/wireguard/publickey`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
        <div className="mt-4">
          <CodeBlock
            code={`[Interface]
PrivateKey = <VOTRE_CLE_PRIVEE>
Address = 10.10.0.2/24

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>
Endpoint = <IP_VPS>:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25`}
            filename="/etc/wireguard/wg0.conf"
            language="ini"
            onCopy={copy}
          />
        </div>
        <div className="mt-4">
          <CodeBlock
            code={`sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
sudo systemctl status wg-quick@wg0`}
            filename="bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="iptables et forwarding (sur le VPS)" color={C} />
        <NoteBox type="info">
          Ces commandes sont à exécuter sur le VPS Linux, pas sur le client Debian/Ubuntu.
        </NoteBox>
        <div className="mt-4">
          <CodeBlock
            code={`# Activer le forwarding IP
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Règles de redirection (exemple : RDP port 3389)
sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 3389 -j DNAT --to-destination 10.10.0.2:3389
sudo iptables -A FORWARD -p tcp -d 10.10.0.2 --dport 3389 -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT
sudo iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o eth0 -j MASQUERADE

sudo netfilter-persistent save`}
            filename="bash — VPS"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} />
        <CodeBlock
          code={`sudo wg show
sudo iptables -t nat -L PREROUTING -n -v
ping -c 3 10.10.0.1
nc -zv <IP_VPS> 3389`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="Clé invalide">
            Si WireGuard affiche "Invalid key length", la clé n'est pas en base64 valide (44 caractères attendus).
          </NoteBox>
          <NoteBox type="info" title="Logs en temps réel">
            <code className="text-accent-cyan font-mono text-xs">journalctl -f -u wg-quick@wg0</code>
          </NoteBox>
          <NoteBox type="tip">
            Vérifiez le nom de l'interface réseau principale : <code className="font-mono text-xs">ip link show</code> — peut être <code className="font-mono text-xs">ens3</code>, <code className="font-mono text-xs">enp1s0</code>, etc. à la place de <code className="font-mono text-xs">eth0</code>.
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

      <div id="install">
        <StepTitle n={1} label="Installation selon votre distribution" color={C} />

        {/* Cartes par distro */}
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
          filename="bash — choisissez votre distro"
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
        <StepTitle n={2} label="Configuration WireGuard" color={C} />
        <CodeBlock
          code={`# Générer les clés
wg genkey | tee privatekey | wg pubkey > publickey
chmod 600 privatekey

mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << 'EOF'
[Interface]
PrivateKey = <COLLER_LE_CONTENU_DE_privatekey>
Address = 10.10.0.2/24

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>
Endpoint = <IP_VPS>:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
EOF

chmod 600 /etc/wireguard/wg0.conf`}
          filename="bash"
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
            filename="bash"
            language="bash"
            onCopy={copy}
          />
        </div>
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Forwarding IP (sur le VPS)" color={C} />
        <CodeBlock
          code={`echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/99-wireguard.conf
sysctl --system

iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -j MASQUERADE

# Sauvegarder selon la distro
iptables-save > /etc/iptables/rules.v4   # Fedora / Arch
rc-service iptables save                 # Alpine`}
          filename="bash — VPS"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} />
        <CodeBlock
          code={`wg show
ip addr show wg0
ping -c 3 10.10.0.1`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="Module non chargé">
            Si WireGuard renvoie "Operation not supported", lancez : <code className="font-mono text-xs">sudo modprobe wireguard</code>
          </NoteBox>
          <NoteBox type="info" title="Logs">
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

      <div id="install">
        <StepTitle n={1} label="Installation" color={C} />

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
          filename="bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="wireguard">
        <StepTitle n={2} label="Configuration WireGuard" color={C} />
        <p className="text-slate-400 text-sm mb-3">
          Via l'<strong className="text-white">App Store</strong> : ouvrez WireGuard → "+" → "Créer depuis zéro" ou "Importer depuis fichier ou archive".
          <br />Via <strong className="text-white">CLI</strong> :
        </p>
        <CodeBlock
          code={`# Générer les clés
wg genkey | tee privatekey | wg pubkey > publickey
chmod 600 privatekey

mkdir -p /usr/local/etc/wireguard
cat > /usr/local/etc/wireguard/wg0.conf << 'EOF'
[Interface]
PrivateKey = <COLLER_LE_CONTENU_DE_privatekey>
Address = 10.10.0.2/24

[Peer]
PublicKey = <CLE_PUBLIQUE_VPS>
Endpoint = <IP_VPS>:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
EOF

chmod 600 /usr/local/etc/wireguard/wg0.conf

# Démarrer / arrêter
sudo wg-quick up /usr/local/etc/wireguard/wg0.conf
sudo wg-quick down /usr/local/etc/wireguard/wg0.conf`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="iptables">
        <StepTitle n={3} label="Pare-feu macOS" color={C} />
        <NoteBox type="info">
          Sur macOS client, les règles iptables ne s'appliquent pas — c'est le VPS Linux qui gère les redirections. Le pare-feu macOS est généralement transparent pour WireGuard.
        </NoteBox>
      </div>

      <div id="verify">
        <StepTitle n={4} label="Vérification" color={C} />
        <CodeBlock
          code={`sudo wg show
ping -c 3 10.10.0.1
traceroute 10.10.0.1`}
          filename="bash"
          language="bash"
          onCopy={copy}
        />
      </div>

      <div id="troubleshoot">
        <StepTitle n={5} label="Dépannage" color={C} />
        <div className="space-y-3">
          <NoteBox type="warn" title="Permissions réseau">
            macOS demande d'autoriser l'extension réseau au premier lancement. Allez dans Réglages Système → Confidentialité et sécurité → autoriser WireGuard.
          </NoteBox>
          <NoteBox type="tip">
            Avec l'App Store WireGuard, importez directement le fichier <code className="font-mono text-xs">.conf</code> généré par le Générateur de config de cet outil.
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
