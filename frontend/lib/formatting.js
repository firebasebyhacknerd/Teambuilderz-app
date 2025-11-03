const defaultDateOptions = { dateStyle: 'medium' };
const defaultDateTimeOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function formatLabel(value, fallback = '--') {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'number') {
    return String(value);
  }

  return String(value)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatDate(value, options = defaultDateOptions) {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  } catch (err) {
    return String(value);
  }
}

export function formatDateTime(value, options = defaultDateTimeOptions) {
  if (!value) return 'Unknown time';
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  } catch (err) {
    return String(value);
  }
}
