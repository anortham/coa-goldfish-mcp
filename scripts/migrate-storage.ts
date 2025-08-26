#!/usr/bin/env ts-node

/**
 * CLI tool to migrate Memory objects to TodoLists
 * Part of the storage architecture simplification
 */

import { Storage } from '../src/core/storage.js';
import { migrateMemoriesToTodoLists } from '../src/utils/migrate-memories.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('='.repeat(60));
  console.log('📦 COA Goldfish MCP - Storage Migration Tool');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚡ EXECUTE (will make changes)'}`);
  console.log();

  const storage = new Storage();
  console.log(`📁 Base path: ${storage.getBasePath()}`);
  console.log();

  try {
    console.log('🚀 Starting migration...');
    const result = await migrateMemoriesToTodoLists(storage, dryRun);

    // Display results
    console.log();
    console.log('📊 MIGRATION RESULTS');
    console.log('='.repeat(40));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Migrated: ${result.migratedCount} items`);
    console.log(`Skipped: ${result.skippedCount} items`);
    console.log(`Errors: ${result.errors.length}`);
    console.log();

    if (result.details.length > 0) {
      console.log('📋 DETAILS');
      console.log('-'.repeat(40));
      result.details.forEach(detail => console.log(detail));
      console.log();
    }

    if (result.errors.length > 0) {
      console.log('❌ ERRORS');
      console.log('-'.repeat(40));
      result.errors.forEach(error => console.error(error));
      console.log();
    }

    if (dryRun && result.migratedCount > 0) {
      console.log('💡 To execute the migration, run:');
      console.log('   npm run migrate:storage -- --execute');
      console.log();
    }

    if (!dryRun && result.success) {
      console.log('🎉 Migration completed successfully!');
      console.log('📌 Note: Original Memory files are preserved for safety.');
      console.log('   Run Phase 3.2 cleanup when ready to remove them.');
      console.log();
    }

  } catch (error) {
    console.error('💥 Migration failed with error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});