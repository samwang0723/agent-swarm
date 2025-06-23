#!/bin/bash
set -e

# Create temporal database for Temporal.io (appdb already exists as the default database)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create temporal database for Temporal.io
    CREATE DATABASE temporal;
    GRANT ALL PRIVILEGES ON DATABASE temporal TO postgres;
    
    -- Ensure postgres user has proper permissions
    ALTER USER postgres CREATEDB;
EOSQL

echo "Temporal database created successfully (appdb already exists with your schema)" 