#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Checks if all required environment variables are properly configured
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Load environment variables
config();

console.log('🔍 Environment Variable Validation\n');

// Check if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
const envExists = existsSync(envPath);

if (!envExists) {
  console.log('❌ .env file not found');
  console.log('💡 Run "npm run setup" to create one from the template\n');
  process.exit(1);
}

console.log('✅ .env file found');

// Define required and optional variables
const requiredVars = {
  'SUPABASE_URL': {
    description: 'Supabase project URL',
    example: 'https://your-project-id.supabase.co',
    validator: (val) => val && val.startsWith('https://') && val.includes('.supabase.co')
  },
  'SUPABASE_ANON_KEY': {
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    validator: (val) => val && val.length > 100
  },
  'VITE_WEBHOOK_URL': {
    description: 'Webhook endpoint for inquiry submissions (required)',
    example: 'https://your-webhook-endpoint.com/inquiries',
    validator: (val) => val && val.startsWith('https://')
  }
};

const optionalVars = {
  'PORT': {
    description: 'Server port',
    example: '5000',
    validator: (val) => !val || (!isNaN(parseInt(val)) && parseInt(val) > 0)
  },
  'NODE_ENV': {
    description: 'Node environment',
    example: 'development',
    validator: (val) => !val || ['development', 'production', 'test'].includes(val)
  }
};

let hasErrors = false;

// Check required variables
console.log('\n📋 Required Variables:');
for (const [key, config] of Object.entries(requiredVars)) {
  const value = process.env[key];
  const isValid = config.validator(value);
  
  if (!value) {
    console.log(`❌ ${key}: Missing`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Example: ${config.example}`);
    hasErrors = true;
  } else if (!isValid) {
    console.log(`⚠️  ${key}: Invalid format`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Example: ${config.example}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${key}: Configured`);
  }
}

// Check optional variables
console.log('\n📋 Optional Variables:');
for (const [key, config] of Object.entries(optionalVars)) {
  const value = process.env[key];
  
  if (!value) {
    console.log(`⚪ ${key}: Not set (will use defaults)`);
  } else if (!config.validator(value)) {
    console.log(`⚠️  ${key}: Invalid format`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Example: ${config.example}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${key}: ${value}`);
  }
}

// Summary
console.log('\n📊 Summary:');
if (hasErrors) {
  console.log('❌ Environment configuration has issues');
  console.log('💡 Please update your .env file with the correct values');
  console.log('📖 See README.md for detailed setup instructions');
  process.exit(1);
} else {
  console.log('✅ All environment variables are properly configured');
  console.log('🚀 Ready to run the application!');
} 