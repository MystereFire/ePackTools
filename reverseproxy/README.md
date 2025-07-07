# Reverse Proxy BluConsole

Ce répertoire contient un petit serveur Node.js (Express) qui fait office de
proxy entre l'extension Chrome et l'API BluConsole. Son objectif principal est
de contourner les restrictions CORS et de simplifier l'authentification.

## Fonctionnalités

- `POST /login` : envoie les identifiants à `https://api.bluconsole.com/login/`
  et renvoie le token, le refresh token ainsi que les informations utilisateur.
- `GET /verifier-sonde` : vérifie l'état d'une sonde en appelant
  `https://api.bluconsole.com/measurements/rf/`.
- `GET /verifier-hub` : vérifie l'état d'un hub via
  `https://api.bluconsole.com/hubs/`.

Les requêtes sont loguées en console avec l'heure et un niveau (info, warn,
error, success).

## Lancement

### Avec Node.js

```bash
cd reverseproxy
npm install
node server.js
```

Le service écoute alors sur le port `4002`.

### Avec Docker

```bash
docker build -t epack-proxy .
docker run -p 4002:4002 epack-proxy
```

Il est également possible d'utiliser `docker-compose` à la racine du projet :

```bash
docker-compose up -d
```

## Variables

Aucune variable d'environnement n'est requise par défaut. Le port peut être
ajusté en modifiant la constante `port` dans `server.js` si besoin.
