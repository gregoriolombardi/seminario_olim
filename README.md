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
   Ela cria as abas `Workshops`, `Inscricoes` e `Sympla`, os 5 workshops com seus limites
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

## Rodar o site

```bash
cp .env.example .env.local   # preencha APPS_SCRIPT_URL e APPS_SCRIPT_TOKEN
npm install
npm run dev
```

Sem `APPS_SCRIPT_URL`, o `npm run dev` usa vagas simuladas em memória. Em produção a URL é obrigatória.

## Pendências de conteúdo

- Descrição oficial do workshop ECA Digital (`lib/workshops.ts`).
- Logo: salve como `public/logo-olim.png` (até lá aparece o nome em texto).
- Contato no rodapé ("Dúvidas").
