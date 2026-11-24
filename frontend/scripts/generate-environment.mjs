#!/usr/bin/env node
// Writes src/environments/environment.prod.ts from environment variables at deploy time.
// Fails loudly when API_URL is missing, so a deployment can never ship pointing at a placeholder API.
//
//   API_URL              required  e.g. https://shopkeeper-api.onrender.com  (with or without /api/v1)
//   SHOW_DEMO_ACCOUNTS   optional  "true" (default) shows one-tap demo sign-in on the login page
//   DEMO_OWNER_PASSWORD / DEMO_STAFF_PASSWORD  optional, must match the API's SEED_* passwords
//   DEMO_SHOP_SLUG       optional  default alex-corner-shop
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raw = (process.env.API_URL ?? '').trim().replace(/\/+$/, '');
if (!raw) {
  console.error('generate-environment: API_URL is not set. Refusing to build with a placeholder API URL.');
  process.exit(1);
}
if (!/^https?:\/\//i.test(raw)) {
  console.error(`generate-environment: API_URL must be an absolute URL. Received: "${raw}"`);
  process.exit(1);
}
const apiBaseUrl = /\/api\/v\d+$/.test(raw) ? raw : `${raw}/api/v1`;
const showDemoAccounts = (process.env.SHOW_DEMO_ACCOUNTS ?? 'true').toLowerCase() !== 'false';

const contents = `// GENERATED AT DEPLOY TIME - do not edit by hand.
export const environment = {
  production: true,
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  showDemoAccounts: ${showDemoAccounts},
  demoAccounts: {
    owner: { email: 'owner@alexcorner.demo', password: ${JSON.stringify(process.env.DEMO_OWNER_PASSWORD ?? 'Owner#Demo2027')} },
    staff: { email: 'staff@alexcorner.demo', password: ${JSON.stringify(process.env.DEMO_STAFF_PASSWORD ?? 'Staff#Demo2027')} }
  },
  demoShopSlug: ${JSON.stringify(process.env.DEMO_SHOP_SLUG ?? 'alex-corner-shop')}
};
`;
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, '..', 'src', 'environments', 'environment.prod.ts'), contents, 'utf8');
console.log(`generate-environment: apiBaseUrl=${apiBaseUrl} showDemoAccounts=${showDemoAccounts}`);
