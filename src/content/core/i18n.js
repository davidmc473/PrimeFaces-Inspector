import { config } from './config.js';
import en from '../../i18n/en.js';
import es from '../../i18n/es.js';

const I18N = { en, es };

function resolveLang() {
  const cfg = config.language;
  if (cfg === 'en' || cfg === 'es') return cfg;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
}

export function t(key, ...args) {
  const lang = resolveLang();
  const dict = I18N[lang] || I18N.en || {};
  const fallback = I18N.en || {};
  let s = dict[key] !== undefined ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
  args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
