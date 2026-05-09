import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import messages from './messages.js';
import { readStorageValue, removeStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

export const LANGUAGE_OPTIONS = [
  { value: 'system', key: 'system' },
  { value: 'zh-CN', key: 'zh-CN' },
  { value: 'en-US', key: 'en-US' },
];

export const DEFAULT_LOCALE = 'zh-CN';
export const SYSTEM_LOCALE_MODE = 'system';
const I18nContext = createContext(null);
const localeMessageLoaders = {
  'en-US': () => import('./messages.en-US.js'),
};
const localeMessagePromises = new Map();

function hasWindow() {
  return typeof window !== 'undefined';
}

function syncDocumentMeta(locale) {
  if (!hasWindow()) {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  if (document.body) {
    document.body.lang = locale;
    document.body.dataset.locale = locale;
  }

  document.title = getMessage('app.documentTitle', {}, locale);

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', getMessage('app.metaDescription', {}, locale));
  }

  const keywords = document.querySelector('meta[name="keywords"]');
  if (keywords) {
    keywords.setAttribute('content', getMessage('app.metaKeywords', {}, locale));
  }
}

export function normalizeLocale(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value.startsWith('en')) {
    return 'en-US';
  }
  if (value.startsWith('zh')) {
    return 'zh-CN';
  }
  return DEFAULT_LOCALE;
}

export function normalizeLocaleMode(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value === SYSTEM_LOCALE_MODE || value === 'auto') {
    return SYSTEM_LOCALE_MODE;
  }

  return normalizeLocale(value);
}

function resolveMessage(locale, key) {
  const localeMessages = messages[locale] || messages[DEFAULT_LOCALE] || {};
  if (Object.prototype.hasOwnProperty.call(localeMessages, key)) {
    return localeMessages[key];
  }

  const fallbackMessages = messages[DEFAULT_LOCALE] || {};
  if (Object.prototype.hasOwnProperty.call(fallbackMessages, key)) {
    return fallbackMessages[key];
  }

  return key;
}

export function isLocaleMessagesLoaded(locale) {
  const normalized = normalizeLocale(locale);
  return Boolean(messages[normalized]);
}

export function ensureLocaleMessages(locale) {
  const normalized = normalizeLocale(locale);
  if (messages[normalized]) {
    return Promise.resolve(messages[normalized]);
  }

  const loader = localeMessageLoaders[normalized];
  if (!loader) {
    return Promise.resolve(messages[DEFAULT_LOCALE] || {});
  }

  if (!localeMessagePromises.has(normalized)) {
    localeMessagePromises.set(
      normalized,
      loader().then((module) => {
        messages[normalized] = module.default || {};
        return messages[normalized];
      }).catch(() => {
        localeMessagePromises.delete(normalized);
        return messages[DEFAULT_LOCALE] || {};
      })
    );
  }

  return localeMessagePromises.get(normalized);
}

function interpolateMessage(template, params = {}) {
  if (typeof template !== 'string') {
    return String(template ?? '');
  }

  return template.replace(/\{(\w+)\}/g, (_, token) => {
    if (!Object.prototype.hasOwnProperty.call(params, token)) {
      return `{${token}}`;
    }
    return String(params[token] ?? '');
  });
}

function getNavigatorLocale() {
  if (!hasWindow()) {
    return DEFAULT_LOCALE;
  }

  const candidates = [
    ...(Array.isArray(window.navigator?.languages) ? window.navigator.languages : []),
    window.navigator?.language,
  ].filter(Boolean);

  return normalizeLocale(candidates[0]);
}

function resolveLocaleMode(mode) {
  return normalizeLocaleMode(mode) === SYSTEM_LOCALE_MODE
    ? getNavigatorLocale()
    : normalizeLocale(mode);
}

export function getAppLocaleMode() {
  if (!hasWindow()) {
    return SYSTEM_LOCALE_MODE;
  }

  const storedMode = readStorageValue(STORAGE_KEYS.APP_LOCALE_MODE, null, { raw: true });
  if (storedMode) {
    return normalizeLocaleMode(storedMode);
  }

  const legacyLocale = readStorageValue(STORAGE_KEYS.APP_LOCALE, null, { raw: true });
  if (!legacyLocale) {
    return SYSTEM_LOCALE_MODE;
  }

  const normalizedLegacyLocale = normalizeLocale(legacyLocale);
  return normalizedLegacyLocale === getNavigatorLocale()
    ? SYSTEM_LOCALE_MODE
    : normalizedLegacyLocale;
}

export function getAppLocale() {
  if (!hasWindow()) {
    return DEFAULT_LOCALE;
  }

  return resolveLocaleMode(getAppLocaleMode());
}

export function applyAppLocale(locale) {
  const nextMode = normalizeLocaleMode(locale);
  const nextLocale = resolveLocaleMode(nextMode);
  if (!hasWindow()) {
    return nextLocale;
  }

  writeStorageValue(STORAGE_KEYS.APP_LOCALE_MODE, nextMode, { raw: true });
  if (nextMode === SYSTEM_LOCALE_MODE) {
    removeStorageValue(STORAGE_KEYS.APP_LOCALE, { raw: true });
  } else {
    writeStorageValue(STORAGE_KEYS.APP_LOCALE, nextLocale, { raw: true });
  }
  syncDocumentMeta(nextLocale);
  window.dispatchEvent(new CustomEvent('app-locale-change', {
    detail: { locale: nextLocale, mode: nextMode }
  }));
  return nextLocale;
}

export function getMessage(key, params = {}, locale = getAppLocale()) {
  return interpolateMessage(resolveMessage(locale, key), params);
}

export function formatAppNumber(value, locale = getAppLocale(), options = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  return new Intl.NumberFormat(locale, options).format(numericValue);
}

export function formatAppDateTime(value, locale = getAppLocale(), options = {}, fallback = null) {
  if (!value) {
    return fallback ?? getMessage('common.unknown', {}, locale);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? getMessage('common.unknown', {}, locale);
  }

  const { includeYear = true, ...intlOptions } = options || {};

  return new Intl.DateTimeFormat(locale, {
    ...(includeYear ? { year: 'numeric' } : {}),
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...intlOptions,
  }).format(date);
}

export function isEnglishLocale(locale = getAppLocale()) {
  return normalizeLocale(locale) === 'en-US';
}

export function I18nProvider({ children, initialLocale = null }) {
  const [localeMode, setLocaleModeState] = useState(() => normalizeLocaleMode(initialLocale || getAppLocaleMode()));
  const [locale, setLocaleState] = useState(() => resolveLocaleMode(initialLocale || getAppLocaleMode()));
  const [messagesVersion, setMessagesVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const nextLocale = resolveLocaleMode(localeMode);

    ensureLocaleMessages(nextLocale).then(() => {
      if (cancelled) {
        return;
      }

      setLocaleState(nextLocale);
      setMessagesVersion((version) => version + 1);
      applyAppLocale(localeMode);
    });

    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.APP_LOCALE_MODE || event.key === STORAGE_KEYS.APP_LOCALE) {
        const nextMode = getAppLocaleMode();
        const nextStoredLocale = resolveLocaleMode(nextMode);
        ensureLocaleMessages(nextStoredLocale).then(() => {
          setLocaleState(nextStoredLocale);
          setLocaleModeState(nextMode);
        });
      }
    };
    const handleLanguageChange = () => {
      if (localeMode !== SYSTEM_LOCALE_MODE) {
        return;
      }

      const systemLocale = getNavigatorLocale();
      ensureLocaleMessages(systemLocale).then(() => {
        if (cancelled) {
          return;
        }

        setLocaleState(systemLocale);
        setMessagesVersion((version) => version + 1);
        applyAppLocale(SYSTEM_LOCALE_MODE);
      });
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('languagechange', handleLanguageChange);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, [localeMode]);

  const setLocale = useMemo(() => (nextLocale) => {
    const nextMode = normalizeLocaleMode(nextLocale);
    const resolvedLocale = resolveLocaleMode(nextMode);
    ensureLocaleMessages(resolvedLocale).then(() => {
      setLocaleState(resolvedLocale);
      setLocaleModeState(nextMode);
    });
  }, []);

  const value = useMemo(() => ({
    locale,
    localeMode,
    messagesVersion,
    setLocale,
    t: (key, params = {}, fallback = null) => {
      const resolved = getMessage(key, params, locale);
      return resolved === key && fallback ? fallback : resolved;
    },
    formatNumber: (value, options = {}) => formatAppNumber(value, locale, options),
    formatDateTime: (value, options = {}, fallback = null) => formatAppDateTime(value, locale, options, fallback),
    isEnglish: locale === 'en-US',
  }), [locale, localeMode, messagesVersion, setLocale]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
