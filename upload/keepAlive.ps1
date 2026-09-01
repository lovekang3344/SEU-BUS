param (
    [int]$IntervalSeconds = 1800
)

$Host.UI.RawUI.WindowTitle = "aTrust KeepAlive Tool (Key Simulation Only)"

try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
} catch {
    Write-Warning "Failed to load System.Windows.Forms. Key simulation might not work."
}

Write-Host "=== aTrust KeepAlive Service Started ===" -ForegroundColor Green
Write-Host "Strategy: Simulate ScrollLock key press every $IntervalSeconds seconds"
Write-Host "Hint: Minimize this window, do not close it." -ForegroundColor Yellow
Write-Host "----------------------------------------------------"

function Send-KeepAlive {
    $Time = Get-Date -Format "HH:mm:ss"

    try {
        [System.Windows.Forms.SendKeys]::SendWait("{SCROLLLOCK}")
        Write-Host "[$Time] [Success] Simulated Key Press (ScrollLock)" -ForegroundColor Green
    }
    catch {
        Write-Host "[$Time] [Failed] Key Simulation: $_" -ForegroundColor Red
    }
}

while ($true) {
    Send-KeepAlive
    
    # Countdown
    for ($i = $IntervalSeconds; $i -gt 0; $i--) {
        if ($i % 60 -eq 0 -or $i -lt 10) {
            Write-Host -NoNewline "`rNext KeepAlive in: $i seconds...   "
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "`r"
}