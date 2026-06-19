// Default Group Stage Matches for Brazil in 2026 World Cup
const DEFAULT_MATCHES = [
    {
        id: 'm1',
        team1: 'Brasil',
        flag1: 'br',
        team2: 'Marrocos',
        flag2: 'ma',
        date: '2026-06-13T19:00:00-03:00', // June 13, 2026, 7:00 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: 1,
        goals2: 1
    },
    {
        id: 'm2',
        team1: 'Brasil',
        flag1: 'br',
        team2: 'Haiti',
        flag2: 'ht',
        date: '2026-06-19T21:30:00-03:00', // June 19, 2026, 9:30 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: null,
        goals2: null
    },
    {
        id: 'm3',
        team1: 'Escócia',
        flag1: 'gb-sct',
        team2: 'Brasil',
        flag2: 'br',
        date: '2026-06-24T19:00:00-03:00', // June 24, 2026, 7:00 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: null,
        goals2: null
    }
];

// App State
let matches = [];
let participants = [];
let pendingApprovals = [];
let myPredictions = {};
let myName = '';

// API Web App URL from Google Apps Script (leave empty for offline LocalStorage fallback testing)
const API_URL = "https://script.google.com/macros/s/AKfycbxpp5pzhsxP6bFQrIelattGchNZb4KF1QJY_4pm2uhBYwHPib6-csS_KrmbzmV26dnq0A/exec";

// Fetch latest database state from Google Sheets
async function fetchDatabase() {
    if (!API_URL) return;
    try {
        const response = await fetch(`${API_URL}?action=getData`);
        const data = await response.json();
        if (data) {
            matches = data.matches || [];
            participants = data.participants || [];
            pendingApprovals = data.pendingApprovals || [];
            
            // Cache in local storage
            localStorage.setItem('bolao_matches', JSON.stringify(matches));
            localStorage.setItem('bolao_participants', JSON.stringify(participants));
            localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
        }
    } catch (e) {
        console.error("Erro ao carregar dados do Sheets:", e);
        showToast("Erro ao conectar ao Google Sheets. Usando dados locais offline.", true);
    }
}

// HTML Helper to escape variables (prevent XSS)
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Map country flag ISO codes back to emojis for text sharing
function getCountryEmoji(flagCode) {
    if (!flagCode) return '🏳️';
    const emojiMap = {
        'br': '🇧🇷',
        'ma': '🇲🇦',
        'ht': '🇭🇹',
        'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        'ar': '🇦🇷',
        'uy': '🇺🇾',
        'de': '🇩🇪',
        'fr': '🇫🇷',
        'it': '🇮🇹',
        'pt': '🇵🇹',
        'es': '🇪🇸'
    };
    return emojiMap[flagCode.toLowerCase()] || '🏳️';
}

// Initialize Application Data
function initData() {
    // 1. Matches
    const savedMatches = localStorage.getItem('bolao_matches');
    if (savedMatches) {
        try {
            matches = JSON.parse(savedMatches);
            // Migrate old emoji flags to ISO codes if present
            if (matches.length > 0 && (matches[0].flag1 === '🇧🇷' || matches[0].flag1.length > 3)) {
                matches = [...DEFAULT_MATCHES];
                localStorage.setItem('bolao_matches', JSON.stringify(matches));
            }
        } catch (e) {
            matches = [...DEFAULT_MATCHES];
        }
    } else {
        matches = [...DEFAULT_MATCHES];
        localStorage.setItem('bolao_matches', JSON.stringify(matches));
    }

    // 2. Participants
    const savedParticipants = localStorage.getItem('bolao_participants');
    if (savedParticipants) {
        try {
            participants = JSON.parse(savedParticipants);
        } catch (e) {
            participants = [];
        }
    } else {
        participants = [];
    }

    // 3. User guesses
    const savedMyPredictions = localStorage.getItem('bolao_my_predictions');
    if (savedMyPredictions) {
        try {
            myPredictions = JSON.parse(savedMyPredictions);
        } catch (e) {
            myPredictions = {};
        }
    } else {
        myPredictions = {};
    }

    // 4. Pending approvals
    const savedPending = localStorage.getItem('bolao_pending_approvals');
    if (savedPending) {
        try {
            pendingApprovals = JSON.parse(savedPending);
        } catch (e) {
            pendingApprovals = [];
        }
    } else {
        pendingApprovals = [];
    }

    // 5. User Name
    myName = localStorage.getItem('bolao_my_name') || '';
    if (myName) {
        document.getElementById('participant-name').value = myName;
    }
}

// Helper to check if a goal score is empty/null/undefined/NaN
function isScoreEmpty(val) {
    return val === null || val === undefined || val === '' || isNaN(parseInt(val));
}

// Calculate Points for a prediction compared to official result (1 = hit exact score, 0 = missed)
function calculateMatchPoints(prediction, official) {
    if (isScoreEmpty(prediction.goals1) || isScoreEmpty(prediction.goals2) || 
        isScoreEmpty(official.goals1) || isScoreEmpty(official.goals2)) {
        return 0;
    }
    
    const p1 = parseInt(prediction.goals1);
    const p2 = parseInt(prediction.goals2);
    const o1 = parseInt(official.goals1);
    const o2 = parseInt(official.goals2);
    
    // Only exact score gets points (1 point represents correct hit)
    if (p1 === o1 && p2 === o2) {
        return 1;
    }
    return 0;
}

// Calculate champion(s) of a single match
function getMatchChampions(matchId) {
    const matchObj = matches.find(m => m.id === matchId);
    if (!matchObj || isScoreEmpty(matchObj.goals1) || isScoreEmpty(matchObj.goals2)) {
        return null;
    }
    
    let maxPts = 0;
    let champions = [];
    
    participants.forEach(p => {
        const pred = p.predictions[matchId];
        if (pred && !isScoreEmpty(pred.goals1) && !isScoreEmpty(pred.goals2)) {
            const pts = calculateMatchPoints(pred, matchObj);
            if (pts > maxPts) {
                maxPts = pts;
                champions = [{ name: p.name, points: pts }];
            } else if (pts === maxPts && pts > 0) {
                champions.push({ name: p.name, points: pts });
            }
        }
    });
    
    if (champions.length === 0) {
        return null;
    }
    
    return {
        points: maxPts,
        names: champions.map(c => c.name)
    };
}

// Helper to check if a match is locked (next matches disabled until previous ones finish)
function isMatchLocked(matchId) {
    const idx = matches.findIndex(m => m.id === matchId);
    if (idx <= 0) return false;
    
    // 1. Lock if previous matches are not finished (and their date is in the future)
    for (let i = 0; i < idx; i++) {
        if (isScoreEmpty(matches[i].goals1) || isScoreEmpty(matches[i].goals2)) {
            const prevDate = new Date(matches[i].date);
            const now = new Date();
            if (prevDate > now) {
                return true;
            }
        }
    }
    
    // 2. Lock if previous match finished TODAY (betting only opens starting the day after the previous match date)
    const prevMatch = matches[idx - 1];
    if (prevMatch && prevMatch.date) {
        const prevDate = new Date(prevMatch.date);
        const now = new Date();
        const isSameDayOrBefore = 
            now.getFullYear() < prevDate.getFullYear() ||
            (now.getFullYear() === prevDate.getFullYear() && now.getMonth() < prevDate.getMonth()) ||
            (now.getFullYear() === prevDate.getFullYear() && now.getMonth() === prevDate.getMonth() && now.getDate() <= prevDate.getDate());
            
        if (isSameDayOrBefore) {
            return true;
        }
    }
    
    return false;
}

// Helper to get lock explanation reason
function getMatchLockReason(matchId) {
    const idx = matches.findIndex(m => m.id === matchId);
    if (idx <= 0) return '';
    
    for (let i = 0; i < idx; i++) {
        if (isScoreEmpty(matches[i].goals1) || isScoreEmpty(matches[i].goals2)) {
            const prevDate = new Date(matches[i].date);
            const now = new Date();
            if (prevDate > now) {
                const prevOpp = matches[i].team1 === 'Brasil' ? matches[i].team2 : matches[i].team1;
                return `Habilitado após o término de Brasil x ${prevOpp}`;
            }
        }
    }
    
    const prevMatch = matches[idx - 1];
    if (prevMatch && prevMatch.date) {
        const prevDate = new Date(prevMatch.date);
        const now = new Date();
        const isSameDayOrBefore = 
            now.getFullYear() < prevDate.getFullYear() ||
            (now.getFullYear() === prevDate.getFullYear() && now.getMonth() < prevDate.getMonth()) ||
            (now.getFullYear() === prevDate.getFullYear() && now.getMonth() === prevDate.getMonth() && now.getDate() <= prevDate.getDate());
            
        if (isSameDayOrBefore) {
            return `Habilitado a partir do dia seguinte ao jogo anterior`;
        }
    }
    return '';
}

// Helper to check if predictions are closed for a match (up to 5 minutes before match start)
function isMatchClosedForBetting(match) {
    if (!match.date) return false;
    const matchTime = new Date(match.date).getTime();
    const nowTime = new Date().getTime();
    const closingTime = matchTime - (5 * 60 * 1000); // 5 minutes before start
    return nowTime >= closingTime;
}

// Calculate entire stats for a participant
function getParticipantStats(participant) {
    let totalPoints = 0;
    let count25 = 0;
    let count18 = 0;
    let count15 = 0;
    let count12 = 0;
    
    matches.forEach(match => {
        if (match.goals1 !== null && match.goals2 !== null) {
            const pred = participant.predictions[match.id];
            if (pred && pred.goals1 !== '' && pred.goals2 !== '' && pred.goals1 !== null && pred.goals2 !== null) {
                const pts = calculateMatchPoints(pred, match);
                totalPoints += pts;
                if (pts === 25) count25++;
                else if (pts === 18) count18++;
                else if (pts === 15) count15++;
                else if (pts === 12) count12++;
            }
        }
    });
    
    return {
        totalPoints,
        count25,
        count18,
        count15,
        count12
    };
}

// Show Toast Message
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast'; // reset classes
    if (isError) {
        toast.classList.add('error');
    }
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Helper to get active match to display by default in leaderboard
function getDefaultActiveMatchId() {
    // Find the first unplayed match that is NOT closed for betting
    let activeMatch = matches.find(m => (isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2)) && !isMatchClosedForBetting(m));
    if (activeMatch) return activeMatch.id;
    
    // Fallback: find the first unplayed match
    const firstUnplayed = matches.find(m => isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2));
    if (firstUnplayed) return firstUnplayed.id;
    
    return 'm1';
}

// Calculate and update total pot of the entire sweepstakes
function updateTotalPot() {
    let totalApprovedBets = 0;
    participants.forEach(p => {
        for (const [matchId, guess] of Object.entries(p.predictions)) {
            if (guess && !isScoreEmpty(guess.goals1) && !isScoreEmpty(guess.goals2)) {
                totalApprovedBets++;
            }
        }
    });
    
    const totalPot = totalApprovedBets * 5;
    const potBadge = document.getElementById('total-pot-value');
    if (potBadge) {
        potBadge.textContent = `R$ ${totalPot.toFixed(2).replace('.', ',')}`;
    }
}

// Render Predictions list in "Palpitar" tab
function renderPredictions() {
    const container = document.getElementById('predictions-matches');
    container.innerHTML = '';
    
    if (matches.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum jogo cadastrado.</p></div>';
        return;
    }
    
    // The active match is the first unplayed match that is NOT closed for betting
    let activeMatch = matches.find(m => (isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2)) && !isMatchClosedForBetting(m));
    
    // If all matches are either played or closed for betting, fallback to the first unplayed match
    if (!activeMatch) {
        activeMatch = matches.find(m => isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2));
    }
    
    if (!activeMatch) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-circle-check text-green" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i>
                <p>Todos os jogos foram finalizados!</p>
                <p style="font-size: 0.85rem; margin-top: 5px;">Acompanhe o ranking final na aba de Classificação.</p>
            </div>
        `;
        const btnSave = document.getElementById('btn-save-my-guesses');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.5';
            btnSave.innerHTML = '<i class="fa-solid fa-ban"></i> Apostas Encerradas';
        }
        return;
    }
    
    // Enable or disable send button based on active match status
    const btnSave = document.getElementById('btn-save-my-guesses');
    if (btnSave) {
        const isClosed = isMatchClosedForBetting(activeMatch) || (!isScoreEmpty(activeMatch.goals1) && !isScoreEmpty(activeMatch.goals2));
        if (isClosed) {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.5';
            btnSave.innerHTML = '<i class="fa-solid fa-ban"></i> Apostas Encerradas';
        } else {
            btnSave.disabled = false;
            btnSave.style.opacity = '1';
            btnSave.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Enviar Palpite e Confirmar PIX';
        }
    }
    
    matches.forEach((match, idx) => {
        // Hide all matches that are not the current active match (display: none replacement)
        if (match.id !== activeMatch.id) {
            return;
        }
        
        const prediction = myPredictions[match.id] || { goals1: '', goals2: '' };
        const matchDate = new Date(match.date);
        const formattedDate = matchDate.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // A match is locked if any previous matches are not played yet
        const isDisabled = isMatchLocked(match.id);
        const lockReason = getMatchLockReason(match.id);
        
        // Define if inputs are disabled (locked, closed 15m before kick-off, or already has results)
        const inputDisabled = isDisabled || isMatchClosedForBetting(match) || (!isScoreEmpty(match.goals1) && !isScoreEmpty(match.goals2));
        
        // Calculate match champions
        const champs = getMatchChampions(match.id);
        let champsHtml = '';
        if (champs) {
            const namesList = champs.names.map(name => `<strong class="text-yellow">${escapeHtml(name)}</strong>`).join(', ');
            champsHtml = `
                <div class="match-champions-badge">
                    <i class="fa-solid fa-trophy text-yellow"></i> Ganhador(es) do Jogo: ${namesList}
                </div>
            `;
        } else if (!isScoreEmpty(match.goals1) && !isScoreEmpty(match.goals2)) {
            champsHtml = `<div class="match-champions-badge text-muted" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">Sem acertadores nesta partida.</div>`;
        }
        
        const card = document.createElement('div');
        card.className = `card match-card ${isDisabled ? 'match-card-disabled' : ''}`;
        card.style.margin = '0';
        card.style.border = 'none';
        card.style.background = 'rgba(0,0,0,0.15)';
        card.innerHTML = `
            <div class="match-card-header">
                <span class="match-num">${escapeHtml(match.desc)}</span>
                <span class="match-datetime"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
            </div>
            <div class="match-body">
                <div class="team">
                    <img src="https://flagcdn.com/w80/${match.flag1}.png" class="team-flag-img" style="${isDisabled ? 'opacity: 0.4;' : ''}" alt="">
                    <span class="team-name" style="${isDisabled ? 'color: var(--text-muted);' : ''}">${escapeHtml(match.team1)}</span>
                </div>
                <div class="score-vs">
                    <input type="number" min="0" class="input-score" id="guess-${match.id}-goals1" value="${prediction.goals1 !== undefined && !isScoreEmpty(prediction.goals1) ? prediction.goals1 : ''}" placeholder="-" ${inputDisabled ? 'disabled' : ''}>
                    <span class="vs-divider">x</span>
                    <input type="number" min="0" class="input-score" id="guess-${match.id}-goals2" value="${prediction.goals2 !== undefined && !isScoreEmpty(prediction.goals2) ? prediction.goals2 : ''}" placeholder="-" ${inputDisabled ? 'disabled' : ''}>
                </div>
                <div class="team">
                    <img src="https://flagcdn.com/w80/${match.flag2}.png" class="team-flag-img" style="${isDisabled ? 'opacity: 0.4;' : ''}" alt="">
                    <span class="team-name" style="${isDisabled ? 'color: var(--text-muted);' : ''}">${escapeHtml(match.team2)}</span>
                </div>
            </div>
            <div class="match-footer" style="flex-direction: column; gap: 8px; align-items: center; width: 100%;">
                ${isDisabled ? 
                    `<span class="text-muted" style="color: var(--color-yellow) !important;"><i class="fa-solid fa-lock"></i> ${lockReason}</span>` :
                    (isMatchClosedForBetting(match) ?
                        `<span class="text-muted" style="color: #ef4444 !important;"><i class="fa-solid fa-hourglass-end"></i> Apostas encerradas para este jogo</span>` :
                        (!isScoreEmpty(match.goals1) && !isScoreEmpty(match.goals2) ? 
                            `<span>Resultado Real: <strong class="text-green">${match.goals1} x ${match.goals2}</strong></span>` : 
                            `<span>Aguardando jogo</span>`)
                    )
                }
                ${champsHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

// Render Leaderboard in "Classificação" tab
function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const emptyState = document.getElementById('leaderboard-empty');
    const table = document.getElementById('leaderboard-table');
    tbody.innerHTML = '';
    
    // Update global sweepstakes pot in header
    updateTotalPot();
    
    // Fill match selector dropdown
    const select = document.getElementById('leaderboard-match-select');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '';
        
        matches.forEach(m => {
            // Hide locked matches (future games not yet open) from leaderboard selector
            if (isMatchLocked(m.id)) {
                return;
            }
            const opt = document.createElement('option');
            opt.value = m.id;
            const oppName = m.team1 === 'Brasil' ? m.team2 : m.team1;
            opt.textContent = `Brasil x ${oppName} (${m.desc})`;
            select.appendChild(opt);
        });
        
        // Restore selected value if valid, otherwise select default active
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        } else {
            select.value = getDefaultActiveMatchId();
        }
        
        if (!select.dataset.listenerAttached) {
            select.addEventListener('change', () => {
                renderLeaderboard();
            });
            select.dataset.listenerAttached = 'true';
        }
    }
    
    const selectedMatchId = select ? select.value : (matches.length > 0 ? matches[0].id : 'm1');
    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    
    if (participants.length === 0 || !selectedMatch) {
        emptyState.style.display = 'flex';
        table.style.display = 'none';
        document.getElementById('match-pot-value').textContent = 'R$ 0,00';
        document.getElementById('match-winners-value').textContent = 'Aguardando palpites...';
        return;
    }
    
    emptyState.style.display = 'none';
    table.style.display = 'table';
    
    // Calculate total pot for this specific match
    let matchBetsCount = 0;
    const matchParticipants = [];
    
    participants.forEach(p => {
        const pred = p.predictions[selectedMatchId];
        if (pred && !isScoreEmpty(pred.goals1) && !isScoreEmpty(pred.goals2)) {
            matchBetsCount++;
            
            // Calculate points for this match (1 = hit exact score, 0 = missed)
            let pts = 0;
            let criteria = 'Aguardando jogo';
            if (!isScoreEmpty(selectedMatch.goals1) && !isScoreEmpty(selectedMatch.goals2)) {
                pts = calculateMatchPoints(pred, selectedMatch);
                if (pts === 1) criteria = 'Acertou';
                else criteria = 'Errou';
            }
            
            matchParticipants.push({
                name: p.name,
                prediction: `${pred.goals1} x ${pred.goals2}`,
                points: pts,
                criteria: criteria,
                rawPred: pred
            });
        }
    });
    
    // Sort ranking: Points DESC -> name ASC
    matchParticipants.sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        return a.name.localeCompare(b.name);
    });
    
    const matchPot = matchBetsCount * 5;
    document.getElementById('match-pot-value').textContent = `R$ ${matchPot.toFixed(2).replace('.', ',')}`;
    
    // Determine winner(s) if match finished
    let winnersList = [];
    let maxPoints = -1;
    
    if (!isScoreEmpty(selectedMatch.goals1) && !isScoreEmpty(selectedMatch.goals2) && matchParticipants.length > 0) {
        maxPoints = matchParticipants[0].points;
        if (maxPoints > 0) {
            winnersList = matchParticipants.filter(p => p.points === maxPoints);
        }
    }
    
    if (isScoreEmpty(selectedMatch.goals1) || isScoreEmpty(selectedMatch.goals2)) {
        document.getElementById('match-winners-value').textContent = 'Partida não realizada';
    } else if (winnersList.length === 0) {
        document.getElementById('match-winners-value').textContent = 'Nenhum ganhador (todos erraram)';
    } else {
        const prizeEach = matchPot / winnersList.length;
        const winnerNames = winnersList.map(w => w.name).join(', ');
        document.getElementById('match-winners-value').textContent = `${winnerNames} - R$ ${prizeEach.toFixed(2).replace('.', ',')} cada`;
    }
    
    // Render table rows
    tbody.innerHTML = '';
    
    if (matchParticipants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 20px;">Nenhum palpite aprovado para este jogo.</td></tr>`;
        return;
    }
    
    matchParticipants.forEach((p, index) => {
        const rank = index + 1;
        let rankClass = 'rank-other';
        let rankContent = rank;
        
        if (rank === 1 && p.points > 0) {
            rankClass = 'rank-1';
            rankContent = '<i class="fa-solid fa-crown"></i>';
        } else if (rank === 2 && p.points > 0) {
            rankClass = 'rank-2';
        } else if (rank === 3 && p.points > 0) {
            rankClass = 'rank-3';
        }
        
        // Calculate prize display for each row
        let prizeDisplay = '-';
        if (winnersList.length > 0 && p.points === maxPoints) {
            const prizeEach = matchPot / winnersList.length;
            prizeDisplay = `<strong>R$ ${prizeEach.toFixed(2).replace('.', ',')}</strong>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank">
                <span class="rank-badge ${rankClass}">${rankContent}</span>
            </td>
            <td class="participant-name-cell" style="cursor: pointer; text-decoration: underline; text-underline-offset: 4px;" onclick="viewParticipantGuesses('${escapeHtml(p.name)}')">${escapeHtml(p.name)}</td>
            <td class="col-guess text-center">${escapeHtml(p.prediction)}</td>
            <td class="col-pts text-center ${p.points === 1 ? 'text-green font-weight-bold' : 'text-muted'}">${p.points}</td>
            <td class="col-prize text-center text-green">${prizeDisplay}</td>
            <td class="col-criteria text-center d-none-mobile ${p.points === 1 ? 'text-green font-weight-bold' : 'text-muted'}">${escapeHtml(p.criteria)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Matches in Admin results list
function renderAdminMatches() {
    const container = document.getElementById('admin-matches-list');
    container.innerHTML = '';
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum jogo cadastrado.</p>';
        return;
    }
    
    matches.forEach(match => {
        const row = document.createElement('div');
        row.className = 'match-admin-row';
        row.innerHTML = `
            <div class="match-admin-teams" style="display: flex; gap: 10px; align-items: center;">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <img src="https://flagcdn.com/w40/${match.flag1}.png" style="width: 24px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);" alt="">
                    ${escapeHtml(match.team1)}
                </span>
                <span>x</span>
                <span style="display: flex; align-items: center; gap: 8px;">
                    ${escapeHtml(match.team2)}
                    <img src="https://flagcdn.com/w40/${match.flag2}.png" style="width: 24px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);" alt="">
                </span>
            </div>
            <div class="match-admin-scores">
                <input type="number" min="0" class="input-score-admin" id="admin-${match.id}-goals1" value="${match.goals1 !== null && match.goals1 !== undefined ? match.goals1 : ''}" placeholder="-">
                <span>x</span>
                <input type="number" min="0" class="input-score-admin" id="admin-${match.id}-goals2" value="${match.goals2 !== null && match.goals2 !== undefined ? match.goals2 : ''}" placeholder="-">
            </div>
        `;
        container.appendChild(row);
    });
}

// Render Participants list in Admin panel
function renderAdminParticipants() {
    const container = document.getElementById('admin-participants-list');
    container.innerHTML = '';
    
    if (participants.length === 0) {
        container.innerHTML = `<li style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Nenhum participante ainda.</li>`;
        return;
    }
    
    participants.forEach(p => {
        const li = document.createElement('li');
        li.className = 'participant-admin-item';
        li.innerHTML = `
            <span class="participant-admin-info">${escapeHtml(p.name)}</span>
            <button class="btn-delete-participant" onclick="deleteParticipant('${escapeHtml(p.name)}')" title="Excluir Participante">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        container.appendChild(li);
    });
}

// Delete Participant
window.deleteParticipant = async function(name) {
    if (confirm(`Deseja realmente remover ${name} do bolão?`)) {
        if (API_URL) {
            showToast("Removendo participante no Sheets...");
            try {
                // Find participant's prediction keys to reject them
                const p = participants.find(p => p.name.toLowerCase() === name.toLowerCase());
                if (p) {
                    const matchIds = Object.keys(p.predictions);
                    for (const matchId of matchIds) {
                        await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'rejectPrediction',
                                name: p.name,
                                matchId: matchId
                            })
                        });
                    }
                }
                showToast(`Participante "${name}" removido.`);
                await fetchDatabase();
                renderLeaderboard();
                renderAdminParticipants();
                renderAdminPending();
            } catch (e) {
                console.error("Erro na API ao remover participante:", e);
                showToast("Erro ao conectar ao Sheets para remover participante.", true);
            }
        } else {
            participants = participants.filter(p => p.name !== name);
            localStorage.setItem('bolao_participants', JSON.stringify(participants));
            showToast(`[Offline] Participante "${name}" removido.`);
            renderLeaderboard();
            renderAdminParticipants();
        }
    }
};

// Render Pending Approvals list in Admin panel
function renderAdminPending() {
    const container = document.getElementById('admin-pending-list');
    container.innerHTML = '';
    
    if (pendingApprovals.length === 0) {
        container.innerHTML = `<li style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Nenhum pagamento pendente.</li>`;
        return;
    }
    
    pendingApprovals.forEach((p, idx) => {
        // Build readable guesses list
        const guessDetails = [];
        for (const [matchId, guess] of Object.entries(p.predictions)) {
            const match = matches.find(m => m.id === matchId);
            if (match) {
                guessDetails.push(`${getCountryEmoji(match.flag1)} ${match.team1} ${guess.goals1} x ${guess.goals2} ${match.team2} ${getCountryEmoji(match.flag2)}`);
            }
        }
        const guessStr = guessDetails.join(' | ');
        
        const li = document.createElement('li');
        li.className = 'participant-admin-item';
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        li.style.gap = '8px';
        li.style.padding = '12px 15px';
        
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span style="font-weight: 700; color: var(--color-yellow);">${escapeHtml(p.name)}</span>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-success" onclick="approvePending(${idx})" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; height: 32px;" title="Confirmar PIX e Salvar Palpite">
                        <i class="fa-solid fa-check"></i> Aprovar
                    </button>
                    <button class="btn btn-danger-outline" onclick="rejectPending(${idx})" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; height: 32px;" title="Rejeitar Palpite">
                        <i class="fa-solid fa-times"></i> Rejeitar
                    </button>
                </div>
            </div>
            <div class="text-muted" style="font-size: 0.8rem; line-height: 1.3; width: 100%; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 5px;">
                ${escapeHtml(guessStr)}
            </div>
        `;
        container.appendChild(li);
    });
}

// Approve Pending Bet (Admin confirmed PIX)
window.approvePending = async function(idx) {
    const item = pendingApprovals[idx];
    if (!item) return;
    
    if (API_URL) {
        showToast("Processando aprovação no Sheets...");
        try {
            // Approve each prediction in the pending set
            const matchIds = Object.keys(item.predictions);
            for (const matchId of matchIds) {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'approvePrediction',
                        name: item.name,
                        matchId: matchId
                    })
                });
                const res = await response.json();
                if (!res.success) {
                    showToast(res.error || "Erro ao aprovar palpite", true);
                    return;
                }
            }
            showToast(`Palpites de "${item.name}" confirmados!`);
            await fetchDatabase();
            renderLeaderboard();
            renderAdminParticipants();
            renderAdminPending();
        } catch (e) {
            console.error("Erro na API ao aprovar:", e);
            showToast("Erro ao conectar ao Sheets para aprovar.", true);
        }
    } else {
        // Merge predictions into official participants list
        const existingIndex = participants.findIndex(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (existingIndex > -1) {
            participants[existingIndex].predictions = {
                ...participants[existingIndex].predictions,
                ...item.predictions
            };
            participants[existingIndex].name = item.name;
        } else {
            participants.push(item);
        }
        
        // Remove from pending list
        pendingApprovals.splice(idx, 1);
        
        // Save to localStorage
        localStorage.setItem('bolao_participants', JSON.stringify(participants));
        localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
        
        showToast(`[Offline] Palpites de "${item.name}" confirmados!`);
        renderLeaderboard();
        renderAdminParticipants();
        renderAdminPending();
    }
};

// Reject Pending Bet
window.rejectPending = async function(idx) {
    const item = pendingApprovals[idx];
    if (!item) return;
    
    if (confirm(`Deseja realmente rejeitar os palpites de "${item.name}"?`)) {
        if (API_URL) {
            showToast("Rejeitando palpite no Sheets...");
            try {
                const matchIds = Object.keys(item.predictions);
                for (const matchId of matchIds) {
                    await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'rejectPrediction',
                            name: item.name,
                            matchId: matchId
                        })
                    });
                }
                showToast(`Palpites de "${item.name}" rejeitados.`);
                await fetchDatabase();
                renderLeaderboard();
                renderAdminParticipants();
                renderAdminPending();
            } catch (e) {
                console.error("Erro na API ao rejeitar:", e);
                showToast("Erro ao conectar ao Sheets para rejeitar.", true);
            }
        } else {
            pendingApprovals.splice(idx, 1);
            localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
            showToast(`[Offline] Palpites de "${item.name}" rejeitados.`);
            renderAdminPending();
        }
    }
};

// Open Participant Predictions Modal
window.viewParticipantGuesses = function(name) {
    const participant = participants.find(p => p.name === name);
    if (!participant) return;
    
    const modal = document.getElementById('predictions-modal');
    const modalTitle = document.getElementById('modal-user-name');
    const modalBody = document.getElementById('modal-predictions-body');
    
    modalTitle.innerHTML = `Palpites de <span class="text-yellow">${escapeHtml(name)}</span>`;
    modalBody.innerHTML = '';
    
    matches.forEach(match => {
        const pred = participant.predictions[match.id];
        const hasPred = pred && pred.goals1 !== '' && pred.goals2 !== '' && pred.goals1 !== null && pred.goals2 !== null && pred.goals1 !== undefined && pred.goals2 !== undefined;
        const guessStr = hasPred ? `${pred.goals1} x ${pred.goals2}` : 'Sem palpite';
        
        let resultLabel = '';
        let guessClass = 'guess-wrong';
        
        if (hasPred && match.goals1 !== null && match.goals2 !== null) {
            const hit = calculateMatchPoints(pred, match) === 1;
            guessClass = hit ? 'guess-correct' : 'guess-wrong';
            resultLabel = hit ? 'Acertou' : 'Errou';
        }
        
        const row = document.createElement('div');
        row.className = 'modal-match-row';
        row.innerHTML = `
            <div class="modal-match-team-flags" style="display: flex; gap: 6px; align-items: center;">
                <img src="https://flagcdn.com/w40/${match.flag1}.png" style="width: 24px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);" alt="">
                <span style="font-size: 0.75rem; color: var(--text-muted);">x</span>
                <img src="https://flagcdn.com/w40/${match.flag2}.png" style="width: 24px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);" alt="">
            </div>
            <div class="modal-match-teams-info">
                <div style="font-weight: 700;">${escapeHtml(match.team1)} x ${escapeHtml(match.team2)}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(match.desc)}</div>
            </div>
            <div class="modal-match-guess ${guessClass}">${guessStr}</div>
            ${match.goals1 !== null && match.goals2 !== null ? `
                <div class="modal-match-points ${guessClass}" style="padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; text-align: center; width: 75px; text-transform: uppercase;">${resultLabel}</div>
            ` : ''}
        `;
        modalBody.appendChild(row);
    });
    
    modal.classList.add('active');
};

// Parse WhatsApp messages containing the specialized code
function parseWhatsAppMessage(text) {
    // Expected structure: BOLAO2026:Name|m1:2-1|m2:4-0...
    const nameMatch = text.match(/BOLAO2026:([^|\r\n]+)/);
    if (!nameMatch) return null;
    
    const name = nameMatch[1].trim();
    const predictions = {};
    
    // Regex matches the match pattern (m1:2-1)
    const regex = /(m\d+):(\d+)-(\d+)/g;
    let match;
    let count = 0;
    
    while ((match = regex.exec(text)) !== null) {
        const matchId = match[1];
        const goals1 = parseInt(match[2]);
        const goals2 = parseInt(match[3]);
        predictions[matchId] = { goals1, goals2 };
        count++;
    }
    
    if (count === 0) return null;
    
    return { name, predictions };
}

// Countdown timer to the next match
function updateCountdown() {
    const now = new Date();
    
    const upcoming = matches
        .filter(m => isScoreEmpty(m.goals1) && isScoreEmpty(m.goals2))
        .map(m => ({ ...m, dateObj: new Date(m.date) }))
        .filter(m => m.dateObj > now)
        .sort((a, b) => a.dateObj - b.dateObj);
        
    const badge = document.getElementById('countdown-badge');
    const text = document.getElementById('countdown-text');
    
    if (upcoming.length === 0) {
        badge.style.display = 'none';
        return;
    }
    
    badge.style.display = 'flex';
    const nextMatch = upcoming[0];
    const diff = nextMatch.dateObj - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    let countdownStr = '';
    if (days > 0) {
        countdownStr = `${days}d ${hours}h para`;
    } else if (hours > 0) {
        countdownStr = `${hours}h ${minutes}m para`;
    } else {
        countdownStr = `${minutes}m ${seconds}s para`;
    }
    
    const flag1Url = `https://flagcdn.com/w40/${nextMatch.flag1}.png`;
    const flag2Url = `https://flagcdn.com/w40/${nextMatch.flag2}.png`;
    
    badge.innerHTML = `
        <span class="pulse-dot"></span>
        <span id="countdown-text" style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; font-size: 0.85rem; font-weight: 600;">
            ${countdownStr}
            <img src="${flag1Url}" style="width: 20px; height: 13px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.15); object-fit: cover;" alt="">
            vs
            <img src="${flag2Url}" style="width: 20px; height: 13px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.15); object-fit: cover;" alt="">
        </span>
    `;
}

// Event Listeners setup
function setupEventListeners() {
    // 1. Tab Switching
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Re-render corresponding tabs
            if (targetTab === 'tab-leaderboard') {
                renderLeaderboard();
            } else if (targetTab === 'tab-admin') {
                renderAdminMatches();
                renderAdminParticipants();
                renderAdminPending();
            } else if (targetTab === 'tab-predictions') {
                renderPredictions();
            }
        });
    });

    // Copy PIX Key
    document.getElementById('btn-copy-pix').addEventListener('click', () => {
        const pixKey = document.getElementById('pix-key').textContent;
        navigator.clipboard.writeText(pixKey).then(() => {
            showToast('Chave PIX copiada com sucesso! 🇧🇷');
        }).catch(err => {
            console.error('Falha ao copiar PIX:', err);
            showToast('Falha ao copiar. Selecione e copie o código manualmente.', true);
        });
    });

    // 2. Save My Guesses (and submit to Sheets API + redirect to WhatsApp)
    document.getElementById('btn-save-my-guesses').addEventListener('click', async () => {
        const nameInput = document.getElementById('participant-name').value.trim();
        if (!nameInput) {
            showToast('Por favor, digite seu nome primeiro.', true);
            return;
        }
        
        // Prevent duplicate names for the active match (pending or approved)
        let activeMatch = matches.find(m => (isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2)) && !isMatchClosedForBetting(m));
        if (!activeMatch) {
            activeMatch = matches.find(m => isScoreEmpty(m.goals1) || isScoreEmpty(m.goals2));
        }
        if (activeMatch) {
            const hasApproved = participants.some(p => 
                p.name.toLowerCase() === nameInput.toLowerCase() && 
                p.predictions[activeMatch.id] !== undefined &&
                p.predictions[activeMatch.id].goals1 !== null &&
                p.predictions[activeMatch.id].goals1 !== undefined &&
                p.predictions[activeMatch.id].goals1 !== ''
            );
            
            const hasPending = pendingApprovals.some(p => 
                p.name.toLowerCase() === nameInput.toLowerCase() && 
                p.predictions[activeMatch.id] !== undefined &&
                p.predictions[activeMatch.id].goals1 !== null &&
                p.predictions[activeMatch.id].goals1 !== undefined &&
                p.predictions[activeMatch.id].goals1 !== ''
            );
            
            if (hasApproved) {
                showToast(`O nome "${nameInput}" já possui um palpite CONFIRMADO para este jogo.`, true);
                return;
            }
            if (hasPending) {
                showToast(`O nome "${nameInput}" já possui um palpite ENVIADO (aguardando PIX) para este jogo.`, true);
                return;
            }
        }
        
        const guesses = {};
        const activeGuessesList = [];
        const codeParts = [];
        let hasNewGuesses = false;
        
        matches.forEach(match => {
            if (isMatchLocked(match.id) || isMatchClosedForBetting(match) || (!isScoreEmpty(match.goals1) && !isScoreEmpty(match.goals2))) {
                // Keep existing predictions for locked/closed/finished matches
                if (myPredictions[match.id]) {
                    guesses[match.id] = myPredictions[match.id];
                }
                return;
            }
            
            const g1 = document.getElementById(`guess-${match.id}-goals1`).value;
            const g2 = document.getElementById(`guess-${match.id}-goals2`).value;
            
            if (g1 !== '' && g2 !== '') {
                const goals1 = parseInt(g1);
                const goals2 = parseInt(g2);
                guesses[match.id] = { goals1, goals2 };
                activeGuessesList.push(`⚽ ${getCountryEmoji(match.flag1)} *${match.team1} ${goals1} x ${goals2} ${match.team2}* ${getCountryEmoji(match.flag2)}`);
                codeParts.push(`${match.id}:${goals1}-${goals2}`);
                hasNewGuesses = true;
            } else {
                guesses[match.id] = { goals1: null, goals2: null };
            }
        });
        
        if (!hasNewGuesses) {
            showToast('Por favor, insira o seu palpite para o jogo ativo.', true);
            return;
        }
        
        myName = nameInput;
        myPredictions = guesses;
        localStorage.setItem('bolao_my_name', myName);
        localStorage.setItem('bolao_my_predictions', JSON.stringify(myPredictions));
        
        // Send to sheets API if API_URL is set
        if (API_URL) {
            showToast("Enviando palpites para o Google Sheets...");
            try {
                // Submit predictions for each active match
                const matchIds = Object.keys(guesses).filter(mId => {
                    const m = matches.find(match => match.id === mId);
                    return m && !isMatchLocked(mId) && !isMatchClosedForBetting(m) && isScoreEmpty(m.goals1) && isScoreEmpty(m.goals2);
                });
                
                for (const mId of matchIds) {
                    const g = guesses[mId];
                    if (!isScoreEmpty(g.goals1) && !isScoreEmpty(g.goals2)) {
                        const response = await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'submitPrediction',
                                name: myName,
                                matchId: mId,
                                goals1: g.goals1,
                                goals2: g.goals2
                            })
                        });
                        const res = await response.json();
                        if (!res.success) {
                            showToast(res.error || "Erro ao salvar palpite no Sheets.", true);
                            return;
                        }
                    }
                }
                showToast("Palpites salvos como pendentes! Redirecionando para o WhatsApp...");
            } catch (e) {
                console.error("Erro na API ao salvar palpites:", e);
                showToast("Erro ao conectar ao servidor. Redirecionando para o WhatsApp...", true);
            }
        } else {
            // Offline mockup fallback: save to pendingApprovals locally
            const parsedPreds = {};
            Object.keys(guesses).forEach(mId => {
                const g = guesses[mId];
                const m = matches.find(match => match.id === mId);
                if (m && !isMatchLocked(mId) && !isMatchClosedForBetting(m) && isScoreEmpty(m.goals1) && isScoreEmpty(m.goals2) && !isScoreEmpty(g.goals1) && !isScoreEmpty(g.goals2)) {
                    parsedPreds[mId] = g;
                }
            });
            
            const existingPendingIdx = pendingApprovals.findIndex(p => p.name.toLowerCase() === myName.toLowerCase());
            if (existingPendingIdx > -1) {
                pendingApprovals[existingPendingIdx].predictions = {
                    ...pendingApprovals[existingPendingIdx].predictions,
                    ...parsedPreds
                };
            } else {
                pendingApprovals.push({ name: myName, predictions: parsedPreds });
            }
            localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
            showToast("[Offline] Palpites salvos localmente! Redirecionando para o WhatsApp...");
        }
        
        // Automatically build WhatsApp text and open it to Cabello (+5511988902522)
        const formattedDate = new Date().toLocaleDateString('pt-BR');
        let message = `🇧🇷 *Bolão Copa 2026 - Palpite de Jogo* 🇧🇷\n`;
        message += `👤 *Participante:* ${myName}\n`;
        message += `💵 *Aposta:* R$ 5,00 (PIX a confirmar)\n`;
        message += `📅 *Data:* ${formattedDate}\n\n`;
        message += activeGuessesList.join('\n') + `\n\n`;
        message += `Enviando comprovante do PIX anexado a esta mensagem.`;
        
        const url = `https://wa.me/5511988902522?text=${encodeURIComponent(message)}`;
        
        // Copy to clipboard in a fire-and-forget manner if supported
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message).catch(err => {
                console.warn('Clipboard write skipped/failed:', err);
            });
        }
        
        // Direct redirect to avoid iOS Safari popup blocker
        window.location.href = url;
    });

    // 3. Admin Save Results
    document.getElementById('btn-save-results').addEventListener('click', async () => {
        let changed = false;
        const updatedMatches = [];
        
        matches.forEach(match => {
            const g1Input = document.getElementById(`admin-${match.id}-goals1`).value;
            const g2Input = document.getElementById(`admin-${match.id}-goals2`).value;
            
            const g1 = g1Input !== '' ? parseInt(g1Input) : null;
            const g2 = g2Input !== '' ? parseInt(g2Input) : null;
            
            if (match.goals1 !== g1 || match.goals2 !== g2) {
                match.goals1 = g1;
                match.goals2 = g2;
                changed = true;
            }
            updatedMatches.push({
                id: match.id,
                goals1: g1,
                goals2: g2
            });
        });
        
        if (changed) {
            if (API_URL) {
                showToast("Salvando resultados oficiais no Sheets...");
                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'saveResults',
                            matches: updatedMatches
                        })
                    });
                    const res = await response.json();
                    if (res.success) {
                        showToast('Resultados oficiais salvos no Sheets e classificação atualizada! ⚽');
                        await fetchDatabase();
                        renderLeaderboard();
                        renderPredictions();
                    } else {
                        showToast(res.error || "Erro ao salvar resultados.", true);
                    }
                } catch (e) {
                    console.error("Erro na API ao salvar resultados:", e);
                    showToast("Erro ao conectar ao servidor para salvar resultados.", true);
                }
            } else {
                localStorage.setItem('bolao_matches', JSON.stringify(matches));
                renderLeaderboard();
                renderPredictions();
                showToast('[Offline] Resultados oficiais salvos e classificação atualizada! ⚽');
            }
        } else {
            showToast('Nenhum resultado foi alterado.');
        }
    });

    // 4. Admin Import WhatsApp Guesses
    document.getElementById('btn-import-whatsapp').addEventListener('click', async () => {
        const text = document.getElementById('import-whatsapp-text').value.trim();
        if (!text) {
            showToast('Por favor, cole a mensagem do WhatsApp.', true);
            return;
        }
        
        const parsed = parseWhatsAppMessage(text);
        if (!parsed) {
            showToast('Mensagem inválida. Certifique-se de copiar todo o texto, incluindo o código no final.', true);
            return;
        }
        
        if (API_URL) {
            showToast("Enviando palpite importado para o Sheets...");
            try {
                // Submit each prediction to Sheets as pending
                const matchIds = Object.keys(parsed.predictions);
                for (const matchId of matchIds) {
                    const g = parsed.predictions[matchId];
                    await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'submitPrediction',
                            name: parsed.name,
                            matchId: matchId,
                            goals1: g.goals1,
                            goals2: g.goals2
                        })
                    });
                }
                showToast(`Palpites de "${parsed.name}" importados como pendentes!`);
                document.getElementById('import-whatsapp-text').value = '';
                await fetchDatabase();
                renderAdminPending();
            } catch (e) {
                console.error("Erro ao importar palpite:", e);
                showToast("Erro ao conectar ao servidor para importar palpites.", true);
            }
        } else {
            // Put in pending approvals list for PIX verification
            const existingPendingIdx = pendingApprovals.findIndex(p => p.name.toLowerCase() === parsed.name.toLowerCase());
            if (existingPendingIdx > -1) {
                pendingApprovals[existingPendingIdx].predictions = {
                    ...pendingApprovals[existingPendingIdx].predictions,
                    ...parsed.predictions
                };
                pendingApprovals[existingPendingIdx].name = parsed.name;
            } else {
                pendingApprovals.push(parsed);
            }
            localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
            document.getElementById('import-whatsapp-text').value = '';
            renderAdminPending();
            showToast(`[Offline] Palpites de "${parsed.name}" importados!`);
        }
    });

    // 5. Admin Add Custom Match
    document.getElementById('btn-add-match').addEventListener('click', async () => {
        const opp = document.getElementById('new-opponent').value.trim();
        const flag = document.getElementById('new-opponent-flag').value.trim().toLowerCase() || 'un';
        const dateVal = document.getElementById('new-match-date').value;
        const phase = document.getElementById('new-match-phase').value.trim() || 'Jogo do Brasil';
        const pos = document.getElementById('new-brazil-pos').value;
        
        if (!opp) {
            showToast('Por favor, digite o nome do adversário.', true);
            return;
        }
        if (!dateVal) {
            showToast('Por favor, selecione a data e hora do jogo.', true);
            return;
        }
        
        // Generate ID
        const nextNum = matches.length + 1;
        const newId = `m${nextNum}`;
        
        const team1 = pos === '1' ? 'Brasil' : opp;
        const flag1 = pos === '1' ? 'br' : flag;
        const team2 = pos === '2' ? 'Brasil' : opp;
        const flag2 = pos === '2' ? 'br' : flag;
        
        const newMatch = {
            id: newId,
            team1,
            flag1,
            team2,
            flag2,
            date: new Date(dateVal).toISOString(),
            desc: phase,
            goals1: null,
            goals2: null
        };
        
        if (API_URL) {
            showToast("Criando novo jogo no Sheets...");
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'addMatch',
                        match: newMatch
                    })
                });
                const res = await response.json();
                if (res.success) {
                    showToast('Novo jogo do Brasil cadastrado com sucesso!');
                    await fetchDatabase();
                    renderPredictions();
                    renderAdminMatches();
                    renderLeaderboard();
                    
                    // Reset Inputs
                    document.getElementById('new-opponent').value = '';
                    document.getElementById('new-opponent-flag').value = '';
                    document.getElementById('new-match-date').value = '';
                    document.getElementById('new-match-phase').value = '';
                } else {
                    showToast(res.error || "Erro ao cadastrar novo jogo.", true);
                }
            } catch (e) {
                console.error("Erro na API ao criar jogo:", e);
                showToast("Erro ao conectar ao servidor para criar jogo.", true);
            }
        } else {
            matches.push(newMatch);
            localStorage.setItem('bolao_matches', JSON.stringify(matches));
            
            // Reset Inputs
            document.getElementById('new-opponent').value = '';
            document.getElementById('new-opponent-flag').value = '';
            document.getElementById('new-match-date').value = '';
            document.getElementById('new-match-phase').value = '';
            
            renderPredictions();
            renderAdminMatches();
            renderLeaderboard();
            showToast('[Offline] Novo jogo do Brasil cadastrado!');
        }
    });

    // 6. Backup Export DB
    document.getElementById('btn-export-db').addEventListener('click', () => {
        const db = {
            matches,
            participants,
            pendingApprovals
        };
        
        const jsonStr = JSON.stringify(db, null, 2);
        
        navigator.clipboard.writeText(jsonStr).then(() => {
            showToast('Backup JSON copiado! Salve em um arquivo de texto.');
        }).catch(err => {
            console.error('Erro ao copiar backup:', err);
            document.getElementById('import-db-text').value = jsonStr;
            showToast('Falha ao copiar. O JSON foi inserido no campo abaixo, copie manualmente.', true);
        });
    });

    // 7. Backup Restore DB
    document.getElementById('btn-import-db').addEventListener('click', () => {
        const jsonStr = document.getElementById('import-db-text').value.trim();
        if (!jsonStr) {
            showToast('Por favor, cole o JSON de backup.', true);
            return;
        }
        
        try {
            const db = JSON.parse(jsonStr);
            if (db.matches && Array.isArray(db.matches) && db.participants && Array.isArray(db.participants)) {
                if (confirm('Atenção: Isso substituirá TODOS os dados atuais. Continuar?')) {
                    matches = db.matches;
                    participants = db.participants;
                    pendingApprovals = db.pendingApprovals || [];
                    
                    localStorage.setItem('bolao_matches', JSON.stringify(matches));
                    localStorage.setItem('bolao_participants', JSON.stringify(participants));
                    localStorage.setItem('bolao_pending_approvals', JSON.stringify(pendingApprovals));
                    
                    document.getElementById('import-db-text').value = '';
                    
                    renderPredictions();
                    renderAdminMatches();
                    renderLeaderboard();
                    renderAdminParticipants();
                    renderAdminPending();
                    
                    showToast('Backup carregado com sucesso!');
                }
            } else {
                showToast('JSON inválido. Deve conter propriedades "matches" e "participants".', true);
            }
        } catch (e) {
            showToast('Erro ao processar o JSON. Certifique-se de que copiou todo o texto.', true);
        }
    });

    // 8. Clear Database
    document.getElementById('btn-clear-db').addEventListener('click', async () => {
        if (confirm('ATENÇÃO: Você irá excluir todos os participantes e resetar os jogos do Brasil para o padrão. Deseja prosseguir?')) {
            if (API_URL) {
                showToast("Resetando banco de dados no Sheets...");
                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'resetDb'
                        })
                    });
                    const res = await response.json();
                    if (res.success) {
                        showToast('Banco de dados do Google Sheets redefinido com sucesso!');
                        await fetchDatabase();
                        renderPredictions();
                        renderAdminMatches();
                        renderLeaderboard();
                        renderAdminParticipants();
                        renderAdminPending();
                    } else {
                        showToast(res.error || "Erro ao redefinir banco de dados.", true);
                    }
                } catch (e) {
                    console.error("Erro na API ao resetar banco:", e);
                    showToast("Erro ao conectar ao servidor para resetar banco de dados.", true);
                }
            } else {
                localStorage.clear();
                
                matches = [...DEFAULT_MATCHES];
                participants = [];
                pendingApprovals = [];
                myPredictions = {};
                myName = '';
                
                localStorage.setItem('bolao_matches', JSON.stringify(matches));
                document.getElementById('participant-name').value = '';
                
                renderPredictions();
                renderAdminMatches();
                renderLeaderboard();
                renderAdminParticipants();
                renderAdminPending();
                
                showToast('Banco de dados local redefinido.');
            }
        }
    });

    // 9. Close Modal
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('predictions-modal').classList.remove('active');
    });

    window.addEventListener('click', (event) => {
        const modal = document.getElementById('predictions-modal');
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Start Timer
setInterval(updateCountdown, 1000);

// Load and Render on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
    initData();
    setupEventListeners();
    
    // Initial renders from local storage cache
    renderPredictions();
    renderLeaderboard();
    updateCountdown();
    
    // Show or hide Admin Nav Tab based on ?admin=true parameter
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === 'true';
    const adminTabButton = document.querySelector('[data-tab="tab-admin"]');
    if (adminTabButton) {
        if (isAdmin) {
            adminTabButton.style.display = 'flex';
        } else {
            adminTabButton.style.display = 'none';
        }
    }
    
    // Sincronizar com banco de dados remoto se a API_URL estiver definida
    if (API_URL) {
        showToast("Sincronizando com o Google Sheets...");
        await fetchDatabase();
        
        renderPredictions();
        renderLeaderboard();
        updateCountdown();
        
        if (isAdmin) {
            renderAdminMatches();
            renderAdminParticipants();
            renderAdminPending();
        }
    }
});
