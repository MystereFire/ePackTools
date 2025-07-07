# Extension Chrome ePack Tools

Cette extension automatise plusieurs tâches réalisées dans le backoffice
`backoffice.epack-manager.com` à partir des données collectées sur Odoo.
Elle permet notamment :

- création automatique de **solutions** et d'**utilisateurs** ;
- ouverture rapide des **paramètres** liés à une zone ;
- association d'une solution à des paramètres et à un utilisateur ;
- vérification de **sondes** et de **hubs** via le proxy BluConsole.

La collecte des données (client, manager, paramètres) se fait en arrière‑plan
par interception des requêtes réseau envoyées par Odoo lors de la
consultation d'un devis. Les informations sont stockées dans `chrome.storage` et
présentées dans la fenêtre popup de l'extension.

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
  Manager.
- **Ouvrir le param** : ouvre directement les paramètres correspondant à la zone
  détectée.
- **Tout créer / connecter** : enchaîne automatiquement la création des
  solutions, de l'utilisateur puis l'association des paramètres.
- **Vérifier les sondes** : onglet accessible depuis l'icône du thermomètre pour
  se connecter via le proxy et tester une liste d'identifiants.

La section sondes nécessite que le **reverse proxy** soit lancé (voir
[../reverseproxy](../reverseproxy/README.md)).

Pour plus de détails sur chaque fonctionnalité et le fonctionnement interne,
se référer aux commentaires dans le code source (`popup.js`, `background.js`,
`scripts/*`).
