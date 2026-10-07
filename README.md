# Workshops — II Seminário Internacional de Educação Olim

Página de escolha de workshop. As vagas e inscrições ficam numa planilha Google,
servida por um Apps Script (`apps-script/Code.gs`).

```
navegador ──> /api/vagas, /api/inscricao (Next.js) ──> Apps Script ──> Planilha
```

- O conteúdo dos workshops (título, palestrante, descrição) fica em `lib/workshops.ts`.
- Os **limites de vagas** ficam na aba `Workshops` da planilha — mude lá, sem deploy.
- O token do Apps Script só existe no servidor do Next; o navegador nunca fala direto com o script.

## Configurar o Apps Script

1. Crie uma planilha Google → **Extensões › Apps Script**.
2. Cole o conteúdo de `apps-script/Code.gs` no editor e salve.
3. Selecione a função `setup` e clique em **Executar** (autorize o acesso).
   Ela cria as abas `Workshops`, `Inscricoes` e `Sympla` (email | nome | link), os 5 workshops com seus limites
   e um token. O token aparece no **Registro de execução**.
4. **Implantar › Nova implantação** → tipo **App da Web**
   - Executar como: **eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Copie a URL (termina em `/exec`).

Ao alterar o código do script depois, use **Gerenciar implantações › editar › Nova versão**
para manter a mesma URL.

### Validação pelo Sympla (opcional)

Cole os e-mails dos inscritos no Sympla na coluna A da aba `Sympla` (a partir da linha 2).
Com a aba preenchida, só esses e-mails conseguem se inscrever. Vazia, a validação fica desligada.

## Links de convite

`https://SEU-SITE/?email=fulano@escola.com&nome=Fulano%20de%20Tal` abre a página com nome e
e-mail preenchidos. O **e-mail do link fica travado** (a pessoa não consegue digitar errado);
o nome continua editável. E-mail inválido no link é ignorado e o campo fica livre.
Ao abrir o link, o site consulta a planilha: se o e-mail já tem inscrição, mostra em qual
workshop no lugar do formulário.

Para gerar os links de todo mundo:

1. Na aba `Sympla`, cole os e-mails na coluna A e os nomes na coluna B (a partir da linha 2).
2. Recarregue a planilha → menu **Seminário › Gerar links de convite**.
3. Na primeira vez ele pede a URL do site (fica salva em Propriedades do script › `SITE_URL`;
   apague a propriedade para trocar). A coluna C recebe os links, já codificados para WhatsApp/e-mail.

## Rodar o site

```bash
cp .env.example .env.local   # preencha APPS_SCRIPT_URL e APPS_SCRIPT_TOKEN
npm install
npm run dev
```

Sem `APPS_SCRIPT_URL`, o `npm run dev` usa vagas simuladas em memória. Em produção a URL é obrigatória.

## Pendências de conteúdo

- Descrição oficial do workshop ECA Digital (`lib/workshops.ts`).
- Contato no rodapé ("Dúvidas").
