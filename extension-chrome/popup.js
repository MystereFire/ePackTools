
// Fonctions UX améliorées
function showLoader(msg = "Chargement...") {
  const loader = document.getElementById("loader");
  loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${msg}`;
  loader.style.display = "block";
}

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

function updateOutput(message, type = "info") {
  const outputDiv = document.getElementById("output");
  outputDiv.style.display = "block";
  outputDiv.style.color = "#333";
  outputDiv.style.backgroundColor = type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#f9f9f9";
  outputDiv.style.borderColor = type === "success" ? "#c3e6cb" : type === "error" ? "#f5c6cb" : "#ccc";
  outputDiv.innerHTML = message;
}

// Utilities ---------------------------------------------------------------

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

function createUser(BOSSID, userData) {
  fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/user/new', 'GET', BOSSID)
    .then(response => response.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tokenValue = doc.querySelector('#user__token')?.value;

      if (!tokenValue) {
        updateOutput("Token introuvable pour création utilisateur.", "error");
        hideLoader();
        return;
      }

      const { nom, prenom } = splitName(userData.name);
      const body = new URLSearchParams({
        'user[_token]': tokenValue,
        'user[email]': userData.email,
        'user[jobTitle]': userData.function || '/',
        'user[lang]': '1',
        'user[nom]': nom || '/',
        'user[prenom]': prenom,
        'user[telephoneMobile]': userData.mobile || '/',
        'user[typeContrat]': '1',
        'user[user_type]': '1',
      });

      fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/user/new', 'POST', BOSSID, { 'Content-Type': 'application/x-www-form-urlencoded' }, body)
        .then(response => {
          if (response.ok) {
            const match = response.url.match(/user\/(\d+)/);
            if (match) {
              chrome.storage.local.set({ userId: match[1] });
            }
            updateOutput("Utilisateur créé avec succès !", "success");
            chrome.tabs.create({ url: response.url, active: false });
          } else {
            updateOutput("Erreur création utilisateur.", "error");
          }
          hideLoader();
        })
        .catch(error => {
          updateOutput(`Erreur création utilisateur : ${error.message}`, "error");
          hideLoader();
        });
    })
    .catch(error => {
      updateOutput(`Erreur récupération token : ${error.message}`, "error");
      hideLoader();
    });
}

document.getElementById("openSonde").addEventListener("click", () => {
  document.getElementById("main-panel").style.display = "none";
  document.getElementById("sondes-panel").style.display = "block";
});

document.getElementById("backToMain").addEventListener("click", () => {
  document.getElementById("sondes-panel").style.display = "none";
  document.getElementById("main-panel").style.display = "block";
});

// 🔐 Charger les infos au démarrage
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["sondeEmail", "sondePassword"], (data) => {
    if (data.sondeEmail) {
      document.getElementById("sonde-email").value = data.sondeEmail;
    }
    if (data.sondePassword) {
      document.getElementById("sonde-password").value = data.sondePassword;
    }
  });
});

// 💾 Sauvegarder email et mot de passe
document.getElementById("sonde-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("sonde-email").value.trim();
  const password = document.getElementById("sonde-password").value.trim();

  chrome.storage.local.set({
    sondeEmail: email,
    sondePassword: password
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

  fetch("http://blulog.ligma.fr/api/login", {
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
        updateSondeOutput("✅ Connexion réussie via proxy local !", "success");
      } else {
        updateSondeOutput("❌ Connexion échouée : identifiants invalides.", "error");
      }
    })
    .catch(err => {
      updateSondeOutput("❌ Erreur réseau : " + err.message, "error");
    });
});

document.getElementById("verifierSondes").addEventListener("click", () => {
  const textarea = document.getElementById("sonde-ids");
  let rawLines = textarea.value.split("\n");

  if (rawLines.length === 0) {
    updateSondeOutput("Veuillez entrer au moins un ID.", "error");
    return;
  }

  chrome.storage.local.get(["bluconsoleToken", "bluconsoleRToken"], (data) => {
    const token = data.bluconsoleToken;
    const rtoken = data.bluconsoleRToken;

    if (!token || !rtoken) {
      updateSondeOutput("❌ Token manquant. Connectez-vous d'abord.", "error");
      return;
    }

    // Nettoie les lignes de départ
    rawLines = rawLines.map(line =>
      line.split(" ")[0].trim().replace(/\s+/g, "")
    );

    // On garde la structure pour update ligne par ligne
    const updatedLines = [...rawLines];

    Promise.all(
      rawLines.map((cleanId, index) => {
        if (!cleanId) {
          updatedLines[index] = ""; // ignore vide
          return Promise.resolve();
        }

        const isHub = cleanId.startsWith("0");
        const url = isHub
          ? `http://blulog.ligma.fr/api/verifier-hub?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`
          : `http://blulog.ligma.fr/api/verifier-sonde?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`;

        return fetch(url)
          .then(res => res.json())
          .then(data => {
            if (isHub) {
              const row = data?.Result?.Rows?.[0];
              const emoji = row ? "✅" : "❌";
              const info = row
                ? ` (${row.ConnectionStatus}, ${row.Status}, ${row.LastRequestAt || "-"})`
                : "";
              updatedLines[index] = `${cleanId} ${emoji}${info}`;
            } else {
              const row = data?.Result?.Rows?.[0];
              const emoji = row ? "✅" : "❌";
              const temp = row?.Temperature?.Value || "?";
              const battery = row?.Battery || "-";
              const info = row
                ? ` (Temp: ${temp}, Battery: ${battery})`
                : "";
              updatedLines[index] = `${cleanId} ${emoji}${info}`;
            }
          })
          .catch(() => {
            updatedLines[index] = `${cleanId} ❌`;
          });
      })
    ).then(() => {
      textarea.value = updatedLines.filter(Boolean).join("\n");
    });
  });
});



function updateSondeOutput(message, type = "info") {
  const outputDiv = document.getElementById("sonde-output");
  if (!outputDiv) return;

  outputDiv.style.display = "block";
  outputDiv.style.backgroundColor = type === "success" ? "#d4edda" :
    type === "error" ? "#f8d7da" :
      "#f9f9f9";
  outputDiv.style.borderColor = type === "success" ? "#c3e6cb" :
    type === "error" ? "#f5c6cb" :
      "#ccc";

  outputDiv.textContent = message;
}



// Créer une solution
document.getElementById("createSolution").addEventListener("click", function () {
  const btn = this;
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

  chrome.storage.local.get("paramData", d => {
    const hasZones = Array.isArray(d.paramData) && d.paramData.length > 1;
    showLoader(hasZones ? "Création des solutions..." : "Création de la solution...");
  });

  getBOSSID(async BOSSID => {
    if (!BOSSID) {
      updateOutput("Le cookie BOSSID est introuvable.", "error");
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-desktop"></i>`;
      hideLoader();
      return;
    }

    chrome.storage.local.get(["partnerData", "paramData"], async (data) => {
      if (!data.partnerData) {
        updateOutput("Aucune donnée client trouvée.", "error");
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-desktop"></i>`;
        hideLoader();
        return;
      }

      const client = data.partnerData;
      const hasZones = Array.isArray(data.paramData) && data.paramData.length > 1;

      if (hasZones) {
        const zones = data.paramData.map(p => p.zone);
        const solutionMap = {};

        for (const zoneName of zones) {
          try {
            const html = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'GET', BOSSID).then(r => r.text());
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const token = doc.querySelector('#solution__token')?.value;
            if (!token) throw new Error("Token manquant");

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
              solutionMap[zoneName] = match[1];
              chrome.tabs.create({ url: response.url, active: false });
            }
          } catch (err) {
            updateOutput(`Erreur création pour zone ${zoneName} : ${err.message}`, "error");
          }
        }

        chrome.storage.local.set({ solutionMap });
        if (Object.keys(solutionMap).length === zones.length) {
          updateOutput("Solutions créées avec succès !", "success");
        } else {
          const failed = zones.filter(z => !solutionMap[z]).join(', ');
          updateOutput(`Solutions incomplètes : ${failed}`, "error");
        }
      } else {
        try {
          const html = await fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'GET', BOSSID).then(r => r.text());
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const token = doc.querySelector('#solution__token')?.value;
          if (!token) throw new Error("Token manquant");

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
          updateOutput("Solution créée avec succès !", "success");
          chrome.tabs.create({ url: response.url, active: false });
        } catch (err) {
          updateOutput("Erreur : " + err.message, "error");
        }
      }

      hideLoader();
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-desktop"></i>`;
    });
  });
});

// 👤 Créer un utilisateur
document.getElementById("createUser").addEventListener("click", () => {
  showLoader("Recherche des données utilisateur...");
  chrome.storage.local.get("managerData", (data) => {
    if (!data.managerData) {
      updateOutput("Aucune donnée utilisateur trouvée.", "error");
      hideLoader();
      return;
    }
    const { email, name, mobile, function: userFunction } = data.managerData;
    checkIfUserExists(email, (userId) => {
      if (userId) {
        updateOutput(`Utilisateur existant : ${userId}`, "info");
        chrome.tabs.create({ url: `https://backoffice.epack-manager.com/epack/manager/user/${userId}`, active: false });
        hideLoader();
      } else {
        getBOSSID(BOSSID => {
          if (!BOSSID) {
            updateOutput("Le cookie BOSSID est introuvable.", "error");
            hideLoader();
            return;
          }
          createUser(BOSSID, { email, name, mobile, function: userFunction });
        });
      }
    });
  });
});

// 🧩 Ouvrir les paramètres
document.getElementById("openParam").addEventListener("click", () => {
  showLoader("Chargement des paramètres...");
  chrome.storage.local.get(["paramData", "managerData"], async (data) => {
    if (!data.paramData || !Array.isArray(data.paramData)) {
      updateOutput("Aucune donnée paramData valide trouvée.", "error");
      hideLoader();
      return;
    }

    const managerKey = data.managerData ? integratorKey(data.managerData.name) : "";

    const client = data.paramData[0].client;
    const searchUrl = `https://backoffice.epack-manager.com/epack/configurateur/?search=${encodeURIComponent(client)}`;

    let successCount = 0;
    let failCount = 0;
    const failedZones = [];
    const multipleZones = data.paramData.length > 1;

    try {
      const response = await fetch(searchUrl, { method: "GET", credentials: "include" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const rows = [...doc.querySelectorAll("table.table-bordered tbody tr")];

      if (rows.length === 0) {
        updateOutput(`❌ Aucun résultat trouvé pour ${client}`, "error");
        hideLoader();
        return;
      }

      const usedIndexes = new Set();
      const paramMap = {};
      const paramIds = [];

      for (const { zone, integrator } of data.paramData) {
        let found = false;

        for (let i = 0; i < rows.length; i++) {
          if (usedIndexes.has(i)) continue;

          const row = rows[i];
          const tds = row.querySelectorAll("td");
          const zoneCellText = tds[4]?.textContent?.trim() || "";
          const nameCellText = tds[2]?.textContent?.trim() || "";

          const rowKey = integratorKey(nameCellText);
          const expectedKey = integratorKey(integrator);

          if (
            normalizeText(zoneCellText) === normalizeText(zone) &&
            (!expectedKey || keysMatch(rowKey, expectedKey))
          ) {
            const link = row.querySelector("a[href]")?.getAttribute("href");
            if (link) {
              const fullUrl = `https://backoffice.epack-manager.com${link}`;
              chrome.tabs.create({ url: fullUrl, active: false });
              const id = link.split('/').pop();
              if (multipleZones) {
                paramMap[zone] = id;
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

      // Résumé
      let summary = `✅ ${successCount} zone(s) ouverte(s).\n`;
      if (failCount > 0) {
        summary += `❌ ${failCount} zone(s) introuvable(s) : ${failedZones.join(", ")}`;
        updateOutput(summary, "error");
      } else {
        updateOutput(summary, "success");
      }

    } catch (err) {
      console.error(`❌ Erreur réseau pour ${client} :`, err);
      updateOutput(`Erreur lors de la recherche pour ${client}`, "error");
    } finally {
      hideLoader();
    }
  });
});

// 🧠 Tout créer
document.getElementById("doAll").addEventListener("click", () => {
  document.getElementById("createSolution").click();
  setTimeout(() => {
    document.getElementById("createUser").click();
  }, 3000);
  setTimeout(() => {
    document.getElementById("openParam").click();
  }, 6000);
});

// 🤖 Tout faire
document.getElementById("doEverything").addEventListener("click", () => {
  document.getElementById("doAll").click();
  setTimeout(() => {
    document.getElementById("connectAll").click();
  }, 9000);
});

// 🔗 Tout connecter
document.getElementById("connectAll").addEventListener("click", () => {
  showLoader("Association en cours...");
  chrome.storage.local.get(["solutionMap", "solutionId", "paramMap", "paramIds", "userId"], data => {
    const { solutionMap, solutionId, paramMap, paramIds, userId } = data;
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

      const paramErrors = [];
      if (multipleZones) {
        for (const [zone, pid] of Object.entries(paramMap)) {
          const sid = solutionMap[zone];
          if (!sid) {
            paramErrors.push(zone);
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
            if (!res.ok) paramErrors.push(zone);
          } catch (err) {
            paramErrors.push(zone);
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
        updateOutput(`Utilisateur associé mais paramètres en échec : ${paramErrors.join(', ')}`, "error");
      } else {
        updateOutput(`Erreur association utilisateur : ${userError}`, "error");
      }

      hideLoader();
    });
  });
});


// Afficher données à l'ouverture
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["partnerData", "managerData", "paramData"], (data) => {
    const container = document.getElementById("client-info");
    let html = "";

    // 🏢 Client
    if (data.partnerData) {
      const c = data.partnerData;
      html += `🏢 <strong style="color:#223836;">Client</strong><br>
🔹 Nom : ${c.name || "-"}<br>
🔹 Adresse : ${c.street || "-"}, ${c.zip || "-"} ${c.city || "-"}<br>`;
    }

    // 👤 Manager
    if (data.managerData) {
      const u = data.managerData;
      html += `👤 <strong style="color:#223836;">Manager</strong><br>
🔹 Nom : ${u.name || "-"}<br>
🔹 Fonction : ${u.function || "-"}<br>
🔹 Téléphone : ${u.mobile || "-"}<br>
🔹 Email : ${u.email || "-"}<br>`;
    }

    // 🧩 Paramètres
    if (Array.isArray(data.paramData)) {
      if (data.paramData.length > 0 && typeof data.paramData[0] === "object") {
        if (data.paramData.length > 1) {
          html += `🧩 <strong style="color:#223836;">Paramètres détectés</strong><br>
    <ul style="margin: 4px 0 0 16px; padding: 0;">` +
            data.paramData
              .map((p, idx) =>
                `<li>🔸 ${p.client} (${p.integrator || '-'}) – <input type="text" class="zone-input" data-index="${idx}" value="${p.zone}" /></li>`
              )
              .join("") +
            `</ul>`;
        } else {
          const p = data.paramData[0];
          html += `🧩 <strong style="color:#223836;">Paramètre détecté</strong><br>
    🔸 ${p.client} (${p.integrator || '-'}) – ${p.zone}`;
        }
      } else {
        html += `🧩 <strong style="color:#223836;">Paramètres détectés</strong><br>
    <ul style="margin: 4px 0 0 16px; padding: 0;">` +
          data.paramData.map(p => `<li>🔸 ${p}</li>`).join("") +
          `</ul>`;
      }
    } else if (data.paramData) {
      html += `🧩 <strong style="color:#223836;">Paramètre détecté</strong><br>
    🔸 ${data.paramData}`;
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
