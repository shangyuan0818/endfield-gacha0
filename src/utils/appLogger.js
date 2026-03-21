/* eslint-disable no-console */
const isDev = Boolean(import.meta.env.DEV);

function callConsole(level, args) {
  const target = console?.[level];
  if (typeof target !== 'function') {
    return;
  }

  target(...args);
}

export const appLogger = {
  debug(...args) {
    if (isDev) {
      callConsole('debug', args);
    }
  },

  info(...args) {
    if (isDev) {
      callConsole('info', args);
    }
  },

  warn(...args) {
    if (isDev) {
      callConsole('warn', args);
    }
  },

  error(...args) {
    callConsole('error', args);
  }
};

export default appLogger;
