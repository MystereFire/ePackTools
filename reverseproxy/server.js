const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = 4002;

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
  console.log(`${chalk.gray(new Date().toISOString())} ${chalk.cyan(req.method)} ${chalk.white(req.originalUrl)} ${chalk.yellow('from')} ${chalk.magenta(req.ip)}`);
  next();
});


// 🔐 Login Bluconsole
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.warn(chalk.yellow("⚠️  Email ou mot de passe manquant"));
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
      console.log(chalk.green(`✅ Login réussi pour ${email}`));
      return res.json({
        token: response.data.Result.Token,
        refreshToken: response.data.Result.RefreshToken,
        user: response.data.Result.UserData
      });
    } else {
      console.warn(chalk.red("❌ Login refusé"));
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
  } catch (err) {
    console.error(chalk.red("🔥 Erreur login:"), err.message);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// 📡 Vérifier une sonde
app.get('/api/verifier-sonde', async (req, res) => {
  const { id, token, rtoken } = req.query;

  if (!id || !token || !rtoken) {
    console.warn(chalk.yellow("⚠️  Données manquantes (sonde)"));
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
    console.log(chalk.magenta(`🔎 Vérification sonde ${id} → ${response.data?.Result?.Rows?.length || 0} résultat(s)`));
    return res.json(response.data);
  } catch (err) {
    console.error(chalk.red(`🔥 Erreur sonde ${id}`), err.message);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// 📡 Vérifier un hub
app.get('/api/verifier-hub', async (req, res) => {
  const { id, token, rtoken } = req.query;

  if (!id || !token || !rtoken) {
    console.warn(chalk.yellow("⚠️  Données manquantes (hub)"));
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
    console.log(chalk.blue(`📡 Vérification hub ${id} → ${response.data?.Result?.Rows?.length || 0} résultat(s)`));
    return res.json(response.data);
  } catch (err) {
    console.error(chalk.red(`🔥 Erreur hub ${id}`), err.message);
    return res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});

// ▶️ Lancement
app.listen(port, () => {
  console.log(chalk.bold.green(`🚀 Proxy Bluconsole en ligne : http://localhost:${port}`));
});
