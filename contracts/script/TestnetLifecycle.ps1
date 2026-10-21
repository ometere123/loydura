$ErrorActionPreference = "Stop"

# Testnet-only lifecycle evidence. This script generates ephemeral member keys in memory,
# reads only ignored local deployer configuration, and never writes private keys to disk.
$envLines = Get-Content (Join-Path $PSScriptRoot "..\.env.local")
$rpc = ($envLines | Where-Object { $_ -match "^ELYSIUM_RPC_URL=" }) -replace "^ELYSIUM_RPC_URL=", ""
$deployerKey = ($envLines | Where-Object { $_ -match "^DEPLOYER_PRIVATE_KEY=" }) -replace "^DEPLOYER_PRIVATE_KEY=", ""
if ([string]::IsNullOrWhiteSpace($rpc) -or [string]::IsNullOrWhiteSpace($deployerKey)) {
  throw "contracts/.env.local must provide ELYSIUM_RPC_URL and DEPLOYER_PRIVATE_KEY"
}

$hub = "0x12B48836E495F863F40212f40aEc7372388345a4"
$rewards = "0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea"
$usdc = "0x1c615884174973eb69c14ebb3c9a91d72f2d035d"
$token = "0x2358d9a7d7a5000914bca4c20d193039d788cf8f"
$deployer = "0x9E118CC3876CBe57DaeE90A079be16F4AD74098c"
$shopId = "1"

function Send-LifecycleTransaction {
  param(
    [Parameter(Mandatory = $true)][string]$Step,
    [Parameter(Mandatory = $true)][string]$SignerKey,
    [Parameter(Mandatory = $true)][string]$To,
    [string]$Signature = "",
    [string[]]$FunctionArgs = @(),
    [string]$Value = ""
  )

  $arguments = @("send", $To)
  if ($Signature -ne "") {
    $arguments += $Signature
    if ($FunctionArgs.Count -gt 0) { $arguments += $FunctionArgs }
  }
  if ($Value -ne "") { $arguments += @("--value", $Value) }
  $arguments += @("--rpc-url", $rpc, "--private-key", $SignerKey, "--json", "--confirmations", "1")
  $rawParts = @(& cast @arguments 2>&1)
  $exitCode = $LASTEXITCODE
  $raw = ($rawParts | Out-String).Trim()
  if ($exitCode -ne 0) {
    throw "$Step failed: $($raw.Substring(0, [Math]::Min(1200, $raw.Length)))"
  }
  try { $receipt = $raw | ConvertFrom-Json } catch {
    throw "$Step returned an invalid receipt: $($raw.Substring(0, [Math]::Min(1200, $raw.Length)))"
  }
  if (-not $receipt.transactionHash -or $receipt.status -ne "0x1") {
    throw "$Step returned an unsuccessful receipt"
  }
  Write-Output ("TX|{0}|{1}" -f $Step, $receipt.transactionHash)
  return $receipt.transactionHash
}

function Get-ChainTimestamp {
  return [uint64](cast block latest --rpc-url $rpc --field timestamp)
}

function Wait-ForChainTime([uint64]$Target) {
  while ($true) {
    $now = Get-ChainTimestamp
    if ($now -ge $Target) {
      Write-Output ("CHAIN_TIME|{0}" -f $now)
      return
    }
    $remaining = [int]($Target - $now)
    Write-Output ("WAIT|target={0}|current={1}|remaining={2}s" -f $Target, $now, $remaining)
    Start-Sleep -Seconds ([Math]::Min(30, [Math]::Max(5, [int]($remaining / 2))))
  }
}

if ((cast chain-id --rpc-url $rpc).Trim() -ne "99801") { throw "Refusing lifecycle: RPC is not Elysium Testnet 99801" }
$wallets = @()
for ($walletIndex = 0; $walletIndex -lt 4; $walletIndex++) {
  $walletJson = @(cast wallet new --json | ConvertFrom-Json)
  $wallets += $walletJson[0]
}
$members = @($wallets | ForEach-Object { [string]($_.PSObject.Properties["address"].Value) })
$keys = @($wallets | ForEach-Object { [string]($_.PSObject.Properties["private_key"].Value) })
$price = "10000000000000000000" # 10 tLOYD1, read from shop #1
$lockAmount = "5000000000000000000" # 5 tLOYD1 per member
$memberMint = "100000000000000000000"
$budget = "120000" # 0.12 mock USDC, six-decimal units
$totalFunding = "121200" # net budget plus 1% funding fee
$baseTimestamp = Get-ChainTimestamp
$start = $baseTimestamp + 180
$end = $baseTimestamp + 360
$campaignId = (cast call $rewards "nextCampaignId()(uint256)" --rpc-url $rpc).Trim()

Write-Output ("LIFECYCLE|chain=99801|shop={0}|campaign={1}|start={2}|end={3}" -f $shopId, $campaignId, $start, $end)
for ($i = 0; $i -lt $members.Count; $i++) {
  Write-Output ("MEMBER|m{0}|{1}" -f ($i + 1), $members[$i])
  Send-LifecycleTransaction ("fund-hype-m{0}" -f ($i + 1)) $deployerKey $members[$i] "" @() "1000000000000000"
  Send-LifecycleTransaction ("mint-token-m{0}" -f ($i + 1)) $deployerKey $token "mint(address,uint256)" @($members[$i], $memberMint)
}

Send-LifecycleTransaction "creator-approve-campaign" $deployerKey $usdc "approve(address,uint256)" @($rewards, $totalFunding)
Send-LifecycleTransaction "creator-create-campaign" $deployerKey $rewards "createCampaign(uint256,uint256,uint64,uint64)" @($shopId, $budget, $start, $end)

for ($i = 0; $i -lt $members.Count; $i++) {
  Send-LifecycleTransaction ("member-approve-hub-m{0}" -f ($i + 1)) $keys[$i] $token "approve(address,uint256)" @($hub, $price)
  Send-LifecycleTransaction ("member-buy-m{0}" -f ($i + 1)) $keys[$i] $hub "buyMembership(uint256)" @($shopId)
  Send-LifecycleTransaction ("member-approve-rewards-m{0}" -f ($i + 1)) $keys[$i] $token "approve(address,uint256)" @($rewards, $lockAmount)
  Send-LifecycleTransaction ("member-lock-m{0}" -f ($i + 1)) $keys[$i] $rewards "lock(uint256,uint256)" @($campaignId, $lockAmount)
}

Wait-ForChainTime ($start + 2)
for ($i = 0; $i -lt 2; $i++) {
  Send-LifecycleTransaction ("member-early-exit-m{0}" -f ($i + 1)) $keys[$i] $rewards "unlock(uint256)" @($campaignId)
}

Wait-ForChainTime ($end + 2)
for ($i = 2; $i -lt 4; $i++) {
  Send-LifecycleTransaction ("member-claim-m{0}" -f ($i + 1)) $keys[$i] $rewards "claim(uint256)" @($campaignId)
  Send-LifecycleTransaction ("member-principal-withdraw-m{0}" -f ($i + 1)) $keys[$i] $rewards "unlock(uint256)" @($campaignId)
}
Send-LifecycleTransaction "creator-reclaim-campaign" $deployerKey $rewards "reclaim(uint256)" @($campaignId)

Write-Output "LIFECYCLE|complete"
Write-Output "CAMPAIGN_STATE|"
cast call $rewards "getCampaign(uint256)" $campaignId --rpc-url $rpc
for ($i = 0; $i -lt $members.Count; $i++) {
  Write-Output ("POSITION|m{0}|{1}" -f ($i + 1), $members[$i])
  cast call $rewards "getPosition(uint256,address)" $campaignId $members[$i] --rpc-url $rpc
}
Write-Output "RECONCILIATION|rewards-usdc-balance"
cast call $usdc "balanceOf(address)(uint256)" $rewards --rpc-url $rpc
Write-Output "RECONCILIATION|creator-usdc-balance"
cast call $usdc "balanceOf(address)(uint256)" $deployer --rpc-url $rpc
