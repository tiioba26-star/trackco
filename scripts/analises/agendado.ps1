# Rotina das análises da IA (Gestão), chamada pelo Agendador de Tarefas do Windows às 5h e às 13h.
# Roda na pasta própria da rotina (um clone do repositório), nunca na pasta de trabalho.
# Atualiza o código, instala dependências só se o package-lock mudou, roda as análises e guarda o log.
$ErrorActionPreference = "Continue"
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $raiz
$logs = Join-Path $raiz "analises\logs"
New-Item -ItemType Directory -Force $logs | Out-Null
$log = Join-Path $logs ("{0:yyyy-MM-dd_HHmm}.log" -f (Get-Date))

function Escrever($texto) {
  $linha = "{0:HH:mm:ss} {1}" -f (Get-Date), $texto
  Add-Content -Path $log -Value $linha -Encoding UTF8
}

Escrever "Início em $raiz"
$antes = (Get-FileHash package-lock.json).Hash
cmd /c "git pull --ff-only origin main >> ""$log"" 2>&1"
if ($LASTEXITCODE -ne 0) { Escrever "git pull falhou; segue com o código que já está aqui" }
$depois = (Get-FileHash package-lock.json).Hash
if ($antes -ne $depois -or -not (Test-Path "node_modules")) {
  Escrever "Dependências mudaram: npm ci"
  cmd /c "npm ci --no-audit --no-fund >> ""$log"" 2>&1"
  if ($LASTEXITCODE -ne 0) { Escrever "npm ci falhou"; exit 1 }
}
cmd /c "npm run analises:rodar >> ""$log"" 2>&1"
$codigo = $LASTEXITCODE
Escrever "Fim (código $codigo)"

# guarda só os 30 logs mais recentes
Get-ChildItem $logs -Filter *.log | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force
exit $codigo
