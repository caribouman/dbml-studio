FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY app/package*.json ./

# Install ALL dependencies (including dev dependencies for Vite)
RUN npm install

# Copy application files
COPY app/ ./

# Build the frontend for production
RUN npm run build

# Create data directory for persistence
RUN mkdir -p /app/data

EXPOSE 3000

# Run in production mode
CMD ["npm", "start"]
