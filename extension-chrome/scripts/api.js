// Fonctions réseau utilisées dans le service worker
// storageUtils et logger doivent être déjà chargés

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
    .then(r => r.json())
    .then(data => {
      const result = data.result?.[0];
      if (!result) return;

      if (result.is_company && label === "client") {
        logger.success(`Client détecté : ${result.name}`);
        storageUtils.storeData("partnerData", result);
      } else if (!result.is_company && label === "manager") {
        logger.success(`Manager détecté : ${result.name}`);
        storageUtils.storeData("managerData", result);
      } else {
        logger.warn(`Type inattendu pour ${label} (${result.name})`);
        storageUtils.storeData(label === "client" ? "partnerData" : "managerData", result);
      }
    })
    .catch(e => logger.error(`Erreur duplicate res.partner.read (${label}) : ${e}`));
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
    .then(r => r.json())
    .then(data => {
      const order = data.result?.[0];
      if (!order) return;

      const partnerId = order.partner_id?.[0];
      const managerId = order.x_contact_manager?.[0];

      if (partnerId) {
        logger.info(`partner_id récupéré : ${partnerId}`);
        fetchResPartner(partnerId, "client");
      } else {
        logger.warn('partner_id non trouvé.');
      }

      if (managerId) {
        logger.info(`x_contact_manager récupéré : ${managerId}`);
        fetchResPartner(managerId, "manager");
      } else {
        logger.warn('x_contact_manager non trouvé.');
      }
    })
    .catch(err => logger.error(`Erreur lors de la requête sale.order.read : ${err}`));
}

function fetchFiles(requestBody) {
  const url = "https://chr-num.odoo.com/mail/thread/data";
  const headers = {
    "Content-Type": "application/json",
    "X-Duplicated-Request": "true"
  };

  fetch(url, { method: "POST", headers, body: requestBody })
    .then(r => r.json())
    .then(data => {
      const attachments = data.result?.attachments || [];
      if (attachments.length === 0) {
        logger.warn('Aucune pièce jointe trouvée.');
        return;
      }

      const extractedParams = [];
      for (const attachment of attachments) {
        const filename = attachment.filename;
        const parts = filename.replace(".zip", "").split("-");
        // Format attendu : v5-INTÉGRATEUR-CLIENT-ZONE
        if (parts.length === 4 && parts[0] === "v5") {
          const integrator = parts[1];
          const client = parts[2];
          const zone = parts[3];
          logger.info(`Param détecté — Integrateur: ${integrator}, Client: ${client}, Zone: ${zone} ← ${filename}`);
          extractedParams.push({
            id: storageUtils.generateId(),
            integrator,
            client,
            zone,
            originalZone: zone
          });
        }
      }

      if (extractedParams.length > 0) {
        storageUtils.storeData("paramData", extractedParams);
      } else {
        logger.warn('Aucun fichier au format attendu.');
      }
    })
    .catch(e => logger.error(`Erreur duplication mail/thread/data : ${e}`));
}

self.api = { fetchResPartner, fetchIdFromOrder, fetchFiles };
