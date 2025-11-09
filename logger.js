const icons = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅" };

/**
 * Affiche un message dans la console avec un emoji et un timestamp.
 * @param {"info"|"warn"|"error"|"success"} type
 * @param {string} message
 * @param {...any} rest
 */
function log(type, message, ...rest) {
  const emoji = icons[type] || "";
  const ts = new Date().toISOString();
  if (type === "warn") console.warn(`${ts} ${emoji} ${message}`, ...rest);
  else if (type === "error")
    console.error(`${ts} ${emoji} ${message}`, ...rest);
  else console.log(`${ts} ${emoji} ${message}`, ...rest);
}

export const logger = {
  info: (m, ...a) => log("info", m, ...a),
  warn: (m, ...a) => log("warn", m, ...a),
  error: (m, ...a) => log("error", m, ...a),
  success: (m, ...a) => log("success", m, ...a),
};
