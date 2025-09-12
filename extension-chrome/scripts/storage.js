// Fonctions partagées pour la gestion des données en arrière-plan

// Indicateurs utilisés par l'écouteur de requêtes
let firstReadRequestCaptured = false;
let shouldCaptureRequest = true;
let shouldCaptureDataRequest = true;

/** Réinitialise les indicateurs quand une nouvelle page se charge. */
function resetCaptureFlags() {
  shouldCaptureRequest = true;
  firstReadRequestCaptured = false;
  shouldCaptureDataRequest = true;
}

/** Supprime les données précédemment enregistrées dans chrome.storage. */
function cleanData() {
  chrome.storage.local.remove(
    ["clientData", "managerInfo", "parameterData"],
    () => {},
  );
}

/**
 * Enveloppe simple autour de chrome.storage.local.set
 * @param {string} key
 * @param {any} data
 */
function storeData(key, data) {
  chrome.storage.local.set({ [key]: data }, () => {});
}

/**
 * Génère un identifiant aléatoire.
 * @returns {string}
 */
function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export const storageUtils = {
  resetCaptureFlags,
  cleanData,
  storeData,
  generateId,
  flags: {
    get firstReadRequestCaptured() {
      return firstReadRequestCaptured;
    },
    set firstReadRequestCaptured(v) {
      firstReadRequestCaptured = v;
    },
    get shouldCaptureRequest() {
      return shouldCaptureRequest;
    },
    set shouldCaptureRequest(v) {
      shouldCaptureRequest = v;
    },
    get shouldCaptureDataRequest() {
      return shouldCaptureDataRequest;
    },
    set shouldCaptureDataRequest(v) {
      shouldCaptureDataRequest = v;
    },
  },
};
