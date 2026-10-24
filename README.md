# Roda CRM

CRM para equipes que vendem pelo WhatsApp: os leads chegam do Facebook, de portais e do site, são distribuídos automaticamente entre os vendedores e acompanhados até a proposta, o contrato e a venda.

## O que tem

- **Captura de leads:** cada origem (Facebook, portal, site) ganha um endereço próprio que recebe leads em JSON ou formulário. Funciona com Zapier, Make, formulários de site e portais. Lead repetido entra no mesmo negócio, sem duplicar.
- **Fila de leads (roleta):** cada lead vai para o próximo vendedor, respeitando o peso de cada um e as origens que ele atende. O vendedor recebe um aviso no WhatsApp e pode ter um prazo para aceitar; se não aceitar, o lead passa para o próximo.
- **Equipes e permissões:** administrador vê tudo, gestor vê a equipe dele e os leads sem responsável, vendedor vê só o que é dele.
- **Funis:** vários funis em Kanban, com modelos prontos por ramo (imóveis, veículos, serviços, consultoria).
- **Negócios e contatos:** valor, produtos, responsável, ganho/perdido, tarefas, anotações e linha do tempo.
- **Propostas e contratos:** modelos com campos que se preenchem sozinhos, página para imprimir ou salvar em PDF, envio pelo WhatsApp e link onde o cliente aceita com o nome dele.
- **Visitas:** agendar visitas no negócio, agenda dos próximos 14 dias e botão para salvar no Google Agenda.
- **Relatórios:** marketing (leads, vendas e conversão por origem e campanha) e equipe (ofertas aceitas, tempo até o primeiro contato, conversão e receita por vendedor).
- **Conversas:** inbox de WhatsApp pela Cloud API oficial da Meta.
- **Várias empresas:** a mesma pessoa pode trabalhar em várias empresas e trocar pelo menu.
- **Celular:** tela responsiva e instalável na tela inicial do celular.

## Rodando localmente

Requisitos: Node 22 e Postgres 16.

```bash
cp .env.example .env          # ajuste DATABASE_URL
npm install
npx prisma migrate dev        # cria as tabelas
npm run db:seed               # opcional: dados de exemplo
npm run dev                   # http://localhost:3000
```

Logins de exemplo (senha `demo1234`): `demo@roda.dev` (administrador), `carla@roda.dev` (gestora), `bruno@roda.dev` e `diego@roda.dev` (vendedores). O Bruno começa com um lead esperando para ser aceito.

Testes e checagens: `npm test`, `npm run lint`, `npm run build`.

## Publicando para teste (Vercel + Neon, grátis)

1. Em vercel.com, entre com o GitHub e importe o repositório `Stasoru/100BUG-COPY`.
2. Opcional: adicione a variável `SEED_DEMO` com o valor `1` para criar os dados de exemplo.
3. Clique em **Deploy**. O primeiro deploy pode falhar por falta de banco; é normal.
4. No projeto da Vercel, abra **Storage → Create Database → Neon** e conecte ao projeto. Isso cria o `DATABASE_URL` sozinho.
5. Em **Deployments**, clique em **Redeploy**. O build cria as tabelas e, com `SEED_DEMO=1`, os logins de exemplo.

Não é preciso configurar mais nada. Sem `SESSION_SECRET`, a chave das sessões é derivada do `DATABASE_URL`; em produção de verdade, defina um `SESSION_SECRET` (texto aleatório com 32+ caracteres), remova `SEED_DEMO` e apague os usuários de exemplo.

## Recebendo leads

1. Em **Fila de leads → Origens de leads**, crie uma origem (ex.: "Facebook") e escolha o funil.
2. Copie o endereço que aparece e configure no Zapier, no Make, no formulário do site ou no portal para enviar cada lead por POST.
3. Campos aceitos: `nome`, `telefone`, `email`, `campanha` e `mensagem`. Também entende os nomes em inglês e os campos dos formulários do Facebook (`full_name`, `phone_number`, `field_data`, `ad_name`, `utm_campaign`).
4. Em **Vendedores na roleta**, coloque os vendedores, o peso de cada um e, se quiser, as origens que cada um atende.
5. Em **Tempo para aceitar**, escolha quantos minutos o vendedor tem para aceitar (0 entrega direto).

Para testar sem integração, use **Cadastrar lead à mão** na mesma página, ou:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"nome":"Maria","telefone":"11999990000","campanha":"Teste"}' \
  https://SEU-APP.vercel.app/api/webhooks/leads/ENDERECO-DA-ORIGEM
```

O prazo de aceite é verificado sempre que alguém usa o sistema e, como garantia, uma vez por dia pela Vercel Cron. Opcional: defina `CRON_SECRET` na Vercel para proteger essa rotina.

## Conectando o WhatsApp

1. Crie um app em developers.facebook.com com o produto WhatsApp e gere um token permanente (usuário de sistema).
2. Em **Configurações → Canais de WhatsApp**, informe o Phone number ID e o token.
3. No painel da Meta, configure o webhook com a URL e o token de verificação mostrados na tela e assine o campo `messages`.
4. Cada vendedor informa o próprio WhatsApp em **Configurações → Meu perfil** para receber os avisos de lead.
5. Opcional e recomendado em produção: defina `WHATSAPP_APP_SECRET` para validar a assinatura das chamadas.

A Meta só aceita texto livre dentro de 24 horas desde a última mensagem da pessoa. Para os avisos de lead chegarem sempre, peça para cada vendedor mandar uma mensagem para o número da empresa uma vez por dia, ou use um template aprovado (ainda não suportado). Quando o aviso falha, o motivo aparece no histórico do negócio.

## Stack

Next.js 15 (App Router, server actions), TypeScript, Prisma + Postgres, Tailwind CSS 4, dnd-kit, Vitest.

## Próximos passos

Conexão direta com a API de leads do Facebook, sincronização com o Google Agenda, templates de WhatsApp para avisos, integração com sistemas financeiros e assinatura eletrônica com validade jurídica.
