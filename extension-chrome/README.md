# Extension Chrome ePack Tools

Cette extension automatise plusieurs tâches réalisées dans le backoffice
`backoffice.epack-manager.com` à partir des données collectées sur Odoo.
Elle permet notamment :

- création automatique de **solutions** et d'**utilisateurs** ;
- ouverture rapide des **paramètres** liés à une zone ;
- association d'une solution à des paramètres et à un utilisateur ;
- vérification de **sondes** et de **hubs** directement via l'API BluConsole intégrée.

La collecte des données (client, manager, paramètres) se fait en arrière‑plan
par interception des requêtes réseau envoyées par Odoo lors de la
consultation d'un devis. Les informations sont stockées dans `chrome.storage` et
présentées dans la fenêtre popup de l'extension.

## Structure du code

Le code de l'extension est maintenant découpé en modules ES6 commentés :

- `popup.js` : logique principale du popup, important les modules ci‑dessous.
- `scripts/popup-ui.js` : fonctions d'affichage (loader, messages, etc.).
- `scripts/sondes.js` : vérification et authentification des sondes BluConsole.
- `scripts/storage.js` : helpers autour de `chrome.storage`.
- `scripts/api.js` : appels réseau vers Odoo pour récupérer clients/managers et paramètres.
- `scripts/utils.js` : utilitaires généraux (normalisation, langues, cookies...).
- `logger.js` : petit logger coloré utilisé par le service worker et le popup.
- un badge de version (dans `popup.html`/`popup.js`) compare automatiquement la version locale
  à celle publiée sur GitHub et avertit l'utilisateur quand une mise à jour est disponible.

Tous ces fichiers utilisent désormais la syntaxe `import`/`export` et sont
documentés par des commentaires JSDoc pour faciliter la compréhension.

## Installation

1. Ouvrir Chrome et activer le **mode développeur** dans la page
   `chrome://extensions`.
2. Cliquer sur **"Charger l'extension non empaquetée"** et sélectionner le dossier
   `extension-chrome` du dépôt.
3. L'icône "ePack Tools" apparaît alors dans la barre d'outils.

## Utilisation rapide

- **Créer la solution** : crée une ou plusieurs solutions dans ePack Manager en se
  basant sur les données du client.
- **Créer l'utilisateur** : crée le manager détecté comme utilisateur ePack
  Manager en choisissant automatiquement la langue selon le pays du client
  détecté.
- **Pays détecté** : affiche également le pays du client et du manager à partir
  du champ `country_id` d'Odoo.
- **Ouvrir le param** : ouvre directement les paramètres correspondant à la zone
  détectée.
- **Tout créer / connecter** : enchaîne automatiquement la création des
  solutions, de l'utilisateur puis l'association des paramètres.
- **Vérifier les sondes** : onglet accessible depuis l'icône du thermomètre pour
  se connecter via le proxy et tester une liste d'identifiants.

La section sondes communique maintenant directement avec l'API BluConsole et ne dépend plus d'un reverse proxy externe.

Pour plus de détails sur chaque fonctionnalité et le fonctionnement interne,
se référer aux commentaires dans le code source (`popup.js`, `background.js`,
`scripts/*`).
