#!/usr/bin/env node
/**
 * Database configuration helper
 * Switches Prisma schema between SQLite (dev) and PostgreSQL (prod)
 * based on NODE_ENV environment variable.
 *
 * Gracefully handles production environments (Vercel, etc.) by:
 * 1. Detecting VERCEL_ENV or NODE_ENV=production
 * 2. Using DATABASE_URL if available (no DEV_DATABASE_URL required in prod)
 * 3. Falling back to SQLite only if DATABASE_URL is missing in non-prod
 *
 * Usage:
 *   node scripts/db-config.js [production|development]
 *
 * Or automatically detect from NODE_ENV:
 *   node scripts/db-config.js
 */

const fs = require('fs');
const path = require('path');

// Load .env file if present (for local usage)
// Note: In production (Vercel, etc.), env vars are already loaded
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (err) {
    // dotenv not available, env vars should be set by platform
    console.log('ℹ️  dotenv not available, using platform environment variables');
  }
}

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

// Smart environment detection
const explicitEnv = process.argv[2]; // Command line argument
const nodeEnv = process.env.NODE_ENV;
const vercelEnv = process.env.VERCEL_ENV; // Vercel sets this automatically
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const hasDevDatabaseUrl = !!process.env.DEV_DATABASE_URL;

// Determine if we're in production
// Priority: explicit arg > VERCEL_ENV > NODE_ENV > fallback to dev if no DATABASE_URL
let isProduction;
if (explicitEnv) {
  isProduction = explicitEnv === 'production';
} else if (vercelEnv) {
  // Vercel sets VERCEL_ENV to 'production', 'preview', or 'development'
  isProduction = vercelEnv === 'production';
} else if (nodeEnv === 'production') {
  isProduction = true;
} else if (hasDatabaseUrl && !hasDevDatabaseUrl) {
  // If only DATABASE_URL is set, assume production
  isProduction = true;
} else {
  // Default to development
  isProduction = false;
}

// Log environment detection
console.log(`\n🔧 Configuring database for: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
if (vercelEnv) console.log(`   Detected Vercel environment: ${vercelEnv}`);
if (explicitEnv) console.log(`   Explicit environment: ${explicitEnv}`);
if (nodeEnv) console.log(`   NODE_ENV: ${nodeEnv}`);
console.log('');

// Validate environment variables
if (isProduction && !hasDatabaseUrl) {
  console.error('❌ ERROR: Production mode requires DATABASE_URL environment variable');
  console.error('');
  console.error('Please set DATABASE_URL to your PostgreSQL connection string:');
  console.error('  - Vercel: Settings → Environment Variables → Add DATABASE_URL');
  console.error('  - Local: Add DATABASE_URL=postgresql://... to .env');
  console.error('');
  console.error('💡 Get a free PostgreSQL database:');
  console.error('  - Vercel Postgres: vercel.com/storage');
  console.error('  - Neon: neon.tech');
  console.error('  - Supabase: supabase.com');
  console.error('');
  process.exit(1);
}

if (!isProduction && !hasDevDatabaseUrl) {
  console.warn('⚠️  WARNING: Development mode requires DEV_DATABASE_URL');
  console.warn('   Using fallback: file:./vibesafe.db');
  console.warn('   Add DEV_DATABASE_URL="file:./vibesafe.db" to .env to silence this warning\n');
}

// Read current schema
let schema = fs.readFileSync(schemaPath, 'utf8');

if (isProduction) {
  // Switch to PostgreSQL
  schema = schema.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`
  );
  console.log('✅ Configured for PostgreSQL (DATABASE_URL)');
  console.log('   Provider: postgresql');
  console.log('   URL: env("DATABASE_URL")\n');
} else {
  // Switch to SQLite
  schema = schema.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {
  provider = "sqlite"
  url      = env("DEV_DATABASE_URL")
}`
  );
  console.log('✅ Configured for SQLite (DEV_DATABASE_URL)');
  console.log('   Provider: sqlite');
  console.log('   URL: env("DEV_DATABASE_URL")\n');
}

// Write updated schema
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('💡 Next steps:');
if (isProduction) {
  console.log('   1. Make sure DATABASE_URL is set in .env or Vercel');
  console.log('   2. Run: npx prisma generate');
  console.log('   3. Run: npx prisma db push\n');
} else {
  console.log('   1. Run: npx prisma generate');
  console.log('   2. Run: npx prisma migrate dev\n');
}

console.log('✅ Configuration complete!\n');
