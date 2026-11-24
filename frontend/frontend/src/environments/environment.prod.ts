// Replaced at deploy time by scripts/generate-environment.mjs (see render.yaml). This copy lets a plain
// `ng build` succeed; point API_URL at your own API when you deploy.
export const environment = {
  production: true,
  apiBaseUrl: 'https://shopkeeper-api.onrender.com/api/v1',
  showDemoAccounts: true,
  demoAccounts: {
    owner: { email: 'owner@alexcorner.demo', password: 'Owner#Demo2027' },
    staff: { email: 'staff@alexcorner.demo', password: 'Staff#Demo2027' }
  },
  demoShopSlug: 'alex-corner-shop'
};
