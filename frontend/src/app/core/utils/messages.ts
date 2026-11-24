import { PublicProduct, PublicShop, Sale } from '../models/api.models';
import { formatMoney, formatTime, hoursText, STATUS_LABEL } from './format';

/** A plain-text update an owner can paste into WhatsApp, a community group or an SMS. No messaging service
 *  is called: the app only builds the text, and a person sends it. */
export function buildUpdateMessage(shop: PublicShop, link: string, now = new Date()): string {
  const lines: string[] = [];
  lines.push(`${shop.name} (${shop.area_label})`);

  const status = STATUS_LABEL[shop.status];
  const hours = shop.status === 'open' ? `, today ${hoursText(shop.today)}` : '';
  lines.push(`Status: ${status}${hours}`);
  if (shop.status_message) lines.push(shop.status_message);
  if (shop.announcement) {
    lines.push('');
    lines.push(shop.announcement.body ? `${shop.announcement.title}: ${shop.announcement.body}` : shop.announcement.title);
  }

  const group = (state: PublicProduct['availability']) => shop.products.filter((p) => p.availability === state);
  const line = (p: PublicProduct) => `- ${p.name}  ${formatMoney(p.price_cents)}`;

  const inStock = group('in_stock');
  const low = group('low_stock');
  const out = group('out_of_stock');
  if (inStock.length) lines.push('', 'In stock:', ...inStock.map(line));
  if (low.length) lines.push('', 'Running low:', ...low.map(line));
  if (out.length) lines.push('', 'Out of stock:', ...out.map((p) => `- ${p.name}`));

  lines.push('', `Updated ${formatTime(now.toISOString())}. Live availability: ${link}`);
  return lines.join('\n');
}

/** A copyable receipt for the demo. Real SMS or WhatsApp receipts are deliberately out of scope. */
export function buildReceiptMessage(shopName: string, sale: Sale): string {
  const lines = [`${shopName}: receipt`];
  for (const item of sale.items) {
    lines.push(`${item.quantity} x ${item.product_name}  ${formatMoney(item.line_total_cents)}`);
  }
  lines.push(`Total: ${formatMoney(sale.total_cents)}`, `${formatTime(sale.created_at)}. Thank you!`);
  return lines.join('\n');
}
