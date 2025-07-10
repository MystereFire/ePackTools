// Fonctions utilitaires pour l'interface popup
// Affiche un loader avec un message
function showLoader(msg = "Chargement...") {
  const loader = document.getElementById("loader");
  if (!loader) return;
  loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${msg}`;
  loader.style.display = "block";
}

// Masque l'élément de chargement
function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

// Affiche un message dans le bloc de sortie générique
function updateOutput(message, type = "info") {
  const outputDiv = document.getElementById("output");
  if (!outputDiv) return;
  outputDiv.style.display = "block";
  outputDiv.style.color = "#333";
  outputDiv.style.backgroundColor =
    type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#f9f9f9";
  outputDiv.style.borderColor =
    type === "success" ? "#c3e6cb" : type === "error" ? "#f5c6cb" : "#ccc";
  outputDiv.innerHTML = message;
}

// Fonction d'affichage pour le panneau des sondes
function updateSondeOutput(message, type = "info") {
  const outputDiv = document.getElementById("sonde-output");
  if (!outputDiv) return;
  outputDiv.style.display = "block";
  outputDiv.style.backgroundColor =
    type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#f9f9f9";
  outputDiv.style.borderColor =
    type === "success" ? "#c3e6cb" : type === "error" ? "#f5c6cb" : "#ccc";
  outputDiv.textContent = message;
}
