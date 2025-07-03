// Fonctions de vérification des sondes et hubs

// Réauthentifie l'utilisateur BluConsole si besoin
function relogin() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["sondeEmail", "sondePassword"], creds => {
      const { sondeEmail, sondePassword } = creds;
      if (!sondeEmail || !sondePassword) {
        updateSondeOutput("❌ Identifiants manquants pour reconnexion.", "error");
        return reject(new Error("missing credentials"));
      }
      fetch("https://api.ligma.fr/blulog/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sondeEmail, password: sondePassword })
      })
        .then(r => r.json())
        .then(data => {
          if (data.token && data.refreshToken) {
            chrome.storage.local.set({
              bluconsoleToken: data.token,
              bluconsoleRToken: data.refreshToken,
              bluconsoleUser: data.user
            }, () => resolve({ token: data.token, rtoken: data.refreshToken }));
          } else {
            reject(new Error("login failed"));
          }
        })
        .catch(err => reject(err));
    });
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
      u.searchParams.set('token', creds.token);
      u.searchParams.set('rtoken', creds.rtoken);
      res = await fetch(u.toString());
    } catch (e) {
      // on ignore et on renvoie la réponse originale
    }
  }
  return res.json();
}

// Vérifie l'état d'une liste de sondes ou hubs
function verifierSondes() {
  const textarea = document.getElementById("sonde-ids");
  let rawLines = textarea.value.split("\n");

  if (rawLines.length === 0) {
    updateSondeOutput("Veuillez entrer au moins un ID.", "error");
    return;
  }

  chrome.storage.local.get(["bluconsoleToken", "bluconsoleRToken"], data => {
    let token = data.bluconsoleToken;
    let rtoken = data.bluconsoleRToken;

    if (!token || !rtoken) {
      updateSondeOutput("❌ Token manquant. Connectez-vous d'abord.", "error");
      return;
    }

    // Nettoie les lignes de départ
    rawLines = rawLines.map(line =>
      line.split(" ")[0].trim().replace(/\s+/g, "")
    );

    // On garde la structure pour mettre à jour ligne par ligne
    const updatedLines = [...rawLines];

    Promise.all(
      rawLines.map((cleanId, index) => {
        if (!cleanId) {
          updatedLines[index] = ""; // ignore vide
          return Promise.resolve();
        }

        const isHub = cleanId.startsWith("0");
        const url = isHub
          ? `https://api.ligma.fr/blulog/verifier-hub?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`
          : `https://api.ligma.fr/blulog/verifier-sonde?id=${encodeURIComponent(cleanId)}&token=${token}&rtoken=${rtoken}`;

        return fetchWithAuthRetry(url, creds => { token = creds.token; rtoken = creds.rtoken; })
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
}

// Expose la fonction au reste du popup
self.sondeUtils = { verifierSondes };

