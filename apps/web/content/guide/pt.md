<!-- section: overview -->
## Visão Geral e Estrutura

O UserHQ ajuda sua equipe a coletar e agir sobre o feedback dos seus clientes. Veja como seu espaço de trabalho está estruturado:

<cards>
- **1. Workspace (Espaço de trabalho)**: O centro de comando da sua equipe. Reúne membros da equipe, faturamento, chaves de API, webhooks e a caixa de entrada unificada de feedback de todos os seus produtos.
- **2. Products (Produtos)**: Os aplicativos ou serviços individuais que você desenvolve (ex.: Web App, App iOS, API). Cada produto possui seu próprio painel de feedback, roadmap, changelog, categorias e personalização de marca.
- **3. Customer Portals (Portais de clientes)**: O portal com sua marca que seus usuários acessam para enviar ideias, votar em sugestões de recursos, acompanhar o roadmap público e ler anúncios de lançamentos.
</cards>

<!-- section: roles-permissions -->
## Funções e Permissões de Equipe

Colabore de forma integrada com toda a equipe enquanto mantém o controle total sobre as configurações do espaço de trabalho:

<cards>
- **Workspace Owner (Proprietário)**: Controle total: gerenciar assinaturas, convidar administradores, criar chaves de API, configurar webhooks e transferir propriedade.
- **Workspace Admin (Administrador)**: Pode gerenciar produtos, fazer triagem de feedback, responder oficialmente a clientes, gerenciar cartões do roadmap e publicar notas de lançamento.
- **Workspace Member (Membro)**: Pode visualizar sugestões de feedback, participar de discussões internas da equipe e acompanhar solicitações de clientes.
</cards>

<!-- section: requests-inbox -->
## Solicitações de Feedback e Triagem

Localizada em `/dashboard/[ws]/requests`, a caixa de entrada unificada reúne todos os envios de clientes de cada produto em uma visualização de triagem de alto desempenho.

<cards>
- **Filtragem Multidimensional**: Filtre instantaneamente por produto, estágio de status (Backlog, Em andamento, Concluído), categoria, busca por palavra-chave e intervalos de datas.
- **Atualizações Rápidas de Status**: Mova itens entre as fases (Em análise, Planejado, Em desenvolvimento, Concluído) com um clique. Os clientes que votaram na solicitação são notificados automaticamente.
</cards>

<!-- section: comments-attention -->
## Comentários e Fila de Atenção Necessária

Localizada em `/dashboard/[ws]/comments`, esta caixa de entrada funciona como uma central de suporte ágil para todas as discussões de feedback.

### Etapas do Fluxo de Trabalho

<stages>
- **Needs Attention (Requer atenção)**: Qualquer comentário de cliente que ainda não tenha recebido uma resposta oficial da equipe. Destacado em âmbar para que nenhuma dúvida seja esquecida.
- **Handled (Resolvido)**: Removido automaticamente da fila de atenção assim que um membro da equipe responde com um selo oficial, ou marcado manualmente como resolvido.
</stages>

<!-- section: author-location -->
## Contato do Autor e Informações Geográficas

Para fornecer à sua equipe um contexto valioso sobre quem envia sugestões, os cartões de solicitações e comentários exibem detalhes do autor:

- **Contato Direto por E-mail**: Clique no botão de e-mail ao lado do nome do autor para entrar em contato diretamente para entrevistas ou perguntas de acompanhamento.
- **Contexto Geográfico**: Veja a localização aproximada do cliente (ex.: `London, United Kingdom [GB]`) para entender as tendências geográficas de uso.
- **Privacidade por Design**: Os endereços de e-mail e localizações são visíveis exclusivamente para os membros da equipe e nunca são exibidos nos portais públicos.

<!-- section: customer-portals -->
## Portais Públicos de Clientes

Cada produto no seu espaço de trabalho pode ter seu próprio portal público em `/[ws]/[product]`.

<cards>
- **Recursos Modulares**: Ative ou desative de forma independente o Painel de Feedback, Roadmap, Changelog ou FAQ por produto conforme sua necessidade.
- **Identidade Visual e Cores Personalizadas**: Personalize seu portal com seu logotipo, nome de marca e uma cor de destaque personalizada.
- **Suporte Multilíngue e RTL**: Suporte para 13 idiomas com detecção automática do visitante, seletores de idioma e redação de conteúdo traduzido.
- **Alteração do Idioma Padrão**: As traduções existentes são promovidas para os campos principais e o texto anterior é mantido como tradução.
- **Distintivos de Usuário**: Reconheça clientes com distintivos ao lado de seus nomes em postagens e comentários, atribuídos manualmente ou por regras de rastreamento.
</cards>

<!-- section: roadmap-changelog -->
## Planejamento de Roadmap e Notas de Lançamento

<cards>
- **Roadmap Interativo**: Organize o desenvolvimento em colunas visuais (ex.: Em avaliação, Planejado, Em andamento). Vincule sugestões diretamente aos cartões do roadmap.
- **Changelog e Anúncios**: Publique notas de versão categorizadas (Novo recurso, Melhoria, Correção de bug). Feche o ciclo automaticamente com os clientes solicitantes.
</cards>

<!-- section: faq-system -->
## Base de Conhecimento FAQ de Autoatendimento

Adicione perguntas frequentes organizadas em categorias no portal do seu produto. Respostas imediatas reduzem solicitações duplicadas e tickets comuns de suporte.

<!-- section: themes-push -->
## Temas e Notificações Web Push

O UserHQ oferece quatro temas: **Sistema**, **Claro**, **Escuro** (azul-marinho profundo) e **Carvão** (quase preto neutro). Membros da equipe podem ativar notificações Web Push em `/account`.

<!-- section: api-overview -->
## API de Automação e Autenticação

Conecte sistemas externos, pipelines de CI/CD, Slack, Discord, Linear, GitHub ou painéis internos através da API REST de Automação do UserHQ.

### Cabeçalho de Autenticação

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Limites de Requisição**: Limite generoso de 120 requisições por minuto por chave de API com controle de fluxo automático por token-bucket.
- **Permissões por Escopo**: As chaves podem ser restritas a produtos específicos e receber permissões selecionadas de leitura/escrita.
</cards>

<!-- section: swagger-explorer -->
## Explorador Interativo de API

Teste endpoints, examine parâmetros, visualize esquemas de solicitação e resposta e gere trechos de código instantâneos em cURL, TypeScript e Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks e Verificação de Assinatura HMAC

O UserHQ entrega eventos HTTP POST em tempo real quando solicitações são criadas, status mudam ou comentários chegam. Cada envio inclui uma assinatura segura HMAC-SHA256 no cabeçalho `x-userhq-signature`.

### Exemplo de Verificação HMAC em Node.js / Express

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
