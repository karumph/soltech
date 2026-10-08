# Deploys the Soltech API and the static site. Run from this folder in PowerShell.
#   .\deploy.ps1            -> API (Lambda, role policy, one-minute schedule) then the site
#   .\deploy.ps1 -ApiOnly   -> API only
#   .\deploy.ps1 -SiteOnly  -> site only
# Uses the AWS CLI profile "invoicing" (account 942852434225, us-east-1). Touches only the Soltech resources.
param([switch]$ApiOnly, [switch]$SiteOnly, [string]$Branch = 'soltech')
$ErrorActionPreference = 'Stop'
$profileArgs = @('--profile', 'invoicing', '--region', 'us-east-1')
$here = $PSScriptRoot
$dist = Join-Path (Split-Path $here) 'soltech-refined\dist'
$build = Join-Path $env:TEMP 'soltech-build'
New-Item -ItemType Directory -Force $build | Out-Null

if (-not $SiteOnly) {
  Write-Host 'Checking the API code...'
  Push-Location $here
  npm ci --omit=dev --no-audit --no-fund | Out-Null
  node --check index.mjs; node --check scan.mjs
  Pop-Location

  Write-Host 'Making sure the watchlist table exists...'
  $tables = aws dynamodb list-tables @profileArgs --query TableNames --output text
  if (-not ($tables -split '\s+' -contains 'soltech-watchlists')) {
    aws dynamodb create-table --table-name soltech-watchlists --attribute-definitions AttributeName=userId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH --billing-mode PAY_PER_REQUEST @profileArgs | Out-Null
    aws dynamodb wait table-exists --table-name soltech-watchlists @profileArgs
  }

  Write-Host 'Updating the Lambda role policy for the new account routes...'
  aws iam put-role-policy --role-name soltech-scan --policy-name soltech-accounts --policy-document "file://$here/policy-accounts.json" @profileArgs

  Write-Host 'Uploading the Lambda code...'
  $zip = Join-Path $build 'function.zip'
  if (Test-Path $zip) { Remove-Item $zip }
  # tar writes forward-slash paths; Compress-Archive in Windows PowerShell can write backslashes, which Lambda can't read.
  tar -a -c -f $zip -C $here index.mjs scan.mjs assess.mjs safety.mjs onchain.mjs wallet.mjs package.json node_modules
  if ($LASTEXITCODE -ne 0) { throw 'Could not build function.zip' }
  aws lambda update-function-code --function-name soltech-api --zip-file "fileb://$zip" @profileArgs | Out-Null
  aws lambda wait function-updated --function-name soltech-api @profileArgs
  # Safety checks add a few seconds to each scan; 60 seconds leaves plenty of headroom.
  aws lambda update-function-configuration --function-name soltech-api --timeout 60 @profileArgs | Out-Null
  aws lambda wait function-updated --function-name soltech-api @profileArgs

  Write-Host 'Scanning every minute...'
  aws events put-rule --name soltech-scan --schedule-expression 'rate(1 minute)' --state ENABLED @profileArgs | Out-Null

  Write-Host 'Running one scan now...'
  $out = Join-Path $build 'scan-result.json'
  # Windows PowerShell strips quotes from JSON arguments, so the payload goes through a file.
  $payload = Join-Path $build 'scan-payload.json'
  Set-Content -Path $payload -Value '{"source":"aws.events"}' -Encoding ascii
  aws lambda invoke --function-name soltech-api --cli-binary-format raw-in-base64-out --payload "fileb://$payload" $out @profileArgs | Out-Null
  Get-Content $out
}

if (-not $ApiOnly) {
  Write-Host 'Packaging the site...'
  Push-Location (Split-Path $dist)
  node --test "tests/*.test.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed. The site was not deployed.' }
  Pop-Location
  $site = Join-Path $build 'site.zip'
  if (Test-Path $site) { Remove-Item $site }
  # index.html must sit at the top of the zip, not inside a folder.
  $entries = Get-ChildItem $dist | ForEach-Object { $_.Name }
  tar -a -c -f $site -C $dist @entries
  if ($LASTEXITCODE -ne 0) { throw 'Could not build site.zip' }
  $job = aws amplify create-deployment --app-id d3ilz6ab0hx4y4 --branch-name $Branch @profileArgs | ConvertFrom-Json
  Invoke-WebRequest -Uri $job.zipUploadUrl -Method Put -InFile $site -ContentType 'application/zip' -UseBasicParsing | Out-Null
  aws amplify start-deployment --app-id d3ilz6ab0hx4y4 --branch-name $Branch --job-id $job.jobId @profileArgs | Out-Null
  Write-Host "Site deployment $($job.jobId) started: https://$Branch.d3ilz6ab0hx4y4.amplifyapp.com/"
}
