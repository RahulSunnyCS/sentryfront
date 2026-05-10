#!/usr/bin/env node
/**
 * Database configuration helper
 * Switches Prisma schema between SQLite (dev) and PostgreSQL (prod)
 * based on NODE_ENV environment variable.
 * 
 * Usage:
 *   node scripts/db-config.js [production|development]
 *   
 * Or automatically detect from NODE_ENV:
 *   node scripts/db-config.js
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const env = process.argv[2] || process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

console.log(`\n🔧 Configuring database for: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

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
  console.log('   1. Make sure DATABASE_URL is set in .env');
  console.log('   2. Run: npx prisma generate');
  console.log('   3. Run: npx prisma migrate deploy\n');
} else {
  console.log('   1. Run: npx prisma generate');
  console.log('   2. Run: npx prisma migrate dev\n');
}
