# ePack Tools

Ce dépôt regroupe divers outils destinés à faciliter l'intégration et le suivi de solutions ePack Manager.
Il se compose de deux parties principales :

- **extension-chrome/** : une extension Google Chrome pour automatiser la création
  de solutions et d'utilisateurs à partir des données récupérées dans Odoo.
- **reverseproxy/** : ancien serveur Node.js faisant office de proxy pour
  l'API BluConsole. L'extension communique désormais directement avec BluConsole,
  ce dossier est conservé pour référence ou dépannage ponctuel.

Chaque répertoire contient un fichier `README.md` décrivant son fonctionnement en

détail.

## Démarrage rapide

1. Cloner ce dépôt :
   ```bash
   git clone <repo>
   cd ePackTools
   ```
2. Installer l'extension Chrome en mode développeur et suivre la documentation
   du dossier [extension-chrome](extension-chrome/README.md).

## Documentation

- [extension-chrome/README.md](extension-chrome/README.md)
- [reverseproxy/README.md](reverseproxy/README.md)
