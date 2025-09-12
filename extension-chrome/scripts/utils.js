// Fonctions utilitaires partagées entre le popup et le service worker

/**
 * Supprime les accents, espaces et underscores puis met en minuscule.
 * @param {string} str Texte à normaliser
 * @returns {string}
 */
export function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "")
    .toLowerCase();
}

/**
 * Génère une clé d'intégrateur à partir d'un nom complet.
 * @param {string} name Nom complet (ex: "Jean DUPONT")
 * @returns {string}
 */
export function integratorKey(name) {
  if (!name) return "";
  const cleanName = name.replace(/_/g, " ").trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) {
    return normalizeText(parts[0]);
  }
  const prenomInitial = parts[0][0] || "";
  const nom = parts.slice(1).join("");
  return normalizeText(prenomInitial + nom);
}

/**
 * Compare deux clés intégrateur avec une tolérance sur le préfixe.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function keysMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Redimensionne automatiquement un textarea en fonction de son contenu.
 * @param {HTMLTextAreaElement} el
 */
export function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Retourne une promesse résolue après le délai indiqué.
 * @param {number} ms Durée en millisecondes
 * @returns {Promise<void>}
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Récupère la valeur du cookie BOSSID dans le backoffice.
 * @param {(id: string|null) => void} callback
 */
export function getBOSSID(callback) {
  chrome.cookies.get(
    { url: "https://backoffice.epack-manager.com", name: "BOSSID" },
    (cookie) => callback(cookie ? cookie.value : null),
  );
}

/**
 * Effectue une requête fetch en ajoutant le cookie BOSSID.
 * @param {string} url
 * @param {string} method
 * @param {string} BOSSID
 * @param {Object} [headers]
 * @param {BodyInit|null} [body]
 * @returns {Promise<Response>}
 */
export function fetchWithCookie(url, method, BOSSID, headers = {}, body = null) {
  return fetch(url, {
    method,
    headers: {
      Cookie: `BOSSID=${BOSSID}`,
      ...headers,
    },
    body,
  });
}

/**
 * Vérifie si un utilisateur existe dans le backoffice.
 * @param {string} email Adresse mail à rechercher
 * @param {(id: string|null) => void} callback Callback recevant l'id ou null
 */
export function checkIfUserExists(email, callback) {
  const url = `https://backoffice.epack-manager.com/epack/manager/user/?search=${encodeURIComponent(email)}`;
  fetch(url, { method: "GET", credentials: "include" })
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const userIdCell = doc.querySelector(
        "table.table-bordered tr.color td:first-child",
      );
      if (userIdCell) {
        const userId = userIdCell.textContent.trim();
        chrome.storage.local.set({ userId });
        callback(userId);
      } else {
        callback(null);
      }
    })
    .catch(() => callback(null));
}

/**
 * Sépare un nom complet en nom et prénom.
 * @param {string} name
 * @returns {{nom: string, prenom: string}}
 */
export function splitName(name) {
  const parts = name.split(" ");
  const prenom = parts.find((part) => part[0] === part[0].toUpperCase());
  const nom = parts.filter((part) => part !== prenom).join(" ").toUpperCase();
  return { nom, prenom };
}

/**
 * Mappe un code langue vers l'identifiant attendu par ePack Manager.
 * @param {string} code Code langue (ex: fr_FR)
 * @returns {string}
 */
export function getLangId(code) {
  const map = {
    fr_FR: "1",
    en_US: "2",
    en_GB: "2",
    it_IT: "3",
    de_DE: "4",
    pt_PT: "5",
    pt_BR: "5",
    es_ES: "6",
    pl_PL: "7",
    ca_ES: "8",
    nl_NL: "9",
    zh_CN: "10",
    zh_TW: "10",
    ar_SY: "11",
    ar_EG: "11",
    ar: "11",
    el_GR: "12",
  };
  return map[code] || "1";
}

/**
 * Détermine un code langue à partir du pays.
 * @param {string} country
 * @returns {string}
 */
export function getLangFromCountry(country) {
  const map = {
    France: "fr_FR",
    Belgique: "fr_FR",
    Suisse: "fr_FR",
    Canada: "en_US",
    "États-Unis": "en_US",
    "Royaume-Uni": "en_GB",
    Espagne: "es_ES",
    Italie: "it_IT",
    Allemagne: "de_DE",
    Portugal: "pt_PT",
    Brésil: "pt_BR",
    "Pays-Bas": "nl_NL",
    Pologne: "pl_PL",
    Chine: "zh_CN",
    Grèce: "el_GR",
    "Arabie saoudite": "ar_SY",
    Égypte: "ar_EG",
    "Émirats arabes unis": "ar_SY",
  };
  return map[country] || "fr_FR";
}

/**
 * Retourne l'emoji de drapeau correspondant au pays.
 * @param {string} country
 * @returns {string}
 */
export function getFlagEmoji(country) {
  const codes = {
    France: "FR",
    Belgique: "BE",
    Suisse: "CH",
    Canada: "CA",
    "États-Unis": "US",
    "Royaume-Uni": "GB",
    Espagne: "ES",
    Italie: "IT",
    Allemagne: "DE",
    Portugal: "PT",
    Brésil: "BR",
    "Pays-Bas": "NL",
    Pologne: "PL",
    Chine: "CN",
    Grèce: "GR",
  };
  const code = codes[country];
  if (!code) return "";
  return String.fromCodePoint(...code.split("").map((c) => c.charCodeAt(0) + 127397));
}

