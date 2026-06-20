
'use strict';
// tsx registers TypeScript support for require()
try { require('tsx/cjs'); } catch(e) { process.stdout.write(JSON.stringify({error:'tsx not available: '+e.message})); process.exit(0); }

const svc = require('../server/services/artist-master-generator');
const { generateArtistMasterJSON, deriveParamsFromMaster } = svc;

(async () => {
  try {
    const mj = await generateArtistMasterJSON({ genre: 'Electronic', gender: 'female', mood: 'dark', artistName: 'TestArtist' });
    const derived = deriveParamsFromMaster(mj);
    process.stdout.write(JSON.stringify({ ok: true, masterJson: mj, derived }));
  } catch(e) {
    process.stdout.write(JSON.stringify({ error: e.message }));
  }
})();
