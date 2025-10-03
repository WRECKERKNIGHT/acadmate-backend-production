# Use Node.js LTS Debian-based image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# Copy package files first for caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for Prisma)
RUN npm ci

# Generate Prisma client with proper permissions
RUN npx prisma generate --schema=prisma/schema.prisma --no-install --unsafe-perm

# Remove devDependencies to slim image
RUN npm prune --production

# Copy rest of the source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
