function OnGameStopped() {
    param($args)

    if ($null -eq $args.Game -or [uint64]$args.ElapsedSeconds -eq 0) {
        return
    }

    $eventId = "{0}-{1}-{2}" -f $args.Game.Id, [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(), $args.ElapsedSeconds
    $query = @(
        "game=$([Uri]::EscapeDataString($args.Game.Name))"
        "gameId=$([Uri]::EscapeDataString($args.Game.Id.ToString()))"
        "elapsedSeconds=$($args.ElapsedSeconds)"
        "eventId=$([Uri]::EscapeDataString($eventId))"
    ) -join "&"

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "playcrew://playtime?$query"
    $startInfo.UseShellExecute = $true
    [System.Diagnostics.Process]::Start($startInfo) | Out-Null
}
