Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root "assets\icons"
$storeDir = Join-Path $root "assets\store"
New-Item -ItemType Directory -Force -Path $iconDir, $storeDir | Out-Null

function New-Brush($color) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
}

function New-Pen($color, $width) {
  return [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($color), $width)
}

function Fill-RoundedRectangle($graphics, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundedRectangle($graphics, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $graphics.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-ChessMarkIcon($graphics, [float]$x, [float]$y, [float]$size, [bool]$storePadding = $false) {
  $scale = $size / 128
  if ($storePadding) {
    $pad = $size * 0.1
    $x += $pad
    $y += $pad
    $size -= $pad * 2
    $scale = $size / 128
  }

  $navy = New-Brush "#0F172A"
  $offWhite = New-Brush "#F8FAFC"
  $light = New-Brush "#E2E8F0"
  $darkSquare = New-Brush "#64748B"
  $yellow = New-Brush "#FACC15"
  $yellowShadow = New-Brush "#EAB308"
  $ink = New-Brush "#111827"
  $boardStroke = New-Pen "#111827" ([Math]::Max(1, 4 * $scale))

  Fill-RoundedRectangle $graphics $navy $x $y $size $size (28 * $scale)
  Fill-RoundedRectangle $graphics $offWhite ($x + 19 * $scale) ($y + 22 * $scale) (75 * $scale) (75 * $scale) (9 * $scale)

  $cell = 16 * $scale
  for ($rank = 0; $rank -lt 4; $rank++) {
    for ($file = 0; $file -lt 4; $file++) {
      $brush = if ((($rank + $file) % 2) -eq 0) { $light } else { $darkSquare }
      $graphics.FillRectangle($brush, $x + (25 + 16 * $file) * $scale, $y + (28 + 16 * $rank) * $scale, $cell, $cell)
    }
  }

  $ribbon = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $ribbon.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($x + 82 * $scale, $y + 18 * $scale),
    [System.Drawing.PointF]::new($x + 108 * $scale, $y + 18 * $scale),
    [System.Drawing.PointF]::new($x + 114 * $scale, $y + 24 * $scale),
    [System.Drawing.PointF]::new($x + 114 * $scale, $y + 110 * $scale),
    [System.Drawing.PointF]::new($x + 95 * $scale, $y + 97 * $scale),
    [System.Drawing.PointF]::new($x + 76 * $scale, $y + 110 * $scale),
    [System.Drawing.PointF]::new($x + 76 * $scale, $y + 24 * $scale)
  ))
  $graphics.FillPath($yellow, $ribbon)
  $ribbon.Dispose()

  $shadow = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $shadow.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($x + 76 * $scale, $y + 78 * $scale),
    [System.Drawing.PointF]::new($x + 95 * $scale, $y + 65 * $scale),
    [System.Drawing.PointF]::new($x + 114 * $scale, $y + 78 * $scale),
    [System.Drawing.PointF]::new($x + 114 * $scale, $y + 110 * $scale),
    [System.Drawing.PointF]::new($x + 95 * $scale, $y + 97 * $scale),
    [System.Drawing.PointF]::new($x + 76 * $scale, $y + 110 * $scale)
  ))
  $graphics.FillPath($yellowShadow, $shadow)
  $shadow.Dispose()

  $plus = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $plus.AddRectangle([System.Drawing.RectangleF]::new($x + 90 * $scale, $y + 35 * $scale, 10 * $scale, 30 * $scale))
  $plus.AddRectangle([System.Drawing.RectangleF]::new($x + 80 * $scale, $y + 45 * $scale, 30 * $scale, 10 * $scale))
  $graphics.FillPath($ink, $plus)
  $plus.Dispose()

  Stroke-RoundedRectangle $graphics $boardStroke ($x + 19 * $scale) ($y + 22 * $scale) (75 * $scale) (75 * $scale) (9 * $scale)

  $navy.Dispose()
  $offWhite.Dispose()
  $light.Dispose()
  $darkSquare.Dispose()
  $yellow.Dispose()
  $yellowShadow.Dispose()
  $ink.Dispose()
  $boardStroke.Dispose()
}

function Save-IconPng([int]$size, [string]$path, [bool]$storePadding = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-ChessMarkIcon $graphics 0 0 $size $storePadding
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-CenteredText($graphics, [string]$text, [string]$fontName, [float]$fontSize, [string]$color, [float]$x, [float]$y, [float]$w, [float]$h, [int]$style = 0) {
  $font = [System.Drawing.Font]::new($fontName, $fontSize, [System.Drawing.FontStyle]$style)
  $brush = New-Brush $color
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-LeftText($graphics, [string]$text, [float]$fontSize, [string]$color, [float]$x, [float]$y, [float]$w, [float]$h, [int]$style = 0) {
  $font = [System.Drawing.Font]::new("Segoe UI", $fontSize, [System.Drawing.FontStyle]$style)
  $brush = New-Brush $color
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Near
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $graphics.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-SampleBoard($graphics, [float]$x, [float]$y, [float]$size) {
  $light = New-Brush "#E2E8F0"
  $dark = New-Brush "#64748B"
  $piece = New-Brush "#111827"
  $pieceLight = New-Brush "#F8FAFC"
  $cell = $size / 8

  for ($rank = 0; $rank -lt 8; $rank++) {
    for ($file = 0; $file -lt 8; $file++) {
      $brush = if ((($rank + $file) % 2) -eq 0) { $light } else { $dark }
      $graphics.FillRectangle($brush, $x + $file * $cell, $y + $rank * $cell, $cell, $cell)
    }
  }

  $positions = @(
    @(4, 0, "dark"), @(3, 1, "dark"), @(4, 1, "dark"), @(5, 2, "dark"),
    @(2, 4, "light"), @(4, 5, "light"), @(3, 6, "light"), @(6, 7, "light")
  )

  foreach ($pos in $positions) {
    $brush = if ($pos[2] -eq "light") { $pieceLight } else { $piece }
    $graphics.FillEllipse($brush, $x + ($pos[0] + 0.22) * $cell, $y + ($pos[1] + 0.18) * $cell, $cell * 0.56, $cell * 0.64)
  }

  $light.Dispose()
  $dark.Dispose()
  $piece.Dispose()
  $pieceLight.Dispose()
}

function Draw-Chip($graphics, [string]$text, [float]$x, [float]$y, [float]$w, [string]$fill, [string]$color) {
  $brush = New-Brush $fill
  Fill-RoundedRectangle $graphics $brush $x $y $w 34 17
  $brush.Dispose()
  Draw-CenteredText $graphics $text "Segoe UI" 12 $color $x ($y + 7) $w 20 1
}

function Draw-StoreScreenshot($graphics, [int]$width, [int]$height, [string]$mode) {
  $paper = New-Brush "#F8FAFC"
  $panel = New-Brush "#FFFFFF"
  $navy = New-Brush "#0F172A"
  $line = New-Pen "#CBD5E1" 2
  $yellow = New-Brush "#FACC15"
  $muted = "#64748B"

  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#EEF2F7"))
  $graphics.FillRectangle($paper, 0, 0, $width, $height)
  Draw-ChessMarkIcon $graphics 72 62 82 $false
  Draw-LeftText $graphics "ChessMark" 38 "#0F172A" 178 70 360 52 1
  Draw-LeftText $graphics "Save chess positions for later study." 20 $muted 180 124 520 42 0

  if ($mode -eq "popup-detected" -or $mode -eq "popup-saved") {
    Fill-RoundedRectangle $graphics $panel 432 188 416 520 18
    Stroke-RoundedRectangle $graphics $line 432 188 416 520 18
    Draw-ChessMarkIcon $graphics 462 220 48 $false
    Draw-LeftText $graphics "ChessMark" 20 "#0F172A" 526 222 160 32 1
    Draw-LeftText $graphics "Save positions." 12 $muted 526 252 160 22 0
    Draw-Chip $graphics "Board detected" 672 224 136 "#FFF8D3" "#713F12"
    Draw-SampleBoard $graphics 554 300 168
    Draw-LeftText $graphics "Notes" 13 "#111827" 462 502 160 24 1
    Fill-RoundedRectangle $graphics $paper 462 532 316 54 8
    Draw-LeftText $graphics "Missed tactic here" 13 $muted 478 548 260 24 0
    Draw-LeftText $graphics "Tags" 13 "#111827" 462 604 160 24 1
    Fill-RoundedRectangle $graphics $paper 462 632 316 38 8
    Draw-LeftText $graphics "tactic, endgame" 13 $muted 478 642 260 24 0
    Draw-Chip $graphics "#tactic" 462 682 78 "#FFF8D3" "#713F12"
    Draw-Chip $graphics "#endgame" 548 682 94 "#FFFFFF" "#111827"
    Draw-Chip $graphics "#mistake" 650 682 92 "#FFFFFF" "#111827"

    if ($mode -eq "popup-saved") {
      Draw-LeftText $graphics "FEN saved locally" 18 "#0F172A" 892 320 300 42 1
      Draw-LeftText $graphics "Open it later from your library or export the position as FEN." 17 $muted 892 374 310 120 0
      Fill-RoundedRectangle $graphics $yellow 892 500 220 44 8
      Draw-CenteredText $graphics "Open Lichess Board" "Segoe UI" 14 "#111827" 892 511 220 24 1
    } else {
      Draw-LeftText $graphics "Detect a board, add notes, then save." 18 "#0F172A" 892 320 300 58 1
      Draw-LeftText $graphics "ChessMark captures a board screenshot and FEN when available." 18 $muted 892 390 300 90 0
    }
  } elseif ($mode -eq "library") {
    Fill-RoundedRectangle $graphics $panel 96 188 1088 520 18
    Stroke-RoundedRectangle $graphics $line 96 188 1088 520 18
    Draw-LeftText $graphics "ChessMark Library" 28 "#0F172A" 136 224 360 42 1
    Draw-LeftText $graphics "3 saved bookmarks." 15 $muted 138 264 240 28 0
    Draw-Chip $graphics "JSON" 924 224 76 "#FFFFFF" "#111827"
    Draw-Chip $graphics "FEN" 1010 224 68 "#FFFFFF" "#111827"
    Draw-Chip $graphics "Clear" 1088 224 72 "#FFF6F2" "#8E3F2D"
    Fill-RoundedRectangle $graphics $paper 136 310 396 46 8
    Draw-LeftText $graphics "Search notes, tags, FEN, source" 14 $muted 158 323 320 24 0
    Draw-Chip $graphics "All tags" 552 316 96 "#FFFFFF" "#111827"
    Draw-Chip $graphics "Newest first" 666 316 126 "#FFFFFF" "#111827"

    for ($row = 0; $row -lt 2; $row++) {
      $y = 388 + $row * 132
      Fill-RoundedRectangle $graphics $paper 136 $y 1008 112 10
      Draw-SampleBoard $graphics 154 ($y + 14) 84
      Draw-Chip $graphics $(if ($row -eq 0) { "Chess.com" } else { "Lichess" }) 260 ($y + 16) 98 "#F0F3F6" "#111827"
      Draw-LeftText $graphics $(if ($row -eq 0) { "Knight tactic from blitz review" } else { "Endgame conversion position" }) 18 "#0F172A" 260 ($y + 52) 440 30 1
      Draw-Chip $graphics $(if ($row -eq 0) { "#tactic" } else { "#endgame" }) 260 ($y + 84) 92 "#FFF8D3" "#713F12"
      Draw-Chip $graphics "Source" 854 ($y + 20) 82 "#FFFFFF" "#111827"
      Draw-Chip $graphics "Copy" 944 ($y + 20) 72 "#FFFFFF" "#111827"
      Draw-Chip $graphics "Analysis" 1024 ($y + 20) 92 "#FFFFFF" "#111827"
    }
  } else {
    throw "Unknown store screenshot mode: $mode"
  }

  $paper.Dispose()
  $panel.Dispose()
  $navy.Dispose()
  $line.Dispose()
  $yellow.Dispose()
}

function Save-StoreAsset([int]$width, [int]$height, [string]$path, [string]$mode) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0F172A"))

  $accent = New-Brush "#FACC15"
  $graphics.FillRectangle($accent, 0, $height - [Math]::Max(8, [int]($height * 0.04)), $width, [Math]::Max(8, [int]($height * 0.04)))
  $accent.Dispose()

  if ($mode -eq "promo") {
    Draw-ChessMarkIcon $graphics 28 48 112 $false
    Draw-LeftText $graphics "ChessMark" 36 "#F8FAFC" 166 58 240 52 1
    Draw-LeftText $graphics "Bookmark chess positions for later study." 18 "#CBD5E1" 168 112 230 70 0
    Draw-LeftText $graphics "No engine. No eval. Just saved positions." 13 "#FACC15" 168 190 230 34 1
  } elseif ($mode -eq "marquee") {
    Draw-ChessMarkIcon $graphics 112 130 300 $false
    Draw-LeftText $graphics "ChessMark" 78 "#F8FAFC" 470 138 760 100 1
    Draw-LeftText $graphics "Bookmark chess positions for later study." 34 "#CBD5E1" 476 258 760 62 0
    Draw-LeftText $graphics "A private library for positions you want to remember." 24 "#FACC15" 478 344 760 48 1
  } elseif ($mode -in @("popup-detected", "popup-saved", "library")) {
    Draw-StoreScreenshot $graphics $width $height $mode
  } else {
    throw "Unknown store asset mode: $mode"
  }

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-IconPng 16 (Join-Path $iconDir "icon_16.png")
Save-IconPng 32 (Join-Path $iconDir "icon_32.png")
Save-IconPng 48 (Join-Path $iconDir "icon_48.png")
Save-IconPng 128 (Join-Path $iconDir "icon_128.png")
Save-IconPng 128 (Join-Path $iconDir "store_icon_128.png") $true

Save-StoreAsset 440 280 (Join-Path $storeDir "promo_tile_440x280.png") "promo"
Save-StoreAsset 1400 560 (Join-Path $storeDir "marquee_1400x560.png") "marquee"
Save-StoreAsset 1280 800 (Join-Path $storeDir "screenshot_popup_detected_1280x800.png") "popup-detected"
Save-StoreAsset 1280 800 (Join-Path $storeDir "screenshot_popup_saved_1280x800.png") "popup-saved"
Save-StoreAsset 1280 800 (Join-Path $storeDir "screenshot_library_1280x800.png") "library"

$oldScreenshotPath = Join-Path $storeDir "screenshot_placeholder_1280x800.png"
if (Test-Path -LiteralPath $oldScreenshotPath) {
  Remove-Item -LiteralPath $oldScreenshotPath -Force
}

Write-Host "Generated ChessMark icon and store assets."
