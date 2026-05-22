# Generate self-signed code signing certificate for MC ForgeLab
# Run once on your dev machine, then add the output to GitHub Secrets

$ErrorActionPreference = "Stop"

$certName = "N个酸柠檬"
$password = "mcfl-self-sign-2026"

Write-Host "=== Creating self-signed code signing certificate ===" -ForegroundColor Cyan
Write-Host "Subject: CN=$certName" -ForegroundColor Gray
Write-Host ""

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=$certName" `
  -KeyUsage DigitalSignature `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -CertStoreLocation Cert:\CurrentUser\My

Write-Host "Certificate created. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green

$certPath = "mcfl-code-sign.pfx"
$passwordSecure = ConvertTo-SecureString -String $password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $passwordSecure | Out-Null

Write-Host "Exported to $certPath" -ForegroundColor Green
Write-Host ""

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $certPath)))

Write-Host "=== GitHub Secrets ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add the following to repo Settings -> Secrets and variables -> Actions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Name:  WINDOWS_CSC_LINK" -ForegroundColor White
Write-Host "  Value: $base64" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Name:  WINDOWS_CSC_KEY_PASSWORD" -ForegroundColor White
Write-Host "  Value: $password" -ForegroundColor DarkGray
Write-Host ""

Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "1. Copy the two secrets above to GitHub" -ForegroundColor White
Write-Host "2. Delete $certPath from this machine (it's already in the base64 secret)" -ForegroundColor White
Write-Host "3. Next release will be self-signed" -ForegroundColor White
Write-Host ""
Write-Host "NOTE: Self-signed certs still trigger SmartScreen initially." -ForegroundColor Yellow
Write-Host "Submit the signed .exe to https://www.microsoft.com/en-us/wdsi/filesubmission" -ForegroundColor Yellow
Write-Host "after the first release to remove the warning faster." -ForegroundColor Yellow
