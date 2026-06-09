// @ts-ignore
import appInstance from '../dist/server.cjs';

// Resolve default import differences between ES module and CommonJS wrappers
const app = (appInstance as any).default || appInstance;

export default app;


