FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json package*.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies
RUN npm install --workspace=server

# Copy application code
COPY server ./server

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["npm", "run", "--workspace=server", "start"]
