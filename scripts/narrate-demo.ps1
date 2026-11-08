$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$workspacePath = Split-Path -Parent $PSScriptRoot
$demoPath = Join-Path $workspacePath '.local/demo'
$scenes = Get-Content -LiteralPath (Join-Path $demoPath 'scenes.json') -Raw | ConvertFrom-Json
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft David Desktop')
$voice.Rate = 0
try {
  for ($index = 0; $index -lt $scenes.Count; $index++) {
    $targetPath = Join-Path $demoPath ('voice-' + ($index + 1).ToString('00') + '.wav')
    $voice.SetOutputToWaveFile($targetPath)
    $voice.Speak($scenes[$index].narration)
    $voice.SetOutputToNull()
    Write-Output ('Narration rendered: ' + $scenes[$index].title)
  }
} finally { $voice.Dispose() }
