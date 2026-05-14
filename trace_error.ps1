$bundle = (Invoke-WebRequest -Uri "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" -UseBasicParsing).Content
$lines = $bundle.Split("`n")
Write-Host "Total bundle lines: $($lines.Length)"
Write-Host ""

$targets = @(351223, 3856, 106792, 160426, 346851)

foreach ($t in $targets) {
    Write-Host "--- Stack frame at line $t ---"
    $found = $false
    for ($i = $t; $i -ge [Math]::Max(0, $t-3000); $i--) {
        if ($lines[$i] -match '^__d\(function') {
            for ($j = $t; $j -le [Math]::Min($lines.Length-1, $t+3000); $j++) {
                if ($lines[$j] -match '^\},(\d+),\[') {
                    $endLine = $lines[$j]
                    $fileMatch = [regex]::Match($endLine, '"([^"]+)"')
                    if ($fileMatch.Success) {
                        Write-Host "  File: $($fileMatch.Groups[1].Value)"
                    }
                    $idMatch = [regex]::Match($endLine, '^\},(\d+),')
                    if ($idMatch.Success) {
                        Write-Host "  Module ID: $($idMatch.Groups[1].Value)"
                    }
                    break
                }
            }
            Write-Host "  Module starts at line: $i"
            Write-Host "  Crash/call at line: $t (offset +$($t - $i) from module start)"
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "  Not inside a __d module (global scope or polyfill)"
        $content = $lines[$t]
        if ($content.Length -gt 120) { $content = $content.Substring(0, 120) }
        Write-Host "  Content: $content"
    }
    Write-Host ""
}

# Also show what's at line 346851 exactly and 15 chars in
$line = $lines[346851]
Write-Host "--- Line 346851 full content (first 200 chars) ---"
if ($line.Length -gt 200) { Write-Host $line.Substring(0,200) } else { Write-Host $line }
