# Build Windows package
# This script handles the electron-builder failures gracefully

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host 'Building Windows Package' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Set environment variables
$env:NODE_ENV = "production"
$env:ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = "true"

# Run electron-builder with --dir to create win-unpacked
# We ignore the exit code because it may fail on winCodeSign but still create win-unpacked
Write-Host 'Running electron-builder...' -ForegroundColor Yellow

try {
    npx electron-builder --win --x64 --dir 2>&1 | Out-Host
} catch {
    Write-Host "`nelectron-builder encountered errors" -ForegroundColor Yellow
}

Write-Host 'Checking if win-unpacked was created...' -ForegroundColor Yellow
Write-Host ''

# Check if win-unpacked exists
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$distPath = Join-Path -Path $projectRoot -ChildPath "dist"
$unpackedPath = Join-Path -Path $distPath -ChildPath "win-unpacked"

if (Test-Path $unpackedPath) {
    Write-Host '✓ win-unpacked directory found' -ForegroundColor Green
    Write-Host 'Proceeding to create ZIP package...' -ForegroundColor Green
    Write-Host ''
    
    # Run the pack script
    $packScript = Join-Path -Path $scriptPath -ChildPath "pack-windows.js"
    node $packScript
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nWindows package built successfully!" -ForegroundColor Green
        Write-Host ''
        exit 0
    } else {
        Write-Host "`nZIP packaging failed" -ForegroundColor Red
        Write-Host ''
        exit 1
    }
} else {
    Write-Host ("`nwin-unpacked directory not found at: {0}" -f $unpackedPath) -ForegroundColor Red
    Write-Host 'electron-builder failed to create the unpacked directory' -ForegroundColor Red
    exit 1
}
