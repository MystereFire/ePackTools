const chalk = require("chalk");

function stamp() {
  return chalk.gray(new Date().toISOString());
}

function format(type, msg) {
  const emojis = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅" };
  const colors = {
    info: chalk.cyan,
    warn: chalk.yellow,
    error: chalk.red,
    success: chalk.green,
  };
  const color = colors[type] || ((x) => x);
  return `${stamp()} ${emojis[type] || ""} ${color(msg)}`;
}

module.exports = {
  info: (msg) => console.log(format("info", msg)),
  warn: (msg) => console.warn(format("warn", msg)),
  error: (msg) => console.error(format("error", msg)),
  success: (msg) => console.log(format("success", msg)),
};
