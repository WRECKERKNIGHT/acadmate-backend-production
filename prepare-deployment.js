#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Preparing backend for deployment...');

// Clean up old SQLite migrations that won't work with PostgreSQL
const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
if (fs.existsSync(migrationsDir)) {
  console.log('📁 Cleaning up old migrations...');
  fs.rmSync(migrationsDir, { recursive: true, force: true });
  console.log('✅ Old migrations removed');
}

// Create a deployment environment file template
const envTemplate = `# Production Environment Variables for Render
NODE_ENV=production
PORT=10000
DATABASE_URL=your_postgres_connection_string_here
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=https://your-frontend-domain.netlify.app

# Optional: Email configuration for notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
`;

const envPath = path.join(__dirname, '.env.production');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envTemplate);
  console.log('📄 Created .env.production template');
}

// Create a simple deployment checklist
const checklist = `# Deployment Checklist

## Before Deploying:
- [ ] Update Prisma schema provider to 'postgresql'
- [ ] Set up PostgreSQL database on Render
- [ ] Configure environment variables in Render dashboard
- [ ] Test build process locally: npm run build
- [ ] Push code to GitHub repository

## Environment Variables to Set in Render:
- NODE_ENV=production
- PORT=10000
- DATABASE_URL=(from Render PostgreSQL database)
- JWT_SECRET=(generate a secure random string)
- CORS_ORIGIN=(your frontend URL on Netlify)

## After Deployment:
- [ ] Run database migration: npx prisma migrate deploy
- [ ] Seed database: npm run seed:all
- [ ] Test API endpoints
- [ ] Monitor logs for errors

## Troubleshooting:
- Check logs in Render dashboard
- Verify environment variables are set correctly
- Ensure PostgreSQL connection is working
- Test with curl or Postman
`;

fs.writeFileSync(path.join(__dirname, 'DEPLOYMENT_CHECKLIST.md'), checklist);
console.log('📋 Created deployment checklist');

console.log('✨ Deployment preparation complete!');
console.log('\nNext steps:');
console.log('1. Run: npm run build (to test build process)');
console.log('2. Set up PostgreSQL database on Render');
console.log('3. Configure environment variables');
console.log('4. Deploy to Render');