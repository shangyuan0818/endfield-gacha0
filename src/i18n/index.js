import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import messages from './messages.js';
import { readStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', key: 'zh-CN' },
  { value: 'en-US', key: 'en-US' },
];

export const DEFAULT_LOCALE = 'zh-CN';
const I18nContext = createContext(null);

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

export function getAppLocale() {
  if (!hasWindow()) {
    return DEFAULT_LOCALE;
  }

  const stored = readStorageValue(STORAGE_KEYS.APP_LOCALE, null, { raw: true });
  if (stored) {
    return normalizeLocale(stored);
  }

  return getNavigatorLocale();
}

export function applyAppLocale(locale) {
  const nextLocale = normalizeLocale(locale);
  if (!hasWindow()) {
    return nextLocale;
  }

  writeStorageValue(STORAGE_KEYS.APP_LOCALE, nextLocale, { raw: true });
  syncDocumentMeta(nextLocale);
  window.dispatchEvent(new CustomEvent('app-locale-change', {
    detail: { locale: nextLocale }
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
  const [locale, setLocaleState] = useState(() => normalizeLocale(initialLocale || getAppLocale()));

  useEffect(() => {
    applyAppLocale(locale);

    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.APP_LOCALE && event.newValue) {
        setLocaleState(normalizeLocale(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [locale]);

  const setLocale = useMemo(() => (nextLocale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: (key, params = {}, fallback = null) => {
      const resolved = getMessage(key, params, locale);
      return resolved === key && fallback ? fallback : resolved;
    },
    formatNumber: (value, options = {}) => formatAppNumber(value, locale, options),
    formatDateTime: (value, options = {}, fallback = null) => formatAppDateTime(value, locale, options, fallback),
    isEnglish: locale === 'en-US',
  }), [locale, setLocale]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
