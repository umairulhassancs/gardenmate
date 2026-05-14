# Find ONLY changed files (exist in both, different hash) and restore from backup
$current = "c:\Users\Umair Ul Hassan\Downloads\GM\GM"
$backup = "c:\Users\Umair Ul Hassan\Music\GardenMateExpoup"

$excludeDirs = @("node_modules", ".git", "android", "ios", ".expo", ".gemini", "dist", ".idea", "tester")

function Get-ProjectFiles($root) {
    Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $path = $_.FullName
        $excluded = $false
        foreach ($dir in $excludeDirs) {
            if ($path -like "*\$dir\*") { $excluded = $true; break }
        }
        -not $excluded
    }
}

$currentFiles = Get-ProjectFiles $current
$backupFiles = Get-ProjectFiles $backup

$currentMap = @{}
foreach ($f in $currentFiles) {
    $rel = $f.FullName.Substring($current.Length)
    $currentMap[$rel] = $f.FullName
}

$backupMap = @{}
foreach ($f in $backupFiles) {
    $rel = $f.FullName.Substring($backup.Length)
    $backupMap[$rel] = $f.FullName
}

Write-Host "=== ALL FILES THAT DIFFER (exist in both, different content) ==="
$changed = @()
foreach ($rel in $currentMap.Keys | Sort-Object) {
    if ($backupMap.ContainsKey($rel)) {
        $h1 = (Get-FileHash $currentMap[$rel]).Hash
        $h2 = (Get-FileHash $backupMap[$rel]).Hash
        if ($h1 -ne $h2) {
            Write-Host "CHANGED: $rel"
            $changed += $rel
        }
    }
}
Write-Host ""
Write-Host "Total files that need restoring: $($changed.Count)"
Write-Host ""
Write-Host "Changed files list:"
foreach ($c in $changed) {
    Write-Host "  $c"
}
