/**
 * Backend de vagas dos workshops — II Seminário Internacional de Educação Olim.
 *
 * Usa a planilha exportada do Sympla:
 *   - Lista de participantes: ... CODIGO | NOME COMPLETO | EMAIL | STATUS | WORKSHOP_1 | WORKSHOP_1_DATA | LINK_CONVITE | CHECKIN
 *       (colunas achadas pelo nome do cabeçalho; só STATUS "Aprovado" pode escolher workshop)
 *   - Workshops: id | titulo | limite   (titulo é o que vai gravado em WORKSHOP_1)
 *   - Config: chave | valor   (checkin_exigir_codigo: caixa de seleção; checkin_codigo: o código de OK)
 *
 * Endpoints (App da Web, "Executar como: eu", "Acesso: qualquer pessoa"):
 *   GET  .../exec          -> { ok, vagas: [{ id, limite, inscritos, restantes, lotado }] }
 *   GET  .../exec?token=   -> { ok, vagas, participantes: [{ codigo, nome, email, workshopId, checkin }], checkinExigeCodigo }
 *   POST .../exec  (JSON)  -> { token, workshopId, codigo? | (email, nome) }
 *                             { ok: true, vagas } | { ok: false, codigo, mensagem, vagas? }
 *   POST .../exec  (JSON)  -> { token, acao: 'checkin', codigo, codigoOk? }   (organizadores, no dia)
 *                             { ok: true, checkin } | { ok: false, codigo, mensagem, checkin? }
 *
 * GET com token e POST exigem o token das Propriedades do script (TOKEN). Rode setup() uma vez.
 */

var ABA_PARTICIPANTES = 'Lista de participantes';
var ABA_WORKSHOPS = 'Workshops';
var ABA_CONFIG = 'Config';

var COL_CODIGO = 'CODIGO';
var COL_NOME = 'NOME COMPLETO';
var COL_EMAIL = 'EMAIL';
var COL_STATUS = 'STATUS';
var COL_WORKSHOP = 'WORKSHOP_1';
var COL_DATA = 'WORKSHOP_1_DATA';
var COL_LINK = 'LINK_CONVITE';
var COL_CHECKIN = 'CHECKIN';
var STATUS_OK = 'aprovado';

var WORKSHOPS_INICIAIS = [
  ['eca-digital', 'ECA Digital', 130],
  ['projetos-educacao-infantil', 'Projetos na educação infantil', 80],
  ['quando-o-corpo-aprende', 'Quando o corpo aprende', 80],
  ['quintalizar-os-espacos', 'Quintalizar os espaços', 80],
  ['linguagem-da-comida', 'A linguagem da comida', 40],
];

/**
 * Prepara a planilha (rode uma vez pelo editor): preenche a aba Workshops se estiver vazia,
 * cria as colunas WORKSHOP_1_DATA, LINK_CONVITE e CHECKIN se faltarem, cria a aba Config
 * (código de OK do check-in, ligado) e gera o token.
 * Não apaga nem reordena nada.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var workshops = ss.getSheetByName(ABA_WORKSHOPS) || ss.insertSheet(ABA_WORKSHOPS);
  if (workshops.getLastRow() === 0) {
    workshops.appendRow(['id', 'titulo', 'limite']);
    WORKSHOPS_INICIAIS.forEach(function (linha) { workshops.appendRow(linha); });
    workshops.setFrozenRows(1);
  }

  var lista = ss.getSheetByName(ABA_PARTICIPANTES);
  if (!lista) throw new Error('Aba "' + ABA_PARTICIPANTES + '" não encontrada.');
  var cab = cabecalho(lista);
  if (cab[COL_WORKSHOP] === undefined) throw new Error('Coluna ' + COL_WORKSHOP + ' não encontrada.');
  if (cab[COL_DATA] === undefined) {
    lista.insertColumnAfter(cab[COL_WORKSHOP] + 1);
    lista.getRange(1, cab[COL_WORKSHOP] + 2).setValue(COL_DATA);
  }
  garantirColuna(lista, COL_LINK);
  garantirColuna(lista, COL_CHECKIN);

  var config = ss.getSheetByName(ABA_CONFIG) || ss.insertSheet(ABA_CONFIG);
  if (config.getLastRow() === 0) {
    config.appendRow(['chave', 'valor']);
    config.appendRow(['checkin_exigir_codigo', true]);
    config.appendRow(['checkin_codigo', String(Math.floor(100000 + Math.random() * 900000))]);
    config.getRange(2, 2).insertCheckboxes();
    config.setFrozenRows(1);
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) {
    props.setProperty('TOKEN', Utilities.getUuid());
  }
  CacheService.getScriptCache().remove(CHAVE_CACHE);
  Logger.log('TOKEN (coloque em APPS_SCRIPT_TOKEN no .env do site): ' + props.getProperty('TOKEN'));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Seminário')
    .addItem('Gerar links de convite', 'gerarLinks')
    .addToUi();
}

/**
 * Preenche LINK_CONVITE com o link individual de cada participante aprovado (/?c=CODIGO).
 * O site busca nome e e-mail pela planilha — o link não leva dados pessoais.
 * Pede a URL do site na 1ª vez (fica em Propriedades do script › SITE_URL).
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

  var lista = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PARTICIPANTES);
  var colLink = garantirColuna(lista, COL_LINK);
  var total = lista.getLastRow() - 1;
  if (total < 1) return;

  var links = [];
  for (var i = 0; i < total; i++) links.push(['']);
  lerParticipantes().forEach(function (p) {
    if (p.aprovado && p.codigo) links[p.linha - 2] = [site + '/?c=' + encodeURIComponent(p.codigo)];
  });
  lista.getRange(2, colLink, total, 1).setValues(links);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    links.filter(function (l) { return l[0]; }).length + ' links gerados (só ingressos aprovados).');
}

// Ler a planilha a cada GET custa 2–4s. O estado fica em cache e é regravado a cada
// inscrição; edições manuais na planilha limpam o cache (onEdit) ou expiram em 60s.
var CHAVE_CACHE = 'estado-v3';
var CACHE_SEGUNDOS = 60;

function doGet(e) {
  var params = (e && e.parameter) || {};
  var estado = obterEstado();

  if (params.token) {
    // Inclui nomes e e-mails — por isso exige o token, como o POST.
    if (!tokenValido(params.token)) return json(erro('NAO_AUTORIZADO', 'Token inválido.'));
    return json({
      ok: true,
      vagas: estado.vagas,
      participantes: estado.participantes,
      checkinExigeCodigo: estado.checkinExigeCodigo,
    });
  }

  return json({ ok: true, vagas: estado.vagas });
}

function onEdit() {
  CacheService.getScriptCache().remove(CHAVE_CACHE);
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
  if (dados.acao === 'checkin') {
    return json(fazerCheckin(String(dados.codigo || '').trim().toUpperCase(), String(dados.codigoOk || '').trim()));
  }

  var workshopId = String(dados.workshopId || '').trim();
  var codigo = String(dados.codigo || '').trim().toUpperCase();
  var email = String(dados.email || '').trim().toLowerCase();
  var nome = String(dados.nome || '');

  if (!codigo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(erro('EMAIL_INVALIDO', 'Informe um e-mail válido.'));
  }

  // Serializa as inscrições: sem isso, dois envios simultâneos passam do limite.
  // Dentro do lock a planilha é sempre lida direto, nunca do cache.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json(erro('OCUPADO', 'Muitas inscrições ao mesmo tempo. Tente novamente em instantes.'));
  }

  try {
    var workshops = lerWorkshops();
    var workshop = workshops.filter(function (w) { return w.id === workshopId; })[0];
    if (!workshop) return json(erro('WORKSHOP_INEXISTENTE', 'Workshop não encontrado.'));

    var participantes = lerParticipantes();
    var achado = encontrarParticipante(participantes, codigo, email, nome);
    if (achado.erro) return json(achado.erro);
    var p = achado.participante;

    if (p.workshopBruto) {
      return json(erro('JA_INSCRITO', 'Você já está inscrito no workshop "' + p.workshopBruto + '".',
        salvarEstado(workshops, participantes).vagas));
    }

    var vaga = montarEstado(workshops, participantes).vagas.filter(function (v) { return v.id === workshopId; })[0];
    if (vaga.lotado) {
      return json(erro('LOTADO', 'As vagas deste workshop acabaram. Escolha outro.', salvarEstado(workshops, participantes).vagas));
    }

    var lista = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PARTICIPANTES);
    var cab = cabecalho(lista);
    lista.getRange(p.linha, cab[COL_WORKSHOP] + 1).setValue(workshop.titulo);
    if (cab[COL_DATA] !== undefined) lista.getRange(p.linha, cab[COL_DATA] + 1).setValue(new Date());
    SpreadsheetApp.flush();

    p.workshopBruto = workshop.titulo;
    return json({ ok: true, vagas: salvarEstado(workshops, participantes).vagas });
  } finally {
    lock.releaseLock();
  }
}

/** Marca a entrada do participante no dia (CHECKIN = data e hora). Só uma vez por ingresso e
 *  só com workshop escolhido. Com checkin_exigir_codigo marcado na aba Config, exige o código de OK. */
function fazerCheckin(codigo, codigoOk) {
  if (!codigo) return erro('FORA_DA_LISTA', 'Informe o código do ingresso.');
  var config = lerConfig();
  if (config.exigirCodigo && (!config.codigo || codigoOk !== config.codigo)) {
    return erro('CODIGO_OK_INVALIDO', 'Código de OK incorreto.');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return erro('OCUPADO', 'Muitos check-ins ao mesmo tempo. Tente novamente.');

  try {
    var participantes = lerParticipantes();
    var p = participantes.filter(function (x) { return x.codigo === codigo; })[0];
    if (!p) return erro('FORA_DA_LISTA', 'Ingresso ' + codigo + ' não está na lista de participantes.');
    if (!p.aprovado) return erro('INGRESSO_PENDENTE', 'Ingresso ' + codigo + ' não está aprovado no Sympla.');
    if (p.checkin) {
      var r = erro('JA_FEZ_CHECKIN', 'Este ingresso já fez check-in.');
      r.checkin = p.checkin;
      return r;
    }
    var workshops = lerWorkshops();
    if (!idDoWorkshop(p.workshopBruto, workshops)) {
      return erro('SEM_WORKSHOP', p.workshopBruto
        ? 'O workshop gravado para este ingresso não bate com nenhum workshop. Confira a coluna WORKSHOP_1.'
        : 'Escolha um workshop antes de fazer o check-in.');
    }

    var lista = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PARTICIPANTES);
    var agora = new Date();
    lista.getRange(p.linha, garantirColuna(lista, COL_CHECKIN)).setValue(agora);
    SpreadsheetApp.flush();

    p.checkin = agora.toISOString();
    salvarEstado(workshops, participantes, config);
    return { ok: true, checkin: p.checkin };
  } finally {
    lock.releaseLock();
  }
}

/** Pelo código do ingresso; sem código, pelo e-mail (e pelo nome, se o e-mail for compartilhado). */
function encontrarParticipante(participantes, codigo, email, nome) {
  var candidatos;
  if (codigo) {
    candidatos = participantes.filter(function (p) { return p.codigo === codigo; });
    if (candidatos.length === 0) return { erro: erro('FORA_DA_LISTA', 'Link de convite inválido. Confira o link recebido.') };
  } else {
    candidatos = participantes.filter(function (p) { return p.email === email; });
    if (candidatos.length === 0) {
      return { erro: erro('FORA_DA_LISTA', 'Não encontramos este e-mail entre os inscritos do seminário. Use o mesmo e-mail da sua inscrição no Sympla.') };
    }
    if (candidatos.length > 1) {
      var alvo = normalizar(nome);
      candidatos = candidatos.filter(function (p) { return normalizar(p.nome) === alvo; });
      if (candidatos.length !== 1) {
        return { erro: erro('EMAIL_COMPARTILHADO', 'Este e-mail está ligado a mais de um ingresso. Use o link individual que você recebeu ou digite seu nome exatamente como no ingresso.') };
      }
    }
  }

  var p = candidatos[0];
  if (!p.aprovado) {
    return { erro: erro('INGRESSO_PENDENTE', 'Seu ingresso ainda não está aprovado no Sympla. Fale com a organização.') };
  }
  return { participante: p };
}

function tokenValido(token) {
  return Boolean(token) && token === PropertiesService.getScriptProperties().getProperty('TOKEN');
}

function obterEstado() {
  var guardado = CacheService.getScriptCache().get(CHAVE_CACHE);
  if (guardado) return JSON.parse(guardado);
  return salvarEstado(lerWorkshops(), lerParticipantes());
}

function salvarEstado(workshops, participantes, config) {
  var estado = montarEstado(workshops, participantes);
  // Só o liga/desliga vai para o estado; o código de OK nunca sai do script.
  estado.checkinExigeCodigo = (config || lerConfig()).exigirCodigo;
  try {
    CacheService.getScriptCache().put(CHAVE_CACHE, JSON.stringify(estado), CACHE_SEGUNDOS);
  } catch (err) {
    // Acima de 100 KB o cache recusa; segue lendo a planilha direto.
  }
  return estado;
}

function montarEstado(workshops, participantes) {
  var contagem = {};
  var publicos = [];
  participantes.forEach(function (p) {
    var id = idDoWorkshop(p.workshopBruto, workshops);
    if (id) contagem[id] = (contagem[id] || 0) + 1;
    if (p.aprovado) {
      // Valor em WORKSHOP_1 que não bate com nenhum workshop ainda conta como "já escolheu".
      publicos.push({
        codigo: p.codigo,
        nome: p.nome,
        email: p.email,
        workshopId: id || (p.workshopBruto ? '?' : null),
        checkin: p.checkin || null,
      });
    }
  });
  var vagas = workshops.map(function (w) {
    var total = contagem[w.id] || 0;
    var restantes = Math.max(0, w.limite - total);
    return { id: w.id, limite: w.limite, inscritos: total, restantes: restantes, lotado: restantes === 0 };
  });
  return { vagas: vagas, participantes: publicos };
}

/** WORKSHOP_1 guarda o título; aceita também o id. Renomear um título depois de abrir as
 *  inscrições exige atualizar os valores já gravados em WORKSHOP_1. */
function idDoWorkshop(valor, workshops) {
  var v = normalizar(valor);
  if (!v) return null;
  var w = workshops.filter(function (w) { return normalizar(w.titulo) === v || normalizar(w.id) === v; })[0];
  return w ? w.id : null;
}

function lerWorkshops() {
  return linhas(ABA_WORKSHOPS)
    .filter(function (l) { return l[0]; })
    .map(function (l) { return { id: String(l[0]).trim(), titulo: String(l[1]).trim(), limite: Number(l[2]) || 0 }; });
}

/** Aba Config (chave | valor). Sem a aba ou sem a chave, o código de OK fica exigido. */
function lerConfig() {
  var valores = {};
  linhas(ABA_CONFIG).forEach(function (l) { valores[normalizar(l[0])] = l[1]; });
  var exigir = valores.checkin_exigir_codigo;
  return {
    exigirCodigo: exigir === undefined || exigir === true || ['true', 'sim', '1', 'ligado'].indexOf(normalizar(exigir)) >= 0,
    codigo: String(valores.checkin_codigo === undefined ? '' : valores.checkin_codigo).trim(),
  };
}

function lerParticipantes() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PARTICIPANTES);
  if (!aba || aba.getLastRow() < 2) return [];
  var cab = cabecalho(aba);
  [COL_CODIGO, COL_NOME, COL_EMAIL, COL_STATUS, COL_WORKSHOP].forEach(function (c) {
    if (cab[c] === undefined) throw new Error('Coluna ' + c + ' não encontrada em "' + ABA_PARTICIPANTES + '".');
  });

  return aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues()
    .map(function (l, i) {
      return {
        linha: i + 2,
        codigo: String(l[cab[COL_CODIGO]]).trim().toUpperCase(),
        nome: String(l[cab[COL_NOME]]).replace(/\s+/g, ' ').trim(),
        email: String(l[cab[COL_EMAIL]]).trim().toLowerCase(),
        aprovado: normalizar(l[cab[COL_STATUS]]) === STATUS_OK,
        workshopBruto: String(l[cab[COL_WORKSHOP]]).trim(),
        checkin: cab[COL_CHECKIN] === undefined ? '' : dataIso(l[cab[COL_CHECKIN]]),
      };
    })
    .filter(function (p) { return p.codigo || p.email; });
}

/** { NOME_DA_COLUNA: índice (0-based) } a partir da 1ª linha. */
function cabecalho(aba) {
  var mapa = {};
  aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0].forEach(function (h, i) {
    var nome = String(h).trim().toUpperCase();
    if (nome && mapa[nome] === undefined) mapa[nome] = i;
  });
  return mapa;
}

/** Garante a coluna no fim da aba e devolve seu número (1-based). */
function garantirColuna(aba, nome) {
  var cab = cabecalho(aba);
  if (cab[nome] !== undefined) return cab[nome] + 1;
  var col = aba.getLastColumn() + 1;
  aba.getRange(1, col).setValue(nome);
  return col;
}

/** Linhas de dados de uma aba, sem o cabeçalho. */
function linhas(nomeAba) {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return [];
  return aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
}

/** Célula de data (ou texto) como ISO 8601; vazia vira ''. */
function dataIso(v) {
  if (v instanceof Date) return v.toISOString();
  return String(v || '').trim();
}

/** Minúsculas, sem acento, espaços colapsados. */
function normalizar(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function erro(codigo, mensagem, vagas) {
  var resposta = { ok: false, codigo: codigo, mensagem: mensagem };
  if (vagas) resposta.vagas = vagas;
  return resposta;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
