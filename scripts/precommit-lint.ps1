$ErrorActionPreference = "Stop"

$stagedFiles = git diff --cached --name-only --diff-filter=ACMR
if (-not $stagedFiles) {
    Write-Host "pre-commit: no staged files"
    exit 0
}

$lintTargets = @()
foreach ($file in $stagedFiles) {
    if ($file -match '^client/src/.+\.(js|jsx|mjs|cjs|ts|tsx)$') {
        $lintTargets += ($file -replace '^client/', '')
    }
}

if ($lintTargets.Count -eq 0) {
    Write-Host "pre-commit: no staged client JS/TS files to lint"
    exit 0
}

Write-Host ("pre-commit: linting {0} staged file(s)" -f $lintTargets.Count)
npm --prefix client exec eslint -- @lintTargets
if ($LASTEXITCODE -ne 0) {
    Write-Host "pre-commit: lint failed; commit aborted"
    exit $LASTEXITCODE
}

Write-Host "pre-commit: lint passed"
exit 0
