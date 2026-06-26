/**
 * Bolão Copa 2026 - Google Sheets Backend Database
 * 
 * INSTRUÇÕES DE INSTALAÇÃO:
 * 1. Crie uma nova Planilha Google (Google Sheet).
 * 2. Acesse "Extensões" (Extensions) > "Apps Script".
 * 3. Apague o código padrão e cole este código completo.
 * 4. Clique em "Salvar" (ícone de disquete).
 * 5. Clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 6. Selecione o tipo de implantação: "Aplicativo Web" (Web app).
 * 7. Configure:
 *    - Descrição: Bolao Copa 2026 API
 *    - Executar como: Você (seu e-mail)
 *    - Quem tem acesso: Qualquer pessoa (Anyone)
 * 8. Clique em "Implantar" e conceda as permissões necessárias para ler/gravar na planilha.
 * 9. Copie o link do "Aplicativo Web" gerado (URL da API) e cole na variável API_URL do seu app.js.
 */

// Configuração padrão dos jogos
var DEFAULT_MATCHES = [
  { id: 'm1', team1: 'Brasil', flag1: 'br', team2: 'Marrocos', flag2: 'ma', date: '2026-06-13T19:00:00-03:00', desc: 'Fase de Grupos - Grupo C', goals1: 1, goals2: 1 },
  { id: 'm2', team1: 'Brasil', flag1: 'br', team2: 'Haiti', flag2: 'ht', date: '2026-06-19T21:30:00-03:00', desc: 'Fase de Grupos - Grupo C', goals1: 2, goals2: 0 },
  { id: 'm3', team1: 'Escócia', flag1: 'gb-sct', team2: 'Brasil', flag2: 'br', date: '2026-06-24T19:00:00-03:00', desc: 'Fase de Grupos - Grupo C', goals1: 0, goals2: 3 },
  { id: 'm4', team1: 'Brasil', flag1: 'br', team2: 'Japão', flag2: 'jp', date: '2026-06-29T14:00:00-03:00', desc: '16-avos de final', goals1: '', goals2: '' }
];

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Inicializa planilhas se não existirem
  initializeSheets(sheet);
  
  if (action === 'getData') {
    var data = getDatabaseData(sheet);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({success: false, error: "Ação GET inválida"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  initializeSheets(sheet);
  
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: "JSON inválido"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = payload.action;
  var result = { success: false, error: "Ação desconhecida" };
  
  if (action === 'submitPrediction') {
    result = submitPrediction(sheet, payload.name, payload.matchId, payload.goals1, payload.goals2);
  } else if (action === 'approvePrediction') {
    result = approvePrediction(sheet, payload.name, payload.matchId);
  } else if (action === 'rejectPrediction') {
    result = rejectPrediction(sheet, payload.name, payload.matchId);
  } else if (action === 'saveResults') {
    result = saveResults(sheet, payload.matches);
  } else if (action === 'addMatch') {
    result = addMatch(sheet, payload.match);
  } else if (action === 'resetDb') {
    result = resetDatabase(sheet);
  } else if (action === 'voteFrogJump') {
    result = submitFrogJumpVote(sheet, payload.choice, payload.oldChoice);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Inicializa as abas da planilha
function initializeSheets(sheet) {
  var matchesSheet = sheet.getSheetByName("Matches");
  if (!matchesSheet) {
    matchesSheet = sheet.insertSheet("Matches");
    matchesSheet.appendRow(["id", "team1", "flag1", "team2", "flag2", "date", "desc", "goals1", "goals2"]);
    
    // Seed default matches
    DEFAULT_MATCHES.forEach(function(m) {
      matchesSheet.appendRow([m.id, m.team1, m.flag1, m.team2, m.flag2, m.date, m.desc, m.goals1, m.goals2]);
    });
  }
  
  var betsSheet = sheet.getSheetByName("Bets");
  if (!betsSheet) {
    betsSheet = sheet.insertSheet("Bets");
    betsSheet.appendRow(["timestamp", "name", "matchId", "goals1", "goals2", "status"]);
    
    // Seed Cabello's approved bet: 3x1 on Match 1 (Morocco)
    betsSheet.appendRow([new Date(), "Cabello", "m1", 3, 1, "approved"]);
  }
  
  var frogSheet = sheet.getSheetByName("FrogJumpVotes");
  if (!frogSheet) {
    frogSheet = sheet.insertSheet("FrogJumpVotes");
    frogSheet.appendRow(["timestamp", "choice"]);
  }
}

// Submits a vote for the Frog Jump challenge
function submitFrogJumpVote(sheet, choice, oldChoice) {
  var frogSheet = sheet.getSheetByName("FrogJumpVotes");
  if (!frogSheet) {
    return { success: false, error: "Aba FrogJumpVotes não encontrada" };
  }
  if (oldChoice) {
    frogSheet.appendRow([new Date(), "-" + oldChoice]);
  }
  if (choice) {
    frogSheet.appendRow([new Date(), choice]);
  }
  return { success: true };
}

// Retorna todos os dados formatados
function getDatabaseData(sheet) {
  var matchesSheet = sheet.getSheetByName("Matches");
  var betsSheet = sheet.getSheetByName("Bets");
  
  // 1. Read matches
  var matchesRange = matchesSheet.getDataRange();
  var matchesValues = matchesRange.getValues();
  var matches = [];
  
  for (var i = 1; i < matchesValues.length; i++) {
    var row = matchesValues[i];
    var g1 = row[7];
    var g2 = row[8];
    matches.push({
      id: row[0] ? row[0].toString().trim() : '',
      team1: row[1] ? row[1].toString().trim() : '',
      flag1: row[2] ? row[2].toString().trim() : '',
      team2: row[3] ? row[3].toString().trim() : '',
      flag2: row[4] ? row[4].toString().trim() : '',
      date: row[5] ? row[5].toString().trim() : '',
      desc: row[6] ? row[6].toString().trim() : '',
      goals1: (g1 === "" || g1 === null || g1 === undefined || isNaN(parseInt(g1))) ? null : parseInt(g1, 10),
      goals2: (g2 === "" || g2 === null || g2 === undefined || isNaN(parseInt(g2))) ? null : parseInt(g2, 10)
    });
  }
  
  // 2. Read bets
  var betsRange = betsSheet.getDataRange();
  var betsValues = betsRange.getValues();
  
  var participants = [];
  var pendingApprovals = [];
  
  for (var j = 1; j < betsValues.length; j++) {
    var bRow = betsValues[j];
    var name = bRow[1] ? bRow[1].toString().trim() : '';
    var matchId = bRow[2] ? bRow[2].toString().trim() : '';
    var gb1 = bRow[3];
    var gb2 = bRow[4];
    var goals1 = (gb1 === "" || gb1 === null || gb1 === undefined || isNaN(parseInt(gb1))) ? null : parseInt(gb1, 10);
    var goals2 = (gb2 === "" || gb2 === null || gb2 === undefined || isNaN(parseInt(gb2))) ? null : parseInt(gb2, 10);
    var status = bRow[5] ? bRow[5].toString().trim().toLowerCase() : '';
    
    if (name === '') continue; // Skip empty rows
    
    var list = (status === 'approved') ? participants : pendingApprovals;
    
    var existing = list.find(function(p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (existing) {
      existing.predictions[matchId] = { goals1: goals1, goals2: goals2 };
    } else {
      var pObj = { name: name, predictions: {} };
      pObj.predictions[matchId] = { goals1: goals1, goals2: goals2 };
      list.push(pObj);
    }
  }
  
  // 3. Read FrogJumpVotes
  var frogSheet = sheet.getSheetByName("FrogJumpVotes");
  var frogJumpVotes = { ori: 0, nelsinho: 0 };
  if (frogSheet) {
    var frogRange = frogSheet.getDataRange();
    var frogValues = frogRange.getValues();
    for (var k = 1; k < frogValues.length; k++) {
      var choice = frogValues[k][1] ? frogValues[k][1].toString().trim().toLowerCase() : '';
      if (choice === 'ori') frogJumpVotes.ori++;
      if (choice === 'nelsinho' || choice === 'nerso') frogJumpVotes.nelsinho++;
      if (choice === '-ori') frogJumpVotes.ori = Math.max(0, frogJumpVotes.ori - 1);
      if (choice === '-nelsinho' || choice === '-nerso') frogJumpVotes.nelsinho = Math.max(0, frogJumpVotes.nelsinho - 1);
    }
  }
  
  return {
    matches: matches,
    participants: participants,
    pendingApprovals: pendingApprovals,
    frogJumpVotes: frogJumpVotes
  };
}

// Grava um palpite como "pending" (Aguardando PIX)
function submitPrediction(sheet, name, matchId, goals1, goals2) {
  var betsSheet = sheet.getSheetByName("Bets");
  var range = betsSheet.getDataRange();
  var values = range.getValues();
  
  // Check if this user already has an active bet for this match (pending or approved)
  var rowToUpdate = -1;
  for (var i = 1; i < values.length; i++) {
    if (values[i][1].toString().toLowerCase() === name.toLowerCase() && values[i][2].toString() === matchId) {
      rowToUpdate = i + 1; // 1-based index including header
      break;
    }
  }
  
  if (rowToUpdate > -1) {
    // If it exists, update it but set status back to pending
    betsSheet.getRange(rowToUpdate, 1).setValue(new Date());
    betsSheet.getRange(rowToUpdate, 4).setValue(parseInt(goals1));
    betsSheet.getRange(rowToUpdate, 5).setValue(parseInt(goals2));
    betsSheet.getRange(rowToUpdate, 6).setValue("pending");
  } else {
    // Append new pending bet
    betsSheet.appendRow([new Date(), name, matchId, parseInt(goals1), parseInt(goals2), "pending"]);
  }
  
  return { success: true };
}

// Aprova um palpite pendente (Confirmado pagamento PIX)
function approvePrediction(sheet, name, matchId) {
  var betsSheet = sheet.getSheetByName("Bets");
  var range = betsSheet.getDataRange();
  var values = range.getValues();
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1].toString().toLowerCase() === name.toLowerCase() && values[i][2].toString() === matchId) {
      betsSheet.getRange(i + 1, 6).setValue("approved");
      return { success: true };
    }
  }
  
  return { success: false, error: "Palpite não encontrado para aprovação." };
}

// Rejeita um palpite pendente (Exclui do banco de dados)
function rejectPrediction(sheet, name, matchId) {
  var betsSheet = sheet.getSheetByName("Bets");
  var range = betsSheet.getDataRange();
  var values = range.getValues();
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1].toString().toLowerCase() === name.toLowerCase() && values[i][2].toString() === matchId) {
      betsSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: "Palpite não encontrado para rejeição." };
}

// Salva resultados oficiais dos jogos
function saveResults(sheet, updatedMatches) {
  var matchesSheet = sheet.getSheetByName("Matches");
  var range = matchesSheet.getDataRange();
  var values = range.getValues();
  
  updatedMatches.forEach(function(um) {
    for (var i = 1; i < values.length; i++) {
      if (values[i][0].toString() === um.id) {
        var row = i + 1;
        matchesSheet.getRange(row, 8).setValue(um.goals1 === null || um.goals1 === "" ? "" : parseInt(um.goals1));
        matchesSheet.getRange(row, 9).setValue(um.goals2 === null || um.goals2 === "" ? "" : parseInt(um.goals2));
        break;
      }
    }
  });
  
  return { success: true };
}

// Adiciona um novo jogo do Brasil
function addMatch(sheet, m) {
  var matchesSheet = sheet.getSheetByName("Matches");
  matchesSheet.appendRow([m.id, m.team1, m.flag1, m.team2, m.flag2, m.date, m.desc, "", ""]);
  return { success: true };
}

// Limpa banco de dados e reseta ao padrão
function resetDatabase(sheet) {
  // Delete Sheets
  var matchesSheet = sheet.getSheetByName("Matches");
  if (matchesSheet) sheet.deleteSheet(matchesSheet);
  
  var betsSheet = sheet.getSheetByName("Bets");
  if (betsSheet) sheet.deleteSheet(betsSheet);
  
  // Re-initialize
  initializeSheets(sheet);
  
  return { success: true };
}
