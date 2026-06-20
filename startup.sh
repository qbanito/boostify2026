#!/bin/bash
set -e

echo "🚀 Starting production server..."

# Set environment to production
export NODE_ENV=production

# Set the port (Cloud Run provides PORT env var)
export PORT=${PORT:-5000}

echo "📦 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"

# Start the production server
echo "▶️  Starting server from dist/server/index.js..."
node dist/server/index.js
