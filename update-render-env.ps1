# ============================================================
# update-render-env.ps1 — Sync .env to Render environment vars
# Usage: .\update-render-env.ps1 -RenderApiKey "rnd_XXXX"
#        or set $env:RENDER_API_KEY before running
# ============================================================

param(
    [string]$RenderApiKey = $env:RENDER_API_KEY,
    [string]$ServiceName  = "boostify-music",
    [string]$EnvFile      = ".env"
)

if (-not $RenderApiKey) {
    $RenderApiKey = Read-Host "Render API Key (https://dashboard.render.com/u/settings > API Keys)"
}

$headers = @{
    "Authorization" = "Bearer $RenderApiKey"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# ── 1. Find the service ID by name ────────────────────────────────────────────
Write-Host "`n[1/3] Searching for service '$ServiceName'..." -ForegroundColor Cyan
$resp = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers -ErrorAction Stop

$service = $resp | Where-Object { $_.service.name -eq $ServiceName } | Select-Object -First 1
if (-not $service) {
    Write-Error "Service '$ServiceName' not found. Check the name in render.yaml or pass -ServiceName."
    exit 1
}
$serviceId = $service.service.id
Write-Host "  Found service: $serviceId ($($service.service.name))" -ForegroundColor Green

# ── 2. Parse .env file ────────────────────────────────────────────────────────
Write-Host "`n[2/3] Parsing $EnvFile..." -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath   = Join-Path $scriptDir $EnvFile

if (-not (Test-Path $envPath)) {
    Write-Error ".env file not found at: $envPath"
    exit 1
}

$envVars = [System.Collections.Generic.List[hashtable]]::new()

# Multi-line value state
$currentKey   = $null
$currentValue = ""

foreach ($rawLine in (Get-Content $envPath -Encoding UTF8)) {
    $line = $rawLine

    # If we're inside a multi-line quoted value
    if ($null -ne $currentKey) {
        $currentValue += "`n" + $line
        if ($line -match '"$') {
            # Strip surrounding double-quotes from full value
            $val = $currentValue -replace '^"','' -replace '"$',''
            $envVars.Add(@{ key = $currentKey; value = $val })
            $currentKey   = $null
            $currentValue = ""
        }
        continue
    }

    # Skip comments and blank lines
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }

    # KEY=VALUE
    if ($line -match '^([^=]+)=(.*)$') {
        $key   = $Matches[1].Trim()
        $value = $Matches[2]

        # Handle single-quoted block (e.g., FIREBASE_ADMIN_KEY='...')
        if ($value -match "^'(.*)'\s*$") {
            $envVars.Add(@{ key = $key; value = $Matches[1] })
        }
        # Opening of multi-line double-quoted value
        elseif ($value -match '^"' -and $value -notmatch '"$') {
            $currentKey   = $key
            $currentValue = $value
        }
        # Normal double-quoted value on single line
        elseif ($value -match '^"(.*)"$') {
            $envVars.Add(@{ key = $key; value = $Matches[1] })
        }
        else {
            $envVars.Add(@{ key = $key; value = $value })
        }
    }
}

Write-Host "  Parsed $($envVars.Count) variables." -ForegroundColor Green

# ── 3. Push env vars to Render ────────────────────────────────────────────────
Write-Host "`n[3/3] Updating env vars on Render (service: $serviceId)..." -ForegroundColor Cyan

$body = $envVars | ForEach-Object { [PSCustomObject]$_ }
$json = $body | ConvertTo-Json -Depth 5

$putUrl = "https://api.render.com/v1/services/$serviceId/env-vars"

try {
    $result = Invoke-RestMethod -Uri $putUrl -Method Put -Headers $headers -Body $json -ErrorAction Stop
    Write-Host "`n  Done! $($result.Count) env vars updated on Render." -ForegroundColor Green
    Write-Host "  Render will use the new vars on the next deploy." -ForegroundColor Yellow
} catch {
    Write-Error "Render API error: $_"
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}
