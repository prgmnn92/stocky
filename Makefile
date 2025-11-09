.PHONY: help install dev test lint format docker-build docker-up docker-down clean

help:
	@echo "Stocky - Swing Trading Signal Generator"
	@echo ""
	@echo "Available commands:"
	@echo "  install      Install dependencies with poetry"
	@echo "  dev          Run development server"
	@echo "  test         Run tests"
	@echo "  lint         Run ruff linter"
	@echo "  format       Format code with black"
	@echo "  docker-build Build Docker image"
	@echo "  docker-up    Start Docker container"
	@echo "  docker-down  Stop Docker container"
	@echo "  clean        Remove build artifacts"

install:
	poetry install

dev:
	poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	poetry run pytest tests/ -v --cov=app

lint:
	poetry run ruff check app/

format:
	poetry run black app/
	poetry run ruff check --fix app/

docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache .coverage htmlcov/
