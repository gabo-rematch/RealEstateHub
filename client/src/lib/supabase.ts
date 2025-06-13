import { createClient } from '@supabase/supabase-js';

// Extract Supabase URL and key from the connection string
const supabaseUrl = 'https://oxfibueovlhulfseukzl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

// For development with dummy data when anon key is not provided
const isDummyMode = !import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = isDummyMode ? null : createClient(supabaseUrl, supabaseAnonKey);
export { isDummyMode };
