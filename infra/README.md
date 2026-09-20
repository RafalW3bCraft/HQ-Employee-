# Infrastructure & Deployment

This directory contains container definitions for Webcraft Employee.

## Local PostgreSQL
To start the local database container:
```bash
docker compose up -d
```
Connection URL: `postgresql://webcraft:webcraft_secure_password@localhost:5432/webcraft_employee`

## Backend Docker Container
To build and run the backend container:
```bash
docker build -t webcraft-employee-backend -f infra/Dockerfile .
docker run -p 3000:3000 --env-file backend/.env webcraft-employee-backend
```
