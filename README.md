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
para manter a mesma URL — ou use o clasp (abaixo).

### Atualizar o script pelo terminal (clasp)

O projeto já está ligado ao script da Olim (`.clasp.json`), no perfil `olim` do clasp.

```bash
npx clasp login --user olim   # uma vez, com a conta Google dona da planilha
npm run gas:push              # só envia o código (editor/menu da planilha)
npm run gas:deploy            # envia e publica nova versão na MESMA URL /exec
npm run gas:open              # abre a planilha
```

### Validação pelo Sympla (opcional)

Cole os e-mails dos inscritos no Sympla na coluna A da aba `Sympla` (a partir da linha 2).
Com a aba preenchida, só esses e-mails conseguem se inscrever. Vazia, a validação fica desligada.

## Links de convite

`https://seminario.bluebrick.com.br/?c=CODIGO` — `CODIGO` é o código do ingresso no Sympla
(ex.: `?c=AAAQ-C0-XWY8`). O link não leva dados pessoais: nome e e-mail vêm da aba
`Lista de participantes`. Se a pessoa já escolheu, a página mostra em qual workshop.
Código que não está na lista (ou ingresso não aprovado) mostra aviso de link inválido.

Para gerar os links de todo mundo:

1. Recarregue a planilha → menu **Seminário › Gerar links de convite**.
2. Na primeira vez ele pede a URL do site (fica salva em Propriedades do script › `SITE_URL`;
   apague a propriedade para trocar). A coluna `LINK_CONVITE` recebe os links dos ingressos aprovados.

O site guarda a planilha em memória e a renova a cada 30s, então abrir o link não espera o
Apps Script. Só espera quando o servidor acabou de subir ou quando o código ainda não estava
na memória (ingresso aprovado nos últimos segundos).

## Check-in (organização)

`https://seminario.bluebrick.com.br/check-in?c=CODIGO` mostra nome, e-mail e workshop do
participante e o botão **OK — confirmar entrada**, que grava data e hora na coluna `CHECKIN`.
Cada ingresso só faz check-in uma vez; o segundo OK mostra "entrada já registrada" com o horário.
Sem `?c=`, a página pede o código para digitar.

O **código de OK** fica na aba `Config` (criada pelo `setup()`):

| chave                   | valor                                   |
| ----------------------- | --------------------------------------- |
| `checkin_exigir_codigo` | caixa marcada = exige o código de OK    |
| `checkin_codigo`        | o código (o `setup()` sorteia 6 dígitos) |

Quem confere é o Apps Script, então o código nunca chega ao navegador. Cada aparelho lembra
o último código que funcionou. Desmarcar a caixa libera o OK sem código. Sem a aba `Config`,
o código fica exigido e nenhum OK passa.

A página também mostra horário e sala do workshop (campos `horario` e `sala` em
`lib/workshops.ts`; vazios aparecem como "A definir") e a presença: quantos do workshop e do
seminário já entraram e quantos faltam.

## Rodar o site

```bash
cp .env.example .env.local   # preencha APPS_SCRIPT_URL e APPS_SCRIPT_TOKEN
npm install
npm run dev
```

Sem `APPS_SCRIPT_URL`, o `npm run dev` usa vagas simuladas em memória. Em produção a URL é obrigatória.

## Publicar na Vercel

1. Importe o repositório na Vercel (o preset Next.js é detectado sozinho).
2. Em **Settings › Environment Variables**, cadastre `APPS_SCRIPT_URL` e `APPS_SCRIPT_TOKEN`
   (Production e Preview) e faça o redeploy.
3. Em **Settings › Domains**, adicione `seminario.escolaolim.com.br` e aponte o DNS como a Vercel indicar.

Na planilha, `SITE_URL` deve ser `https://seminario.escolaolim.com.br`.

## Pendências de conteúdo

- Descrição oficial do workshop ECA Digital (`lib/workshops.ts`).
- Contato no rodapé ("Dúvidas").
