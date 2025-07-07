# ePack Tools

Ce dépôt regroupe divers outils destinés à faciliter l'intégration et le suivi de solutions ePack Manager.
Il se compose de deux parties principales :

- **extension-chrome/** : une extension Google Chrome pour automatiser la création
  de solutions et d'utilisateurs à partir des données récupérées dans Odoo.
- **reverseproxy/** : un petit serveur Node.js faisant office de proxy pour
  l'API BluConsole. Il est utilisé par l'extension pour la vérification des
  sondes et hubs.

Chaque répertoire contient un fichier `README.md` décrivant son fonctionnement en

détail.

## Démarrage rapide

1. Cloner ce dépôt :
   ```bash
   git clone <repo>
   cd ePackTools
   ```
2. (Optionnel) Lancer le proxy via Docker :
   ```bash
   docker-compose up -d
   ```
   Le proxy sera alors disponible sur `http://localhost:4002`.
3. Installer l'extension Chrome en mode développeur et suivre la documentation
   du dossier [extension-chrome](extension-chrome/README.md).

## Documentation

- [extension-chrome/README.md](extension-chrome/README.md)
- [reverseproxy/README.md](reverseproxy/README.md)
