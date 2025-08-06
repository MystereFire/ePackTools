// Fonctions de vérification des sondes et hubs

const DEFAULT_PROXY_URL = "https://api.ligma.fr/blulog";
let proxyURL = DEFAULT_PROXY_URL;
chrome.storage.local.get("proxyURL", (data) => {
  if (data.proxyURL) proxyURL = data.proxyURL;
});

// Réauthentifie l'utilisateur BluConsole si besoin
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

// Effectue un appel HTTP et retente après relogin si 401
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

// Vérifie l'état d'une liste d'identifiants de sondes/hubs
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
        const updatedLines = [];

        Promise.all(
          cleaned.map((cleanId) => {
            if (!cleanId) {
              updatedLines.push("");
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
                      lastReq && Date.now() - lastReq.getTime() < 3600 * 1000;
                    const connected =
                      row.ConnectionStatus?.toLowerCase() === "connected";
                    const emoji = connected && recent ? "✅" : "❌";
                    const info = ` (${row.ConnectionStatus}, ${row.Status}, ${
                      row.LastRequestAt || "-"
                    })`;
                    updatedLines.push(`${cleanId} ${emoji}${info}`);
                  } else {
                    updatedLines.push(`${cleanId} ❌`);
                  }
                } else {
                  const row = data?.Result?.Rows?.[0];
                  if (row) {
                    const timeStr = row.Time;
                    const lastTime = timeStr ? new Date(timeStr) : null;
                    const recent =
                      lastTime && Date.now() - lastTime.getTime() < 3600 * 1000;
                    const emoji = recent ? "✅" : "❌";
                    const temp = row?.Temperature?.Value || "?";
                    const battery = row?.Battery || "-";
                    const info = ` (Temp: ${temp}, Battery: ${battery}, Time: ${
                      timeStr || "-"
                    })`;
                    updatedLines.push(`${cleanId} ${emoji}${info}`);
                  } else {
                    updatedLines.push(`${cleanId} ❌`);
                  }
                }
              })
              .catch(() => {
                updatedLines.push(`${cleanId} ❌`);
              });
          }),
        ).then(() => {
          resolve(updatedLines.filter(Boolean));
        });
      },
    );
  });
}

// Vérifie les sondes depuis le textarea du popup
function verifierSondes() {
  const textarea = document.getElementById("sonde-ids");
  const rawLines = textarea.value.split("\n");
  if (rawLines.length === 0) {
    updateSondeOutput("Veuillez entrer au moins un ID.", "error");
    return;
  }
  verifierSondesListe(rawLines).then((result) => {
    textarea.value = result.join("\n");
  });
}

// Expose les fonctions au reste du popup
self.sondeUtils = { verifierSondes, verifierSondesListe, relogin };
