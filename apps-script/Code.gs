/**
 * Backend de vagas dos workshops — II Seminário Internacional de Educação Olim.
 *
 * A planilha é a fonte da verdade:
 *   - Workshops:  id | titulo | limite
 *   - Inscricoes: data_hora | workshop_id | workshop | nome | email
 *   - Sympla:     email | nome | link   (opcional — se tiver e-mails, só eles podem se inscrever;
 *                 o link de convite é gerado pelo menu Seminário › Gerar links de convite)
 *
 * Endpoints (implantar como App da Web, "Executar como: eu", "Acesso: qualquer pessoa"):
 *   GET  .../exec              -> { ok, vagas: [{ id, limite, inscritos, restantes, lotado }] }
 *   GET  .../exec?email=&token= -> { ok, inscricao: { workshopId } | null }
 *   POST .../exec  (JSON)      -> { token, workshopId, nome, email }
 *                                 { ok: true, vagas } | { ok: false, codigo, mensagem, vagas? }
 *
 * O POST exige o token salvo nas Propriedades do script (TOKEN). Rode setup() uma vez.
 */

var ABA_WORKSHOPS = 'Workshops';
var ABA_INSCRICOES = 'Inscricoes';
var ABA_SYMPLA = 'Sympla';

var WORKSHOPS_INICIAIS = [
  ['eca-digital', 'ECA Digital e demais legislações afins', 130],
  ['projetos-educacao-infantil', 'Projetos na educação infantil', 80],
  ['quando-o-corpo-aprende', 'Quando o corpo aprende', 80],
  ['quintalizar-os-espacos', 'Quintalizar os espaços para humanizar as infâncias', 80],
  ['linguagem-da-comida', 'A linguagem da comida', 40],
];

/** Cria as abas, cabeçalhos, workshops iniciais e o token. Rode uma vez pelo editor. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var workshops = ss.getSheetByName(ABA_WORKSHOPS) || ss.insertSheet(ABA_WORKSHOPS);
  if (workshops.getLastRow() === 0) {
    workshops.appendRow(['id', 'titulo', 'limite']);
    WORKSHOPS_INICIAIS.forEach(function (linha) { workshops.appendRow(linha); });
    workshops.setFrozenRows(1);
  }

  var inscricoes = ss.getSheetByName(ABA_INSCRICOES) || ss.insertSheet(ABA_INSCRICOES);
  if (inscricoes.getLastRow() === 0) {
    inscricoes.appendRow(['data_hora', 'workshop_id', 'workshop', 'nome', 'email']);
    inscricoes.setFrozenRows(1);
  }

  var sympla = ss.getSheetByName(ABA_SYMPLA) || ss.insertSheet(ABA_SYMPLA);
  if (sympla.getLastRow() === 0) {
    sympla.appendRow(['email', 'nome', 'link']);
    sympla.setFrozenRows(1);
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) {
    props.setProperty('TOKEN', Utilities.getUuid());
  }
  Logger.log('TOKEN (coloque em APPS_SCRIPT_TOKEN no .env do site): ' + props.getProperty('TOKEN'));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Seminário')
    .addItem('Gerar links de convite', 'gerarLinks')
    .addToUi();
}

/**
 * Preenche a coluna "link" da aba Sympla com o link de convite de cada pessoa
 * (e-mail travado e nome preenchido no formulário). Pede a URL do site na 1ª vez.
 */
function gerarLinks() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var site = props.getProperty('SITE_URL');

  if (!site) {
    var resposta = ui.prompt('URL do site', 'Ex.: https://workshops.olim.com.br', ui.ButtonSet.OK_CANCEL);
    if (resposta.getSelectedButton() !== ui.Button.OK) return;
    site = resposta.getResponseText().trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(site)) {
      ui.alert('A URL precisa começar com https://');
      return;
    }
    props.setProperty('SITE_URL', site);
  }

  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_SYMPLA);
  var dados = linhas(ABA_SYMPLA);
  if (dados.length === 0) {
    ui.alert('Cole os e-mails (coluna A) e nomes (coluna B) na aba Sympla primeiro.');
    return;
  }

  var links = dados.map(function (l) {
    var email = String(l[0]).trim().toLowerCase();
    var nome = String(l[1] || '').trim();
    if (!email) return [''];
    return [site + '/?email=' + encodeURIComponent(email) + (nome ? '&nome=' + encodeURIComponent(nome) : '')];
  });
  aba.getRange(2, 3, links.length, 1).setValues(links);

  SpreadsheetApp.getActiveSpreadsheet().toast(links.filter(function (l) { return l[0]; }).length + ' links gerados.');
}

function doGet(e) {
  var params = (e && e.parameter) || {};

  if (params.email) {
    // Diz em qual workshop o e-mail está — por isso exige o token, como o POST.
    if (!tokenValido(params.token)) return json(erro('NAO_AUTORIZADO', 'Token inválido.'));
    var email = String(params.email).trim().toLowerCase();
    var existente = lerInscricoes().filter(function (i) { return i.email === email; })[0];
    return json({ ok: true, inscricao: existente ? { workshopId: existente.workshopId } : null });
  }

  return json({ ok: true, vagas: calcularVagas() });
}

function doPost(e) {
  var dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (err) {
    return json(erro('REQUISICAO_INVALIDA', 'Corpo da requisição inválido.'));
  }

  if (!tokenValido(dados.token)) {
    return json(erro('NAO_AUTORIZADO', 'Token inválido.'));
  }

  var workshopId = String(dados.workshopId || '').trim();
  var nome = String(dados.nome || '').trim().replace(/\s+/g, ' ');
  var email = String(dados.email || '').trim().toLowerCase();

  if (nome.length < 3) return json(erro('NOME_INVALIDO', 'Informe seu nome completo.'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(erro('EMAIL_INVALIDO', 'Informe um e-mail válido.'));

  // Serializa as inscrições: sem isso, dois envios simultâneos passam do limite.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json(erro('OCUPADO', 'Muitas inscrições ao mesmo tempo. Tente novamente em instantes.'));
  }

  try {
    var workshop = lerWorkshops().filter(function (w) { return w.id === workshopId; })[0];
    if (!workshop) return json(erro('WORKSHOP_INEXISTENTE', 'Workshop não encontrado.'));

    if (!emailNoSympla(email)) {
      return json(erro('FORA_DO_SYMPLA', 'Não encontramos este e-mail na lista de inscritos do Sympla. Use o mesmo e-mail da sua inscrição.'));
    }

    var inscricoes = lerInscricoes();
    var existente = inscricoes.filter(function (i) { return i.email === email; })[0];
    if (existente) {
      return json(erro('JA_INSCRITO', 'Este e-mail já está inscrito no workshop "' + existente.workshop + '".', calcularVagas()));
    }

    var inscritos = inscricoes.filter(function (i) { return i.workshopId === workshopId; }).length;
    if (inscritos >= workshop.limite) {
      return json(erro('LOTADO', 'As vagas deste workshop acabaram. Escolha outro.', calcularVagas()));
    }

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_INSCRICOES)
      .appendRow([new Date(), workshopId, workshop.titulo, nome, email]);
    SpreadsheetApp.flush();

    return json({ ok: true, vagas: calcularVagas() });
  } finally {
    lock.releaseLock();
  }
}

function tokenValido(token) {
  return Boolean(token) && token === PropertiesService.getScriptProperties().getProperty('TOKEN');
}

function calcularVagas() {
  var contagem = {};
  lerInscricoes().forEach(function (i) {
    contagem[i.workshopId] = (contagem[i.workshopId] || 0) + 1;
  });
  return lerWorkshops().map(function (w) {
    var inscritos = contagem[w.id] || 0;
    var restantes = Math.max(0, w.limite - inscritos);
    return { id: w.id, limite: w.limite, inscritos: inscritos, restantes: restantes, lotado: restantes === 0 };
  });
}

function lerWorkshops() {
  return linhas(ABA_WORKSHOPS)
    .filter(function (l) { return l[0]; })
    .map(function (l) { return { id: String(l[0]).trim(), titulo: String(l[1]), limite: Number(l[2]) || 0 }; });
}

function lerInscricoes() {
  return linhas(ABA_INSCRICOES)
    .filter(function (l) { return l[1]; })
    .map(function (l) {
      return { workshopId: String(l[1]).trim(), workshop: String(l[2]), email: String(l[4]).trim().toLowerCase() };
    });
}

/** Sem e-mails na aba Sympla, a validação fica desligada. */
function emailNoSympla(email) {
  var emails = linhas(ABA_SYMPLA)
    .map(function (l) { return String(l[0]).trim().toLowerCase(); })
    .filter(Boolean);
  return emails.length === 0 || emails.indexOf(email) !== -1;
}

/** Linhas de dados de uma aba, sem o cabeçalho. */
function linhas(nomeAba) {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return [];
  return aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
}

function erro(codigo, mensagem, vagas) {
  var resposta = { ok: false, codigo: codigo, mensagem: mensagem };
  if (vagas) resposta.vagas = vagas;
  return resposta;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
