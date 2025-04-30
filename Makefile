# Makefile for setting up the Lynx DevTool project

# Variables
NODE_VERSION = 18.20.2
PNPM_VERSION = 7.33.6

NODE_VM=$(shell \
		command -v nvm > /dev/null 2>&1 && echo ". ~/.nvm/nvm.sh && nvm" \
		|| command -v fnm > /dev/null 2>&1 && echo "fnm" )

# Targets
.PHONY: all setup install build dev

all: setup build install dev

setup:
	@echo "Setting up Node.js and pnpm..."
	corepack enable
	$(NODE_VM) install $(NODE_VERSION)
	$(NODE_VM) use $(NODE_VERSION)
	npx pnpm@$(PNPM_VERSION) -v

build:
	@echo "Building DevTools frontend..."
	npx pnpm@$(PNPM_VERSION) run build:devtools-frontend-lynx

install:
	@echo "Installing project dependencies..."
	npx pnpm@$(PNPM_VERSION) install

dev:
	@echo "Starting development environment..."
	npx pnpm@$(PNPM_VERSION) run dev