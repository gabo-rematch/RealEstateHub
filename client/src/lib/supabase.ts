import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// For development with dummy data when credentials are not provided
const isDummyMode = !supabaseUrl || !supabaseAnonKey;

console.log('Supabase config:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  isDummyMode,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'not provided'
});

export const supabase = isDummyMode ? null : createClient(supabaseUrl, supabaseAnonKey);
export { isDummyMode };
