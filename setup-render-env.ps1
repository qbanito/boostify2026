<#
.SYNOPSIS
    Sube todas las variables de entorno de .env a Render via API.
.USAGE
    .\setup-render-env.ps1 -RenderApiKey "rnd_XXXXX" -ServiceId "srv-XXXXX"
    
    Obtén tu API Key en: https://dashboard.render.com/u/settings → API Keys
    El Service ID está en la URL de tu servicio: dashboard.render.com/web/srv-XXXXX
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$RenderApiKey,
    
    [Parameter(Mandatory=$true)]
    [string]$ServiceId
)

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found at $envFile"
    exit 1
}

# Parse .env file into key-value pairs
$envVars = @()
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    
    # Split on first = only
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    
    # Remove surrounding quotes if present
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    
    # Skip NODE_ENV=development (override to production)
    if ($key -eq "NODE_ENV") {
        $envVars += @{ key = $key; value = "production" }
        return
    }
    
    $envVars += @{ key = $key; value = $value }
}

Write-Host "📦 Found $($envVars.Count) variables in .env" -ForegroundColor Cyan

# Build the request body — Render expects an array of {key, value} objects
$body = $envVars | ConvertTo-Json -Depth 3

$headers = @{
    "Accept"        = "application/json"
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $RenderApiKey"
}

$url = "https://api.render.com/v1/services/$ServiceId/env-vars"

Write-Host "🚀 Uploading to Render service: $ServiceId ..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $url -Method PUT -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ All $($envVars.Count) environment variables set successfully!" -ForegroundColor Green
    Write-Host "🔄 Render will redeploy automatically with the new variables." -ForegroundColor Cyan
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody  = $_.ErrorDetails.Message
    Write-Error "❌ Render API error ($statusCode): $errorBody"
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  • API Key is wrong — get it from https://dashboard.render.com/u/settings" -ForegroundColor Yellow
    Write-Host "  • Service ID is wrong — check the URL in your Render dashboard" -ForegroundColor Yellow
}
