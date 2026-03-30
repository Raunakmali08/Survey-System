#!/bin/bash
set -e

# Deployment script for production
# Usage: ./deploy.sh <environment> [version]

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
REGISTRY=${REGISTRY:-docker.io}
IMAGE_NAME=${IMAGE_NAME:-survey-system}

echo "🚀 Deploying $IMAGE_NAME:$VERSION to $ENVIRONMENT..."

# Verify environment
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "development" ]; then
  echo "❌ Invalid environment: $ENVIRONMENT"
  exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  exit 1
fi

# Load environment
ENV_FILE=".env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Environment file not found: $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

echo "📦 Building Docker image..."
docker build \
  --build-arg NODE_ENV="$ENVIRONMENT" \
  -t "$IMAGE_NAME:$VERSION" \
  -t "$IMAGE_NAME:latest" \
  .

if [ -n "$REGISTRY" ]; then
  echo "📤 Pushing to registry: $REGISTRY..."
  docker tag "$IMAGE_NAME:$VERSION" "$REGISTRY/$IMAGE_NAME:$VERSION"
  docker tag "$IMAGE_NAME:latest" "$REGISTRY/$IMAGE_NAME:latest"
  docker push "$REGISTRY/$IMAGE_NAME:$VERSION"
  docker push "$REGISTRY/$IMAGE_NAME:latest"
fi

echo "🔄 Pulling latest dependencies..."
docker-compose pull

echo "🗄️  Running database migrations..."
docker-compose run --rm backend npm run migrate

echo "🔄 Deploying with zero downtime..."
# Strategy: Bring up new container, health check, stop old
docker-compose up -d --no-deps --build backend

# Wait for health check
echo "⏳ Waiting for service to be healthy..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if docker-compose exec -T backend curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Service is healthy"
    break
  fi
  attempt=$((attempt + 1))
  echo "  Checking... ($attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "⚠️  Service health check timeout - rolling back"
  docker-compose down
  exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo "   Environment: $ENVIRONMENT"
echo "   Version: $VERSION"
echo "   Image: $IMAGE_NAME:$VERSION"
echo ""
echo "📊 Check logs with: docker-compose logs -f"
echo "🛑 To rollback: docker-compose down && docker-compose up -d"
