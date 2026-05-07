const axios = require('axios');

const url = process.argv[2] || 'https://shree-ram-physio-backend.azurewebsites.net/health';

(async () => {
  const t0 = Date.now();
  try {
    const res = await axios.get(url, { timeout: 60_000 });
    console.log('OK', res.status, 'ms', Date.now() - t0);
    console.log(res.data);
  } catch (e) {
    console.error('FAILED ms', Date.now() - t0);
    console.error(e.code || e.message);
  }
})();
