# Use Node.js LTS Debian-based image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install ALL dependencies (dev + prod)
RUN npm ci

# Add node_modules/.bin to PATH (ensure tsc & prisma are executable)
ENV PATH=/app/node_modules/.bin:$PATH

# Copy Prisma schema folder
COPY prisma ./prisma/

# Generate Prisma client BEFORE copying full source
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy all source code
COPY . .

# Make node_modules binaries executable
RUN chmod -R +x node_modules/.bin

# Build TypeScript project
RUN npm run build

# Remove devDependencies to slim image (optional)
RUN npm prune --production

# Create uploads directory
RUN mkdir -p uploads

# Create non-root user and set ownership
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
ENV PORT=5000
EXPOSE 5000

# Healthcheck for Render
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Start application
CMD ["npm", "start"]
