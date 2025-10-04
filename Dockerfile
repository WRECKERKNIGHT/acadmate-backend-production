# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies and set proper shell
RUN apk add --no-cache curl bash git python3 make g++ dumb-init

# Create non-root user early
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files as root
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies as root
RUN npm ci --only=production --silent
RUN npm install typescript @prisma/client prisma --save-dev --silent

# Copy source code
COPY . .

# Generate Prisma client with explicit binary targets
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads dist

# Change ownership of everything to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 10000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start app
CMD ["node", "dist/server.js"]
