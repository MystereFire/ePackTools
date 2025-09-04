// Service worker principal de l'extension
// Importe le logger et les modules utilitaires
importScripts(
  "logger.js",
  "scripts/storage.js",
  "scripts/api.js",
  "scripts/sondes.js",
  "scripts/utils.js",
  "scripts/api-utils.js",
  "scripts/jobQueue.js",
  "scripts/workflows.js",
);

// Planifie un test de connexion toutes les 20 minutes
function initLoginCron() {
  chrome.alarms.create("autoLogin", { periodInMinutes: 20 });
}

chrome.runtime.onInstalled.addListener(() => {
  initLoginCron();
  jobQueue.processQueue();
});
chrome.runtime.onStartup.addListener(() => {
  initLoginCron();
  jobQueue.processQueue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoLogin") {
    sondeUtils.relogin().catch(() => {});
  }
  if (alarm.name === "jobQueue") {
    jobQueue.processQueue();
  }
});

// Alarme pour réveiller régulièrement le service worker
chrome.alarms.create("jobQueue", { periodInMinutes: 1 });

// Gestion des messages depuis le popup et les content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "enqueue") {
    jobQueue
      .addJob({ type: msg.jobType, payload: msg.payload })
      .then((id) => sendResponse({ id }));
    return true;
  }
  if (msg.type === "getState") {
    jobQueue.getJobs().then((jobs) => sendResponse({ jobs }));
    return true;
  }
  if (msg.type === "cancelJob") {
    jobQueue.cancelJob(msg.id).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "saleOrderRead") {
    if (storageUtils.flags.shouldCaptureRequest) {
      logger.info(`Requête sale.order/read interceptée : ${sender.tab?.url}`);
      storageUtils.flags.shouldCaptureRequest = false;
      storageUtils.cleanData();
      try {
        const orderId = JSON.parse(msg.body).params.args[0][0];
        logger.info(`orderId trouvé : ${orderId}`);
        api.fetchIdFromOrder(orderId);
      } catch (e) {
        logger.error(`Erreur parsing sale.order/read : ${e}`);
      }
    }
    return false;
  }

  if (msg.type === "mailThreadData") {
    if (storageUtils.flags.shouldCaptureDataRequest) {
      logger.info(`Requête mail/thread/data interceptée : ${sender.tab?.url}`);
      storageUtils.flags.shouldCaptureDataRequest = false;
      try {
        api.fetchFiles(msg.body);
      } catch (e) {
        logger.error(`Erreur parsing mail/thread/data : ${e}`);
      }
    }
    return false;
  }

  return false;
});

// Réinitialise les indicateurs lors de la navigation dans Odoo
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url.includes("chr-num.odoo.com")) {
    storageUtils.resetCaptureFlags();
  }
});

