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

O aplicativo oferece solicitação de cadastro e login por e-mail e senha no MySQL, além do acesso Manus para contas existentes. Toda solicitação local começa como pendente, não recebe sessão e não acessa dados até um administrador aprová-la em **Usuários e permissões**. Cadastros locais sempre começam como `user`; nenhum e-mail informado no formulário concede papel `admin`. O status pode ser aprovado ou rejeitado por um administrador, e uma conta revogada perde acesso mesmo com uma sessão antiga.

Configure `MANUS_JWT_SECRET` com um segredo aleatório longo para assinar sessões. A conta proprietária do projeto mantém o papel admin por sua identidade Manus autenticada (`OWNER_OPEN_ID`), não por e-mail autodeclarado. Não configure `OWNER_EMAIL` para conceder privilégios.

Antes do deploy com cadastro local, aplique as migrações `0006_local_email_auth` e `0007_local_account_approval` com `pnpm db:migrate`, usando a `DATABASE_URL` configurada para o ambiente. As contas existentes recebem status `approved`; novas solicitações são `pending`. Nunca reutilize uma senha como `MANUS_JWT_SECRET` e não coloque segredos no código-fonte.
