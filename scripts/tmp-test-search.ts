import { config } from 'dotenv';
config();

import { searchCompanies } from '../lib/enrichment/service.js';

async function main() {
  try {
    console.log('Searching for "Stripe"...');
    const r = await searchCompanies({ companyName: 'Stripe', pageSize: 3 });
    console.log('OK:', r.results.length, 'results');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.results.forEach((c: any) => console.log(' -', c.companyName, c.domain));
  } catch (e: unknown) {
    const err = e as Error & { statusCode?: number };
    console.error('ERROR:', err.message);
    if (err.statusCode) console.error('STATUS:', err.statusCode);
  }
  process.exit(0);
}
main();
