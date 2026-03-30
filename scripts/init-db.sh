#!/bin/bash
set -e

# Database initialization script
# This script creates the database schema and initializes tables

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-surveyapp}
DB_NAME=${DB_NAME:-survey_db}

echo "Initializing database: $DB_NAME on $DB_HOST:$DB_PORT..."

# Wait for database to be ready
max_attempts=30
attempt=0
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ $attempt -gt $max_attempts ]; then
    echo "Error: Database not ready after $max_attempts attempts"
    exit 1
  fi
  echo "Waiting for database... ($attempt/$max_attempts)"
  sleep 1
done

echo "Database is ready!"

# Run initialization SQL
if [ -f "$(dirname "$0")/../server/database/schema.sql" ]; then
  echo "Running schema initialization..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/../server/database/schema.sql"
  echo "✓ Database schema initialized successfully"
else
  echo "Warning: schema.sql not found"
fi

# Create indexes for better performance
echo "Creating indexes..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_response_id ON answers(response_id);
EOF

echo "✓ Indexes created successfully"
echo "✓ Database initialization complete!"
