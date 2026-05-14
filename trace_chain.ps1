# Find specifically who depends on 1708 and trace chain to entry point
$bundle = (Invoke-WebRequest -Uri "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" -UseBasicParsing).Content
$lines = $bundle.Split("`n")

$pattern = '^\},(\d+),\[([^\]]*)\],"([^"]*)"'
$moduleMap = @{}
$dependents = @{}

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match $pattern) {
        $modId = $Matches[1]
        $deps = $Matches[2]
        $file = $Matches[3]
        $moduleMap[$modId] = @{ deps = $deps; file = $file }
        
        $depList = $deps -split ','
        foreach ($d in $depList) {
            $d = $d.Trim()
            if ($d -ne '') {
                if (-not $dependents.ContainsKey($d)) {
                    $dependents[$d] = @()
                }
                $dependents[$d] += $modId
            }
        }
    }
}

Write-Host "Total modules: $($moduleMap.Count)"
Write-Host ""

# Trace chain from 1708 up to entry
Write-Host "=== Who imports module 1708 (VendorComplaintsScreen)? ==="
if ($dependents.ContainsKey('1708')) {
    foreach ($parent in $dependents['1708']) {
        Write-Host "  Module $parent -> $($moduleMap[$parent].file)"
    }
}
else {
    Write-Host "  Nobody directly imports 1708!"
}

Write-Host ""
Write-Host "=== Who imports module 1714 (VendorComplaintDetailScreen)? ==="
if ($dependents.ContainsKey('1714')) {
    foreach ($parent in $dependents['1714']) {
        Write-Host "  Module $parent -> $($moduleMap[$parent].file)"
    }
}

# Now trace up: find path from 1708 or 1714 to entry point (0, 3, or 212)
Write-Host ""
Write-Host "=== Tracing from 1708 back to entry point ==="
$queue = @('1708')
$visited = @{}
$path = @{}

while ($queue.Count -gt 0) {
    $current = $queue[0]
    $queue = $queue[1..($queue.Length - 1)]
    
    if ($visited.ContainsKey($current)) { continue }
    $visited[$current] = $true
    
    if ($current -eq '0' -or $current -eq '3' -or $current -eq '212') {
        Write-Host "REACHED ENTRY POINT: Module $current ($($moduleMap[$current].file))"
        # Trace back
        $trace = @($current)
        $c = $current
        while ($path.ContainsKey($c)) {
            $c = $path[$c]
            $trace += $c
        }
        Write-Host "Chain to 1708:"
        foreach ($t in $trace) {
            Write-Host "  -> Module $t ($($moduleMap[$t].file))"
        }
        break
    }
    
    if ($dependents.ContainsKey($current)) {
        foreach ($parent in $dependents[$current]) {
            if (-not $visited.ContainsKey($parent)) {
                $queue += $parent
                if (-not $path.ContainsKey($parent)) {
                    $path[$parent] = $current
                }
            }
        }
    }
}

# Also show module 0, 3, 212 info
Write-Host ""
Write-Host "=== Entry point modules ==="
Write-Host "Module 0: $($moduleMap['0'].file) -> deps: $($moduleMap['0'].deps)"
Write-Host "Module 3: $($moduleMap['3'].file) -> deps: $($moduleMap['3'].deps)"
Write-Host "Module 212: $($moduleMap['212'].file) -> deps: $($moduleMap['212'].deps)"
