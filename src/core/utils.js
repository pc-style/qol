// shared utility functions extracted from existing scripts

export function debounce(fn, wait = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), wait);
  };
}

export function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
  }[char]));
}

export function normalizeHost(value) {
  if (!value) return '';
  return value.replace(/^www\./i, '').toLowerCase();
}

export function sanitizeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed;
  return fallback;
}

export function parseShortcut(value) {
  if (!value) return null;
  const parts = value.toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const key = parts.pop();
  const mod = { ctrl: false, alt: false, shift: false, meta: false };
  parts.forEach(part => {
    if (part === 'ctrl' || part === 'control') mod.ctrl = true;
    if (part === 'alt' || part === 'option') mod.alt = true;
    if (part === 'shift') mod.shift = true;
    if (part === 'meta' || part === 'cmd' || part === 'command') mod.meta = true;
  });
  return { key, ...mod };
}

export function matchesHotkey(event, definition) {
  const parsed = parseShortcut(definition);
  if (!parsed || event.repeat) return false;
  const target = event.target;
  const tag = target?.tagName;
  if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
    if (!event.ctrlKey && !event.metaKey && parsed.key.length === 1) {
      return false;
    }
  }
  if (target instanceof Element && target.isContentEditable && !event.ctrlKey && !event.metaKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  return key === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta;
}

