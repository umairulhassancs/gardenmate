# Compare ALL files between current and backup, including non-src directories
$current = "c:\Users\Umair Ul Hassan\Downloads\GM\GM"
$backup = "c:\Users\Umair Ul Hassan\Music\GardenMateExpoup"

# Get all relevant files (exclude node_modules, .git, android, ios, .expo)
$excludeDirs = @("node_modules", ".git", "android", "ios", ".expo", ".gemini")

function Get-ProjectFiles($root) {
    Get-ChildItem -Path $root -Recurse -File | Where-Object {
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

# Build relative path maps
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

Write-Host "=== FILES THAT EXIST IN BOTH BUT ARE DIFFERENT ==="
$diffCount = 0
foreach ($rel in $currentMap.Keys) {
    if ($backupMap.ContainsKey($rel)) {
        $h1 = (Get-FileHash $currentMap[$rel]).Hash
        $h2 = (Get-FileHash $backupMap[$rel]).Hash
        if ($h1 -ne $h2) {
            Write-Host "CHANGED: $rel"
            $diffCount++
        }
    }
}
Write-Host "Total changed: $diffCount"

Write-Host ""
Write-Host "=== FILES ONLY IN CURRENT (new files added by Gemini Pro) ==="
$newCount = 0
foreach ($rel in $currentMap.Keys) {
    if (-not $backupMap.ContainsKey($rel)) {
        Write-Host "NEW: $rel"
        $newCount++
    }
}
Write-Host "Total new: $newCount"

Write-Host ""
Write-Host "=== FILES ONLY IN BACKUP (deleted by Gemini Pro) ==="
$delCount = 0
foreach ($rel in $backupMap.Keys) {
    if (-not $currentMap.ContainsKey($rel)) {
        Write-Host "MISSING: $rel"
        $delCount++
    }
}
Write-Host "Total missing from current: $delCount"
