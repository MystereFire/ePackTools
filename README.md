# ePack Tools (Chrome Extension)

Extension Chrome pour accelerer la creation et la maintenance des solutions ePack Manager directement depuis le backoffice Odoo/ePack. Elle automatise la collecte des donnees (client, manager, parametres) et expose un ensemble d'actions dans le popup de l'extension.

## Fonctionnalites principales

- Creation de solutions V4/V5 et d'utilisateurs ePack Manager en un clic.
- Association automatique des parametres detectes au sein d'Odoo.
- Onglet "Sondes" permettant de verifier l'etat des sondes/hubs BluConsole et de recuperer leur stock.
- Authentification BluConsole integree pour tous les appels BluConsole.
- Badge de version indiquant la version locale et notification lorsqu'une mise a jour GitHub est disponible.

## Organisation du code

- `manifest.json` : declaration principale de l'extension (permissions, scripts, version).
- `background.js` : service worker (alarms, interceptions webRequest, etc.).
- `popup.html` / `popup.css` / `popup.js` : interface utilisateur, notifications, logique principale.
- `scripts/` :
  - `api.js` : appels reseau vers Odoo.
  - `bluconsole.js` : client BluConsole (login, cookies, requetes).
  - `odoo-stock.js`, `popup-ui.js`, `sondes.js`, `storage.js`, `utils.js`, etc.
- `icons/` : ressources graphiques.
- `logger.js` : logger minimaliste utilise dans le popup et le background.

## Installation

1. Cloner le depot puis se placer a la racine `ePackTools`.
2. Ouvrir `chrome://extensions`, activer le mode developpeur.
3. Cliquer sur **Charger l'extension non empaquetee** et selectionner la racine du depot.

## Usage rapide

- Les boutons principaux (V4, V5, utilisateur, etc.) s'appuient sur les donnees collectees automatiquement lors de la navigation dans Odoo.
- Le bouton engrenage ouvre le panneau de parametrage (identifiants BluConsole + Odoo).
- L'onglet **Sondes** permet de tester plusieurs IDs de sondes/hubs et d'afficher une progression pendant les requetes.
- Le badge en haut a gauche affiche la version locale et devient orange lorsqu'une version plus recente est publiee sur GitHub (une notification toast est egalement affichee).

## Developpement

- Le code est ecrit en modules ES et commente (JSDoc) pour faciliter la maintenance.
- Les donnees utilisateur sont conservees via `chrome.storage`.
- Les requetes BluConsole utilisent les cookies enregistrés par l'extension (via `chrome.cookies`).

N'hesitez pas a ouvrir une PR/issue pour toute amelioration ou bug trouve.
