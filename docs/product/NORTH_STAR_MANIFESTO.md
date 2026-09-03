# GITHUB DECRYPTER — NORTH STAR MANIFESTO

> Status: DIRETRIZ OFICIAL E NORMATIVA DO PROJETO  
> Projeto: GitHub Decrypter  
> Incorporado ao repositório na Build 9 — Architecture Guardian  
> Fonte recebida: `GitHub_Decrypter_North_Star_Manifesto.txt`  
> SHA-256 da fonte: `256c9677407ef3cc5608d62908fb39fbe24e618b799192ab89f315033b90c718`

Este documento é a projeção normativa, versionada no repositório, do manifesto fornecido pelo proprietário do produto. A prosa completa da fonte continua sendo a origem editorial; os itens abaixo constituem a autoridade verificável que o Architecture Guardian deverá tratar como parte do contrato do produto.

## 1. North Star

O GitHub Decrypter não existe apenas para gerar código. Ele deve diminuir a distância entre **IDEIA** e **SOFTWARE** e, quando o usuário desejar, entre **USAR SOFTWARE** e **ENTENDER COMO SOFTWARE É CONSTRUÍDO**.

A experiência-alvo é a de uma equipe de engenharia trabalhando com o usuário, e não a de uma única IA genérica escrevendo código.

O produto deve adaptar a experiência à pessoa. A pessoa não deve precisar se adaptar ao GitHub Decrypter.

## 2. Missão

Tornar o desenvolvimento de software acessível a qualquer pessoa, desde alguém sem conhecimento de programação até desenvolvedores experientes, sem remover profundidade técnica dos usuários avançados.

Antes do código, vem a pessoa. O sistema deve considerar o nível técnico, objetivo, intenção de aprendizado, profundidade desejada e preferências de interação do usuário, além do contexto do projeto.

## 3. Desenvolvimento orientado à intenção

A cadeia conceitual oficial é:

`Ideia → Requisitos → Arquitetura → Plano → Código → Preview → Testes → Correções → Git → Deploy`

O usuário pode trabalhar por objetivos. Descobrir arquivos, componentes e passos técnicos pertence ao sistema.

## 4. Experiência adaptativa

O onboarding deve iniciar um perfil adaptativo do usuário em vez de apenas gravar configurações estáticas.

O produto deve conseguir ajustar o nível das explicações entre camadas simples, intermediárias e técnicas, acompanhar o crescimento do conhecimento do usuário e evitar explicações básicas repetitivas quando elas deixarem de ser úteis.

O Mentor e qualquer mecanismo educacional devem ser contextuais e opcionais. Aprender deve ser possível, nunca obrigatório.

## 5. Equipe de agentes

O GitHub Decrypter deve ser arquitetado como uma equipe coordenada de especialistas, mantendo uma experiência única para o usuário.

Cada agente poderá possuir nome próprio, função, especialidade, personalidade leve, responsabilidades e limites de autoridade. A identidade deve ser memorável sem transformar agentes em personagens caricatos.

Especialistas conceituais previstos incluem:

- Orchestrator;
- Software Architect;
- Builder / Programmer;
- Frontend Specialist;
- Backend Specialist;
- Reviewer;
- QA / Testing Agent;
- Mentor;
- Visual / Perception Specialist.

O usuário não deve precisar escolher manualmente qual agente chamar para cada necessidade.

## 6. Mentor e Explain This

O Mentor deve compreender projeto, plano, alterações, código, arquitetura, perfil técnico do usuário, histórico de conceitos aprendidos e, quando disponível, o elemento visual observado.

A ação contextual **Explique para mim / Explain This** deve poder ser aplicada, conforme as Builds responsáveis forem implementadas, a planos, código, Git, commits, diffs, erros, componentes, Preview, configurações e decisões arquiteturais.

## 7. Voz e Conversational Development

A visão do produto inclui interação por voz integrada ao mesmo contexto de texto, Mentor e equipe de agentes. Voz não constitui uma conversa separada nem uma segunda autoridade de estado.

## 8. Preview como contexto e Perception Engine

A Preview faz parte do contexto operacional do projeto.

O sistema deve evoluir para compreender, quando tecnicamente possível e autorizado:

- DOM;
- árvore de componentes;
- propriedades;
- estilos;
- elementos interativos;
- console;
- erros;
- network requests;
- eventos;
- estado;
- rotas;
- acessibilidade;
- comportamento após interação;
- visão computacional como fonte complementar.

O **Perception Engine** conecta quatro dimensões: código, visual, comportamento e resultado.

## 9. Teste como usuário

Código aparentemente correto não é critério suficiente. O produto deve evoluir para conseguir exercer fluxos da aplicação como usuário, observar efeitos, erros, console e requisições, e comparar o resultado com a intenção original.

## 10. Explore Mode e Visual Element Mapping

A Preview deverá evoluir para suportar exploração contextual: o usuário aponta, toca ou clica em um elemento e pode perguntar sobre ele ou solicitar uma alteração.

Quando tecnicamente possível, o sistema deve relacionar a seleção visual a componente, arquivo, região de código, estilo, propriedades, estado, eventos, dados e dependências.

Essa ligação Preview → elemento → componente → source code é a base do Visual Element Mapping e do Visual Build.

## 11. Context Engine

O Context Engine deve construir o melhor Context Pack possível, selecionando somente informações relevantes entre código, Git, documentação, regras, Skills, schemas, backend, MCP, Preview, console, erros, dependências, estado do projeto, decisões anteriores e perfil do usuário.

Não é objetivo despejar o repositório inteiro no modelo.

## 12. Scope Intelligence

A Scope Intelligence deve relacionar `Pedido → Plano → Execução → Diff → Resultado` e detectar scope creep, arquivos desnecessários, alterações não autorizadas, mudanças fora do plano e impactos inesperados.

A percepção visual poderá acrescentar `Resultado visual esperado → Resultado visual observado` quando essa capacidade existir.

## 13. Plan e Build

PLAN pensa e estrutura. BUILD executa.

A apresentação do plano deve adaptar a linguagem ao nível técnico do usuário sem alterar o significado técnico.

BUILD continua sujeito a Tool Runtime, Context Engine, Scope Intelligence, Git, Preview, testes, Perception Engine e agentes especializados, respeitando as capacidades e aprovações definidas pela arquitetura.

## 14. Local-first e limites reais

Local-first continua sendo princípio central sempre que tecnicamente razoável para reduzir dependência obrigatória de APIs pagas, aumentar privacidade e autonomia, permitir modelos open-source e aproveitar o hardware disponível.

Local-first **não** significa software gratuito, recursos infinitos ou processamento ilimitado. Limites reais incluem RAM, VRAM, CPU, GPU, armazenamento, contexto, velocidade de inferência e capacidade do modelo/dispositivo.

O produto não deve prometer "IA infinita", "tokens infinitos" ou uso absolutamente ilimitado.

A formulação comercial correta para modelos locais suportados é equivalente a: **sem cobrança por token do GitHub Decrypter para cada inferência local**, sujeito aos limites reais do hardware, modelo e ambiente.

## 15. Model routing

Modelos diferentes poderão ser utilizados para funções diferentes. O Orchestrator poderá selecionar modelo conforme tarefa, hardware, custo computacional, qualidade necessária e contexto disponível.

## 16. MCP, segurança e autoridade

MCP permanece atrás do MCP Trust Gateway.

O sistema deve diferenciar observar, analisar, planejar, sugerir, executar, escrever, excluir e publicar. Compreender uma ferramenta nunca concede automaticamente autoridade para usá-la de forma privilegiada.

Ações sensíveis permanecem sujeitas a Scope Lock, permissões, allowlists, aprovação, Trust Gateway e políticas do projeto.

## 17. Proatividade e controle humano

Princípio: **Inteligência proativa. Controle humano.**

Se o sistema percebe uma necessidade, pode oferecer ajuda, mas não deve alterar silenciosamente aquilo que está fora da autoridade concedida.

O usuário permanece autoridade final.

## 18. Progressive Disclosure

A UI deve mostrar primeiro aquilo que o usuário precisa e revelar recursos avançados quando necessários ou solicitados. Acessibilidade para iniciantes não pode limitar usuários avançados.

## 19. Modelo comercial oficial

O GitHub Decrypter é um produto comercial pago.

Modalidades previstas:

- plano mensal;
- plano semestral;
- plano anual;
- plano vitalício;
- teste gratuito de 24 horas.

O teste de 24 horas deve representar o produto real e permitir avaliar compatibilidade de hardware, runtime local, GitHub, Studio, agentes, Plan, Build e recursos disponíveis, podendo existir proteções contra abuso.

"Vitalício" deve possuir termos claros sobre atualizações, suporte, limites, recursos e grandes versões futuras.

O custo do produto e o custo de inferência de provedores externos são conceitos diferentes e devem ser comunicados com transparência.

## 20. Arquitetura conceitual em quatro camadas

### Camada 1 — Fundação
GitHub Integration, Git, Studio, PWA, Extension Bridge, runtime local, Preview, Tool Runtime, arquivos, terminal e diagnóstico.

### Camada 2 — Inteligência
Local Model Runtime, Context Engine, Scope Intelligence, MCP, MCP Trust Gateway, Rules, Skills, Memory e Orchestrator.

### Camada 3 — Equipe
Agentes especializados, Architect, Builder, Frontend, Backend, Reviewer, QA, Mentor e Visual/Perception Agent.

### Camada 4 — Experiência
Onboarding adaptativo, perfil do usuário, Plan/Build, explicações contextuais, Mentor, voz, Preview inteligente, Explore Mode, seleção visual, edição por linguagem natural e aprendizado contextual.

## 21. Blocos obrigatórios no roadmap

O roadmap V1 deverá incorporar explicitamente, sem renumerar Builds já congeladas quando houver uma Build existente que possa ser a autoridade natural:

1. Adaptive User Profile;
2. Agent Orchestrator;
3. Named Agent System;
4. Mentor Engine;
5. Explain This;
6. Voice Interaction;
7. Perception Engine;
8. Explore Mode;
9. Visual Element Mapping;
10. Interactive QA;
11. Adaptive Explanation Engine.

O mapeamento oficial para as Builds existentes é definido por `docs/product/NORTH_STAR_ROADMAP_MAPPING.md`.

## 22. Critério North Star para novas funcionalidades

Antes de incluir nova funcionalidade no roadmap, avaliar se ela:

1. aproxima o GitHub Decrypter da missão;
2. facilita transformar intenção em software;
3. melhora a capacidade da equipe de compreender o usuário;
4. melhora a compreensão do projeto;
5. aumenta autonomia sem retirar controle;
6. funciona para diferentes níveis técnicos;
7. ajuda a construir, compreender, testar ou aprender;
8. respeita o modelo local-first;
9. evita dependência desnecessária de terceiros;
10. possui justificativa clara dentro do produto comercial.

Sem relação clara com a North Star, a funcionalidade deve ser reconsiderada ou passar pelo processo de RFC aplicável.

## 23. Princípios oficiais P01–P22

- **P01** — Antes do código, vem a pessoa.
- **P02** — O usuário descreve objetivos; o sistema descobre a implementação.
- **P03** — Uma equipe de especialistas é melhor que uma IA genérica tentando fazer tudo.
- **P04** — Especialistas múltiplos devem produzir uma experiência única.
- **P05** — Construir e ensinar podem acontecer simultaneamente.
- **P06** — Aprender deve ser opcional, nunca obrigatório.
- **P07** — A Preview faz parte do contexto.
- **P08** — Ver não basta; o sistema deve conseguir testar.
- **P09** — O usuário deve poder aprender explorando o próprio software.
- **P10** — Explicações devem se adaptar ao conhecimento da pessoa.
- **P11** — A IA deve ser proativa, mas não invasiva.
- **P12** — O usuário mantém a autoridade final.
- **P13** — Local-first sempre que tecnicamente razoável.
- **P14** — Privacidade, autonomia e propriedade do código são pilares.
- **P15** — Complexidade técnica deve existir sem precisar ser imposta ao iniciante.
- **P16** — O produto deve crescer junto com o conhecimento do usuário.
- **P17** — Toda execução deve poder ser relacionada à intenção que a originou.
- **P18** — Código correto não é suficiente; o resultado precisa funcionar.
- **P19** — Local-first não significa gratuito.
- **P20** — O usuário paga pela plataforma, não por cada inferência local individual.
- **P21** — Não prometer recursos infinitos quando existem limites físicos de hardware.
- **P22** — Transparência comercial e transparência técnica devem caminhar juntas.

## 24. Definição normativa do produto

O GitHub Decrypter deverá evoluir para ser um ambiente de desenvolvimento adaptativo, local-first, comercial e orientado à intenção, no qual uma equipe coordenada de agentes especializados compreende o usuário e o projeto, observa e testa o software em execução, constrói dentro de escopo controlado e, quando desejado, ensina programação durante o próprio processo de desenvolvimento.

## 25. North Star final

> **Entenda a pessoa.**  
> **Entenda o projeto.**  
> **Construa com ela.**  
> **Teste o resultado.**  
> **Ensine quando ela quiser.**  
> **Nunca retire dela o controle.**  
> **Dê autonomia sem esconder os limites reais.**  
> **Cobre pelo valor da plataforma, não por cada pensamento local da IA.**

Essa é a direção do GitHub Decrypter.
