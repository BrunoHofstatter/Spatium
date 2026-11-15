Add-Type -AssemblyName System.Drawing
foreach ($size in @(192, 512)) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#6268ce'))
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $unit = $size / 100.0
  $graphics.FillRectangle($brush, [single](24*$unit), [single](24*$unit), [single](23*$unit), [single](23*$unit))
  $graphics.FillRectangle($brush, [single](53*$unit), [single](24*$unit), [single](23*$unit), [single](52*$unit))
  $graphics.FillRectangle($brush, [single](24*$unit), [single](53*$unit), [single](23*$unit), [single](23*$unit))
  $bitmap.Save((Join-Path $PSScriptRoot "../public/icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
