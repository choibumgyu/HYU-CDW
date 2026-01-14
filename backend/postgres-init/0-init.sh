DB_NAME="ohdsi"
DB_SCHEMA="ohdsi_test"
DB_USER="ohdsi"

echo "Creating schema '$DB_SCHEMA' if not exists..."
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA};
    GRANT USAGE ON SCHEMA ${DB_SCHEMA} TO ${DB_USER}; -- 필요시 권한 부여
    GRANT ALL PRIVILEGES ON SCHEMA ${DB_SCHEMA} TO ${DB_USER}; -- 필요시 모든 권한 부여
EOSQL

echo "Schema '$DB_SCHEMA' created or already exists."