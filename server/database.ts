// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Supabase client for database access - check for template values
const isValidSupabaseConfig = SUPABASE_URL && 
                              SUPABASE_ANON_KEY && 
                              !SUPABASE_URL.includes('your-project-id') &&
                              !SUPABASE_ANON_KEY.includes('your_supabase_anon_key');

if (!isValidSupabaseConfig) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be properly configured. Please check your .env file.');
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

// Execute raw SQL queries through Supabase RPC (fallback to table queries)
async function querySupabaseRPC(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // RPC functions not available in basic Supabase setup, so we fall back immediately
  throw new Error('RPC not available, using table queries');
}

// Convert PostgreSQL query to Supabase table query for basic cases
async function querySupabaseTable(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Handle basic SELECT queries for inventory_unit_preference
  if (query.includes('inventory_unit_preference') && query.includes('SELECT')) {
    let supabaseQuery = supabase.from('inventory_unit_preference').select('pk, id, data, updated_at, inventory_unit_pk');
    
    // Apply ORDER BY updated_at DESC and remove default limits
    supabaseQuery = supabaseQuery.order('updated_at', { ascending: false });
    
    // Apply LIMIT
    const limitMatch = query.match(/LIMIT\s+\$(\d+)/);
    if (limitMatch) {
      const paramIndex = parseInt(limitMatch[1]) - 1;
      if (params[paramIndex]) {
        supabaseQuery = supabaseQuery.limit(parseInt(params[paramIndex]));
      }
    }
    
    // Apply OFFSET
    const offsetMatch = query.match(/OFFSET\s+\$(\d+)/);
    if (offsetMatch) {
      const paramIndex = parseInt(offsetMatch[1]) - 1;
      if (params[paramIndex]) {
        supabaseQuery = supabaseQuery.range(parseInt(params[paramIndex]), parseInt(params[paramIndex]) + (limitMatch ? parseInt(params[parseInt(limitMatch[1]) - 1]) : 50) - 1);
      }
    }
    
    const { data, error } = await supabaseQuery;
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    return data || [];
  }
  
  // For filter options queries, handle specific cases
  if (query.includes('DISTINCT') && query.includes('inventory_unit_preference')) {
    // This is a filter options query - return basic data for now
    const { data, error } = await supabase.from('inventory_unit_preference').select('data').limit(1000);
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    // Process data to extract unique values based on the query
    const processedData: any[] = [];
    if (query.includes('kind')) {
      const kinds = new Set();
      data?.forEach((row: any) => {
        if (row.data?.kind) kinds.add(row.data.kind);
      });
      kinds.forEach(kind => processedData.push({ value: kind }));
    }
    
    return processedData;
  }
  
  throw new Error('Complex SQL queries require direct Supabase query builder implementation');
}

export async function queryDatabase(query: string, params: any[] = []): Promise<any[]> {
  // Use only Supabase connection
  if (!supabase) {
    throw new Error('Supabase connection not configured - missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  
  // Try RPC first, then fall back to table queries
  try {
    const result = await querySupabaseRPC(query, params);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.log('Supabase RPC failed, using table queries:', (error as Error).message);
    const result = await querySupabaseTable(query, params);
    return Array.isArray(result) ? result : [];
  }
}

export async function testConnection() {
  console.log('Environment check:', {
    SUPABASE_URL: SUPABASE_URL ? '***configured***' : 'missing',
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '***configured***' : 'missing'
  });
  
  try {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }
    
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('inventory_unit_preference').select('*').limit(1);
    if (error) {
      throw error;
    }
    console.log('Supabase connection successful, found', data?.length || 0, 'records');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', (error as Error).message);
    throw new Error(`Database connection failed: ${(error as Error).message}`);
  }
}