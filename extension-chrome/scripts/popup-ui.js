// Fonctions utilitaires pour l'interface popup

const toastTimers = new WeakMap();
const TYPE_CLASSES = ["toast-success", "toast-error", "toast-info"];

function notifyHeightChange() {
  document.dispatchEvent(new CustomEvent("popupHeightChanged"));
}

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
  notifyHeightChange();
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
  notifyHeightChange();

  if (autoHide) {
    const timer = setTimeout(() => hideToast(element), duration);
    toastTimers.set(element, timer);
  }
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
}

/**
 * Affiche un message dans la section sondes.
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
  notifyHeightChange();
}
