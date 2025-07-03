// Service worker principal de l'extension
// Importe le logger et les modules utilitaires
importScripts('logger.js', 'scripts/storage.js', 'scripts/api.js');

// Réinitialise les indicateurs lors de la navigation dans Odoo
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url.includes('chr-num.odoo.com')) {
    storageUtils.resetCaptureFlags();
  }
});

// Intercepte les requêtes réseau pour récupérer les données nécessaires
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.method !== 'POST') return;

    // 🎯 Détecter la requête de devis
    if (storageUtils.flags.shouldCaptureRequest && details.url.includes('sale.order/read')) {
      logger.info(`Requête sale.order/read interceptée : ${details.url}`);
      storageUtils.flags.shouldCaptureRequest = false;
      storageUtils.cleanData();
      try {
        const body = details.requestBody?.raw?.map(e => new TextDecoder().decode(e.bytes)).join('');
        const orderId = JSON.parse(body).params.args[0][0];
        logger.info(`orderId trouvé : ${orderId}`);
        api.fetchIdFromOrder(orderId);
      } catch (e) {
        logger.error(`Erreur parsing sale.order/read : ${e}`);
      }
    }
    // 📎 Détecter la requête de pièces jointes
    else if (storageUtils.flags.shouldCaptureDataRequest && details.url.includes('mail/thread/data')) {
      logger.info(`Requête mail/thread/data interceptée : ${details.url}`);
      storageUtils.flags.shouldCaptureDataRequest = false;
      try {
        const body = details.requestBody?.raw?.map(e => new TextDecoder().decode(e.bytes)).join('');
        api.fetchFiles(body);
      } catch (e) {
        logger.error(`Erreur parsing mail/thread/data : ${e}`);
      }
    }
  },
  { urls: ['https://chr-num.odoo.com/*'] },
  ['requestBody', 'extraHeaders']
);
