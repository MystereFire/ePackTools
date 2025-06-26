const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./logger');

const app = express();
const port = 4002;

// ❤️ Health check route
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    db: 'unknown'
  };

  return res.status(200).json(health);
});

// ✅ Middleware CORS global
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
app.options('*', (req, res) => res.sendStatus(200));

app.use(bodyParser.json());

// 🧾 Logger Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});


// 🔐 Login Bluconsole
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    logger.warn('Email ou mot de passe manquant');
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const response = await axios.post('https://api.bluconsole.com/login/', {
      Email: email,
      Password: password
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data?.Result?.Token) {
      logger.success(`Login réussi pour ${email}`);
      return res.json({
        token: response.data.Result.Token,
        refreshToken: response.data.Result.RefreshToken,
        user: response.data.Result.UserData
      });
    } else {
      logger.warn('Login refusé');
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
  } catch (err) {
    logger.error(`Erreur login: ${err.message}`);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// 📡 Vérifier une sonde
app.get('/verifier-sonde', async (req, res) => {
  const { id, token, rtoken } = req.query;

  if (!id || !token || !rtoken) {
    logger.warn('Données manquantes (sonde)');
    return res.status(400).json({ error: 'LoggerSerialNumber, token et rtoken requis.' });
  }

  try {
    const response = await axios.get(
      `https://api.bluconsole.com/measurements/rf/?ItemsPerPage=15&Page=1&SortBy=MaintenanceMode&Sort=DESC&Status=active&LoggerSerialNumber=${encodeURIComponent(id)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-console-language': 'fr',
          'x-time-zone': 'Europe/Paris',
          'Cookie': `token=${token}; rtoken=${rtoken}`
        }
      }
    );
    logger.info(`Vérification sonde ${id} → ${response.data?.Result?.Rows?.length || 0} résultat(s)`);
    return res.json(response.data);
  } catch (err) {
    logger.error(`Erreur sonde ${id}: ${err.message}`);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// 📡 Vérifier un hub
app.get('/verifier-hub', async (req, res) => {
  const { id, token, rtoken } = req.query;

  if (!id || !token || !rtoken) {
    logger.warn('Données manquantes (hub)');
    return res.status(400).json({ error: 'LoggerSerialNumber, token et rtoken requis.' });
  }

  try {
    const response = await axios.get(
      `https://api.bluconsole.com/hubs/?SerialNumber=${encodeURIComponent(id)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-console-language': 'fr',
          'x-time-zone': 'Europe/Paris',
          'Cookie': `token=${token}; rtoken=${rtoken}`
        }
      }
    );
    logger.info(`Vérification hub ${id} → ${response.data?.Result?.Rows?.length || 0} résultat(s)`);
    return res.json(response.data);
  } catch (err) {
    logger.error(`Erreur hub ${id}: ${err.message}`);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// ▶️ Lancement
app.listen(port, () => {
  logger.success(`Proxy Bluconsole en ligne : http://localhost:${port}`);
});
