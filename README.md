# GatewayManager

Outil de configuration de passerelle VPS → serveur local via WireGuard + iptables.

```bash
cd gateway-manager
npm install       # première fois seulement
npm run dev       # lance le serveur de dev → http://localhost:5173
npm run build     # build de production dans /dist
npm run preview   # prévisualiser le build
```

Pages : `/` Accueil · `/docs` Documentation · `/ports` Gestionnaire de ports · `/config` Générateur de config + export ZIP

## Ce que génère l'outil

- **IP réelle des visiteurs** (option, activée par défaut) : les services du PC local (FiveM/txAdmin, Coolify/Traefik, fail2ban…) voient l'IP de la personne connectée, pas celle du VPS. Sous Linux, seules les réponses repassent par le tunnel (routage par marque de connexion, compatible Docker) ; sous Windows/macOS l'option passe en tunnel complet.
- **Règles VPS dans des chaînes dédiées** (`GM_*`), appliquées/retirées par `wg-quick` (PostUp/PostDown) : relancer `setup-vps.sh` remplace la config sans doublon, sans jamais vider les règles Docker/ufw, et tout survit au redémarrage.
- **Ports avancés** : plages (`27015-27030`), port public ≠ port local (`2222 → 22`), restriction par IP/CIDR.
- **Tous les ports** (Coolify) : SSH (port détecté) et le port WireGuard restent servis par le VPS.
- **`sudo gm-status`** sur le VPS : tunnel, dernier handshake, compteurs par redirection.
- **`uninstall-vps.sh`** : désinstallation propre.
- Options : MTU, keepalive. Interface réseau détectée automatiquement (eth0, ens3, ens6…).
