const { app } = require('electron');

app.setName('shri-ram-physio-invoicing');

async function main() {
  await app.whenReady();

  // Ensure we use the same backend URL as the running app.
  // If AZURE_BACKEND_URL is set in your environment, it will be used.
  const { getBackendUrl } = require('../dist-electron/electron/config/backend');
  const { PrismaSyncEngine } = require('../dist-electron/electron/sync/prismaSyncEngine');

  const backendUrl = getBackendUrl();
  console.log('backendUrl:', backendUrl);

  const engine = new PrismaSyncEngine(backendUrl);
  const result = await engine.performSync(true);

  console.log('sync result:', result);

  setTimeout(() => app.exit(result.success ? 0 : 2), 50);
}

main().catch((e) => {
  console.error(e);
  setTimeout(() => app.exit(1), 50);
});
