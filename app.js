// Default Group Stage Matches for Brazil in 2026 World Cup
const DEFAULT_MATCHES = [
    {
        id: 'm1',
        team1: 'Brasil',
        flag1: '🇧🇷',
        team2: 'Marrocos',
        flag2: '🇲🇦',
        date: '2026-06-13T19:00:00-03:00', // June 13, 2026, 7:00 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: null,
        goals2: null
    },
    {
        id: 'm2',
        team1: 'Brasil',
        flag1: '🇧🇷',
        team2: 'Haiti',
        flag2: '🇭🇹',
        date: '2026-06-19T22:00:00-03:00', // June 19, 2026, 10:00 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: null,
        goals2: null
    },
    {
        id: 'm3',
        team1: 'Escócia',
        flag1: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        team2: 'Brasil',
        flag2: '🇧🇷',
        date: '2026-06-24T19:00:00-03:00', // June 24, 2026, 7:00 PM BRT
        desc: 'Fase de Grupos - Grupo C',
        goals1: null,
        goals2: null
    }
];

// App State
let matches = [];
let participants = [];
let myPredictions = {};
let myName = '';

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

// Initialize Application Data
function initData() {
    // 1. Matches
    const savedMatches = localStorage.getItem('bolao_matches');
    if (savedMatches) {
        try {
            matches = JSON.parse(savedMatches);
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

    // 4. User Name
    myName = localStorage.getItem('bolao_my_name') || '';
    if (myName) {
        document.getElementById('participant-name').value = myName;
    }
}

// Calculate Points for a prediction compared to official result
function calculateMatchPoints(prediction, official) {
    if (prediction.goals1 === null || prediction.goals2 === null || 
        official.goals1 === null || official.goals2 === null ||
        prediction.goals1 === undefined || prediction.goals2 === undefined) {
        return 0;
    }
    
    const p1 = parseInt(prediction.goals1);
    const p2 = parseInt(prediction.goals2);
    const o1 = parseInt(official.goals1);
    const o2 = parseInt(official.goals2);
    
    if (isNaN(p1) || isNaN(p2) || isNaN(o1) || isNaN(o2)) {
        return 0;
    }
    
    // 1. Placar Exato (Exact score): 25 pts
    if (p1 === o1 && p2 === o2) {
        return 25;
    }
    
    // Determine winner/draw outcome
    const pWinner = p1 > p2 ? 1 : (p1 < p2 ? 2 : 0);
    const oWinner = o1 > o2 ? 1 : (o1 < o2 ? 2 : 0);
    
    // If winner is wrong, outcome is wrong -> 0 points
    if (pWinner !== oWinner) {
        return 0;
    }
    
    // If we reach here, outcome is correct
    
    // 2. Empate Diferente (Correct draw but wrong score): 15 pts
    if (oWinner === 0) {
        return 15;
    }
    
    // 3. Vencedor e Saldo (Correct winner and goal difference): 18 pts
    const pDiff = p1 - p2;
    const oDiff = o1 - o2;
    if (pDiff === oDiff) {
        return 18;
    }
    
    // 4. Apenas Vencedor (Correct winner only): 12 pts
    return 12;
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

// Render Predictions list in "Palpitar" tab
function renderPredictions() {
    const container = document.getElementById('predictions-matches');
    container.innerHTML = '';
    
    if (matches.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum jogo cadastrado.</p></div>';
        return;
    }
    
    matches.forEach(match => {
        const prediction = myPredictions[match.id] || { goals1: '', goals2: '' };
        const matchDate = new Date(match.date);
        const formattedDate = matchDate.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const card = document.createElement('div');
        card.className = 'card match-card';
        card.innerHTML = `
            <div class="match-card-header">
                <span class="match-num">${escapeHtml(match.desc)}</span>
                <span class="match-datetime"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
            </div>
            <div class="match-body">
                <div class="team">
                    <span class="team-flag">${match.flag1}</span>
                    <span class="team-name">${escapeHtml(match.team1)}</span>
                </div>
                <div class="score-vs">
                    <input type="number" min="0" class="input-score" id="guess-${match.id}-goals1" value="${prediction.goals1 !== undefined && prediction.goals1 !== null ? prediction.goals1 : ''}" placeholder="-">
                    <span class="vs-divider">x</span>
                    <input type="number" min="0" class="input-score" id="guess-${match.id}-goals2" value="${prediction.goals2 !== undefined && prediction.goals2 !== null ? prediction.goals2 : ''}" placeholder="-">
                </div>
                <div class="team">
                    <span class="team-flag">${match.flag2}</span>
                    <span class="team-name">${escapeHtml(match.team2)}</span>
                </div>
            </div>
            <div class="match-footer">
                ${match.goals1 !== null && match.goals2 !== null ? 
                    `<span>Resultado Real: <strong class="text-green">${match.goals1} x ${match.goals2}</strong></span>` : 
                    `<span>Aguardando jogo</span>`}
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
    
    if (participants.length === 0) {
        emptyState.style.display = 'flex';
        table.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    table.style.display = 'table';
    
    // Enrich participants with calculated stats
    const enrichedParticipants = participants.map(p => {
        const stats = getParticipantStats(p);
        return {
            ...p,
            ...stats
        };
    });
    
    // Sort ranking: Points DESC -> Exact DESC -> Saldo DESC -> Draw DESC -> Alphabetical ASC
    enrichedParticipants.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        if (b.count25 !== a.count25) {
            return b.count25 - a.count25;
        }
        if (b.count18 !== a.count18) {
            return b.count18 - a.count18;
        }
        if (b.count15 !== a.count15) {
            return b.count15 - a.count15;
        }
        return a.name.localeCompare(b.name);
    });
    
    enrichedParticipants.forEach((p, index) => {
        const rank = index + 1;
        let rankClass = 'rank-other';
        let rankContent = rank;
        
        if (rank === 1) {
            rankClass = 'rank-1';
            rankContent = '<i class="fa-solid fa-crown"></i>';
        } else if (rank === 2) {
            rankClass = 'rank-2';
        } else if (rank === 3) {
            rankClass = 'rank-3';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank">
                <span class="rank-badge ${rankClass}">${rankContent}</span>
            </td>
            <td class="participant-name-cell">${escapeHtml(p.name)}</td>
            <td class="col-pts text-center text-yellow">${p.totalPoints}</td>
            <td class="col-stats text-center d-none-mobile">${p.count25}</td>
            <td class="col-stats text-center d-none-mobile">${p.count18}</td>
            <td class="col-stats text-center d-none-mobile">${p.count12 + p.count15}</td>
            <td class="col-details text-center">
                <button class="btn-icon" onclick="viewParticipantGuesses('${escapeHtml(p.name)}')">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
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
            <div class="match-admin-teams">
                <span>${match.flag1} ${escapeHtml(match.team1)}</span>
                <span>x</span>
                <span>${escapeHtml(match.team2)} ${match.flag2}</span>
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
window.deleteParticipant = function(name) {
    if (confirm(`Deseja realmente remover ${name} do bolão?`)) {
        participants = participants.filter(p => p.name !== name);
        localStorage.setItem('bolao_participants', JSON.stringify(participants));
        renderLeaderboard();
        renderAdminParticipants();
        showToast(`Participante "${name}" removido.`);
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
        
        let matchPts = 0;
        let guessClass = 'guess-wrong';
        let ptsClass = 'points-0';
        
        if (hasPred && match.goals1 !== null && match.goals2 !== null) {
            matchPts = calculateMatchPoints(pred, match);
            guessClass = matchPts > 0 ? 'guess-correct' : 'guess-wrong';
            ptsClass = `points-${matchPts}`;
        }
        
        const row = document.createElement('div');
        row.className = 'modal-match-row';
        row.innerHTML = `
            <div class="modal-match-team-flags">${match.flag1} vs ${match.flag2}</div>
            <div class="modal-match-teams-info">
                <div style="font-weight: 700;">${escapeHtml(match.team1)} x ${escapeHtml(match.team2)}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(match.desc)}</div>
            </div>
            <div class="modal-match-guess ${guessClass}">${guessStr}</div>
            ${match.goals1 !== null && match.goals2 !== null ? `
                <div class="modal-match-points ${ptsClass}">${matchPts} pts</div>
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
        .filter(m => m.goals1 === null && m.goals2 === null)
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
    const opp = nextMatch.team1 === 'Brasil' ? nextMatch.team2 : nextMatch.team1;
    const oppFlag = nextMatch.team1 === 'Brasil' ? nextMatch.flag2 : nextMatch.flag1;
    
    if (days > 0) {
        countdownStr = `${days}d ${hours}h para Brasil vs ${opp} ${oppFlag}`;
    } else if (hours > 0) {
        countdownStr = `${hours}h ${minutes}m para Brasil vs ${opp} ${oppFlag}`;
    } else {
        countdownStr = `${minutes}m ${seconds}s para Brasil vs ${opp} ${oppFlag}`;
    }
    
    text.textContent = countdownStr;
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
            } else if (targetTab === 'tab-predictions') {
                renderPredictions();
            }
        });
    });

    // 2. Save My Guesses locally
    document.getElementById('btn-save-my-guesses').addEventListener('click', () => {
        const nameInput = document.getElementById('participant-name').value.trim();
        if (!nameInput) {
            showToast('Por favor, digite seu nome primeiro.', true);
            return;
        }
        
        const guesses = {};
        let hasGuesses = false;
        
        matches.forEach(match => {
            const g1 = document.getElementById(`guess-${match.id}-goals1`).value;
            const g2 = document.getElementById(`guess-${match.id}-goals2`).value;
            
            if (g1 !== '' && g2 !== '') {
                guesses[match.id] = { goals1: parseInt(g1), goals2: parseInt(g2) };
                hasGuesses = true;
            } else {
                guesses[match.id] = { goals1: null, goals2: null };
            }
        });
        
        if (!hasGuesses) {
            showToast('Por favor, insira pelo menos um palpite.', true);
            return;
        }
        
        myName = nameInput;
        myPredictions = guesses;
        
        localStorage.setItem('bolao_my_name', myName);
        localStorage.setItem('bolao_my_predictions', JSON.stringify(myPredictions));
        
        showToast('Palpites salvos localmente com sucesso! 🇧🇷');
    });

    // 3. Share guesses to WhatsApp
    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
        const nameInput = document.getElementById('participant-name').value.trim();
        if (!nameInput) {
            showToast('Por favor, digite seu nome primeiro.', true);
            return;
        }
        
        const guesses = [];
        const codeParts = [];
        let hasGuesses = false;
        
        matches.forEach(match => {
            const g1 = document.getElementById(`guess-${match.id}-goals1`).value;
            const g2 = document.getElementById(`guess-${match.id}-goals2`).value;
            
            if (g1 !== '' && g2 !== '') {
                const goals1 = parseInt(g1);
                const goals2 = parseInt(g2);
                guesses.push(`⚽ *${match.team1} ${goals1} x ${goals2} ${match.team2}*`);
                codeParts.push(`${match.id}:${goals1}-${goals2}`);
                hasGuesses = true;
            }
        });
        
        if (!hasGuesses) {
            showToast('Por favor, insira pelo menos um palpite.', true);
            return;
        }
        
        const formattedDate = new Date().toLocaleDateString('pt-BR');
        
        let message = `🇧🇷 *Bolão Copa 2026 - Jogos do Brasil* 🇧🇷\n`;
        message += `👤 *Participante:* ${nameInput}\n`;
        message += `📅 *Data:* ${formattedDate}\n\n`;
        message += guesses.join('\n') + `\n\n`;
        message += `--- Código de Importação (não altere) ---\n`;
        message += `BOLAO2026:${nameInput}|${codeParts.join('|')}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(message).then(() => {
            showToast('Texto de palpites copiado! Redirecionando para o WhatsApp...');
            
            // Open WhatsApp
            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            setTimeout(() => {
                window.open(url, '_blank');
            }, 1000);
        }).catch(err => {
            console.error('Falha ao copiar:', err);
            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        });
    });

    // 4. Admin Save Results
    document.getElementById('btn-save-results').addEventListener('click', () => {
        let changed = false;
        
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
        });
        
        if (changed) {
            localStorage.setItem('bolao_matches', JSON.stringify(matches));
            renderLeaderboard();
            renderPredictions();
            showToast('Resultados oficiais salvos e classificação atualizada! ⚽');
        } else {
            showToast('Nenhum resultado foi alterado.');
        }
    });

    // 5. Admin Import WhatsApp Guesses
    document.getElementById('btn-import-whatsapp').addEventListener('click', () => {
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
        
        // Add or update participant
        const existingIndex = participants.findIndex(p => p.name.toLowerCase() === parsed.name.toLowerCase());
        
        if (existingIndex > -1) {
            // Merge predictions
            participants[existingIndex].predictions = {
                ...participants[existingIndex].predictions,
                ...parsed.predictions
            };
            participants[existingIndex].name = parsed.name; // Keep formatting
            showToast(`Palpites de "${parsed.name}" atualizados!`);
        } else {
            participants.push(parsed);
            showToast(`Participante "${parsed.name}" adicionado com sucesso!`);
        }
        
        localStorage.setItem('bolao_participants', JSON.stringify(participants));
        document.getElementById('import-whatsapp-text').value = '';
        
        renderLeaderboard();
        renderAdminParticipants();
    });

    // 6. Admin Add Custom Match
    document.getElementById('btn-add-match').addEventListener('click', () => {
        const opp = document.getElementById('new-opponent').value.trim();
        const flag = document.getElementById('new-opponent-flag').value.trim() || '🏳️';
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
        const flag1 = pos === '1' ? '🇧🇷' : flag;
        const team2 = pos === '2' ? 'Brasil' : opp;
        const flag2 = pos === '2' ? '🇧🇷' : flag;
        
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
        showToast('Novo jogo do Brasil cadastrado!');
    });

    // 7. Backup Export DB
    document.getElementById('btn-export-db').addEventListener('click', () => {
        const db = {
            matches,
            participants
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

    // 8. Backup Restore DB
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
                    
                    localStorage.setItem('bolao_matches', JSON.stringify(matches));
                    localStorage.setItem('bolao_participants', JSON.stringify(participants));
                    
                    document.getElementById('import-db-text').value = '';
                    
                    renderPredictions();
                    renderAdminMatches();
                    renderLeaderboard();
                    renderAdminParticipants();
                    
                    showToast('Backup carregado com sucesso!');
                }
            } else {
                showToast('JSON inválido. Deve conter propriedades "matches" e "participants".', true);
            }
        } catch (e) {
            showToast('Erro ao processar o JSON. Certifique-se de que copiou todo o texto.', true);
        }
    });

    // 9. Clear Database
    document.getElementById('btn-clear-db').addEventListener('click', () => {
        if (confirm('ATENÇÃO: Você irá excluir todos os participantes e resetar os jogos do Brasil para o padrão. Deseja prosseguir?')) {
            localStorage.clear();
            
            matches = [...DEFAULT_MATCHES];
            participants = [];
            myPredictions = {};
            myName = '';
            
            localStorage.setItem('bolao_matches', JSON.stringify(matches));
            document.getElementById('participant-name').value = '';
            
            renderPredictions();
            renderAdminMatches();
            renderLeaderboard();
            renderAdminParticipants();
            
            showToast('Banco de dados redefinido.');
        }
    });

    // 10. Close Modal
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
document.addEventListener('DOMContentLoaded', () => {
    initData();
    setupEventListeners();
    
    // Initial renders
    renderPredictions();
    renderLeaderboard();
    updateCountdown();
});
