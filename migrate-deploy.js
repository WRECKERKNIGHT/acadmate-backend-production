#!/usr/bin/env node

/**
 * Database migration script for production deployment
 * This runs after the container starts to ensure database is ready
 */

const { spawn } = require('child_process');

console.log('🚀 Starting database migration for production...');

// Run Prisma migrate deploy
const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true
});

migrate.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Database migration completed successfully');
    
    // Check if we should seed the database
    if (process.env.SEED_DATABASE === 'true') {
      console.log('🌱 Seeding database with initial data...');
      
      const seed = spawn('npm', ['run', 'seed:all'], {
        stdio: 'inherit',
        shell: true
      });
      
      seed.on('close', (seedCode) => {
        if (seedCode === 0) {
          console.log('✅ Database seeding completed');
        } else {
          console.log('⚠️ Database seeding failed, but continuing...');
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } else {
    console.error('❌ Database migration failed with code:', code);
    process.exit(1);
  }
});

migrate.on('error', (error) => {
  console.error('❌ Migration process error:', error);
  process.exit(1);
});