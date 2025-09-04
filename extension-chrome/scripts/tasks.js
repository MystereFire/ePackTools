/**
 * Background tasks for long running operations.
 * These functions can be executed by the service worker and will
 * continue even if the popup window is closed.
 */

// Utility to send status updates to popup
function sendStatus(message, level = 'info', finished = false) {
  chrome.runtime.sendMessage({ type: 'status', message, level, finished });
}

// --- Utilities copied from popup.js but without DOM dependencies ---

function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '')
    .toLowerCase();
}

function integratorKey(name) {
  if (!name) return '';
  const cleanName = name.replace(/_/g, ' ').trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) {
    return normalizeText(parts[0]);
  }
  const prenomInitial = parts[0][0] || '';
  const nom = parts.slice(1).join('');
  return normalizeText(prenomInitial + nom);
}

function keysMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function getBOSSID() {
  return new Promise((resolve) => {
    chrome.cookies.get(
      { url: 'https://backoffice.epack-manager.com', name: 'BOSSID' },
      (cookie) => resolve(cookie ? cookie.value : null)
    );
  });
}

function fetchWithCookie(url, method, BOSSID, headers = {}, body = null) {
  // When running in the service worker we cannot set the `Cookie` header
  // manually. Instead rely on Chrome to include existing cookies by using
  // the `credentials: "include"` option. The BOSSID value is still fetched
  // beforehand to ensure the session exists.
  return fetch(url, {
    method,
    credentials: "include",
    headers: {
      ...headers,
    },
    body,
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function splitName(name) {
  const parts = name.split(' ');
  const prenom = parts.find((part) => part[0] === part[0].toUpperCase());
  const nom = parts.filter((part) => part !== prenom).join(' ').toUpperCase();
  return { nom, prenom };
}

function getLangId(code) {
  const map = {
    fr_FR: '1',
    en_US: '2',
    en_GB: '2',
    it_IT: '3',
    de_DE: '4',
    pt_PT: '5',
    pt_BR: '5',
    es_ES: '6',
    pl_PL: '7',
    ca_ES: '8',
    nl_NL: '9',
    zh_CN: '10',
    zh_TW: '10',
    ar_SY: '11',
    ar_EG: '11',
    ar: '11',
    el_GR: '12',
  };
  return map[code] || '1';
}

function getLangFromCountry(country) {
  const map = {
    France: 'fr_FR',
    Belgique: 'fr_FR',
    Suisse: 'fr_FR',
    Canada: 'en_US',
    'États-Unis': 'en_US',
    'Royaume-Uni': 'en_GB',
    Espagne: 'es_ES',
    Italie: 'it_IT',
    Allemagne: 'de_DE',
    Portugal: 'pt_PT',
    Brésil: 'pt_BR',
    'Pays-Bas': 'nl_NL',
    Pologne: 'pl_PL',
    Chine: 'zh_CN',
    Grèce: 'el_GR',
    'Arabie saoudite': 'ar_SY',
    Égypte: 'ar_EG',
    'Émirats arabes unis': 'ar_SY',
  };
  return map[country] || 'fr_FR';
}

// Extraire la valeur d'un champ hidden depuis du HTML brut.
// L'extraction par regex doit gérer les variations d'espaces et de quotes.
function extractToken(html, id) {
  const pattern = new RegExp(
    `id=["']${id}["'][^>]*value=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(pattern);
  return match ? match[1] : null;
}

// --- Actions ---------------------------------------------------------

async function createSolutionAction() {
  sendStatus('Création de la solution...', 'info');
  const d = await new Promise((r) => chrome.storage.local.get('parameterData', r));
  const hasZones = Array.isArray(d.parameterData) && d.parameterData.length > 1;

  const BOSSID = await getBOSSID();
  if (!BOSSID) {
    sendStatus('Le cookie BOSSID est introuvable.', 'error', true);
    return;
  }

  const data = await new Promise((r) =>
    chrome.storage.local.get(['clientData', 'parameterData'], r)
  );
  if (!data.clientData) {
    sendStatus('Aucune donnée client trouvée.', 'error', true);
    return;
  }

  const client = data.clientData;
  const multi = Array.isArray(data.parameterData) && data.parameterData.length > 1;

  if (multi) {
    const solutionsMap = {};
    for (const param of data.parameterData) {
      const zoneName = param.zone;
      try {
        const html = await fetchWithCookie(
          'https://backoffice.epack-manager.com/epack/manager/solution/new',
          'GET',
          BOSSID
        ).then((r) => r.text());
        const token = extractToken(html, 'solution__token');
        if (!token) throw new Error('Token manquant');

        const body = new URLSearchParams({
          'solution[_token]': token,
          'solution[adresse]': client.street || 'TEST',
          'solution[codePostal]': client.zip || 'TEST',
          'solution[enseigne]': `${client.name || 'TEST'} - ${zoneName}`,
          'solution[latitude]': client.partner_latitude || '0',
          'solution[longitude]': client.partner_longitude || '0',
          'solution[mac]': '',
          'solution[statusApi]': '0',
          'solution[ticketfile]': '1',
          'solution[versionEpack]': '',
          'solution[ville]': client.city || 'TEST',
        });

        const response = await fetchWithCookie(
          'https://backoffice.epack-manager.com/epack/manager/solution/new',
          'POST',
          BOSSID,
          { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        );
        const match = response.url.match(/solution\/(\d+)/);
        if (match) {
          solutionsMap[param.id] = match[1];
          chrome.tabs.create({ url: response.url, active: false });
        }
      } catch (err) {
        sendStatus(`Erreur création pour zone ${zoneName} : ${err.message}`, 'error');
      }
    }

    chrome.storage.local.set({ solutionsMap });
    if (Object.keys(solutionsMap).length === data.parameterData.length) {
      sendStatus('Solutions créées avec succès !', 'success', true);
    } else {
      const failed = data.parameterData
        .filter((p) => !solutionsMap[p.id])
        .map((p) => p.zone)
        .join(', ');
      sendStatus(`Solutions incomplètes : ${failed}`, 'error', true);
    }
  } else {
    try {
      const html = await fetchWithCookie(
        'https://backoffice.epack-manager.com/epack/manager/solution/new',
        'GET',
        BOSSID
      ).then((r) => r.text());
      const token = extractToken(html, 'solution__token');
      if (!token) throw new Error('Token manquant');

      const body = new URLSearchParams({
        'solution[_token]': token,
        'solution[adresse]': client.street || 'TEST',
        'solution[codePostal]': client.zip || 'TEST',
        'solution[enseigne]': client.name || 'TEST',
        'solution[latitude]': client.partner_latitude || '0',
        'solution[longitude]': client.partner_longitude || '0',
        'solution[mac]': '',
        'solution[statusApi]': '0',
        'solution[ticketfile]': '1',
        'solution[versionEpack]': '',
        'solution[ville]': client.city || 'TEST',
      });

      const response = await fetchWithCookie(
        'https://backoffice.epack-manager.com/epack/manager/solution/new',
        'POST',
        BOSSID,
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      );
      const match = response.url.match(/solution\/(\d+)/);
      if (match) {
        chrome.storage.local.set({ solutionId: match[1] });
      }
      sendStatus('Solution créée avec succès !', 'success', true);
      chrome.tabs.create({ url: response.url, active: false });
    } catch (err) {
      sendStatus('Erreur : ' + err.message, 'error', true);
    }
  }
}

async function checkIfUserExists(email) {
  const url = `https://backoffice.epack-manager.com/epack/manager/user/?search=${encodeURIComponent(email)}`;
  try {
    const response = await fetch(url, { method: 'GET', credentials: 'include' });
    const html = await response.text();
    const match = html.match(/<table[^>]*class="table-bordered"[^>]*>[\s\S]*?<tr[^>]*class="color"[^>]*>\s*<td>(\d+)<\/td>/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function createUserAction() {
  sendStatus('Création de l’utilisateur...', 'info');

  const BOSSID = await getBOSSID();
  if (!BOSSID) {
    sendStatus('Le cookie BOSSID est introuvable.', 'error', true);
    return;
  }

  const data = await new Promise((r) =>
    chrome.storage.local.get(['managerInfo', 'clientData'], r)
  );
  if (!data.managerInfo) {
    sendStatus('Aucune donnée manager trouvée.', 'error', true);
    return;
  }

  const userData = data.managerInfo;
  const existingUserId = await checkIfUserExists(userData.email);
  if (existingUserId) {
    chrome.storage.local.set({ userId: existingUserId });
    sendStatus('Utilisateur déjà existant, ID enregistré.', 'success', true);
    return;
  }

  try {
    const html = await fetchWithCookie(
      'https://backoffice.epack-manager.com/epack/manager/user/new',
      'GET',
      BOSSID
    ).then((r) => r.text());

    const tokenValue = extractToken(html, 'user__token');
    if (!tokenValue) {
      sendStatus('Token introuvable pour création utilisateur.', 'error', true);
      return;
    }

    const { nom, prenom } = splitName(userData.name);
    const body = new URLSearchParams({
      'user[_token]': tokenValue,
      'user[email]': userData.email,
      'user[jobTitle]': userData.function || '/',
      'user[lang]': getLangId(getLangFromCountry(userData.country)),
      'user[nom]': nom || '/',
      'user[prenom]': prenom,
      'user[telephoneMobile]': userData.mobile || '/',
      'user[typeContrat]': '1',
      'user[user_type]': '1',
    });

    const response = await fetchWithCookie(
      'https://backoffice.epack-manager.com/epack/manager/user/new',
      'POST',
      BOSSID,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    );

    const match = response.url.match(/user\/(\d+)/);
    if (match) {
      chrome.storage.local.set({ userId: match[1] });
      sendStatus('Utilisateur créé avec succès !', 'success', true);
    } else {
      sendStatus('Impossible de récupérer l’ID utilisateur.', 'error', true);
    }
  } catch (err) {
    sendStatus('Erreur création utilisateur : ' + err.message, 'error', true);
  }
}

async function openParamAction() {
  sendStatus('Chargement des paramètres...', 'info');
  const data = await new Promise((r) =>
    chrome.storage.local.get(['parameterData', 'managerInfo'], r)
  );
  if (!data.parameterData || !Array.isArray(data.parameterData)) {
    sendStatus('Aucune donnée parameterData valide trouvée.', 'error', true);
    return;
  }

  const managerKey = data.managerInfo ? integratorKey(data.managerInfo.name) : '';
  const client = data.parameterData[0].client;
  const searchUrl = `https://backoffice.epack-manager.com/epack/configurateur/?search=${encodeURIComponent(client)}`;

  let successCount = 0;
  let failCount = 0;
  const failedZones = [];
  const multipleZones = data.parameterData.length > 1;

  try {
    const response = await fetch(searchUrl, { method: 'GET', credentials: 'include' });
    const html = await response.text();
    const tableMatch = html.match(/<table[^>]*class="table-bordered"[^>]*>([\s\S]*?)<\/table>/i);
    const rows = [];
    if (tableMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
        }
        const linkMatch = rowMatch[1].match(/<a[^>]*href=\"([^\"]+)\"/i);
        rows.push({ cells, link: linkMatch ? linkMatch[1] : null });
      }
    }

    if (rows.length === 0) {
      sendStatus(`Aucun résultat trouvé pour ${client}`, 'error', true);
      return;
    }

    const usedIndexes = new Set();
    const parameterMap = {};
    const parameterIds = [];

    for (const param of data.parameterData) {
      const { zone, integrator, id: paramId, originalZone } = param;
      const searchZone = originalZone || zone;
      let found = false;

      for (let i = 0; i < rows.length; i++) {
        if (usedIndexes.has(i)) continue;
        const row = rows[i];
        const zoneCellText = row.cells[4] || '';
        const nameCellText = row.cells[2] || '';

        const rowKey = integratorKey(nameCellText);
        const expectedKey = integratorKey(integrator);

        if (
          normalizeText(zoneCellText) === normalizeText(searchZone) &&
          (!expectedKey || keysMatch(rowKey, expectedKey))
        ) {
          const link = row.link;
          if (link) {
            const fullUrl = `https://backoffice.epack-manager.com${link}`;
            chrome.tabs.create({ url: fullUrl, active: false });
            const id = link.split('/').pop();
            if (multipleZones) {
              parameterMap[paramId] = id;
            } else {
              parameterIds.push(id);
            }
            usedIndexes.add(i);
            successCount++;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        failCount++;
        failedZones.push(zone);
      }
    }

    if (multipleZones) {
      chrome.storage.local.set({ parameterMap });
    } else {
      chrome.storage.local.set({ parameterIds });
    }

    let summary = `✅ ${successCount} zone(s) ouverte(s).\n`;
    if (failCount > 0) {
      summary += `❌ ${failCount} zone(s) introuvable(s) : ${failedZones.join(', ')}`;
      sendStatus(summary, 'error', true);
    } else {
      sendStatus(summary, 'success', true);
    }
  } catch (err) {
    sendStatus(`Erreur lors de la recherche pour ${client}`, 'error', true);
  }
}

async function doAllAction() {
  await createSolutionAction();
  await wait(2000);
  await createUserAction();
  await wait(2000);
  await openParamAction();
}

self.backgroundActions = {
  createSolutionAction,
  createUserAction,
  openParamAction,
  doAllAction,
};

