const ODOO_CONFIG = {
  url: "https://chr-num.odoo.com",
  db: "odoo-ps-psbe-chr-num-16-0-8523334",
  username: "m.canals@epack-hygiene.fr",
  apiKey: "c1a12e5b4e33598a337a02b78d06ca5491f3c61e",
};

let cachedUid = null;
let loginPromise = null;

async function callOdoo(service, method, args) {
  const response = await fetch(`${ODOO_CONFIG.url}/jsonrpc`, {
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

async function ensureLogin() {
  if (cachedUid) {
    return cachedUid;
  }
  if (!loginPromise) {
    loginPromise = callOdoo("common", "login", [
      ODOO_CONFIG.db,
      ODOO_CONFIG.username,
      ODOO_CONFIG.apiKey,
    ])
      .then((uid) => {
        cachedUid = uid;
        loginPromise = null;
        return uid;
      })
      .catch((error) => {
        loginPromise = null;
        throw error;
      });
  }
  return loginPromise;
}

async function findLotId(serial) {
  const uid = await ensureLogin();
  const lotIds = await callOdoo("object", "execute_kw", [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.apiKey,
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

async function readQuantities(lotId) {
  const uid = await ensureLogin();
  const quants = await callOdoo("object", "execute_kw", [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.apiKey,
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

async function fetchStockForSerial(serial) {
  const lotId = await findLotId(serial);
  if (!lotId) {
    return { serial, status: "not_found" };
  }

  const quants = await readQuantities(lotId);
  if (!quants || quants.length === 0) {
    return { serial, status: "no_stock" };
  }

  return { serial, status: "ok", quants };
}

export async function fetchSondeStocks(serials) {
  const results = [];
  for (const serial of serials) {
    const cleanSerial = serial.trim();
    if (!cleanSerial) {
      continue;
    }
    try {
      const stock = await fetchStockForSerial(cleanSerial);
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
}
