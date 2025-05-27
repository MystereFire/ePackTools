let firstReadRequestCaptured = false;
let shouldCaptureRequest = true;
let shouldCaptureDataRequest = true;

function resetCaptureFlags() {
  shouldCaptureRequest = true;
  firstReadRequestCaptured = false;
  shouldCaptureDataRequest = true;
  console.log("🔄 Flags de capture réinitialisés.");
}

function extractThirdValueFromFilename(filename) {
  const parts = filename.split("-");
  return parts[2] || "Valeur introuvable";
}

function cleanData() {
  chrome.storage.local.remove(["clientData", "userData", "paramData"], () => {
    console.log("🗑️ Données supprimées du stockage local.");
  });
}

function storeData(key, data) {
  chrome.storage.local.set({ [key]: data }, () => {
    console.log(`💾 Données ${key} stockées :`, data);
  });
}

function fetchResPartner(id, label) {
  const url = "https://chr-num.odoo.com/web/dataset/call_kw/res.partner/read";
  const headers = {
    "Content-Type": "application/json",
    "X-Duplicated-Request": "true"
  };

  const body = JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "call",
    params: {
      args: [[id], [
        "name", "street", "zip", "city", "partner_latitude",
        "partner_longitude", "function", "email", "mobile", "is_company"
      ]],
      model: "res.partner",
      method: "read",
      kwargs: {
        context: {
          lang: "fr_FR",
          tz: "Europe/Paris",
          uid: 419,
          allowed_company_ids: [1],
          bin_size: true
        }
      }
    }
  });

  fetch(url, { method: "POST", headers, body })
    .then(response => response.json())
    .then(data => {
      const result = data.result?.[0];
      if (!result) return;

      if (result.is_company && label === "client") {
        console.log("🏢 Client détecté :", result.name);
        storeData("partnerData", result);
      } else if (!result.is_company && label === "manager") {
        console.log("👤 Manager détecté :", result.name);
        storeData("managerData", result);
      } else {
        console.warn(`⚠️ Type inattendu pour ${label} (${result.name})`);
        storeData(label === "client" ? "partnerData" : "managerData", result); // fallback
      }
    })
    .catch(error => console.error(`❌ Erreur duplicate res.partner.read (${label}) :`, error));
}

function fetchIdFromOrder(orderId) {
  const url = "https://chr-num.odoo.com/web/dataset/call_kw/sale.order/read";
  const headers = {
    "Content-Type": "application/json",
    "X-Duplicated-Request": "true"
  };

  const body = JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "call",
    params: {
      args: [[orderId]],
      model: "sale.order",
      method: "read",
      kwargs: {
        context: {
          lang: "fr_FR",
          tz: "Europe/Paris",
          uid: 419,
          allowed_company_ids: [1],
          bin_size: true
        }
      }
    }
  });

  fetch(url, { method: "POST", headers, body })
    .then(response => response.json())
    .then(data => {
      const order = data.result?.[0];
      if (!order) return;

      const partnerId = order.partner_id?.[0];
      const managerId = order.x_contact_manager?.[0];

      if (partnerId) {
        console.log("👤 partner_id récupéré :", partnerId);
        fetchResPartner(partnerId, "client");
      } else {
        console.warn("❌ partner_id non trouvé.");
      }

      if (managerId) {
        console.log("👤 x_contact_manager récupéré :", managerId);
        fetchResPartner(managerId, "manager");
      } else {
        console.warn("❌ x_contact_manager non trouvé.");
      }
    })
    .catch(err => console.error("❌ Erreur lors de la requête sale.order.read :", err));
}

function fetchFiles(requestBody) {
  const url = "https://chr-num.odoo.com/mail/thread/data";
  const headers = {
    "Content-Type": "application/json",
    "X-Duplicated-Request": "true"
  };

  fetch(url, { method: "POST", headers, body: requestBody })
    .then(response => response.json())
    .then(data => {
      const attachments = data.result?.attachments || [];

      if (attachments.length === 0) {
        console.log("❌ Aucune pièce jointe trouvée.");
        return;
      }

      const extractedParams = [];

      for (const attachment of attachments) {
        const filename = attachment.filename;
        const parts = filename.replace(".zip", "").split("-");

        // Format attendu : v5-INTÉGRATEUR-CLIENT-ZONE
        if (parts.length === 4 && parts[0] === "v5") {
          const client = parts[2];
          const zone = parts[3];
          console.log(`📦 Param détecté — Client: ${client}, Zone: ${zone} ← ${filename}`);
          extractedParams.push({ client, zone });
        }
      }

      if (extractedParams.length > 0) {
        storeData("paramData", extractedParams); // stocke tableau [{client, zone}]
      } else {
        console.warn("❌ Aucun fichier au format attendu.");
      }
    })
    .catch(error => console.error("❌ Erreur duplication mail/thread/data :", error));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url.includes("chr-num.odoo.com")) {
    resetCaptureFlags();
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (details.method !== "POST") return;

    // 🎯 Détection commande client
    if (shouldCaptureRequest && details.url.includes("sale.order/read")) {
      console.log("📡 Requête sale.order/read interceptée :", details.url);
      shouldCaptureRequest = false;

      try {
        const body = details.requestBody?.raw?.map(e => new TextDecoder().decode(e.bytes)).join('');
        const orderId = JSON.parse(body).params.args[0][0];
        console.log("🧾 orderId trouvé :", orderId);
        fetchIdFromOrder(orderId);
      } catch (e) {
        console.error("❌ Erreur parsing sale.order/read :", e);
      }
    }

    // 📎 Détection documents pièces jointes
    else if (shouldCaptureDataRequest && details.url.includes("mail/thread/data")) {
      console.log("📎 Requête mail/thread/data interceptée :", details.url);
      shouldCaptureDataRequest = false;

      try {
        const body = details.requestBody?.raw?.map(e => new TextDecoder().decode(e.bytes)).join('');
        fetchFiles(body);
      } catch (e) {
        console.error("❌ Erreur parsing mail/thread/data :", e);
      }
    }
  },
  { urls: ["https://chr-num.odoo.com/*"] },
  ["requestBody", "extraHeaders"]
);


