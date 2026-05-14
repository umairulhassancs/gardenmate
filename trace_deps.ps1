# Find who depends on module 1708 (VendorComplaintsScreen)
# and trace the chain back to the entry points

$bundle = (Invoke-WebRequest -Uri "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" -UseBasicParsing).Content
$lines = $bundle.Split("`n")

# Find all module registrations
Write-Host "=== Searching for modules that depend on 1708 ==="
$pattern = '^\},(\d+),\[([^\]]*)\],"([^"]*)"'
$moduleMap = @{}

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match $pattern) {
        $modId = $Matches[1]
        $deps = $Matches[2]
        $file = $Matches[3]
        $moduleMap[$modId] = @{ deps = $deps; file = $file; line = $i }
        
        # Check if this module depends on 1708
        $depList = $deps -split ','
        foreach ($d in $depList) {
            if ($d.Trim() -eq '1708') {
                Write-Host "Module $modId ($file) depends on 1708"
            }
        }
    }
}

Write-Host ""
Write-Host "=== Now tracing chain: who depends on those modules? ==="

# Find who depends on module 1714 (VendorComplaintDetailScreen)
foreach ($entry in $moduleMap.GetEnumerator()) {
    $depList = $entry.Value.deps -split ','
    foreach ($d in $depList) {
        if ($d.Trim() -eq '1714') {
            Write-Host "Module $($entry.Key) ($($entry.Value.file)) depends on 1714"
        }
    }
}

Write-Host ""
Write-Host "=== Entry point modules ==="
Write-Host "Module 0: $($moduleMap['0'].file)"
Write-Host "Module 3: $($moduleMap['3'].file)"
Write-Host "Module 212: $($moduleMap['212'].file)"

# Trace from entry 212 down to find path to 1708
Write-Host ""
Write-Host "=== Module 212 deps ==="
Write-Host "File: $($moduleMap['212'].file)"
Write-Host "Deps: $($moduleMap['212'].deps)"

# Find AppNavigator or similar
foreach ($entry in $moduleMap.GetEnumerator()) {
    if ($entry.Value.file -match 'AppNavigator|navigation') {
        Write-Host "Nav module: $($entry.Key) -> $($entry.Value.file)"
        Write-Host "  Deps: $($entry.Value.deps)"
    }
}
