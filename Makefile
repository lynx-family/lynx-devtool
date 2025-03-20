# Makefile for setting up the Lynx DevTool project

# Variables
NODE_VERSION = 18.20.2
PNPM_VERSION = 7.33.6

# Targets
.PHONY: all setup install build dev

all: setup install build dev

setup:
	@echo "Setting up Node.js and pnpm..."
	corepack enable
	. ~/.nvm/nvm.sh && nvm install $(NODE_VERSION)
	. ~/.nvm/nvm.sh && nvm use $(NODE_VERSION)
	npx pnpm@$(PNPM_VERSION) -v

install:
	@echo "Installing project dependencies..."
	npx pnpm@$(PNPM_VERSION) install

build:
	@echo "Building DevTools frontend..."
	npx pnpm@$(PNPM_VERSION) run build:devtools-frontend-lynx

dev:
	@echo "Starting development environment..."
	npx pnpm@$(PNPM_VERSION) run dev