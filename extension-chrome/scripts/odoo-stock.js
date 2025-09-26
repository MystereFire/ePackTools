const DEFAULT_ODOO_CONFIG = {
  url: "https://chr-num.odoo.com",
  db: "odoo-ps-psbe-chr-num-16-0-8523334",
  username: "m.canals@epack-hygiene.fr",
  apiKey: "c1a12e5b4e33598a337a02b78d06ca5491f3c61e",
};

let cachedUid = null;
let loginPromise = null;
let cachedConfig = null;
let cachedConfigSignature = null;
let loginConfigSignature = null;

function buildConfigSignature(config) {
  if (!config) {
    return "";
  }
  return [config.url, config.db, config.username, config.apiKey]
    .map((part) => part || "")
    .join("|");
}

function readStoredConfig() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve({});
      return;
    }
    chrome.storage.local.get(
      ["odooEmail", "odooApiKey", "odooUrl", "odooDb"],
      (data) => resolve(data || {}),
    );
  });
}

async function getOdooConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const stored = await readStoredConfig();
  cachedConfig = {
    url: stored.odooUrl || DEFAULT_ODOO_CONFIG.url,
    db: stored.odooDb || DEFAULT_ODOO_CONFIG.db,
    username: stored.odooEmail || DEFAULT_ODOO_CONFIG.username,
    apiKey: stored.odooApiKey || DEFAULT_ODOO_CONFIG.apiKey,
  };

  return cachedConfig;
}

async function callOdoo(config, service, method, args) {
  if (!config?.url) {
    throw new Error("URL Odoo non configurée");
  }

  const response = await fetch(`${config.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service,
        method,
        args,
      },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.error) {
    const message =
      json.error?.data?.message || json.error?.message || "Erreur Odoo";
    throw new Error(message);
  }

  return json.result;
}

async function ensureLogin(config) {
  const resolvedConfig = config || (await getOdooConfig());
  const signature = buildConfigSignature(resolvedConfig);

  if (cachedConfigSignature && cachedConfigSignature !== signature) {
    cachedUid = null;
  }

  if (cachedUid) {
    if (cachedConfigSignature === signature) {
      return cachedUid;
    }
  }

  if (loginPromise && loginConfigSignature === signature) {
    return loginPromise;
  }

  if (!resolvedConfig.username || !resolvedConfig.apiKey) {
    throw new Error(
      "Identifiants Odoo manquants. Enregistrez un email et une clé API.",
    );
  }

  loginConfigSignature = signature;
  loginPromise = callOdoo(resolvedConfig, "common", "login", [
    resolvedConfig.db,
    resolvedConfig.username,
    resolvedConfig.apiKey,
  ])
    .then((uid) => {
      cachedUid = uid;
      cachedConfigSignature = signature;
      loginPromise = null;
      loginConfigSignature = null;
      return uid;
    })
    .catch((error) => {
      loginPromise = null;
      loginConfigSignature = null;
      throw error;
    });

  return loginPromise;
}

async function findLotId(serial, config) {
  const resolvedConfig = config || (await getOdooConfig());
  const uid = await ensureLogin(resolvedConfig);
  const lotIds = await callOdoo(resolvedConfig, "object", "execute_kw", [
    resolvedConfig.db,
    uid,
    resolvedConfig.apiKey,
    "stock.lot",
    "search",
    [[["name", "=", serial]]],
    { limit: 1 },
  ]);

  if (!Array.isArray(lotIds) || lotIds.length === 0) {
    return null;
  }
  return lotIds[0];
}

async function readQuantities(lotId, config) {
  const resolvedConfig = config || (await getOdooConfig());
  const uid = await ensureLogin(resolvedConfig);
  const quants = await callOdoo(resolvedConfig, "object", "execute_kw", [
    resolvedConfig.db,
    uid,
    resolvedConfig.apiKey,
    "stock.quant",
    "search_read",
    [[["lot_id", "=", lotId]]],
    { fields: ["quantity", "location_id", "product_id"] },
  ]);

  if (!Array.isArray(quants)) {
    return [];
  }

  return quants.map((quant) => ({
    quantity: quant.quantity ?? 0,
    locationName: Array.isArray(quant.location_id)
      ? quant.location_id[1]
      : "Emplacement inconnu",
    productName: Array.isArray(quant.product_id)
      ? quant.product_id[1]
      : "Produit inconnu",
  }));
}

async function fetchStockForSerial(serial, config) {
  const lotId = await findLotId(serial, config);
  if (!lotId) {
    return { serial, status: "not_found" };
  }

  const quants = await readQuantities(lotId, config);
  if (!quants || quants.length === 0) {
    return { serial, status: "no_stock" };
  }

  return { serial, status: "ok", quants };
}

export async function fetchSondeStocks(serials) {
  const config = await getOdooConfig();
  if (!config.username || !config.apiKey) {
    throw new Error(
      "Identifiants Odoo manquants. Enregistrez un email et une clé API.",
    );
  }

  const results = [];
  for (const serial of serials) {
    const cleanSerial = serial.trim();
    if (!cleanSerial) {
      continue;
    }
    try {
      const stock = await fetchStockForSerial(cleanSerial, config);
      results.push(stock);
    } catch (error) {
      results.push({ serial: cleanSerial, status: "error", message: error.message });
    }
  }
  return results;
}

export function resetOdooSession() {
  cachedUid = null;
  loginPromise = null;
  cachedConfig = null;
  cachedConfigSignature = null;
  loginConfigSignature = null;
}
