// Fonctions utilitaires pour l'interface popup

const toastTimers = new WeakMap();
const historyEntries = [];

const TYPE_CLASSES = ["toast-success", "toast-error", "toast-info"];

function clearTimer(element) {
  const timer = toastTimers.get(element);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(element);
  }
}

function hideToast(element) {
  if (!element) return;
  clearTimer(element);
  element.classList.remove("visible", ...TYPE_CLASSES);
  element.innerHTML = "";
}

function renderToast(
  element,
  message,
  {
    type = "info",
    autoHide = true,
    allowHTML = false,
    duration = 6000,
  } = {},
) {
  if (!element) return;
  clearTimer(element);

  element.classList.remove(...TYPE_CLASSES);
  if (type === "success" || type === "error" || type === "info") {
    element.classList.add(`toast-${type}`);
  }

  if (allowHTML) {
    element.innerHTML = message;
  } else {
    element.textContent = message;
  }

  element.classList.add("visible");

  if (autoHide) {
    const timer = setTimeout(() => hideToast(element), duration);
    toastTimers.set(element, timer);
  }
}

function sanitizeMessage(message) {
  const text = (message ?? "").toString();
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function addHistoryEntry(message, type) {
  const historyList = document.getElementById("history-list");
  const historyToast = document.getElementById("history-toast");
  if (!historyList || !historyToast) return;

  const cleanMessage = sanitizeMessage(message);
  if (!cleanMessage) return;

  const entry = {
    message: cleanMessage,
    type,
    time: new Date(),
  };

  historyEntries.unshift(entry);
  if (historyEntries.length > 3) {
    historyEntries.length = 3;
  }

  historyList.innerHTML = "";
  historyEntries.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.type = item.type || "info";
    const timeLabel = item.time.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    li.textContent = `${timeLabel} · ${item.message}`;
    historyList.appendChild(li);
  });

  historyToast.classList.toggle("visible", historyEntries.length > 0);
}

/**
 * Affiche un loader sous forme de toast.
 * @param {string} [msg="Chargement..."]
 */
export function showLoader(msg = "Chargement...") {
  const loader = document.getElementById("loader");
  if (!loader) return;
  renderToast(
    loader,
    `<i class="fas fa-spinner fa-spin"></i> ${msg}`,
    { type: "info", autoHide: false, allowHTML: true },
  );
}

/** Masque le toast de chargement. */
export function hideLoader() {
  const loader = document.getElementById("loader");
  hideToast(loader);
}

/**
 * Affiche un message dans la zone de notification principale.
 * @param {string} message
 * @param {"info"|"success"|"error"} [type="info"]
 */
export function updateOutput(message, type = "info") {
  const outputDiv = document.getElementById("output");
  if (!outputDiv) return;
  renderToast(outputDiv, message, {
    type,
    autoHide: true,
    allowHTML: true,
    duration: 7000,
  });
  addHistoryEntry(message, type);
}

/**
 * Affiche un message dans la section sondes et l'ajoute à l'historique.
 * @param {string} message
 * @param {"info"|"success"|"error"} [type="info"]
 */
export function updateSondeOutput(message, type = "info") {
  const outputDiv = document.getElementById("sonde-output");
  if (!outputDiv) return;
  outputDiv.style.display = "block";
  outputDiv.style.backgroundColor =
    type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#f9f9f9";
  outputDiv.style.borderColor =
    type === "success" ? "#c3e6cb" : type === "error" ? "#f5c6cb" : "#ccc";
  outputDiv.textContent = message;
  addHistoryEntry(message, type);
}
