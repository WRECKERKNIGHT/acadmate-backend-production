# Deployment Checklist

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
