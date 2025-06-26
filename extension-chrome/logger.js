const icons = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };

function log(type, message, ...rest) {
  const emoji = icons[type] || '';
  const ts = new Date().toISOString();
  if (type === 'warn') console.warn(`${ts} ${emoji} ${message}`, ...rest);
  else if (type === 'error') console.error(`${ts} ${emoji} ${message}`, ...rest);
  else console.log(`${ts} ${emoji} ${message}`, ...rest);
}

self.logger = {
  info: (m, ...a) => log('info', m, ...a),
  warn: (m, ...a) => log('warn', m, ...a),
  error: (m, ...a) => log('error', m, ...a),
  success: (m, ...a) => log('success', m, ...a),
};
