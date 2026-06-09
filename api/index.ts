// @ts-ignore
import appInstance from '../server-dist/server.cjs';

// Resolve default import differences between ES module and CommonJS wrappers
const app = (appInstance as any).default || appInstance;

export default app;



