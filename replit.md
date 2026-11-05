# Lance do Pix

Aplicação web de disputas por prêmios com usuários, lances, saldos e atividade persistidos no PostgreSQL. Apenas a confirmação de pagamento de recargas é simulada até a integração Pix; o acesso Google usa uma conta de teste enquanto o provedor não está integrado.

## Run & Operate

- Start the `artifacts/lance-admin: web` workflow to open the admin preview at `/admin/`.
- Start the `artifacts/lance-do-pix: web` workflow to run the client at `/`.
- Start the `artifacts/api-server: API Server` workflow to run the API at `/api`.
- The API requires `DATABASE_URL` and `SESSION_SECRET` in Replit Secrets.
- Admin access uses the raw operator key stored as `ADMIN_ACCESS_KEY`. The existing `ADMIN_ACCESS_KEY_HASH` variable is also accepted for compatibility; despite its name, its value is the raw key.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lance-do-pix/index.html` — interface web
- `artifacts/api-server/src` — autenticação, estado compartilhado e regras das disputas
- `lib/db/src/schema` — esquema PostgreSQL
- `lib/api-spec/openapi.yaml` — contrato da API

## Architecture decisions

- Usuários e atividade compartilhada são persistidos no PostgreSQL; a interface não inventa lances ou saldos.
- Recargas exibem uma confirmação explicitamente simulada até a integração Pix.

## Product

Usuários criam contas, consultam disputas compartilhadas, participam com lances debitados da carteira e podem solicitar resgate de prêmios. Recargas usam uma simulação claramente identificada até a integração Pix. Não usar saldos iniciais, lances, usuários ou disputas artificiais.

## User preferences

- Não usar dados ou atividade de demonstração. A única simulação permitida é o status do pagamento de recargas; Google pode usar uma conta de teste até haver integração.

## Gotchas

- Não executar `push-force` nem alterar o banco de produção sem confirmar o banco-alvo e revisar o impacto.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
