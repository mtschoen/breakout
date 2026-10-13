param(
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$completedSteps = @()
$missingPrerequisites = @()

if (Get-Command npm -ErrorAction SilentlyContinue) {
  $completedSteps += "npm found ($(npm --version))"
} else {
  $missingPrerequisites += "npm (install Node.js 22+)"
}

if (Get-Command aislop -ErrorAction SilentlyContinue) {
  $completedSteps += "aislop found ($(aislop --version))"
} else {
  $missingPrerequisites += "aislop (install via: pnpm add -g aislop)"
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
  npm install
  $completedSteps += "npm install"
}

if (Get-Command aislop -ErrorAction SilentlyContinue) {
  aislop hook install claude --project | Out-Null
  $completedSteps += "aislop hook install claude --project"
}

git ls-files --error-unmatch .claude/settings.json 2>$null | Out-Null
$isTracked = ($LASTEXITCODE -eq 0)
git diff --quiet -- .claude/settings.json 2>$null
$unstagedClean = ($LASTEXITCODE -eq 0)
git diff --cached --quiet -- .claude/settings.json 2>$null
$stagedClean = ($LASTEXITCODE -eq 0)
$porcelain = git status --porcelain -- .claude/settings.json 2>$null
if ($isTracked -and $unstagedClean -and $stagedClean -and $porcelain) {
  git checkout -- .claude/settings.json
  $completedSteps += "normalized .claude/settings.json line endings"
}

if (Get-Command claude-provision -ErrorAction SilentlyContinue) {
  claude-provision apply-project 2>$null
  $completedSteps += "claude-provision apply-project"
}

if ($Build -and (Get-Command npm -ErrorAction SilentlyContinue)) {
  npm run build
  $completedSteps += "npm run build"
}

Write-Host "Completed: $($completedSteps -join ', ')"
if ($missingPrerequisites.Count -gt 0) {
  Write-Host "Missing prerequisites: $($missingPrerequisites -join ', ')"
}
