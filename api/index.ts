import appInstance from '../dist/server.cjs';

// Handle both standard default and CJS wrapper shapes
const app = (appInstance as any).default || appInstance;

export default app;
