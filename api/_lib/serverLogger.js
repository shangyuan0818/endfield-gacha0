function write(level, event, payload = {}) {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const serialized = JSON.stringify(record);
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  const target = console?.[method];
  if (typeof target === 'function') {
    target(serialized);
  }
}

export const serverLogger = {
  info(event, payload) {
    write('info', event, payload);
  },
  warn(event, payload) {
    write('warn', event, payload);
  },
  error(event, payload) {
    write('error', event, payload);
  },
};

export default serverLogger;
