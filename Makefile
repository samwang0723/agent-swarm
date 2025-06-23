.PHONY: install dev build test lint lint-fix clean

# Default target
all: install build

# Install dependencies
install:
	bun install

# Start development server
dev:
	bun run dev

# Build for production
build:
	bun run build

# Docker build api
docker-build-api:
	docker build -t api -f Dockerfile.api .

# Docker build frontend
docker-build-worker:
	docker build -t temporal-worker -f Dockerfile.worker .

# Run tests
test:
	bun test

# Run ESLint
lint:
	bun run lint

# Fix ESLint issues
lint-fix:
	bun run lint:fix

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf build/
	rm -rf coverage/
	rm -rf node_modules/
	rm -f bun.lock
	rm -f package-lock.json