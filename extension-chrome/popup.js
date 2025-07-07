
// Fonctions UX dans scripts/popup-ui.js

// proxyURL is defined in scripts/sondes.js


// Utilitaires ---------------------------------------------------------------

function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "")
    .toLowerCase();
}

function integratorKey(name) {
  if (!name) return "";
  const cleanName = name.replace(/_/g, " ").trim();
  const parts = cleanName.split(/\s+/);

  // Cas 1 : Un seul mot
  if (parts.length === 1) {
    return normalizeText(parts[0]);
  }

  // Cas 2 : Plusieurs mots
  const prenomInitial = parts[0][0] || "";
  const nom = parts.slice(1).join("");
  return normalizeText(prenomInitial + nom);
}


function keysMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function getBOSSID(callback) {
  chrome.cookies.get({ url: 'https://backoffice.epack-manager.com', name: 'BOSSID' }, function (cookie) {
    callback(cookie ? cookie.value : null);
  });
}

function fetchWithCookie(url, method, BOSSID, headers = {}, body = null) {
  return fetch(url, {
    method,
    headers: {
      'Cookie': `BOSSID=${BOSSID}`,
      ...headers,
    },
    body,
  });
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function checkIfUserExists(email, callback) {
  const url = `https://backoffice.epack-manager.com/epack/manager/user/?search=${encodeURIComponent(email)}`;
  fetch(url, { method: 'GET', credentials: 'include' })
    .then(response => response.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const userIdCell = doc.querySelector('table.table-bordered tr.color td:first-child');
      if (userIdCell) {
        const userId = userIdCell.textContent.trim();
        chrome.storage.local.set({ userId });
        callback(userId);
      } else {
        callback(null);
      }
    })
    .catch(error => {
      console.error("Erreur vérification utilisateur :", error);
      callback(null);
    });
}

function splitName(name) {
  const parts = name.split(" ");
  const prenom = parts.find(part => part[0] === part[0].toUpperCase());
  const nom = parts.filter(part => part !== prenom).join(" ").toUpperCase();
  return { nom, prenom };
}

function getLangId(code) {
  const map = {
    'fr_FR': '1',
    'en_US': '2', 'en_GB': '2',
    'it_IT': '3',
    'de_DE': '4',
    'pt_PT': '5', 'pt_BR': '5',
    'es_ES': '6',
    'pl_PL': '7',
    'ca_ES': '8',
    'nl_NL': '9',
    'zh_CN': '10', 'zh_TW': '10',
    'ar_SY': '11', 'ar_EG': '11', 'ar': '11',
    'el_GR': '12'
  };
  return map[code] || '1';
}

function getLangFromCountry(country) {
  const map = {
    'France': 'fr_FR',
    'Belgique': 'fr_FR',
    'Suisse': 'fr_FR',
    'Canada': 'en_US',
    'États-Unis': 'en_US',
    'Royaume-Uni': 'en_GB',
    'Espagne': 'es_ES',
    'Italie': 'it_IT',
    'Allemagne': 'de_DE',
    'Portugal': 'pt_PT',
    'Brésil': 'pt_BR',
    'Pays-Bas': 'nl_NL',
    'Pologne': 'pl_PL',
    'Chine': 'zh_CN',
    'Grèce': 'el_GR',
    'Arabie saoudite': 'ar_SY',
    'Égypte': 'ar_EG',
    'Émirats arabes unis': 'ar_SY'
  };
  return map[country] || 'fr_FR';
}

async function createUser(BOSSID, userData) {
  try {
    const html = await fetchWithCookie(
      'https://backoffice.epack-manager.com/epack/manager/user/new',
      'GET',
      BOSSID
    ).then(r => r.text());

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tokenValue = doc.querySelector('#user__token')?.value;
    if (!tokenValue) {
      updateOutput('Token introuvable pour création utilisateur.', 'error');
      hideLoader();
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
      'user[user_type]': '1'
    });

    const response = await fetchWithCookie(
      'https://backoffice.epack-manager.com/epack/manager/user/new',
      'POST',
      BOSSID,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    );

    if (response.ok) {
      const match = response.url.match(/user\/(\d+)/);
      if (match) {
        chrome.storage.local.set({ userId: match[1] });
      }
      updateOutput('Utilisateur créé avec succès !', 'success');
      chrome.tabs.create({ url: response.url, active: false });
    } else {
      updateOutput('Erreur création utilisateur.', 'error');
    }
  } catch (error) {
    updateOutput(`Erreur création utilisateur : ${error.message}`, 'error');
  } finally {
    hideLoader();
  }
}

document.getElementById("openSonde").addEventListener("click", () => {
  document.getElementById("main-panel").style.display = "none";
  document.getElementById("sondes-panel").style.display = "block";
});

document.getElementById("backToMain").addEventListener("click", () => {
  document.getElementById("sondes-panel").style.display = "none";
  document.getElementById("main-panel").style.display = "block";
});

document.getElementById("toggleLogin").addEventListener("click", () => {
  const section = document.getElementById("login-section");
  section.style.display = section.style.display === "none" ? "block" : "none";
});

// 🔐 Charger les infos au démarrage
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["sondeEmail", "sondePassword", "proxyURL"], (data) => {
    if (data.sondeEmail) {
      document.getElementById("sonde-email").value = data.sondeEmail;
    }
    if (data.sondePassword) {
      document.getElementById("sonde-password").value = data.sondePassword;
    }
    if (data.proxyURL) {
      proxyURL = data.proxyURL;
      document.getElementById("proxy-url").value = data.proxyURL;
    } else {
      document.getElementById("proxy-url").value = DEFAULT_PROXY_URL;
    }
  });
});

// 💾 Sauvegarder email et mot de passe
document.getElementById("sonde-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("sonde-email").value.trim();
  const password = document.getElementById("sonde-password").value.trim();
  const pUrl = document.getElementById("proxy-url").value.trim() || DEFAULT_PROXY_URL;
  proxyURL = pUrl;

  chrome.storage.local.set({
    sondeEmail: email,
    sondePassword: password,
    proxyURL: pUrl
  }, () => {
    updateSondeOutput("🧪 Identifiants enregistrés avec succès !", "success");
  });
});

document.getElementById("testConnexion").addEventListener("click", () => {
  const email = document.getElementById("sonde-email").value.trim();
  const password = document.getElementById("sonde-password").value.trim();

  if (!email || !password) {
    updateSondeOutput("❌ Veuillez saisir un email et un mot de passe.", "error");
    return;
  }

  fetch(`${proxyURL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.token && data.refreshToken) {
        chrome.storage.local.set({
          bluconsoleToken: data.token,
          bluconsoleRToken: data.refreshToken,
          bluconsoleUser: data.user
        });
        updateSondeOutput(`✅ Connexion réussie via proxy ${proxyURL}!`, "success");
      } else {
        updateSondeOutput("❌ Connexion échouée : identifiants invalides.", "error");
      }
    })
    .catch(err => {
      updateSondeOutput("❌ Erreur réseau : " + err.message, "error");
    });
});

document.getElementById("verifierSondes").addEventListener("click", () => {
  sondeUtils.verifierSondes();
});

// Créer une solution
async function createSolutionAction() {
  const btn = document.getElementById('createSolution');
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

  const d = await new Promise(r => chrome.storage.local.get('paramData', r));
  const hasZones = Array.isArray(d.paramData) && d.paramData.length > 1;
  showLoader(hasZones ? 'Création des solutions...' : 'Création de la solution...');

  const BOSSID = await new Promise(r => getBOSSID(r));
  if (!BOSSID) {
    updateOutput('Le cookie BOSSID est introuvable.', 'error');
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-desktop"></i>`;
    hideLoader();
    return;
  }

  const data = await new Promise(r => chrome.storage.local.get(['partnerData', 'paramData'], r));
  if (!data.partnerData) {
    updateOutput('Aucune donnée client trouvée.', 'error');
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-desktop"></i>`;
    hideLoader();
    return;
  }

  const client = data.partnerData;
  const multi = Array.isArray(data.paramData) && data.paramData.length > 1;

  if (multi) {
    const solutionMap = {};
    for (const param of data.paramData) {
      const zoneName = param.zone;
      try {
        const html = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'GET', BOSSID).then(r => r.text());
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const token = doc.querySelector('#solution__token')?.value;
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
          'solution[ville]': client.city || 'TEST'
        });

        const response = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'POST', BOSSID, { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
        const match = response.url.match(/solution\/(\d+)/);
        if (match) {
          solutionMap[param.id] = match[1];
          chrome.tabs.create({ url: response.url, active: false });
        }
      } catch (err) {
        updateOutput(`Erreur création pour zone ${zoneName} : ${err.message}`, 'error');
      }
    }

    chrome.storage.local.set({ solutionMap });
    if (Object.keys(solutionMap).length === data.paramData.length) {
      updateOutput('Solutions créées avec succès !', 'success');
    } else {
      const failed = data.paramData.filter(p => !solutionMap[p.id]).map(p => p.zone).join(', ');
      updateOutput(`Solutions incomplètes : ${failed}`, 'error');
    }
  } else {
    try {
      const html = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'GET', BOSSID).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const token = doc.querySelector('#solution__token')?.value;
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
        'solution[ville]': client.city || 'TEST'
      });

      const response = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'POST', BOSSID, { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
      const match = response.url.match(/solution\/(\d+)/);
      if (match) {
        chrome.storage.local.set({ solutionId: match[1] });
      }
      updateOutput('Solution créée avec succès !', 'success');
      chrome.tabs.create({ url: response.url, active: false });
    } catch (err) {
      updateOutput('Erreur : ' + err.message, 'error');
    }
  }

  hideLoader();
  btn.disabled = false;
  btn.innerHTML = `<i class="fas fa-desktop"></i>`;
}

document.getElementById('createSolution').addEventListener('click', () => {
  createSolutionAction();
});

// 👤 Créer un utilisateur
async function createUserAction() {
  showLoader('Recherche des données utilisateur...');
  const data = await new Promise(r => chrome.storage.local.get(['managerData', 'partnerData'], r));
  if (!data.managerData) {
    updateOutput('Aucune donnée utilisateur trouvée.', 'error');
    hideLoader();
    return;
  }
  const { email, name, mobile, function: userFunction } = data.managerData;
  const clientCountry = Array.isArray(data.partnerData?.country_id)
    ? data.partnerData.country_id[1]
    : '';
  const userId = await new Promise(r => checkIfUserExists(email, r));
  if (userId) {
    updateOutput(`Utilisateur existant : ${userId}`, 'info');
    chrome.tabs.create({ url: `https://backoffice.epack-manager.com/epack/manager/user/${userId}`, active: false });
    hideLoader();
  } else {
    const BOSSID = await new Promise(r => getBOSSID(r));
    if (!BOSSID) {
      updateOutput('Le cookie BOSSID est introuvable.', 'error');
      hideLoader();
      return;
    }
    await createUser(BOSSID, { email, name, mobile, function: userFunction, country: clientCountry });
  }
}

document.getElementById('createUser').addEventListener('click', () => {
  createUserAction();
});

// 🧩 Ouvrir les paramètres

// 🧠 Tout créer
async function openParamAction() {
  showLoader('Chargement des paramètres...');
  const data = await new Promise(r => chrome.storage.local.get(['paramData', 'managerData'], r));
  if (!data.paramData || !Array.isArray(data.paramData)) {
    updateOutput('Aucune donnée paramData valide trouvée.', 'error');
    hideLoader();
    return;
  }

  const managerKey = data.managerData ? integratorKey(data.managerData.name) : '';

  const client = data.paramData[0].client;
  const searchUrl = `https://backoffice.epack-manager.com/epack/configurateur/?search=${encodeURIComponent(client)}`;

  let successCount = 0;
  let failCount = 0;
  const failedZones = [];
  const multipleZones = data.paramData.length > 1;

  try {
    const response = await fetch(searchUrl, { method: 'GET', credentials: 'include' });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table.table-bordered tbody tr')];

    if (rows.length === 0) {
      updateOutput(`❌ Aucun résultat trouvé pour ${client}`, 'error');
      hideLoader();
      return;
    }

    const usedIndexes = new Set();
    const paramMap = {};
    const paramIds = [];

    for (const param of data.paramData) {
      const { zone, integrator, id: paramId, originalZone } = param;
      const searchZone = originalZone || zone;
      let found = false;

      for (let i = 0; i < rows.length; i++) {
        if (usedIndexes.has(i)) continue;

        const row = rows[i];
        const tds = row.querySelectorAll('td');
        const zoneCellText = tds[4]?.textContent?.trim() || '';
        const nameCellText = tds[2]?.textContent?.trim() || '';

        const rowKey = integratorKey(nameCellText);
        const expectedKey = integratorKey(integrator);

        if (
          normalizeText(zoneCellText) === normalizeText(searchZone) &&
          (!expectedKey || keysMatch(rowKey, expectedKey))
        ) {
          const link = row.querySelector('a[href]')?.getAttribute('href');
          if (link) {
            const fullUrl = `https://backoffice.epack-manager.com${link}`;
            chrome.tabs.create({ url: fullUrl, active: false });
            const id = link.split('/').pop();
            if (multipleZones) {
              paramMap[paramId] = id;
            } else {
              paramIds.push(id);
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
      chrome.storage.local.set({ paramMap });
    } else {
      chrome.storage.local.set({ paramIds });
    }

    let summary = `✅ ${successCount} zone(s) ouverte(s).\n`;
    if (failCount > 0) {
      summary += `❌ ${failCount} zone(s) introuvable(s) : ${failedZones.join(', ')}`;
      updateOutput(summary, 'error');
    } else {
      updateOutput(summary, 'success');
    }
  } catch (err) {
    console.error(`❌ Erreur réseau pour ${client} :`, err);
    updateOutput(`Erreur lors de la recherche pour ${client}`, 'error');
  } finally {
    hideLoader();
  }
}

document.getElementById('openParam').addEventListener('click', () => {
  openParamAction();
});
async function doAllAction() {
  await createSolutionAction();
  await wait(2000);
  await createUserAction();
  await wait(2000);
  await openParamAction();
}

document.getElementById('doAll').addEventListener('click', () => {
  doAllAction();
});

document.getElementById('doEverything').addEventListener('click', () => {
  const keysToRemove = ['solutionMap', 'solutionId', 'paramMap', 'paramIds', 'userId'];
  chrome.storage.local.remove(keysToRemove, async () => {
    await doAllAction();
    await wait(2000);
    document.getElementById('connectAll').click();
  });
});



// Afficher données à l'ouverture
document.getElementById("connectAll").addEventListener("click", () => {
  showLoader("Association en cours...");
  chrome.storage.local.get(["solutionMap", "solutionId", "paramMap", "paramIds", "userId", "paramData"], data => {
    const { solutionMap, solutionId, paramMap, paramIds, userId, paramData } = data;
    const multipleZones = solutionMap && paramMap;
    if (multipleZones) {
      if (!userId) {
        updateOutput("ID manquant pour la connexion.", "error");
        hideLoader();
        return;
      }
    } else if (!solutionId || !Array.isArray(paramIds) || paramIds.length === 0 || !userId) {
      updateOutput("ID manquant pour la connexion.", "error");
      hideLoader();
      return;
    }

    getBOSSID(async BOSSID => {
      if (!BOSSID) {
        updateOutput("Le cookie BOSSID est introuvable.", "error");
        hideLoader();
        return;
      }

      const idToZone = {};
      if (Array.isArray(paramData)) {
        for (const p of paramData) idToZone[p.id] = p.zone;
      }

      const paramErrors = [];
      if (multipleZones) {
        for (const [pidKey, pid] of Object.entries(paramMap)) {
          const sid = solutionMap[pidKey];
          if (!sid) {
            paramErrors.push(pidKey);
            continue;
          }
          try {
            const body = new URLSearchParams({ solutionId: sid });
            const res = await fetchWithCookie(
              `https://backoffice.epack-manager.com/epack/configurateur/addSolutionToConfiguration/${pid}`,
              'POST',
              BOSSID,
              { 'Content-Type': 'application/x-www-form-urlencoded' },
              body
            );
            if (!res.ok) paramErrors.push(pidKey);
          } catch (err) {
            paramErrors.push(pidKey);
          }
        }
      } else {
        for (const pid of paramIds) {
          try {
            const body = new URLSearchParams({ solutionId });
            const res = await fetchWithCookie(
              `https://backoffice.epack-manager.com/epack/configurateur/addSolutionToConfiguration/${pid}`,
              'POST',
              BOSSID,
              { 'Content-Type': 'application/x-www-form-urlencoded' },
              body
            );
            if (!res.ok) paramErrors.push(pid);
          } catch (err) {
            paramErrors.push(pid);
          }
        }
      }

      let userError = null;
      const solutionIds = multipleZones ? Object.values(solutionMap) : [solutionId];
      for (const sid of solutionIds) {
        try {
          const body = new URLSearchParams({
            referer: 'epack_manager_user_show',
            solutionId: sid
          });
          const userRes = await fetchWithCookie(
            `https://backoffice.epack-manager.com/epack/manager/user/addSolutionToUser/${userId}`,
            'POST',
            BOSSID,
            { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          );
          if (!userRes.ok) userError = `user association -> ${userRes.status}`;
        } catch (err) {
          userError = err.message;
        }
      }

      if (!userError && paramErrors.length === 0) {
        updateOutput("Associations réalisées avec succès !", "success");
      } else if (!userError) {
        const displayErr = paramErrors.map(id => idToZone[id] || id).join(', ');
        updateOutput(`Utilisateur associé mais paramètres en échec : ${displayErr}`, "error");
      } else {
        updateOutput(`Erreur association utilisateur : ${userError}`, "error");
      }

      hideLoader();
    });
  });
});


document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["partnerData", "managerData", "paramData"], (data) => {
    const container = document.getElementById("client-info");
    let html = "";

    // 🏢 Client
    if (data.partnerData) {
      const c = data.partnerData;
      html += `<div class="info-block"><h3>🏢 Client</h3><ul>
        <li><strong>Nom :</strong> ${c.name || "-"}</li>
        <li><strong>Adresse :</strong> ${c.street || "-"}, ${c.zip || "-"} ${c.city || "-"}</li>
        <li><strong>Pays :</strong> ${c.country_id ? c.country_id[1] : "-"}</li>
      </ul></div>`;
    }

    // 👤 Manager
    if (data.managerData) {
      const u = data.managerData;
      const clientCountry = data.partnerData?.country_id ? data.partnerData.country_id[1] : '';
      html += `<div class="info-block"><h3>👤 Manager</h3><ul>
        <li><strong>Nom :</strong> ${u.name || "-"}</li>
        <li><strong>Fonction :</strong> ${u.function || "-"}</li>
        <li><strong>Téléphone :</strong> ${u.mobile || "-"}</li>
        <li><strong>Email :</strong> ${u.email || "-"}</li>
        <li><strong>Langue :</strong> ${getLangFromCountry(clientCountry)}</li>
      </ul></div>`;
    }

    // 🧩 Paramètres
    if (Array.isArray(data.paramData)) {
      if (data.paramData.length > 0 && typeof data.paramData[0] === "object") {
        if (data.paramData.length > 1) {
          html += `<div class="info-block"><h3>🧩 Paramètres détectés</h3><ul>` +
            data.paramData
              .map((p, idx) =>
                `<li>🔸 ${p.client} (${p.integrator || '-'}) – <input type="text" class="zone-input" data-index="${idx}" value="${p.zone}" /></li>`
              )
              .join("") +
            `</ul></div>`;
        } else {
          const p = data.paramData[0];
          html += `<div class="info-block"><h3>🧩 Paramètre détecté</h3><ul>
            <li>🔸 ${p.client} (${p.integrator || '-'}) – ${p.zone}</li>
          </ul></div>`;
        }
      } else {
        html += `<div class="info-block"><h3>🧩 Paramètres détectés</h3><ul>` +
          data.paramData.map(p => `<li>🔸 ${p}</li>`).join("") +
          `</ul></div>`;
      }
    } else if (data.paramData) {
      html += `<div class="info-block"><h3>🧩 Paramètre détecté</h3><ul>
        <li>🔸 ${data.paramData}</li>
      </ul></div>`;
    }

    container.innerHTML = html || "Aucune donnée trouvée.";

    document.querySelectorAll('.zone-input').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        const val = input.value.trim();
        chrome.storage.local.get('paramData', d => {
          if (Array.isArray(d.paramData) && d.paramData[idx]) {
            d.paramData[idx].zone = val;
            chrome.storage.local.set({ paramData: d.paramData });
          }
        });
      });
    });
  });
});
