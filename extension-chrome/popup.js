
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
  showLoader("Création de la solution...");

  getBOSSID(BOSSID => {
    if (!BOSSID) {
      updateOutput("Le cookie BOSSID est introuvable.", "error");
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-desktop"></i>`;
      hideLoader();
      return;
    }

    chrome.storage.local.get("partnerData", (data) => {
      if (!data.partnerData) {
        updateOutput("Aucune donnée client trouvée.", "error");
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-desktop"></i>`;
        hideLoader();
        return;
      }

      const client = data.partnerData;
      fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'GET', BOSSID)
        .then(response => response.text())
        .then(html => {
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

          return fetchWithCookie('https://backoffice.epack-manager.com/epack/manager/solution/new', 'POST', BOSSID, { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
        })
        .then(response => {
          const match = response.url.match(/solution\/(\d+)/);
          if (match) {
            chrome.storage.local.set({ solutionId: match[1] });
          }
          updateOutput("Solution créée avec succès !", "success");
          chrome.tabs.create({ url: response.url, active: false });
        })
        .catch(error => {
          updateOutput("Erreur : " + error.message, "error");
        })
        .finally(() => {
          hideLoader();
          btn.disabled = false;
          btn.innerHTML = `<i class="fas fa-desktop"></i>`;
        });
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
  chrome.storage.local.get("paramData", async (data) => {
    if (!data.paramData || !Array.isArray(data.paramData)) {
      updateOutput("Aucune donnée paramData valide trouvée.", "error");
      hideLoader();
      return;
    }

    const normalize = str =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();

    const client = data.paramData[0].client;
    const searchUrl = `https://backoffice.epack-manager.com/epack/configurateur/?search=${encodeURIComponent(client)}`;

    let successCount = 0;
    let failCount = 0;
    const failedZones = [];

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
      const paramIds = [];

      for (const { zone } of data.paramData) {
        let found = false;

        for (let i = 0; i < rows.length; i++) {
          if (usedIndexes.has(i)) continue;

          const row = rows[i];
          const tds = row.querySelectorAll("td");
          const zoneCellText = tds[4]?.textContent?.trim() || "";

          if (normalize(zoneCellText) === normalize(zone)) {
            const link = row.querySelector("a[href]")?.getAttribute("href");
            if (link) {
              const fullUrl = `https://backoffice.epack-manager.com${link}`;
              chrome.tabs.create({ url: fullUrl, active: false });
              const id = link.split('/').pop();
              paramIds.push(id);
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

      chrome.storage.local.set({ paramIds });

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

// 🧠 Tout faire
document.getElementById("doAll").addEventListener("click", () => {
  document.getElementById("createSolution").click();
  setTimeout(() => {
    document.getElementById("createUser").click();
  }, 3000);
  setTimeout(() => {
    document.getElementById("openParam").click();
  }, 6000);
});

// 🔗 Tout connecter
document.getElementById("connectAll").addEventListener("click", () => {
  showLoader("Association en cours...");
  chrome.storage.local.get(["solutionId", "paramIds", "userId"], data => {
    const { solutionId, paramIds, userId } = data;
    if (!solutionId || !Array.isArray(paramIds) || paramIds.length === 0 || !userId) {
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

      try {
        for (const pid of paramIds) {
          const body = new URLSearchParams({ solutionId });
          const res = await fetchWithCookie(
            `https://backoffice.epack-manager.com/epack/configurateur/addSolutionToConfiguration/${pid}`,
            'POST',
            BOSSID,
            { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          );
          if (!res.ok) throw new Error(`addSolutionToConfiguration ${pid} -> ${res.status}`);
        }

        const body = new URLSearchParams({ solutionId });
        const userRes = await fetchWithCookie(
          `https://backoffice.epack-manager.com/epack/manager/user/addSolutionToUser/${userId}?solutionId=${solutionId}&all`,
          'POST',
          BOSSID,
          body
        );
        if (!userRes.ok) throw new Error(`user association -> ${userRes.status}`);
        return updateOutput(`${userId}?solutionId=${solutionId}`)

        updateOutput("Associations réalisées avec succès !", "success");
      } catch (err) {
        updateOutput(`Erreur association : ${err.message}`, "error");
      } finally {
        hideLoader();
      }
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
        html += `🧩 <strong style="color:#223836;">Paramètres détectés</strong><br>
    <ul style="margin: 4px 0 0 16px; padding: 0;">` +
          data.paramData.map(p => `<li>🔸 ${p.client} – ${p.zone}</li>`).join("") +
          `</ul>`;
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
  });
});
