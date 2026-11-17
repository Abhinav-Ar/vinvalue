import type { NextConfig } from 'next';

const config: NextConfig = {
  // web-push and postgres are server-only; keep them out of the client bundle.
  serverExternalPackages: ['web-push', 'postgres', '@electric-sql/pglite'],
};

export default config;
