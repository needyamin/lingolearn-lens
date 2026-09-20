Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\needy\OneDrive\Desktop\firefox\bangla-lens\icons\icon-128.png'
$img = [System.Drawing.Image]::FromFile($srcPath)
$size = [Math]::Max($img.Width, $img.Height)
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$x = [int](($size - $img.Width) / 2)
$y = [int](($size - $img.Height) / 2)
$g.DrawImage($img, $x, $y, $img.Width, $img.Height)
$g.Dispose()
$tmpPath = "$srcPath.tmp"
$bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$img.Dispose()
Move-Item -Force $tmpPath $srcPath
$check = [System.Drawing.Image]::FromFile($srcPath)
Write-Host ("icon-128 normalized: {0}x{1}" -f $check.Width, $check.Height)
$check.Dispose()
