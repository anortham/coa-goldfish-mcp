#!/usr/bin/env ts-node

/**
 * Safe cleanup of Memory object files after successful migration
 * Only removes files that contain Memory objects (have "type" field with memory types)
 * Preserves TodoLists and Checkpoints
 */

import { Storage } from '../src/core/storage.js';
import fs from 'fs-extra';
import { join } from 'path';

interface CleanupResult {
  success: boolean;
  totalFilesScanned: number;
  memoryFilesFound: number;
  filesDeleted: number;
  errors: string[];
  deletedFiles: string[];
}

async function cleanupMemoryFiles(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    totalFilesScanned: 0,
    memoryFilesFound: 0,
    filesDeleted: 0,
    errors: [],
    deletedFiles: []
  };

  try {
    const storage = new Storage();
    const basePath = storage.getBasePath();
    const workspaces = await storage.discoverWorkspaces();
    
    console.log(`Found ${workspaces.length} workspaces to clean`);
    
    for (const workspace of workspaces) {
      console.log(`\n--- Cleaning workspace: ${workspace} ---`);
      
      // Check todos directory for Memory objects
      const todosDir = join(basePath, workspace, 'todos');
      if (await fs.pathExists(todosDir)) {
        const files = await fs.readdir(todosDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        console.log(`Found ${jsonFiles.length} JSON files in todos directory`);
        result.totalFilesScanned += jsonFiles.length;
        
        for (const file of jsonFiles) {
          const filePath = join(todosDir, file);
          
          try {
            const data = await fs.readJson(filePath);
            
            // Check if it's a Memory object (has "type" field with memory types)
            if (data.type && ['general', 'todo', 'context'].includes(data.type)) {
              result.memoryFilesFound++;
              console.log(`  🗑️  Memory object: ${file} (type: ${data.type})`);
              
              if (!dryRun) {
                await fs.unlink(filePath);
                result.filesDeleted++;
                result.deletedFiles.push(filePath);
              }
            } else if (data.title && data.items && Array.isArray(data.items)) {
              // This is a TodoList - skip it
              console.log(`  ✅ TodoList: ${file} (keeping)`);
            } else {
              console.log(`  ❓ Unknown format: ${file} (keeping)`);
            }
          } catch (error) {
            const errorMsg = `Failed to process ${filePath}: ${error}`;
            result.errors.push(errorMsg);
            console.log(`  ❌ ${errorMsg}`);
          }
        }
      }
      
      // Also check checkpoints directories for any stray Memory objects
      const checkpointsDir = join(basePath, workspace, 'checkpoints');
      if (await fs.pathExists(checkpointsDir)) {
        const dateDirs = await fs.readdir(checkpointsDir);
        
        for (const dateDir of dateDirs) {
          const datePath = join(checkpointsDir, dateDir);
          const stat = await fs.stat(datePath).catch(() => null);
          if (!stat || !stat.isDirectory()) continue;
          
          const files = await fs.readdir(datePath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          result.totalFilesScanned += jsonFiles.length;
          
          for (const file of jsonFiles) {
            const filePath = join(datePath, file);
            
            try {
              const data = await fs.readJson(filePath);
              
              // Check if it's a Memory object in checkpoints (shouldn't happen but check anyway)
              if (data.type && ['general', 'todo', 'context'].includes(data.type)) {
                result.memoryFilesFound++;
                console.log(`  🗑️  Memory object in checkpoints: ${file} (type: ${data.type})`);
                
                if (!dryRun) {
                  await fs.unlink(filePath);
                  result.filesDeleted++;
                  result.deletedFiles.push(filePath);
                }
              }
            } catch (error) {
              // Silently skip corrupted files in checkpoints
            }
          }
        }
      }
    }
    
  } catch (error) {
    result.success = false;
    result.errors.push(`Cleanup failed: ${error}`);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('='.repeat(60));
  console.log('🧹 COA Goldfish MCP - Memory Files Cleanup Tool');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚡ EXECUTE (will delete files)'}`);
  console.log();
  
  console.log('🎯 Target: Memory objects (type: general|todo|context)');
  console.log('✅ Preserve: TodoLists and Checkpoints');
  console.log();

  try {
    const result = await cleanupMemoryFiles(dryRun);

    // Display results
    console.log();
    console.log('📊 CLEANUP RESULTS');
    console.log('='.repeat(40));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Files Scanned: ${result.totalFilesScanned}`);
    console.log(`Memory Files Found: ${result.memoryFilesFound}`);
    console.log(`Files ${dryRun ? 'Would Delete' : 'Deleted'}: ${dryRun ? result.memoryFilesFound : result.filesDeleted}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log();

    if (result.errors.length > 0) {
      console.log('❌ ERRORS');
      console.log('-'.repeat(40));
      result.errors.forEach(error => console.error(error));
      console.log();
    }

    if (dryRun && result.memoryFilesFound > 0) {
      console.log('💡 To execute the cleanup, run:');
      console.log('   npm run cleanup:memory -- --execute');
      console.log();
      console.log('⚠️  This will permanently delete all Memory object files!');
      console.log('   TodoLists and Checkpoints will be preserved.');
      console.log();
    }

    if (!dryRun && result.success) {
      console.log('🎉 Cleanup completed successfully!');
      console.log(`🗑️  Deleted ${result.filesDeleted} Memory object files`);
      console.log('✅ Storage architecture simplification complete!');
      console.log();
      console.log('📈 Your storage now contains only:');
      console.log('   • Checkpoints (session snapshots)');
      console.log('   • TodoLists (enhanced with metadata, lifecycle, etc.)');
      console.log();
    }

  } catch (error) {
    console.error('💥 Cleanup failed with error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});