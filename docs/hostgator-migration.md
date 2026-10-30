# Migração do LclObras para MySQL HostGator

## Estado atual

A aplicação em execução continua usando o banco MySQL gerenciado pelo Manus (`DATABASE_URL`). O destino HostGator ainda não foi conectado nem alterado. `drizzle.hostgator.config.ts` exige `APP_DATABASE_URL` e valida que host, porta e banco do destino diferem de `DATABASE_URL` antes de executar DDL; `scripts/copy-mysql-database.ts` repete a validação como etapa manual separada. Nenhum runtime troca de banco automaticamente.

O arquivo de configuração e o script não contêm credenciais. O DSN deve ser inserido exclusivamente pelo formulário protegido do projeto, nunca em chat, código, Git ou comandos enviados ao terminal.

## Acesso remoto

1. No cPanel, crie o banco HostGator vazio e um usuário MySQL limitado a esse banco. Sempre que possível, use uma credencial de Workbench separada da credencial de runtime.
2. Em **Remote MySQL**, autorize somente o endereço de saída do backend Manus confirmado pelo suporte e a porta MySQL (normalmente 3306). Não use `%`, `0.0.0.0/0`, nem o IP do computador sandbox como substituto do IP do runtime publicado.
3. A confirmação de IP de saída fixo é uma questão de suporte técnico Manus; solicite-a em [help.manus.im](https://help.manus.im). Se não houver IP fixo que a HostGator possa allowlistar, pare antes de enviar o DSN e avalie outra topologia de rede/servidor.
4. O Workbench no computador do usuário precisa de autorização separada para o IP de origem daquele computador. Essa liberação não substitui a regra de acesso do backend Manus.

## Aplicar schema e copiar dados

1. Depois de confirmar a liberação de rede, salve `APP_DATABASE_URL` pelo formulário protegido no escopo **Development** para preparar/testar a migração. Não substitua nem remova `DATABASE_URL`; ele permanece como origem até o cutover autorizado.
2. Confirme que o banco HostGator está vazio e aplique o schema versionado. A configuração exige `DATABASE_URL` para comparar a origem com o destino e recusa executar DDL se host, porta e banco forem iguais:

   ```bash
   pnpm db:migrate:hostgator
   ```

   Esse comando requer `APP_DATABASE_URL` e não tem fallback para `DATABASE_URL`.
3. Agende uma janela curta de manutenção. Pare todas as gravações no app de origem e mantenha-as pausadas até o cutover. Desconecte Workbench e qualquer outro cliente que possa gravar no destino; o destino deve permanecer exclusivo durante a cópia. A transação de snapshot não inclui novas gravações feitas na origem depois do início.
4. Durante essa janela, execute a cópia somente com as três confirmações explícitas:

   ```bash
   pnpm db:copy:hostgator -- --confirm-empty-target --confirm-source-write-freeze --confirm-exclusive-target
   ```

   O script recusa a mesma origem/destino, tabelas de destino não vazias, schemas divergentes, tabelas que não sejam InnoDB nas duas pontas ou tabelas sem chave primária. Não apaga, trunca nem grava na origem. A cópia preserva IDs e contadores `AUTO_INCREMENT`, fixa `time_zone` da sessão em UTC e valida contagens, hash dos valores por tabela e todas as referências de chave estrangeira antes de confirmar a transação do destino.
5. Se qualquer verificação falhar, não faça cutover nem tente limpar/repetir por conta própria. A transação de dados do destino é revertida; verifique o estado do destino antes de qualquer nova tentativa. O script não tenta sincronização incremental e recusa um destino já preenchido.

## Cutover e arquivos

Depois que as contagens, hashes e referências forem validados, a migração ainda requer autorização explícita do usuário para trocar o runtime. Só então o código passará a usar `APP_DATABASE_URL`, será configurado o valor no escopo **Production**, e a versão será salva/publicada. Não retome gravações de produção até confirmar a nova conexão. O banco Manus fica preservado como contingência, mas novas gravações feitas no HostGator após o cutover não são replicadas automaticamente de volta ao Manus; rollback posterior exige reconciliação dessas gravações.

A cópia MySQL inclui metadados e referências de anexos, não os binários. Os arquivos permanecem no Manus Storage e seus links continuam dependentes desse serviço; transferir binários para outro storage é um trabalho separado.
