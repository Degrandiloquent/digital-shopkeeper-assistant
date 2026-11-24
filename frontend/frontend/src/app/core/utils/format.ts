import { DayHours, ShopStatus, StockState } from '../models/api.models';

export const SHOP_TIMEZONE = 'Africa/Johannesburg';

/** 1899 -> "R 18.99". Money is whole cents everywhere; it is only turned into text here. */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}R\u00a0${rands}.${rest}`;
}

/** Whole-rand version for chart labels: 123456 -> "R 1 235". */
export function formatMoneyShort(cents: number): string {
  return formatMoney(Math.round(cents / 100) * 100).replace(/\.00$/, '');
}

/** Rands typed by a person ("18.5", "18,50") to cents. Returns null when it is not a valid amount. */
export function randsToCents(input: string | number): number | null {
  const text = String(input).trim().replace(',', '.').replace(/\s/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  return Math.round(parseFloat(text) * 100);
}

export function centsToRands(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatTime(iso: string, timeZone = SHOP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(
    new Date(iso)
  );
}

export function formatDateTime(iso: string, timeZone = SHOP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).format(new Date(iso));
}

export function formatDay(iso: string, timeZone = SHOP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(
    new Date(iso)
  );
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function hoursText(day: DayHours): string {
  return day.closed || !day.open || !day.close ? 'Closed' : `${day.open} to ${day.close}`;
}

export const STATUS_LABEL: Record<ShopStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  temporarily_unavailable: 'Temporarily unavailable'
};

export const STOCK_LABEL: Record<StockState, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock'
};

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
