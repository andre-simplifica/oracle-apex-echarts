# Onboarding da equipe — Oracle APEX ECharts

O padrão da equipe é a skill versionada em
`.agents/skills/oracle-apex-echarts/`, recebida pelo Git do projeto consumidor.
Não use submodule nem instalação global como padrão.

1. Faça checkout da branch correta e `git pull`.
2. Confirme `.agents/skills/oracle-apex-echarts/SKILL.md` e
   `.oracle-apex-echarts/profile.yaml`.
3. Inicie uma nova tarefa no Codex Desktop, CLI, IDE ou Cloud.
4. Invoque `$oracle-apex-echarts` e descreva a demanda.
5. Se a skill não aparecer, confirme workspace e branch, abra explicitamente o
   `SKILL.md`, inicie outra tarefa e só então reinicie o Codex.

Claude e agentes genéricos devem ler `SKILL.md` explicitamente e seguir as
referências indicadas. A instalação global em
`${CODEX_HOME:-$HOME/.codex}/skills` é alternativa pessoal e pode divergir do
commit aprovado pela equipe.

Antes de atualizar, execute `status`, `check` e `update --dry-run`; revise o
diff, atualize numa branch e abra PR. Depois do merge, os demais recebem a skill
por `git pull` e iniciam nova tarefa.
