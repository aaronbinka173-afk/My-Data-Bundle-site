// Production entry point for cPanel, Plesk, Namecheap Node.js selectors, and other hostings.
// This file executes the compiled production bundle directly using Node.js without typescript dependencies.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  require('./server-dist/server.cjs');
} catch (err) {
  console.error('[Startup Error] Failed to require production bundles. Make sure to build the app (npm run build) first:', err);
}
