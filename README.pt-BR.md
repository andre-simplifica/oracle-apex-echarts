# Oracle APEX ECharts

Solução pública, reutilizável e autossuficiente para usar Apache ECharts no
Oracle APEX por região plugin, `PK_APEX_ECHARTS`, Dynamic Content ou modo misto.
A distribuição inclui runtime offline, ChartSpec 1.0, profile por projeto,
skill para agentes, atualizador protegido e manutenção do upstream.

Depois da instalação, o runtime não depende de CDN, npm, GitHub, internet,
servidor frontend, iframe, Python ou Node.js. O bundle Apache ECharts 6.1.0 fica
incorporado ao `plugin.sql`.

> Oracle e Oracle APEX são marcas comerciais ou registradas da Oracle
> Corporation e/ou de suas afiliadas. Apache, Apache ECharts e ECharts são
> marcas da Apache Software Foundation. Este projeto independente não é
> afiliado nem endossado pela Oracle Corporation ou pela Apache Software
> Foundation.

## Versões da release 1.0.0

- plugin, package e runtime: `1.0.0`;
- Apache ECharts: `6.1.0`;
- ChartSpec e profile: `1.0`;
- alvo de validação em repositório: Oracle APEX 24.2 e Oracle Database 26ai.

A primeira release pública não foi importada numa aplicação APEX viva. Consulte
[a evidência e as lacunas de runtime](docs/validation.md) antes de produção.

## Instalar a skill vinculada ao projeto

Extraia o ZIP da skill e faça primeiro o dry-run:

```bash
python3 oracle-apex-echarts/scripts/scaffold_consumer.py \
  --project /caminho/do/projeto \
  --commit <sha-do-commit-da-release> \
  --ref v1.0.0
```

Revise os caminhos e repita com `--apply`. O padrão de equipe fica em
`.agents/skills/oracle-apex-echarts/`. Abra uma nova tarefa do Codex e invoque
`$oracle-apex-echarts`. Veja o [onboarding](docs/pt-BR/onboarding-equipe.md).

## Configurar o profile

Edite `.oracle-apex-echarts/profile.yaml`. O provider `auto` usa o profile do
Oracle APEX Brand Report Kit quando disponível e, caso contrário, informa a
decisão e usa o perfil neutro. O provider explícito interrompe se o arquivo
estiver ausente ou inválido. O profile nunca habilita JavaScript executável,
HTML livre, URL livre, callbacks, `renderItem`, `eval` ou formatter arbitrário.

## Instalar plugin e package

Confirme conexão DEV, workspace, aplicação e parsing schema. Verifique os
checksums e execute:

```text
sql -S -L -name <conexao-dev-salva> @audit-installation.sql <application_id>
sql -S -L -name <conexao-dev-salva> @install.sql <application_id>
sql -S -L -name <conexao-dev-salva> @validate-installation.sql <application_id>
```

A auditoria inicial é estritamente read-only e informa estado ausente,
compatível ou parcial/incompatível. O instalador compila apenas
`PK_APEX_ECHARTS`, importa apenas o plugin e valida
objetos, versão e arquivos. Não cria página, região, tabela, job ou dado. Para o
fluxo manual, compile a package no parsing schema e use **Shared Components >
Plug-ins > Import** para `plugin.sql`.

## Atualizar a cópia gerenciada

```bash
python3 Util/scripts/manage_oracle_apex_echarts.py status
python3 Util/scripts/manage_oracle_apex_echarts.py check
python3 Util/scripts/manage_oracle_apex_echarts.py update --dry-run
python3 Util/scripts/manage_oracle_apex_echarts.py update
```

O atualizador substitui somente a skill gerenciada, bloqueia symlink e drift
local, usa troca atômica com rollback e preserva profile, regras, packages de
domínio, queries, autorizações e exports APEX.

## Verificar e preparar upstream

```bash
npm run upstream:check
npm run upstream:update -- --version 6.2.0 --dry-run
npm run upstream:update -- --version 6.2.0 --apply
```

O atualizador verifica SRI npm, SHA-512 e nomes do source archive, assinatura
OpenPGP quando publicada, `KEYS`, licenças, `SOURCE.json`, SHA-256, versões,
`FILES_VERSION`, build e testes. Ele nunca faz commit, push, release ou import
APEX automaticamente. Uma nova major exige branch e PR próprios.

Para arquitetura, segurança, exemplos e contribuição, consulte o
[README principal](README.md).
