if (Test-Path dist) { Remove-Item -Recurse -Force dist }

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm exec wrangler deploy
exit $LASTEXITCODE
