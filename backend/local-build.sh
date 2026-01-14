docker compose down
docker volume rm backend_postgres_data
docker compose up -d --build