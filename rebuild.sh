#!/bin/bash
set -e

echo "🔍 Checking prerequisites..."

# Check if .env file exists
if [ ! -f "app/.env" ]; then
    echo "❌ ERROR: app/.env file not found!"
    echo "   Authentication will not work without this file."
    exit 1
fi

echo "✓ .env file found"

# Check if .env has required variables
if ! grep -q "GOOGLE_CLIENT_ID" app/.env; then
    echo "⚠️  WARNING: GOOGLE_CLIENT_ID not found in .env"
fi

if ! grep -q "JWT_SECRET" app/.env; then
    echo "⚠️  WARNING: JWT_SECRET not found in .env"
fi

echo ""
echo "🔨 Building and deploying DBML Studio..."
echo ""

# Build and start the container
docker-compose up -d --build

echo ""
echo "⏳ Waiting for container to start..."
sleep 3

# Check if container is running
if docker ps | grep -q dbml-studio; then
    echo "✓ Container is running"

    # Verify .env file is in container
    if docker exec dbml-studio test -f /app/.env; then
        echo "✓ .env file is present in container"
    else
        echo "❌ ERROR: .env file missing in container!"
        exit 1
    fi

    # Check environment variables are loaded
    if docker exec dbml-studio node -e "require('dotenv').config(); process.exit(process.env.GOOGLE_CLIENT_ID ? 0 : 1);" 2>/dev/null; then
        echo "✓ Environment variables loaded successfully"
    else
        echo "⚠️  WARNING: Environment variables may not be loaded correctly"
    fi

    echo ""
    echo "✅ Build complete!"
    echo "📊 View logs: docker logs dbml-studio -f"
    echo "🌐 Access at: https://dbml-studio.soyecourt.ovh"
else
    echo "❌ ERROR: Container failed to start"
    echo "📋 Check logs: docker logs dbml-studio"
    exit 1
fi
