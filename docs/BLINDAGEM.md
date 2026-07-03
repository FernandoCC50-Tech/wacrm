### Estrutura minima de blindagem adicionada (Loop de Auditoria Cascudo)
Adicionado docs/, manifest.yml e scripts/preflight.sh. O stack.yml ja
usava variavel de ambiente para os segredos (META_APP_SECRET,
AUTOMATION_CRON_SECRET) e o .env ja estava corretamente fora do git --
nenhuma correcao de seguranca necessaria aqui, so organizacao.
