export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
  // Shows one-tap demo sign-in buttons on the login page. Only ever turn this on for fictional demo data.
  showDemoAccounts: true,
  demoAccounts: {
    owner: { email: 'owner@alexcorner.demo', password: 'Owner#Demo2027' },
    staff: { email: 'staff@alexcorner.demo', password: 'Staff#Demo2027' }
  },
  demoShopSlug: 'alex-corner-shop'
};
