import { PublicShop, Sale } from '../models/api.models';
import { buildReceiptMessage, buildUpdateMessage } from './messages';

const day = { closed: false, open: '07:00', close: '19:00' };
const shop: PublicShop = {
  slug: 'alex-corner-shop',
  name: 'Alex Corner Shop',
  area_label: 'Alexandra, Johannesburg',
  status: 'temporarily_unavailable',
  status_message: 'Power cut, back at 14:00',
  hours: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day },
  today_key: 'mon',
  today: day,
  contact_note: null,
  announcement: { title: 'Delayed opening', body: 'Open at 9.', tone: 'warning', expires_at: null },
  products: [
    { name: 'Bread', category: 'Bakery', price_cents: 1899, availability: 'in_stock' },
    { name: 'Milk', category: 'Dairy', price_cents: 2549, availability: 'low_stock' },
    { name: 'Oil', category: 'Groceries', price_cents: 4799, availability: 'out_of_stock' }
  ],
  categories: ['Bakery', 'Dairy', 'Groceries'],
  updated_at: '2026-11-23T10:00:00Z',
  generated_at: '2026-11-23T10:00:00Z'
};

describe('buildUpdateMessage', () => {
  const text = buildUpdateMessage(shop, 'https://example.test/shop/alex-corner-shop', new Date('2026-11-23T12:32:00Z'));

  it('leads with the shop, its status and the owner message', () => {
    expect(text).toContain('Alex Corner Shop (Alexandra, Johannesburg)');
    expect(text).toContain('Status: Temporarily unavailable');
    expect(text).toContain('Power cut, back at 14:00');
  });

  it('groups products by availability and shows no price for out-of-stock items', () => {
    expect(text).toContain('In stock:\n- Bread  R\u00a018.99');
    expect(text).toContain('Running low:\n- Milk  R\u00a025.49');
    expect(text).toContain('Out of stock:\n- Oil');
    expect(text).not.toContain('Oil  R');
  });

  it('includes the announcement and the live link', () => {
    expect(text).toContain('Delayed opening: Open at 9.');
    expect(text).toContain('https://example.test/shop/alex-corner-shop');
  });
});

describe('buildReceiptMessage', () => {
  it('lists lines and the total', () => {
    const sale = {
      id: '1', created_at: '2026-11-23T10:00:00Z', total_cents: 5798, unit_count: 3, cashier_name: 'Sam', replayed: false,
      items: [
        { product_id: 'a', product_name: 'Bread', quantity: 2, unit_price_cents: 1899, line_total_cents: 3798, stock_after: 5, stock_state: 'in_stock' },
        { product_id: 'b', product_name: 'Airtime', quantity: 2, unit_price_cents: 1000, line_total_cents: 2000, stock_after: 5, stock_state: 'in_stock' }
      ]
    } as Sale;
    const text = buildReceiptMessage('Alex Corner Shop', sale);
    expect(text).toContain('2 x Bread  R\u00a037.98');
    expect(text).toContain('Total: R\u00a057.98');
  });
});
