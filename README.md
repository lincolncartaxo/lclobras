# LclObras

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Login próprio

O aplicativo oferece cadastro e login por e-mail e senha no MySQL, sem depender do OAuth da Manus. Configure `MANUS_JWT_SECRET` com um segredo aleatório longo; `OWNER_EMAIL` é opcional e torna o cadastro desse e-mail administrador. O login Manus continua disponível como fallback durante a transição.

Antes do primeiro deploy com autenticação própria, aplique as migrações com `pnpm db:migrate` usando a mesma `DATABASE_URL` da produção. Nunca reutilize uma senha como `MANUS_JWT_SECRET` e não coloque segredos no código-fonte.
