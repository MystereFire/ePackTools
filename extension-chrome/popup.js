// Fonctions utilitaires et UI importées
import {
  showLoader,
  hideLoader,
  updateOutput,
  updateSondeOutput,
} from "./scripts/popup-ui.js";
import { sondeUtils } from "./scripts/sondes.js";
import { bluconsoleApi } from "./scripts/bluconsole.js";
import { logger } from "./logger.js";

const REMOTE_MANIFEST_URL =
  "https://raw.githubusercontent.com/MystereFire/ePackTools/main/extension-chrome/manifest.json";
import { resetOdooSession } from "./scripts/odoo-stock.js";
import {
  normalizeText,
  integratorKey,
  keysMatch,
  autoResizeTextarea,
  getBOSSID,
  fetchWithCookie,
  checkIfUserExists,
  splitName,
  getLangId,
  getLangFromCountry,
  getFlagEmoji,
} from "./scripts/utils.js";

const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const settingsButton = document.getElementById("openSettings");
const settingsPanel = document.getElementById("settings-panel");
const closeSettingsButton = document.getElementById("closeSettings");
const container = document.querySelector(".container");
const feedbackLayer = document.querySelector(".feedback-layer");
const MIN_POPUP_HEIGHT = 300;

function normalizeVersionParts(version = "") {
  return version
    .split(".")
    .map((part) => parseInt(part, 10))
    .map((num) => (Number.isNaN(num) ? 0 : num));
}

function compareVersions(localVersion, remoteVersion) {
  const localParts = normalizeVersionParts(localVersion);
  const remoteParts = normalizeVersionParts(remoteVersion);
  const len = Math.max(localParts.length, remoteParts.length);
  for (let i = 0; i < len; i += 1) {
    const l = localParts[i] ?? 0;
    const r = remoteParts[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

async function fetchRemoteManifestVersion() {
  const response = await fetch(REMOTE_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const manifest = await response.json();
  return manifest?.version ?? null;
}

function checkExtensionVersion(currentVersion, badgeEl) {
  fetchRemoteManifestVersion()
    .then((remoteVersion) => {
      if (!remoteVersion || !badgeEl) return;
      if (compareVersions(currentVersion, remoteVersion) < 0) {
        badgeEl.classList.add("outdated");
        badgeEl.title = `Nouvelle version disponible (${remoteVersion})`;
        updateOutput(
          `Une nouvelle version (${remoteVersion}) est disponible. Vous utilisez ${currentVersion}.`,
          "info",
        );
      } else {
        badgeEl.title = "Extension à jour";
      }
    })
    .catch((err) => {
      badgeEl && (badgeEl.title = "Version locale");
      logger.warn("Impossible de vérifier la version distante", err);
    });
}

function updatePopupHeight() {
  requestAnimationFrame(() => {
    if (!container) return;
    document.body.style.height = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.minHeight = "0px";
    document.documentElement.style.minHeight = "0px";

    const containerRect = container.getBoundingClientRect();
    let height = containerRect.height;

    if (feedbackLayer) {
      const layerRect = feedbackLayer.getBoundingClientRect();
      const layerBottom = layerRect.bottom - containerRect.top;
      height = Math.max(height, layerBottom + 20);
    }

    const ceilHeight = Math.ceil(Math.max(height, MIN_POPUP_HEIGHT));
    document.body.style.height = `${ceilHeight}px`;
    document.body.style.minHeight = `${ceilHeight}px`;
    document.documentElement.style.height = `${ceilHeight}px`;
    document.documentElement.style.minHeight = `${ceilHeight}px`;
  });
}

if (container && typeof ResizeObserver !== "undefined") {
  const resizeObserver = new ResizeObserver(() => updatePopupHeight());
  resizeObserver.observe(container);
  if (settingsPanel) {
    resizeObserver.observe(settingsPanel);
  }
  if (feedbackLayer) {
    resizeObserver.observe(feedbackLayer);
  }
  updatePopupHeight();
}

window.addEventListener("resize", updatePopupHeight);

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tab === tabName);
  });
  updatePopupHeight();
}

function isSettingsOpen() {
  return settingsPanel?.classList.contains("open");
}

function toggleSettings(open) {
  if (!settingsPanel) return;
  const shouldOpen = open ?? !isSettingsOpen();
  settingsPanel.classList.toggle("open", shouldOpen);
  settingsPanel.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  settingsButton?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  container?.classList.toggle("settings-open", shouldOpen);

  if (shouldOpen) {
    const firstField = settingsPanel.querySelector(
      "input, select, textarea, button",
    );
    firstField?.focus({ preventScroll: true });
  } else {
    settingsButton?.focus({ preventScroll: true });
  }
  updatePopupHeight();
}

if (tabButtons.length > 0) {
  const defaultTab =
    tabButtons.find((btn) => btn.classList.contains("active"))?.dataset.tab ||
    "backoffice";
  switchTab(defaultTab);
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.addEventListener("popupHeightChanged", () => updatePopupHeight());
document.addEventListener("DOMContentLoaded", () => {
  updatePopupHeight();
});

if (settingsButton) {
  settingsButton.addEventListener("click", () => toggleSettings());
  settingsButton.setAttribute("aria-expanded", "false");
}

if (closeSettingsButton) {
  closeSettingsButton.addEventListener("click", () => toggleSettings(false));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSettingsOpen()) {
    toggleSettings(false);
  }
});

async function createUser(BOSSID, userData) {
  try {
    const html = await fetchWithCookie(
      "https://backoffice.epack-manager.com/epack/manager/user/new",
      "GET",
      BOSSID,
    ).then((r) => r.text());

    const doc = new DOMParser().parseFromString(html, "text/html");
    const tokenValue = doc.querySelector("#user__token")?.value;
    if (!tokenValue) {
      updateOutput("Token introuvable pour création utilisateur.", "error");
      hideLoader();
      return;
    }

    const { nom, prenom } = splitName(userData.name);
    const body = new URLSearchParams({
      "user[_token]": tokenValue,
      "user[email]": userData.email,
      "user[jobTitle]": userData.function || "/",
      "user[lang]": getLangId(getLangFromCountry(userData.country)),
      "user[nom]": nom || "/",
      "user[prenom]": prenom,
      "user[telephoneMobile]": userData.mobile || "/",
      "user[typeContrat]": "1",
      "user[user_type]": "1",
    });

    const response = await fetchWithCookie(
      "https://backoffice.epack-manager.com/epack/manager/user/new",
      "POST",
      BOSSID,
      { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    );

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
  } catch (error) {
    updateOutput(`Erreur création utilisateur : ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

// 🔐 Charger les infos au démarrage
document.addEventListener("DOMContentLoaded", () => {
  const sondeTextarea = document.getElementById("sonde-ids");
  const versionBadge = document.getElementById("extension-version");
  if (versionBadge && chrome?.runtime?.getManifest) {
    const { version } = chrome.runtime.getManifest();
    versionBadge.textContent = `v${version}`;
    checkExtensionVersion(version, versionBadge);
  }
  sondeTextarea.addEventListener("input", () => autoResizeTextarea(sondeTextarea));
  chrome.storage.local.get(
    [
      "probeEmail",
      "probePassword",
      "odooEmail",
      "odooApiKey",
      "sondeIds",
      "lastSondeResults",
    ],
    (data) => {
      if (data.probeEmail) {
        document.getElementById("sonde-email").value = data.probeEmail;
      }
      if (data.probePassword) {
        document.getElementById("sonde-password").value = data.probePassword;
      }
      if (data.odooEmail) {
        document.getElementById("odoo-email").value = data.odooEmail;
      }
      if (data.odooApiKey) {
        document.getElementById("odoo-api-key").value = data.odooApiKey;
      }

      if (Array.isArray(data.sondeIds)) {
        sondeTextarea.value = data.lastSondeResults
          ? data.lastSondeResults.join("\n---\n")
          : data.sondeIds.join("\n");
      }
      autoResizeTextarea(sondeTextarea);
    },
  );
});

// 💾 Sauvegarder email et mot de passe
document.getElementById("sonde-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("sonde-email").value.trim();
  const password = document.getElementById("sonde-password").value.trim();
  const odooEmail = document.getElementById("odoo-email").value.trim();
  const odooApiKey = document.getElementById("odoo-api-key").value.trim();

  chrome.storage.local.set(
    {
      probeEmail: email,
      probePassword: password,
      odooEmail,
      odooApiKey,
    },
    () => {
      resetOdooSession();
      updateSondeOutput(
        "🧪 Identifiants BluConsole et Odoo enregistrés !",
        "success",
      );
    },
  );
});

document.getElementById("testConnexion").addEventListener("click", () => {
  const email = document.getElementById("sonde-email").value.trim();
  const password = document.getElementById("sonde-password").value.trim();

  if (!email || !password) {
    updateSondeOutput(
      "❌ Veuillez saisir un email et un mot de passe.",
      "error",
    );
    return;
  }

  bluconsoleApi
    .login(email, password)
    .then(() => {
      updateSondeOutput("Connexion BluConsole reussie.", "success");
    })
    .catch((err) => {
      updateSondeOutput(
        "Erreur BluConsole : " + (err.message || "Impossible de se connecter."),
        "error",
      );
    });
});

document.getElementById("verifierSondes").addEventListener("click", () => {
  const ids = document
    .getElementById("sonde-ids")
    .value.split("\n")
    .filter((line) => line.trim() && !/^[-]{3,}$/.test(line.trim()));
  chrome.storage.local.set({ sondeIds: ids }, () => {
    sondeUtils.verifierSondes();
  });
});

document.getElementById("stockSondes").addEventListener("click", () => {
  const ids = document
    .getElementById("sonde-ids")
    .value.split("\n")
    .filter((line) => line.trim() && !/^[-]{3,}$/.test(line.trim()))
    .map((line) => line.split(" ")[0].trim());
  chrome.storage.local.set({ sondeIds: ids }, () => {
    sondeUtils.recupererStockSondes();
  });
});

// Créer une solution
async function createSolutionAction(typeVersion = "V5", buttonId = "createSolution") {
  const btn = document.getElementById(buttonId);
  if (!btn) {
    updateOutput("Bouton introuvable pour la création de solution.", "error");
    return;
  }

  const defaultIcon = btn.dataset.icon || `<i class="fas fa-desktop"></i>`;
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

  const d = await new Promise((r) =>
    chrome.storage.local.get("parameterData", r),
  );
  const hasZones = Array.isArray(d.parameterData) && d.parameterData.length > 1;
  showLoader(
    hasZones ? "Création des solutions..." : "Création de la solution...",
  );

  const BOSSID = await new Promise((r) => getBOSSID(r));
  if (!BOSSID) {
    updateOutput("Le cookie BOSSID est introuvable.", "error");
    btn.disabled = false;
    btn.innerHTML = defaultIcon;
    hideLoader();
    return;
  }

  const data = await new Promise((r) =>
    chrome.storage.local.get(["clientData", "parameterData"], r),
  );
  if (!data.clientData) {
    updateOutput("Aucune donnée client trouvée.", "error");
    btn.disabled = false;
    btn.innerHTML = defaultIcon;
    hideLoader();
    return;
  }

  const client = data.clientData;
  const multi =
    Array.isArray(data.parameterData) && data.parameterData.length > 1;

  if (multi) {
    const solutionsMap = {};
    for (const param of data.parameterData) {
      const zoneName = param.zone;
      try {
        const html = await fetchWithCookie(
          "https://backoffice.epack-manager.com/epack/manager/solution/new",
          "GET",
          BOSSID,
        ).then((r) => r.text());
        const doc = new DOMParser().parseFromString(html, "text/html");
        const token = doc.querySelector("#solution__token")?.value;
        if (!token) throw new Error("Token manquant");

        const body = new URLSearchParams({
          "solution[_token]": token,
          "solution[adresse]": client.street || "TEST",
          "solution[codePostal]": client.zip || "TEST",
          "solution[enseigne]": `${client.name || "TEST"} - ${zoneName}`,
          "solution[latitude]": client.partner_latitude || "0",
          "solution[longitude]": client.partner_longitude || "0",
          "solution[mac]": "",
          "solution[statusApi]": "0",
          "solution[ticketfile]": "1",
          "solution[versionEpack]": "",
          "solution[ville]": client.city || "TEST",
          "solution[typeVersion]": typeVersion,
          "solution[statusMaj]": "1",
        });

        const response = await fetchWithCookie(
          "https://backoffice.epack-manager.com/epack/manager/solution/new",
          "POST",
          BOSSID,
          { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        );
        const match = response.url.match(/solution\/(\d+)/);
        if (match) {
          solutionsMap[param.id] = match[1];
          chrome.tabs.create({ url: response.url, active: false });
        }
      } catch (err) {
        updateOutput(
          `Erreur création pour zone ${zoneName} : ${err.message}`,
          "error",
        );
      }
    }

    await new Promise((resolve) => chrome.storage.local.set({ solutionsMap }, resolve));
    if (Object.keys(solutionsMap).length === data.parameterData.length) {
      updateOutput("Solutions créées avec succès !", "success");
    } else {
      const failed = data.parameterData
        .filter((p) => !solutionsMap[p.id])
        .map((p) => p.zone)
        .join(", ");
      updateOutput(`Solutions incomplètes : ${failed}`, "error");
    }
  } else {
    try {
      const html = await fetchWithCookie(
        "https://backoffice.epack-manager.com/epack/manager/solution/new",
        "GET",
        BOSSID,
      ).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, "text/html");
      const token = doc.querySelector("#solution__token")?.value;
      if (!token) throw new Error("Token manquant");

      const body = new URLSearchParams({
        "solution[_token]": token,
        "solution[adresse]": client.street || "TEST",
        "solution[codePostal]": client.zip || "TEST",
        "solution[enseigne]": client.name || "TEST",
        "solution[latitude]": client.partner_latitude || "0",
        "solution[longitude]": client.partner_longitude || "0",
        "solution[mac]": "",
        "solution[statusApi]": "0",
        "solution[ticketfile]": "1",
        "solution[versionEpack]": "",
        "solution[ville]": client.city || "TEST",
        "solution[typeVersion]": typeVersion,
        "solution[statusMaj]": "1",
      });

      const response = await fetchWithCookie(
        "https://backoffice.epack-manager.com/epack/manager/solution/new",
        "POST",
        BOSSID,
        { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      );
      const match = response.url.match(/solution\/(\d+)/);
      if (match) {
        await new Promise((resolve) => chrome.storage.local.set({ solutionId: match[1] }, resolve));
      }
      updateOutput("Solution créée avec succès !", "success");
      chrome.tabs.create({ url: response.url, active: false });
    } catch (err) {
      updateOutput("Erreur : " + err.message, "error");
    }
  }

  hideLoader();
  btn.disabled = false;
  btn.innerHTML = defaultIcon;
}

document.getElementById("createSolution").addEventListener("click", () => {
  createSolutionAction("V5");
});

document.getElementById("createSolutionV4").addEventListener("click", () => {
  createSolutionAction("V4", "createSolutionV4");
});

// 👤 Créer un utilisateur
async function createUserAction() {
  showLoader("Recherche des données utilisateur...");
  const data = await new Promise((r) =>
    chrome.storage.local.get(["managerInfo", "clientData"], r),
  );
  if (!data.managerInfo) {
    updateOutput("Aucune donnée utilisateur trouvée.", "error");
    hideLoader();
    return;
  }
  const { email, name, mobile, function: userFunction } = data.managerInfo;
  const clientCountry = Array.isArray(data.clientData?.country_id)
    ? data.clientData.country_id[1]
    : "";
  const userId = await new Promise((r) => checkIfUserExists(email, r));
  if (userId) {
    updateOutput(`Utilisateur existant : ${userId}`, "info");
    chrome.tabs.create({
      url: `https://backoffice.epack-manager.com/epack/manager/user/${userId}`,
      active: false,
    });
    hideLoader();
  } else {
    const BOSSID = await new Promise((r) => getBOSSID(r));
    if (!BOSSID) {
      updateOutput("Le cookie BOSSID est introuvable.", "error");
      hideLoader();
      return;
    }
    await createUser(BOSSID, {
      email,
      name,
      mobile,
      function: userFunction,
      country: clientCountry,
    });
  }
}

document.getElementById("createUser").addEventListener("click", () => {
  createUserAction();
});

// 🧩 Ouvrir les paramètres

// 🧠 Tout créer
async function openParamAction() {
  showLoader("Chargement des paramètres...");
  const data = await new Promise((r) =>
    chrome.storage.local.get(["parameterData", "managerInfo"], r),
  );
  if (!data.parameterData || !Array.isArray(data.parameterData)) {
    updateOutput("Aucune donnée parameterData valide trouvée.", "error");
    hideLoader();
    return;
  }

  const managerKey = data.managerInfo
    ? integratorKey(data.managerInfo.name)
    : "";

  const client = data.parameterData[0].client;
  const searchUrl = `https://backoffice.epack-manager.com/epack/configurateur/?search=${encodeURIComponent(client)}`;

  let successCount = 0;
  let failCount = 0;
  const failedZones = [];
  const multipleZones = data.parameterData.length > 1;

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      credentials: "include",
    });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [...doc.querySelectorAll("table.table-bordered tbody tr")];

    if (rows.length === 0) {
      updateOutput(`❌ Aucun résultat trouvé pour ${client}`, "error");
      hideLoader();
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
        const tds = row.querySelectorAll("td");
        const zoneCellText = tds[4]?.textContent?.trim() || "";
        const nameCellText = tds[2]?.textContent?.trim() || "";

        const rowKey = integratorKey(nameCellText);
        const expectedKey = integratorKey(integrator);

        if (
          normalizeText(zoneCellText) === normalizeText(searchZone) &&
          (!expectedKey || keysMatch(rowKey, expectedKey))
        ) {
          const link = row.querySelector("a[href]")?.getAttribute("href");
          if (link) {
            const fullUrl = `https://backoffice.epack-manager.com${link}`;
            chrome.tabs.create({ url: fullUrl, active: false });
            const id = link.split("/").pop();
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
      await new Promise((resolve) => chrome.storage.local.set({ parameterMap }, resolve));
    } else {
      await new Promise((resolve) => chrome.storage.local.set({ parameterIds }, resolve));
    }

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
}

document.getElementById("openParam").addEventListener("click", () => {
  openParamAction();
});
async function runSetupSequence({ includeConnect = false } = {}) {
  await createSolutionAction("V5");
  await createUserAction();
  await openParamAction();
  if (includeConnect) {
    await connectAllAction();
  }
}

document.getElementById("doAll").addEventListener("click", () => {
  runSetupSequence().catch((err) => {
    console.error("runSetupSequence failed", err);
    updateOutput(`Erreur scenario automatique : ${err.message || err}`, "error");
    hideLoader();
  });
});

document.getElementById("doEverything").addEventListener("click", async () => {
  const keysToRemove = [
    "solutionsMap",
    "solutionId",
    "parameterMap",
    "parameterIds",
    "userId",
  ];
  try {
    await new Promise((resolve) => chrome.storage.local.remove(keysToRemove, resolve));
    await runSetupSequence({ includeConnect: true });
  } catch (err) {
    console.error("doEverything failed", err);
    updateOutput(`Erreur scenario complet : ${err.message || err}`, "error");
    hideLoader();
  }
});

// Afficher données à l'ouverture
document.getElementById("connectAll").addEventListener("click", () => {
  connectAllAction().catch((err) => {
    console.error("connectAllAction failed", err);
    updateOutput(`Erreur association utilisateur : ${err.message || err}`, "error");
    hideLoader();
  });
});

async function connectAllAction() {
  showLoader("Association en cours...");
  const data = await new Promise((resolve) =>
    chrome.storage.local.get(
      [
        "solutionsMap",
        "solutionId",
        "parameterMap",
        "parameterIds",
        "userId",
        "parameterData",
      ],
      resolve,
    ),
  );

  const {
    solutionsMap,
    solutionId,
    parameterMap,
    parameterIds,
    userId,
    parameterData,
  } = data;
  const multipleZones = solutionsMap && parameterMap;
  if (multipleZones) {
    if (!userId) {
      updateOutput("ID manquant pour la connexion.", "error");
      hideLoader();
      return;
    }
  } else if (
    !solutionId ||
    !Array.isArray(parameterIds) ||
    parameterIds.length === 0 ||
    !userId
  ) {
    updateOutput("ID manquant pour la connexion.", "error");
    hideLoader();
    return;
  }

  const BOSSID = await new Promise((resolve) => getBOSSID(resolve));
  if (!BOSSID) {
    updateOutput("Le cookie BOSSID est introuvable.", "error");
    hideLoader();
    return;
  }

  const idToZone = {};
  if (Array.isArray(parameterData)) {
    for (const p of parameterData) idToZone[p.id] = p.zone;
  }

  const paramErrors = [];
  if (multipleZones) {
    for (const [pidKey, pid] of Object.entries(parameterMap)) {
      const sid = solutionsMap[pidKey];
      if (!sid) {
        paramErrors.push(pidKey);
        continue;
      }
      try {
        const body = new URLSearchParams({ solutionId: sid });
        const res = await fetchWithCookie(
          `https://backoffice.epack-manager.com/epack/configurateur/addSolutionToConfiguration/${pid}`,
          "POST",
          BOSSID,
          { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        );
        if (!res.ok && res.status !== 302) paramErrors.push(pidKey);
      } catch (err) {
        paramErrors.push(pidKey);
      }
    }
  } else {
    for (const pid of parameterIds) {
      try {
        const body = new URLSearchParams({ solutionId });
        const res = await fetchWithCookie(
          `https://backoffice.epack-manager.com/epack/configurateur/addSolutionToConfiguration/${pid}`,
          "POST",
          BOSSID,
          { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        );
        if (!res.ok && res.status !== 302) paramErrors.push(pid);
      } catch (err) {
        paramErrors.push(pid);
      }
    }
  }

  let userError = null;
  const solutionIds = multipleZones ? Object.values(solutionsMap) : [solutionId];
  for (const sid of solutionIds) {
    try {
      const body = new URLSearchParams({
        referer: "epack_manager_user_show",
        solutionId: sid,
      });
      const userRes = await fetchWithCookie(
        `https://backoffice.epack-manager.com/epack/manager/user/addSolutionToUser/${userId}`,
        "POST",
        BOSSID,
        { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      );
      if (!userRes.ok) userError = `user association -> ${userRes.status}`;
    } catch (err) {
      userError = err.message;
    }
  }

  if (!userError && paramErrors.length === 0) {
    updateOutput("Associations realisees avec succes !", "success");
  } else if (!userError) {
    const displayErr = paramErrors.map((id) => idToZone[id] || id).join(", ");
    updateOutput(
      `Utilisateur associe mais parametres en echec : ${displayErr}`,
      "error",
    );
  } else {
    updateOutput(`Erreur association utilisateur : ${userError}`, "error");
  }

  hideLoader();
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["clientData", "managerInfo", "parameterData"],
    (data) => {
      const container = document.getElementById("client-info");
      let html = "";

      // 🏢 Client
      if (data.clientData) {
        const c = data.clientData;
        html += `<div class="info-block"><h3>🏢 Client</h3><ul>
        <li><strong>Nom :</strong> ${c.name || "-"}</li>
        <li><strong>Adresse :</strong> ${c.street || "-"}, ${c.zip || "-"} ${c.city || "-"}</li>
        <li><strong>Pays :</strong> ${c.country_id ? c.country_id[1] : "-"} ${getFlagEmoji(c.country_id ? c.country_id[1] : "")}</li>
      </ul></div>`;
      }

      // 👤 Manager
      if (data.managerInfo) {
        const u = data.managerInfo;
        const clientCountry = data.clientData?.country_id
          ? data.clientData.country_id[1]
          : "";
        html += `<div class="info-block"><h3>👤 Manager</h3><ul>
        <li><strong>Nom :</strong> ${u.name || "-"}</li>
        <li><strong>Fonction :</strong> ${u.function || "-"}</li>
        <li><strong>Téléphone :</strong> ${u.mobile || "-"}</li>
        <li><strong>Email :</strong> ${u.email || "-"}</li>
        <li><strong>Langue :</strong> ${getLangFromCountry(clientCountry)}</li>
      </ul></div>`;
      }

      // 🧩 Paramètres
      if (Array.isArray(data.parameterData)) {
        if (
          data.parameterData.length > 0 &&
          typeof data.parameterData[0] === "object"
        ) {
          if (data.parameterData.length > 1) {
            html +=
              `<div class="info-block"><h3>🧩 Paramètres détectés</h3><ul>` +
              data.parameterData
                .map(
                  (p, idx) =>
                    `<li>🔸 ${p.client} (${p.integrator || "-"}) – <input type="text" class="zone-input" data-index="${idx}" value="${p.zone}" /></li>`,
                )
                .join("") +
              `</ul></div>`;
          } else {
            const p = data.parameterData[0];
            html += `<div class="info-block"><h3>🧩 Paramètre détecté</h3><ul>
            <li>🔸 ${p.client} (${p.integrator || "-"}) – ${p.zone}</li>
          </ul></div>`;
          }
        } else {
          html +=
            `<div class="info-block"><h3>🧩 Paramètres détectés</h3><ul>` +
            data.parameterData.map((p) => `<li>🔸 ${p}</li>`).join("") +
            `</ul></div>`;
        }
      } else if (data.parameterData) {
        html += `<div class="info-block"><h3>🧩 Paramètre détecté</h3><ul>
        <li>🔸 ${data.parameterData}</li>
      </ul></div>`;
      }

      container.innerHTML = html || "Aucune donnée trouvée.";

      const hasClient = !!data.clientData;
      const hasManager = !!data.managerInfo;
      const hasParams = Array.isArray(data.parameterData)
        ? data.parameterData.length > 0
        : !!data.parameterData;

      const solutionButtons = [
        document.getElementById("createSolution"),
        document.getElementById("createSolutionV4"),
      ];
      solutionButtons.forEach((btn) => {
        if (!btn) return;
        if (hasClient) {
          btn.disabled = false;
          btn.classList.remove("button-error");
        } else {
          btn.disabled = true;
          btn.classList.add("button-error");
        }
      });

      const createUserBtn = document.getElementById("createUser");
      if (createUserBtn) {
        if (hasManager) {
          createUserBtn.disabled = false;
          createUserBtn.classList.remove("button-error");
        } else {
          createUserBtn.disabled = true;
          createUserBtn.classList.add("button-error");
        }
      }

      const openParamBtn = document.getElementById("openParam");
      if (openParamBtn) {
        if (hasParams) {
          openParamBtn.disabled = false;
          openParamBtn.classList.remove("button-error");
        } else {
          openParamBtn.disabled = true;
          openParamBtn.classList.add("button-error");
        }
      }

      const anyMissing = !hasClient || !hasManager || !hasParams;
      const connectAllBtn = document.getElementById("connectAll");
      if (connectAllBtn) {
        if (anyMissing) {
          connectAllBtn.disabled = true;
          connectAllBtn.classList.add("button-error");
        } else {
          connectAllBtn.disabled = false;
          connectAllBtn.classList.remove("button-error");
        }
      }

      const doAllBtn = document.getElementById("doAll");
      if (doAllBtn) {
        if (anyMissing) {
          doAllBtn.disabled = true;
          doAllBtn.classList.add("button-error");
        } else {
          doAllBtn.disabled = false;
          doAllBtn.classList.remove("button-error");
        }
      }

      const doEverythingBtn = document.getElementById("doEverything");
      if (doEverythingBtn) {
        if (anyMissing) {
          doEverythingBtn.disabled = true;
          doEverythingBtn.classList.add("button-error");
        } else {
          doEverythingBtn.disabled = false;
          doEverythingBtn.classList.remove("button-error");
        }
      }

      document.querySelectorAll(".zone-input").forEach((input) => {
        input.addEventListener("input", () => {
          const idx = parseInt(input.getAttribute("data-index"), 10);
          const val = input.value.trim();
          chrome.storage.local.get("parameterData", (d) => {
            if (Array.isArray(d.parameterData) && d.parameterData[idx]) {
              d.parameterData[idx].zone = val;
              chrome.storage.local.set({ parameterData: d.parameterData });
            }
          });
        });
      });
    },
  );
});
