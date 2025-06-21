// Environment variable utility for client-side code
// Provides type-safe access to environment variables with fallbacks

interface EnvConfig {
  SUPABASE_URL: string | undefined;
  SUPABASE_ANON_KEY: string | undefined;
  WEBHOOK_URL: string | undefined;
  INVENTORY_UNIT_URL: string | undefined;
  INVENTORY_PREFERENCE_URL: string | undefined;
  MATCH_URL: string | undefined;
  API_KEY: string | undefined;
  NODE_ENV: string;
  DEV: boolean;
  PROD: boolean;
}

function getEnvVar(key: string): string | undefined {
  // Try Vite-style variables first, then fallback to custom defines
  if (typeof import.meta.env !== 'undefined') {
    const viteVar = import.meta.env[`VITE_${key}`] || import.meta.env[key];
    if (viteVar) return viteVar;
  }
  
  // Try REACT_APP_ prefix for CRA compatibility
  if (typeof import.meta.env !== 'undefined') {
    const reactVar = import.meta.env[`REACT_APP_${key}`];
    if (reactVar) return reactVar;
  }
  
  // Fallback to custom defines from vite.config.ts
  const globalVar = (globalThis as any)[`__VITE_${key}__`];
  if (globalVar) return globalVar;
  
  return undefined;
}

export const env: EnvConfig = {
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
  WEBHOOK_URL: getEnvVar('WEBHOOK_URL'),
  INVENTORY_UNIT_URL: getEnvVar('INVENTORY_UNIT_URL'),
  INVENTORY_PREFERENCE_URL: getEnvVar('INVENTORY_PREFERENCE_URL'),
  MATCH_URL: getEnvVar('MATCH_URL'),
  API_KEY: getEnvVar('API_KEY'),
  NODE_ENV: getEnvVar('NODE_ENV') || 'development',
  DEV: getEnvVar('NODE_ENV') !== 'production',
  PROD: getEnvVar('NODE_ENV') === 'production',
};

// Development logging
if (env.DEV) {
  console.log('Environment configuration:', {
    SUPABASE_URL: env.SUPABASE_URL ? '***configured***' : 'missing',
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ? '***configured***' : 'missing',
    WEBHOOK_URL: env.WEBHOOK_URL ? '***configured***' : 'missing',
    INVENTORY_UNIT_URL: env.INVENTORY_UNIT_URL ? '***configured***' : 'missing',
    INVENTORY_PREFERENCE_URL: env.INVENTORY_PREFERENCE_URL ? '***configured***' : 'missing',
    MATCH_URL: env.MATCH_URL ? '***configured***' : 'missing',
    API_KEY: env.API_KEY ? '***configured***' : 'missing',
    NODE_ENV: env.NODE_ENV,
  });
}

export default env; 