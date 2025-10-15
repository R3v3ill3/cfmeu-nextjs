-- Query to get recent Postgres logs
SELECT 
  timestamp,
  event_message,
  parsed
FROM postgres_logs
ORDER BY timestamp DESC
LIMIT 50;

