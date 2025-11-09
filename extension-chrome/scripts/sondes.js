// Fonctions de vérification des sondes et hubs
import { updateSondeOutput } from "./popup-ui.js";
import { fetchSondeStocks } from "./odoo-stock.js";
import { bluconsoleApi } from "./bluconsole.js";

const STATUS_OK = "✅";
const STATUS_KO = "❌";
const FOUR_HOURS_MS = 4 * 3600 * 1000;

/**
 * Réauthentifie l'utilisateur BluConsole si besoin.
 * @returns {Promise<{token: string, rtoken: string}>}
 */
function relogin() {
  return bluconsoleApi.loginWithStoredCredentials().then((session) => ({
    token: session.token,
    rtoken: session.refreshToken,
    user: session.user,
  }));
}

function formatHubResult(id, data) {
  const row = data?.Result?.Rows?.[0];
  if (!row) return `${id} ${STATUS_KO}`;

  const lastReq = row.LastRequestAt ? new Date(row.LastRequestAt) : null;
  const recent =
    lastReq && Date.now() - lastReq.getTime() < FOUR_HOURS_MS;
  const connected =
    (row.ConnectionStatus || "").toLowerCase() === "connected";
  const badge = connected && recent ? STATUS_OK : STATUS_KO;
  const info = ` (Conn: ${row.ConnectionStatus || "-"}, Etat: ${row.Status || "-"}, Last: ${row.LastRequestAt || "-"})`;
  return `${id} ${badge}${info}`;
}

function formatProbeResult(id, data) {
  const row = data?.Result?.Rows?.[0];
  if (!row) return `${id} ${STATUS_KO}`;

  const timeStr = row.Time || null;
  const lastTime = timeStr ? new Date(timeStr) : null;
  const recent =
    lastTime && Date.now() - lastTime.getTime() < FOUR_HOURS_MS;
  const temp = (row?.Temperature?.Value ?? "?").toString();
  const battery = (row?.Battery ?? "-").toString();
  const batteryVal = parseFloat(battery);
  const batteryLow = !Number.isNaN(batteryVal) && batteryVal < 75;
  const badge = recent && !batteryLow ? STATUS_OK : STATUS_KO;
  const info = ` (Temp: ${temp}, Battery: ${battery}, Time: ${timeStr || "-"})`;
  return `${id} ${badge}${info}`;
}

/**
 * Verifie l'etat d'une liste d'identifiants de sondes/hubs.
 * @param {string[]} ids
 * @returns {Promise<string[]>}
 */
async function verifierSondesListe(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const sessionReady = await bluconsoleApi.ensureSession();
  if (!sessionReady) {
    updateSondeOutput &&
      updateSondeOutput(
        "Identifiants BluConsole manquants. Enregistrez-les puis testez la connexion.",
        "error",
      );
    return [];
  }

  const cleaned = ids.map((line) =>
    line.split(" ")[0].trim().replace(/\s+/g, ""),
  );
  const updatedLines = Array(cleaned.length);

  await Promise.all(
    cleaned.map(async (cleanId, idx) => {
      if (!cleanId) {
        updatedLines[idx] = "";
        return;
      }

      const isHub = cleanId.startsWith("0");
      const path = isHub
        ? `/hubs/?SerialNumber=${encodeURIComponent(cleanId)}`
        : `/measurements/rf/?ItemsPerPage=15&Page=1&SortBy=MaintenanceMode&Sort=DESC&Status=active&LoggerSerialNumber=${encodeURIComponent(cleanId)}`;

      try {
        const data = await bluconsoleApi.fetchJson(path);
        updatedLines[idx] = isHub
          ? formatHubResult(cleanId, data)
          : formatProbeResult(cleanId, data);
      } catch (err) {
        updatedLines[idx] = `${cleanId} ${STATUS_KO}`;
      }
    }),
  );

  return updatedLines;
}

// Vérifie les sondes depuis le textarea du popup
function verifierSondes() {
  const textarea = document.getElementById("sonde-ids");
  const rawLines = textarea.value
    .split("\n")
    .filter((line) => line.trim() && !/^[-]{3,}$/.test(line.trim()));
  if (rawLines.length === 0) {
    updateSondeOutput("Veuillez entrer au moins un ID.", "error");
    return;
  }
  verifierSondesListe(rawLines).then((result) => {
    textarea.value = result.join("\n---\n");
    chrome.storage.local.set({ lastSondeResults: result });
    textarea.dispatchEvent(new Event("input"));
  });
}

function recupererStockSondes() {
  const textarea = document.getElementById("sonde-ids");
  const rawLines = textarea.value
    .split("\n")
    .filter((line) => line.trim() && !/^[-]{3,}$/.test(line.trim()));

  if (rawLines.length === 0) {
    updateSondeOutput("Veuillez entrer au moins un ID.", "error");
    return;
  }

  const cleanedIds = rawLines.map((line) => line.split(" ")[0].trim());
  updateSondeOutput("Recherche du stock des sondes...", "info");

  fetchSondeStocks(cleanedIds)
    .then((results) => {
      const formatted = results.map((res) => {
        switch (res.status) {
          case "ok":
            if (res.quants && res.quants.length > 0) {
              const last = res.quants[res.quants.length - 1];
              return `${res.serial} 📦 ${last.locationName}`;
            } else {
              return `${res.serial} ⚠️ Stock introuvable`;
            }
          case "no_stock":
            return `${res.serial} ⚠️ Aucun stock disponible`;
          case "not_found":
            return `${res.serial} ❌ Lot introuvable`;
          case "error":
          default:
            return `${res.serial} ❌ Erreur: ${res.message || "Impossible de récupérer le stock"}`;
        }
      });

      textarea.value = formatted.join("\n---\n");
      chrome.storage.local.set({ lastSondeResults: formatted });
      textarea.dispatchEvent(new Event("input"));
      updateSondeOutput("Stocks récupérés depuis Odoo.", "success");
    })
    .catch((error) => {
      updateSondeOutput(
        `Erreur lors de la récupération des stocks: ${error.message}`,
        "error",
      );
    });
}

// Expose les fonctions au reste du projet
export const sondeUtils = {
  verifierSondes,
  verifierSondesListe,
  relogin,
  recupererStockSondes,
};
