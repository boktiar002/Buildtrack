-- Runs once when the Docker database is first created.
-- The automated tests use their own database so they never touch your demo data.
CREATE DATABASE buildtrack_test OWNER buildtrack;
\c buildtrack
CREATE EXTENSION IF NOT EXISTS vector;
\c buildtrack_test
CREATE EXTENSION IF NOT EXISTS vector;
