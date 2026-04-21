param(
  [Parameter(Mandatory = $true)][string]$ShortcutPath,
  [Parameter(Mandatory = $true)][string]$TargetPath,
  [Parameter(Mandatory = $false)][string]$Arguments = "",
  [Parameter(Mandatory = $false)][string]$WorkingDirectory = ""
)
$ErrorActionPreference = "Stop"
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut($ShortcutPath)
$s.TargetPath = $TargetPath
$s.Arguments = $Arguments
$s.WorkingDirectory = $WorkingDirectory
$s.Save()
