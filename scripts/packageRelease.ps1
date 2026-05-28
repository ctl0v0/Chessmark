$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"
$releaseDir = Join-Path $root "release"

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "manifest.json must include a version before packaging."
}

if ([string]::IsNullOrWhiteSpace($manifest.name)) {
  throw "manifest.json must include a name before packaging."
}

if ([string]::IsNullOrWhiteSpace($manifest.description)) {
  throw "manifest.json must include a description before packaging."
}

if ($manifest.description.Length -gt 132) {
  throw "manifest.json description must be 132 characters or fewer."
}

npm run build

$distManifestPath = Join-Path $distDir "manifest.json"
if (!(Test-Path -LiteralPath $distManifestPath)) {
  throw "dist/manifest.json was not created."
}

$distManifest = Get-Content -Raw -Path $distManifestPath | ConvertFrom-Json
if ($distManifest.manifest_version -ne 3) {
  throw "dist/manifest.json must be Manifest V3."
}

if ($distManifest.permissions -contains "tabs") {
  throw "The release manifest still contains the unnecessary tabs permission."
}

$requiredIcons = @(
  "assets\icons\icon_16.png",
  "assets\icons\icon_32.png",
  "assets\icons\icon_48.png",
  "assets\icons\icon_128.png"
)

foreach ($icon in $requiredIcons) {
  $iconPath = Join-Path $distDir $icon
  if (!(Test-Path -LiteralPath $iconPath)) {
    throw "Required extension icon is missing from dist: $icon"
  }
}

$storeAssets = @(
  @{ Path = "assets\store\promo_tile_440x280.png"; Width = 440; Height = 280 },
  @{ Path = "assets\store\marquee_1400x560.png"; Width = 1400; Height = 560 },
  @{ Path = "assets\store\screenshot_popup_detected_1280x800.png"; Width = 1280; Height = 800 },
  @{ Path = "assets\store\screenshot_popup_saved_1280x800.png"; Width = 1280; Height = 800 },
  @{ Path = "assets\store\screenshot_library_1280x800.png"; Width = 1280; Height = 800 }
)

Add-Type -AssemblyName System.Drawing
foreach ($asset in $storeAssets) {
  $assetPath = Join-Path $root $asset.Path
  if (!(Test-Path -LiteralPath $assetPath)) {
    throw "Required Chrome Web Store asset is missing: $($asset.Path)"
  }

  $image = [System.Drawing.Image]::FromFile($assetPath)
  try {
    if ($image.Width -ne $asset.Width -or $image.Height -ne $asset.Height) {
      throw "Chrome Web Store asset has invalid dimensions: $($asset.Path) is $($image.Width)x$($image.Height), expected $($asset.Width)x$($asset.Height)."
    }
  } finally {
    $image.Dispose()
  }
}

$blockedFiles = Get-ChildItem -Path $distDir -Recurse -File | Where-Object {
  $_.Name -match "README\.md|screenshot_placeholder|icon_source\.svg" -or
  $_.FullName.Replace("\", "/") -match "/assets/store/"
}

if ($blockedFiles) {
  $blockedList = ($blockedFiles | ForEach-Object { $_.FullName }) -join [Environment]::NewLine
  throw "Release package contains non-runtime or placeholder files:$([Environment]::NewLine)$blockedList"
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$zipPath = Join-Path $releaseDir "chessmark-$version.zip"

$resolvedReleaseDir = (Resolve-Path -LiteralPath $releaseDir).Path
if ((Split-Path -Parent $zipPath) -ne $resolvedReleaseDir) {
  throw "Resolved ZIP path is outside the release directory."
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$distFiles = Get-ChildItem -Path $distDir -Force
Compress-Archive -Path $distFiles.FullName -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Created $zipPath"
