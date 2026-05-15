#!/usr/bin/env node

/**
 * Delete Database Script
 * 
 * Deletes the SQLite database file and all migrations to start completely fresh.
 * This is useful when you want to reset your entire database schema.
 * 
 * Usage: npm run db:reset
 */

const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log(`✅ Deleted: ${filePath}`, colors.green);
    return true;
  } else {
    log(`⏭️  Skipped (not found): ${filePath}`, colors.yellow);
    return false;
  }
}

function deleteDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    log(`✅ Deleted directory: ${dirPath}`, colors.green);
    return true;
  } else {
    log(`⏭️  Skipped (not found): ${dirPath}`, colors.yellow);
    return false;
  }
}

async function main() {
  log('\n🗑️  Database Reset Script', colors.blue);
  log('━'.repeat(50), colors.blue);
  
  const projectRoot = path.join(__dirname, '..');
  
  // Database files to delete
  const dbFiles = [
    path.join(projectRoot, 'prisma', 'vibesafe.db'),
    path.join(projectRoot, 'prisma', 'vibesafe.db-journal'),
    path.join(projectRoot, 'prisma', 'vibesafe.db-shm'),
    path.join(projectRoot, 'prisma', 'vibesafe.db-wal'),
    path.join(projectRoot, 'prisma', 'dev.db'),
    path.join(projectRoot, 'prisma', 'dev.db-journal'),
  ];
  
  // Migrations directory
  const migrationsDir = path.join(projectRoot, 'prisma', 'migrations');
  
  log('\n📁 Deleting database files...', colors.yellow);
  
  let deletedCount = 0;
  for (const file of dbFiles) {
    if (deleteFile(file)) {
      deletedCount++;
    }
  }
  
  log('\n📁 Deleting migrations directory...', colors.yellow);
  if (deleteDirectory(migrationsDir)) {
    deletedCount++;
  }
  
  log('\n' + '━'.repeat(50), colors.green);
  if (deletedCount > 0) {
    log(`✅ Database reset complete! Deleted ${deletedCount} item(s).`, colors.green);
    log('\n💡 Next steps:', colors.blue);
    log('   1. Your database is now completely clean', colors.reset);
    log('   2. Run "npm run dev" to recreate the database', colors.reset);
    log('   3. Or run "npm run db:migrate" to create proper migrations\n', colors.reset);
  } else {
    log('ℹ️  No database files found to delete.', colors.yellow);
    log('💡 Your database is already clean!\n', colors.blue);
  }
}

main().catch((error) => {
  log('\n❌ Error during database reset:', colors.red);
  console.error(error);
  process.exit(1);
});
