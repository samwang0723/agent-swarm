.PHONY: install dev build test lint lint-fix clean format format-check type-check

# Default target
all: install build

# Install dependencies
install:
	npm install

# Start development server
dev:
	npm run dev

# Build for production
build:
	npm run build

# Run tests
test:
	npm test

# Run ESLint
lint:
	npm run lint

# Fix ESLint issues
lint-fix:
	npm run lint:fix

# Format code with Prettier
format:
	npm run format

# Check code formatting
format-check:
	npm run format:check

# Type check TypeScript
type-check:
	npm run type-check

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf build/
	rm -rf coverage/
	rm -rf node_modules/ 