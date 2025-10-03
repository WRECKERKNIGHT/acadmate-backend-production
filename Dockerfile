# Use Node.js LTS Debian-based image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# Copy package files first for caching
COPY package*.json ./

# Install all dependencies including devDependencies (needed for Prisma and TypeScript)
RUN npm ci

# Ensure node_modules/.bin is in PATH
ENV PATH=/app/node_modules/.bin:$PATH

# Copy Prisma schema folder
COPY prisma ./prisma/

# Generate Prisma client safely
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy the rest of the source code
COPY . .

# Build TypeScript project BEFORE pruning devDependencies
RUN npm run build

# Remove devDependencies to slim the image
RUN npm prune --production

# Create uploads directory
RUN mkdir -p uploads

# Create a non-root user and set ownership
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Render uses $PORT environment variable)
ENV PORT=5000
EXPOSE 5000

# Healthcheck for Render
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application
CMD ["npm", "start"]
