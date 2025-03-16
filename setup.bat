@echo off
setlocal enabledelayedexpansion

:: Variables
set NODE_VERSION=18.20.2
set PNPM_VERSION=7.33.6

:: Main execution - check parameter first
if "%~1"=="" (
    goto all
) else (
    goto %~1
)

:all
    call :setup
    call :build
    call :install
    call :dev
    goto :end

:setup
    echo Setting up Node.js and pnpm...
    call corepack enable
    
    :: Check if correct Node version is already active
    for /f "tokens=*" %%i in ('node -v') do set CURRENT_NODE=%%i
    set CURRENT_NODE=!CURRENT_NODE:~1!
    
    if "!CURRENT_NODE!"=="%NODE_VERSION%" (
        echo Node.js %NODE_VERSION% is already active
    ) else (
        :: Try NVS first
        where nvs >nul 2>&1
        if !errorlevel! equ 0 (
            echo Using NVS to set Node version
            call nvs add %NODE_VERSION%
            call nvs use %NODE_VERSION%
        ) else (
            :: Try NVM as fallback
            where nvm >nul 2>&1
            if !errorlevel! equ 0 (
                echo Using NVM to set Node version
                call nvm use %NODE_VERSION%
                if !errorlevel! neq 0 (
                    call nvm install %NODE_VERSION%
                    call nvm use %NODE_VERSION%
                )
            ) else (
                echo Neither NVS nor NVM found. Please install Node.js %NODE_VERSION% manually.
                exit /b 1
            )
        )
    )
    
    call npx pnpm@%PNPM_VERSION% -v
    if not "%~1"=="" goto :end
    goto :eof

:build
    echo Building DevTools frontend...
    call npx pnpm@%PNPM_VERSION% run build:devtools-frontend-lynx
    if not "%~1"=="" goto :end
    goto :eof

:install
    echo Installing project dependencies...
    call npx pnpm@%PNPM_VERSION% install
    if not "%~1"=="" goto :end
    goto :eof

:dev
    echo Starting development environment...
    start cmd /c "npx pnpm@%PNPM_VERSION% run dev"
    if not "%~1"=="" goto :end
    goto :eof

:end
    exit /b 0