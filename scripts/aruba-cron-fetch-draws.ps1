param(
  [Parameter(Mandatory = $true)]
  [string]$CronSecret,

  [string]$BaseUrl = "https://powerlotto.vercel.app",

  [string]$LogPath = "C:\\inetpub\\wwwroot\\powerlotto-cron.log"
)

$uri = "$BaseUrl/api/cron/fetch-draws"
$timestamp = (Get-Date).ToString("s")

try {
  $headers = @{ Authorization = "Bearer $CronSecret" }
  $response = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -TimeoutSec 90 -UseBasicParsing
  "$timestamp OK Status=$($response.StatusCode) Uri=$uri" | Out-File -FilePath $LogPath -Append -Encoding utf8
}
catch {
  "$timestamp ERROR Uri=$uri Message=$($_.Exception.Message)" | Out-File -FilePath $LogPath -Append -Encoding utf8
  exit 1
}
