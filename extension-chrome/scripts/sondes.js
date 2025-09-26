// Fonctions de vérification des sondes et hubs
import { updateSondeOutput } from "./popup-ui.js";
import { fetchSondeStocks } from "./odoo-stock.js";

export const DEFAULT_PROXY_URL = "https://api.ligma.fr/blulog";
let proxyURL = DEFAULT_PROXY_URL;
chrome.storage.local.get("proxyURL", (data) => {
  if (data.proxyURL) proxyURL = data.proxyURL;
});

/**
 * Réauthentifie l'utilisateur BluConsole si besoin.
 * @returns {Promise<{token: string, rtoken: string}>}
 */
function relogin() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["probeEmail", "probePassword", "proxyURL"],
      (creds) => {
        const { probeEmail, probePassword, proxyURL: storedProxy } = creds;
        if (storedProxy) proxyURL = storedProxy;
        if (!probeEmail || !probePassword) {
          if (typeof updateSondeOutput === "function") {
            updateSondeOutput(
              "❌ Identifiants manquants pour reconnexion.",
              "error",
            );
          }
          return reject(new Error("missing credentials"));
        }
        fetch(`${proxyURL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: probeEmail, password: probePassword }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.token && data.refreshToken) {
              chrome.storage.local.set(
                {
                  bluconsoleToken: data.token,
                  bluconsoleRefreshToken: data.refreshToken,
                  bluconsoleUser: data.user,
                },
                () => resolve({ token: data.token, rtoken: data.refreshToken }),
              );
            } else {
              reject(new Error("login failed"));
            }
          })
          .catch((err) => reject(err));
      },
    );
  });
}

/**
 * Effectue un appel HTTP et retente après relogin si 401.
 * @param {string} url
 * @param {(creds:{token:string,rtoken:string})=>void} [updateTokens]
 */
async function fetchWithAuthRetry(url, updateTokens) {
  let res = await fetch(url);
  if (res.status === 401) {
    try {
      const creds = await relogin();
      if (updateTokens) updateTokens(creds);
      const u = new URL(url);
      u.searchParams.set("token", creds.token);
      u.searchParams.set("rtoken", creds.rtoken);
      res = await fetch(u.toString());
    } catch (e) {
      // on ignore et on renvoie la réponse originale
    }
  }
  return res.json();
}

/**
 * Vérifie l'état d'une liste d'identifiants de sondes/hubs.
 * @param {string[]} ids
 * @returns {Promise<string[]>}
 */
function verifierSondesListe(ids) {
  return new Promise((resolve) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      resolve([]);
      return;
    }

    chrome.storage.local.get(
      ["bluconsoleToken", "bluconsoleRefreshToken", "proxyURL"],
      (data) => {
        let token = data.bluconsoleToken;
        let rtoken = data.bluconsoleRefreshToken;
        if (data.proxyURL) proxyURL = data.proxyURL;

        if (!token || !rtoken) {
          updateSondeOutput &&
            updateSondeOutput(
              "❌ Token manquant. Connectez-vous d'abord.",
              "error",
            );
          resolve([]);
          return;
        }

        const cleaned = ids.map((line) =>
          line.split(" ")[0].trim().replace(/\s+/g, ""),
        );
        const updatedLines = Array(cleaned.length);

        Promise.all(
          cleaned.map((cleanId, idx) => {
            if (!cleanId) {
              updatedLines[idx] = "";
              return Promise.resolve();
            }

            const isHub = cleanId.startsWith("0");
            const url = isHub
              ? `${proxyURL}/verifier-hub?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`
              : `${proxyURL}/verifier-sonde?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`;

            return fetchWithAuthRetry(url, (creds) => {
              token = creds.token;
              rtoken = creds.rtoken;
            })
              .then((data) => {
                if (isHub) {
                  const row = data?.Result?.Rows?.[0];
                  if (row) {
                    const lastReq = row.LastRequestAt
                      ? new Date(row.LastRequestAt)
                      : null;
                    const recent =
                      lastReq && Date.now() - lastReq.getTime() < 4 * 3600 * 1000;
                    const connected =
                      row.ConnectionStatus?.toLowerCase() === "connected";
                    const emoji = connected && recent ? "✅" : "❌";
                    const info = ` (${row.ConnectionStatus}, ${row.Status}, ${
                      row.LastRequestAt || "-"
                    })`;
                    updatedLines[idx] = `${cleanId} ${emoji}${info}`;
                  } else {
                    updatedLines[idx] = `${cleanId} ❌`;
                  }
                } else {
                  const row = data?.Result?.Rows?.[0];
                  if (row) {
                    const timeStr = row.Time;
                    const lastTime = timeStr ? new Date(timeStr) : null;
                    const recent =
                      lastTime && Date.now() - lastTime.getTime() < 4 * 3600 * 1000;
                    const temp = row?.Temperature?.Value || "?";
                    const battery = row?.Battery || "-";
                    const batteryVal = parseFloat(battery);
                    const batteryLow = !isNaN(batteryVal) && batteryVal < 75;
                    const emoji = recent && !batteryLow ? "✅" : "❌";
                    const info = ` (Temp: ${temp}, Battery: ${battery}, Time: ${
                      timeStr || "-"
                    })`;
                    updatedLines[idx] = `${cleanId} ${emoji}${info}`;
                  } else {
                    updatedLines[idx] = `${cleanId} ❌`;
                  }
                }
              })
              .catch(() => {
                updatedLines[idx] = `${cleanId} ❌`;
              });
          }),
        ).then(() => {
          resolve(updatedLines);
        });
      },
    );
  });
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
