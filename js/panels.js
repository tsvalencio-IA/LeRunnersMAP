/* =================================================================== */
/* PAINÉIS DA PLATAFORMA (ADMIN, ATLETA, FEED, FINANCEIRO)
/* ARQUIVO 100% COMPLETO - MODO MESTRE *177
/* INTEGRAÇÃO COM COFRE DE APIS E PREPARAÇÃO PARA GPS NATIVO
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            tabConfiguracoesBtn: document.querySelector('[data-tab="configuracoes"]'),
            
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            adminTabConfiguracoes: document.getElementById('admin-tab-configuracoes'),
            
            apiConfigForm: document.getElementById('api-config-form'),
            configMapsKey: document.getElementById('config-maps-key'),
            configGeminiKey: document.getElementById('config-gemini-key'),
            configCloudName: document.getElementById('config-cloud-name'),
            configCloudPreset: document.getElementById('config-cloud-preset'),

            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        AdminPanel.setupListeners();
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
        AdminPanel.loadApiVault();
    },

    setupListeners: () => {
        if (AdminPanel.elements.athleteSearch) {
            AdminPanel.elements.athleteSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.athlete-item').forEach(item => {
                    const name = item.textContent.toLowerCase();
                    item.style.display = name.includes(term) ? 'flex' : 'none';
                });
            });
        }

        const tabs = [
            { btn: AdminPanel.elements.tabPrescreverBtn, content: AdminPanel.elements.adminTabPrescrever },
            { btn: AdminPanel.elements.tabKpisBtn, content: AdminPanel.elements.adminTabKpis },
            { btn: AdminPanel.elements.tabConfiguracoesBtn, content: AdminPanel.elements.adminTabConfiguracoes }
        ];

        tabs.forEach(tab => {
            if (tab.btn) {
                tab.btn.addEventListener('click', () => {
                    tabs.forEach(t => {
                        if(t.btn) t.btn.classList.remove('active');
                        if(t.content) t.content.classList.remove('active');
                    });
                    tab.btn.classList.add('active');
                    if(tab.content) tab.content.classList.add('active');
                });
            }
        });

        if (AdminPanel.elements.addWorkoutForm) {
            AdminPanel.elements.addWorkoutForm.onsubmit = AdminPanel.handleAddWorkout;
        }

        if (AdminPanel.elements.deleteAthleteBtn) {
            AdminPanel.elements.deleteAthleteBtn.onclick = AdminPanel.handleDeleteAthlete;
        }

        if (AdminPanel.elements.apiConfigForm) {
            AdminPanel.elements.apiConfigForm.onsubmit = AdminPanel.handleSaveApiVault;
        }

        if(AdminPanel.elements.analyzeAthleteBtnIa) {
            AdminPanel.elements.analyzeAthleteBtnIa.onclick = AdminPanel.generateKpiAnalysis;
        }
    },

    loadApiVault: () => {
        AdminPanel.state.db.ref('config/apiKeys').once('value', snapshot => {
            if(snapshot.exists()) {
                const keys = snapshot.val();
                if(AdminPanel.elements.configMapsKey) AdminPanel.elements.configMapsKey.value = keys.mapsKey || '';
                if(AdminPanel.elements.configGeminiKey) AdminPanel.elements.configGeminiKey.value = keys.geminiKey || '';
                if(AdminPanel.elements.configCloudName) AdminPanel.elements.configCloudName.value = keys.cloudName || '';
                if(AdminPanel.elements.configCloudPreset) AdminPanel.elements.configCloudPreset.value = keys.cloudPreset || '';
            }
        });
    },

    handleSaveApiVault: (e) => {
        e.preventDefault();
        const keys = {
            mapsKey: AdminPanel.elements.configMapsKey.value.trim(),
            geminiKey: AdminPanel.elements.configGeminiKey.value.trim(),
            cloudName: AdminPanel.elements.configCloudName.value.trim(),
            cloudPreset: AdminPanel.elements.configCloudPreset.value.trim()
        };

        AdminPanel.state.db.ref('config/apiKeys').set(keys).then(() => {
            alert('Chaves salvas no Cofre com sucesso! Recarregue a página para aplicar o GPS Nativo e as IAs.');
            window.location.reload();
        }).catch(err => {
            alert('Erro ao salvar no cofre: ' + err.message);
        });
    },

    loadPendingApprovals: () => {
        AdminPanel.state.db.ref('pendingApprovals').on('value', snapshot => {
            if(!AdminPanel.elements.pendingList) return;
            AdminPanel.elements.pendingList.innerHTML = '';
            if (!snapshot.exists()) {
                AdminPanel.elements.pendingList.innerHTML = '<p class="empty-state">Nenhuma aprovação pendente.</p>';
                return;
            }
            snapshot.forEach(child => {
                const data = child.val();
                const uid = child.key;
                const div = document.createElement('div');
                div.className = 'pending-item';
                div.innerHTML = `
                    <div><strong>${data.name}</strong><br><small>${data.email}</small></div>
                    <div class="pending-item-actions">
                        <button class="btn btn-success btn-small" onclick="AdminPanel.approveUser('${uid}', '${data.name}', '${data.email}')"><i class='bx bx-check'></i> Aprovar</button>
                        <button class="btn btn-danger btn-small" onclick="AdminPanel.rejectUser('${uid}')"><i class='bx bx-x'></i> Rejeitar</button>
                    </div>
                `;
                AdminPanel.elements.pendingList.appendChild(div);
            });
        });
    },

    approveUser: (uid, name, email) => {
        const userData = { name: name, email: email, role: 'atleta', createdAt: new Date().toISOString() };
        AdminPanel.state.db.ref('users/' + uid).set(userData).then(() => {
            AdminPanel.state.db.ref('pendingApprovals/' + uid).remove();
        });
    },

    rejectUser: (uid) => {
        if(confirm("Tem certeza que deseja rejeitar este cadastro?")) {
            AdminPanel.state.db.ref('pendingApprovals/' + uid).remove();
        }
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').orderByChild('role').equalTo('atleta').on('value', snapshot => {
            if(!AdminPanel.elements.athleteList) return;
            AdminPanel.elements.athleteList.innerHTML = '';
            AdminPanel.state.athletes = {};
            
            if (!snapshot.exists()) {
                AdminPanel.elements.athleteList.innerHTML = '<p class="empty-state">Nenhum atleta encontrado.</p>';
                return;
            }

            snapshot.forEach(child => {
                const uid = child.key;
                const data = child.val();
                AdminPanel.state.athletes[uid] = data;
                
                const div = document.createElement('div');
                div.className = 'athlete-item';
                div.innerHTML = `
                    <div class="athlete-info">
                        <img src="${data.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=' + data.name.charAt(0)}" alt="${data.name}" class="athlete-avatar">
                        <span>${data.name}</span>
                    </div>
                    <i class='bx bx-chevron-right'></i>
                `;
                div.onclick = () => {
                    document.querySelectorAll('.athlete-item').forEach(el => el.classList.remove('active'));
                    div.classList.add('active');
                    AdminPanel.selectAthlete(uid, data.name);
                };
                AdminPanel.elements.athleteList.appendChild(div);
            });
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        if(AdminPanel.elements.athleteDetailName) AdminPanel.elements.athleteDetailName.textContent = name;
        if(AdminPanel.elements.athleteDetailContent) AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
        AdminPanel.loadWorkoutsForSelected();
        AdminPanel.loadIaHistory();
    },

    handleDeleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return;
        if(confirm(`ATENÇÃO: Deseja realmente excluir este atleta e todos os seus treinos? Essa ação não pode ser desfeita.`)) {
            AdminPanel.state.db.ref('users/' + uid).remove().then(() => {
                AdminPanel.state.selectedAthleteId = null;
                if(AdminPanel.elements.athleteDetailContent) AdminPanel.elements.athleteDetailContent.classList.add('hidden');
                if(AdminPanel.elements.athleteDetailName) AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
            });
        }
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if (!uid) return alert("Selecione um atleta primeiro.");

        const payload = {
            date: document.getElementById('workout-date').value,
            title: document.getElementById('workout-title').value,
            modalidade: document.getElementById('workout-modalidade').value,
            tipoTreino: document.getElementById('workout-tipo-treino').value,
            intensidade: document.getElementById('workout-intensidade').value,
            percurso: document.getElementById('workout-percurso').value,
            metrics: {
                distancia: document.getElementById('workout-distancia').value,
                tempo: document.getElementById('workout-tempo').value,
                pace: document.getElementById('workout-pace').value,
                velocidade: document.getElementById('workout-velocidade').value
            },
            observacoes: document.getElementById('workout-observacoes').value,
            status: 'planejado',
            timestamp: Date.now()
        };

        AdminPanel.state.db.ref(`users/${uid}/workouts`).push(payload).then(() => {
            AdminPanel.elements.addWorkoutForm.reset();
            alert("Treino prescrito com sucesso!");
        });
    },

    loadWorkoutsForSelected: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid || !AdminPanel.elements.workoutsList) return;

        AdminPanel.state.db.ref(`users/${uid}/workouts`).orderByChild('date').on('value', snapshot => {
            AdminPanel.elements.workoutsList.innerHTML = '';
            if (!snapshot.exists()) {
                AdminPanel.elements.workoutsList.innerHTML = '<p class="empty-state">Nenhum treino agendado.</p>';
                return;
            }

            const workouts = [];
            snapshot.forEach(child => { workouts.push({ id: child.key, ...child.val() }); });
            workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

            workouts.forEach(workout => {
                const isRealizado = workout.status === 'realizado';
                const div = document.createElement('div');
                div.className = `workout-card ${isRealizado ? 'status-realizado' : 'status-planejado'}`;
                
                let detailsHtml = `<p><strong>Modalidade:</strong> ${workout.modalidade} | <strong>Tipo:</strong> ${workout.tipoTreino}</p>`;
                if(workout.metrics && (workout.metrics.distancia || workout.metrics.tempo)) {
                    detailsHtml += `<p class="metrics-row">`;
                    if(workout.metrics.distancia) detailsHtml += `<span>📏 ${workout.metrics.distancia}</span>`;
                    if(workout.metrics.tempo) detailsHtml += `<span>⏱️ ${workout.metrics.tempo}</span>`;
                    if(workout.metrics.pace) detailsHtml += `<span>⚡ ${workout.metrics.pace}</span>`;
                    detailsHtml += `</p>`;
                }

                div.innerHTML = `
                    <div class="workout-header">
                        <h4>${workout.date.split('-').reverse().join('/')} - ${workout.title}</h4>
                        <button class="btn btn-danger btn-small" onclick="AdminPanel.deleteWorkout('${uid}', '${workout.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                    ${detailsHtml}
                    ${isRealizado && workout.feedback ? `<div class="workout-feedback"><p><strong>Feedback:</strong> ${workout.feedback}</p></div>` : ''}
                `;
                AdminPanel.elements.workoutsList.appendChild(div);
            });
        });
    },

    deleteWorkout: (uid, workoutId) => {
        if(confirm("Excluir este treino?")) {
            AdminPanel.state.db.ref(`users/${uid}/workouts/${workoutId}`).remove();
            AdminPanel.state.db.ref(`publicWorkouts/${workoutId}`).remove();
        }
    },

    generateKpiAnalysis: async () => {
        if(!window.GEMINI_API_KEY) {
            alert("Chave da IA não configurada. Vá na aba 'Configurações & APIs' e insira sua chave do Gemini.");
            return;
        }
        
        const btn = AdminPanel.elements.analyzeAthleteBtnIa;
        btn.innerHTML = "<i class='bx bx-loader bx-spin'></i> Analisando...";
        btn.disabled = true;

        const uid = AdminPanel.state.selectedAthleteId;
        try {
            const snap = await AdminPanel.state.db.ref(`users/${uid}/workouts`).once('value');
            if(!snap.exists()) throw new Error("Atleta não tem treinos suficientes.");
            
            const workouts = [];
            snap.forEach(c => workouts.push(c.val()));
            const treinosRealizados = workouts.filter(w => w.status === 'realizado');

            const promptText = `
                Como Fisiologista e Coach da equipe LeRunners, analise o desempenho recente deste atleta.
                Total de treinos prescritos: ${workouts.length}.
                Treinos realizados: ${treinosRealizados.length}.
                Dados dos últimos treinos realizados: ${JSON.stringify(treinosRealizados.slice(-5))}
                
                Gere um relatório focado em:
                1. Adesão e Consistência.
                2. Evolução de Pace/Distância.
                3. Alerta de possíveis overtrainings ou dores (baseado no feedback).
                4. Recomendação para a próxima semana.
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if(!response.ok) throw new Error("Falha na comunicação com o Gemini");
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Salva no histórico
            await AdminPanel.state.db.ref(`users/${uid}/iaHistory`).push({
                date: new Date().toISOString(),
                report: text
            });

            alert("Análise gerada e salva com sucesso!");
        } catch (err) {
            alert("Erro na IA: " + err.message);
        } finally {
            btn.innerHTML = "<i class='bx bxs-brain'></i> Gerar Nova Análise (Gemini)";
            btn.disabled = false;
        }
    },

    loadIaHistory: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid || !AdminPanel.elements.iaHistoryList) return;

        AdminPanel.state.db.ref(`users/${uid}/iaHistory`).orderByChild('date').on('value', snapshot => {
            AdminPanel.elements.iaHistoryList.innerHTML = '';
            if (!snapshot.exists()) {
                AdminPanel.elements.iaHistoryList.innerHTML = '<p class="empty-state">Nenhuma análise salva.</p>';
                return;
            }

            const histories = [];
            snapshot.forEach(child => histories.push({id: child.key, ...child.val()}));
            histories.sort((a,b) => new Date(b.date) - new Date(a.date));

            histories.forEach(item => {
                const div = document.createElement('div');
                div.className = 'panel';
                div.style.marginBottom = '1rem';
                div.innerHTML = `
                    <h5 style="color: var(--secondary-color); margin-bottom: 0.5rem;">${new Date(item.date).toLocaleDateString()}</h5>
                    <div style="font-size: 0.9rem; white-space: pre-wrap;">${item.report}</div>
                `;
                AdminPanel.elements.iaHistoryList.appendChild(div);
            });
        });
    }
};

const AtletaPanel = {
    state: { db: null, currentUser: null, userData: null },
    elements: {},

    init: (user, db, userData) => {
        AtletaPanel.state.db = db;
        AtletaPanel.state.currentUser = user;
        AtletaPanel.state.userData = userData;

        const nameEl = document.getElementById('atleta-welcome-name');
        if(nameEl) nameEl.textContent = userData.name.split(' ')[0];

        AtletaPanel.elements.workoutsList = document.getElementById('atleta-workouts-list');
        AtletaPanel.loadWorkouts();
        
        const btnManual = document.getElementById('log-manual-activity-btn');
        if(btnManual) {
            btnManual.onclick = () => {
                document.getElementById('log-activity-modal').classList.remove('hidden');
            };
        }
    },

    loadWorkouts: () => {
        const uid = AtletaPanel.state.currentUser.uid;
        AtletaPanel.state.db.ref(`users/${uid}/workouts`).orderByChild('date').on('value', snapshot => {
            if(!AtletaPanel.elements.workoutsList) return;
            AtletaPanel.elements.workoutsList.innerHTML = '';
            
            if (!snapshot.exists()) {
                AtletaPanel.elements.workoutsList.innerHTML = `
                    <div class="empty-state">
                        <i class='bx bx-calendar-x' style="font-size: 3rem; color: #ccc;"></i>
                        <p>Nenhum treino prescrito no momento.</p>
                    </div>`;
                return;
            }

            const workouts = [];
            snapshot.forEach(child => workouts.push({ id: child.key, ...child.val() }));
            workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

            workouts.forEach(workout => {
                const isRealizado = workout.status === 'realizado' || workout.status === 'realizado_parcial';
                const div = document.createElement('div');
                div.className = `workout-card ${isRealizado ? 'status-realizado' : 'status-planejado'}`;
                
                let detailsHtml = `<div class="workout-details-grid">`;
                if(workout.modalidade) detailsHtml += `<div><strong>Modalidade:</strong> ${workout.modalidade}</div>`;
                if(workout.tipoTreino) detailsHtml += `<div><strong>Tipo:</strong> ${workout.tipoTreino}</div>`;
                if(workout.intensidade) detailsHtml += `<div><strong>Intensidade:</strong> ${workout.intensidade}</div>`;
                if(workout.percurso) detailsHtml += `<div><strong>Percurso:</strong> ${workout.percurso}</div>`;
                detailsHtml += `</div>`;

                if(workout.metrics && (workout.metrics.distancia || workout.metrics.tempo)) {
                    detailsHtml += `<div class="metrics-row" style="margin-top: 10px;">`;
                    if(workout.metrics.distancia) detailsHtml += `<span>📏 ${workout.metrics.distancia}</span>`;
                    if(workout.metrics.tempo) detailsHtml += `<span>⏱️ ${workout.metrics.tempo}</span>`;
                    if(workout.metrics.pace) detailsHtml += `<span>⚡ ${workout.metrics.pace}</span>`;
                    detailsHtml += `</div>`;
                }

                div.innerHTML = `
                    <div class="workout-header">
                        <h4>${workout.date.split('-').reverse().join('/')} - ${workout.title}</h4>
                        ${isRealizado ? '<span class="badge badge-success">Concluído</span>' : ''}
                    </div>
                    ${detailsHtml}
                    ${workout.observacoes ? `<div class="workout-obs"><strong>Obs do Coach:</strong> ${workout.observacoes}</div>` : ''}
                    
                    ${!isRealizado ? `
                        <button class="btn btn-primary" style="margin-top: 15px; width: 100%;" onclick="window.AppPrincipal.openFeedbackModal('${workout.id}', '${uid}')">
                            <i class='bx bx-check-circle'></i> Dar Feedback do Treino
                        </button>
                    ` : `
                        <div class="workout-feedback" style="margin-top: 15px;">
                            <strong>Seu Feedback:</strong> ${workout.feedback || 'Sem feedback escrito.'}
                        </div>
                    `}
                `;
                AtletaPanel.elements.workoutsList.appendChild(div);
            });
        });
    }
};

const FeedPanel = {
    state: { db: null, currentUser: null, userData: null },
    
    init: (user, db, userData) => {
        FeedPanel.state = { db, currentUser: user, userData };
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const feedList = document.getElementById('feed-list');
        if(!feedList) return;

        FeedPanel.state.db.ref('publicWorkouts').orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
            feedList.innerHTML = '';
            if(!snapshot.exists()) {
                feedList.innerHTML = '<p class="empty-state">O feed está vazio. Faça um treino e seja o primeiro!</p>';
                return;
            }

            const posts = [];
            snapshot.forEach(child => posts.push({ id: child.key, ...child.val() }));
            posts.sort((a,b) => b.timestamp - a.timestamp);

            posts.forEach(post => {
                const uid = FeedPanel.state.currentUser.uid;
                const likesCount = post.likes ? Object.keys(post.likes).length : 0;
                const isLiked = post.likes && post.likes[uid];
                const commentsCount = post.comments ? Object.keys(post.comments).length : 0;

                const div = document.createElement('div');
                div.className = 'feed-item';
                div.innerHTML = `
                    <div class="feed-header">
                        <img src="${post.ownerPhoto || 'https://placehold.co/150x150/4169E1/FFFFFF?text=' + post.ownerName.charAt(0)}" class="athlete-avatar">
                        <div class="feed-header-info">
                            <span class="athlete-name">${post.ownerName}</span>
                            <span class="workout-date">${new Date(post.timestamp).toLocaleString()}</span>
                        </div>
                        ${post.source === 'lerunners_gps' ? '<span class="badge" style="background:#fc4c02; color:white; font-size:0.7rem;"><i class="bx bx-navigation"></i> GPS Nativo</span>' : ''}
                    </div>
                    
                    <div class="feed-body">
                        <h4 style="margin-bottom: 5px;">${post.title}</h4>
                        <p style="color: var(--text-light); font-size: 0.95rem; margin-bottom: 10px;">${post.feedback}</p>
                        ${post.metrics ? `
                            <div class="metrics-row" style="background: var(--light-gray); padding: 10px; border-radius: 8px;">
                                ${post.metrics.distancia ? `<span>📏 <strong>${post.metrics.distancia}</strong></span>` : ''}
                                ${post.metrics.tempo ? `<span>⏱️ <strong>${post.metrics.tempo}</strong></span>` : ''}
                                ${post.metrics.pace ? `<span>⚡ <strong>${post.metrics.pace}</strong></span>` : ''}
                            </div>
                        ` : ''}
                        ${post.photoUrl ? `<img src="${post.photoUrl}" class="feed-photo" style="width: 100%; border-radius: 8px; margin-top: 10px;">` : ''}
                    </div>

                    <div class="feed-actions">
                        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="FeedPanel.toggleLike('${post.id}', ${!isLiked})">
                            <i class='bx ${isLiked ? 'bxs-heart' : 'bx-heart'}'></i> 
                            ${likesCount > 0 ? `<span class="like-count" onclick="event.stopPropagation(); window.AppPrincipal.showWhoLiked('${post.id}')">${likesCount}</span>` : 'Curtir'}
                        </button>
                        <button class="action-btn" onclick="window.AppPrincipal.openComments('${post.id}')">
                            <i class='bx bx-comment'></i> ${commentsCount > 0 ? commentsCount : 'Comentar'}
                        </button>
                    </div>
                `;
                feedList.appendChild(div);
            });
        });
    },

    toggleLike: (postId, shouldLike) => {
        const uid = FeedPanel.state.currentUser.uid;
        const ref = FeedPanel.state.db.ref(`publicWorkouts/${postId}/likes/${uid}`);
        if(shouldLike) ref.set(true); else ref.remove();
    }
};

const FinancePanel = {
    state: { db: null, currentUser: null },
    elements: {},

    init: (user, db) => {
        FinancePanel.state = { db, currentUser: user };
        FinancePanel.elements = {
            totalReceita: document.getElementById('fin-total-receita'),
            totalDespesa: document.getElementById('fin-total-despesa'),
            saldo: document.getElementById('fin-saldo'),
            transactionsList: document.getElementById('finance-transactions-list'),
            inventoryList: document.getElementById('finance-inventory-list'),
            transactionForm: document.getElementById('finance-transaction-form'),
            productForm: document.getElementById('finance-product-form'),
            
            finType: document.getElementById('fin-type'),
            finCategory: document.getElementById('fin-category'),
            studentSelector: document.getElementById('fin-student-selector'),
            productSelector: document.getElementById('fin-product-selector'),
            studentSelect: document.getElementById('fin-student-select'),
            productSelect: document.getElementById('fin-product-select'),

            tabLancamentosBtn: document.querySelector('[data-fin-tab="lancamentos"]'),
            tabEstoqueBtn: document.querySelector('[data-fin-tab="estoque"]'),
            tabLancamentos: document.getElementById('fin-tab-lancamentos'),
            tabEstoque: document.getElementById('fin-tab-estoque')
        };

        FinancePanel.setupListeners();
        FinancePanel.loadStudents();
        FinancePanel.loadInventoryForSelect();
        FinancePanel.loadTransactions();
        FinancePanel.loadInventory();
    },

    setupListeners: () => {
        const tabs = [
            { btn: FinancePanel.elements.tabLancamentosBtn, content: FinancePanel.elements.tabLancamentos },
            { btn: FinancePanel.elements.tabEstoqueBtn, content: FinancePanel.elements.tabEstoque }
        ];

        tabs.forEach(tab => {
            if(tab.btn) {
                tab.btn.addEventListener('click', () => {
                    tabs.forEach(t => { t.btn.classList.remove('active'); t.content.classList.add('hidden'); });
                    tab.btn.classList.add('active'); tab.content.classList.remove('hidden');
                });
            }
        });

        if(FinancePanel.elements.finCategory) {
            FinancePanel.elements.finCategory.addEventListener('change', (e) => {
                const val = e.target.value;
                FinancePanel.elements.studentSelector.classList.toggle('hidden', val !== 'Mensalidade');
                FinancePanel.elements.studentSelect.required = (val === 'Mensalidade');
                FinancePanel.elements.productSelector.classList.toggle('hidden', val !== 'Venda');
                FinancePanel.elements.productSelect.required = (val === 'Venda');
            });
        }

        if(FinancePanel.elements.productForm) FinancePanel.elements.productForm.onsubmit = FinancePanel.handleAddProduct;
        if(FinancePanel.elements.transactionForm) FinancePanel.elements.transactionForm.onsubmit = FinancePanel.handleAddTransaction;
    },

    loadStudents: () => {
        FinancePanel.state.db.ref('users').orderByChild('role').equalTo('atleta').once('value', snap => {
            if(!snap.exists() || !FinancePanel.elements.studentSelect) return;
            FinancePanel.elements.studentSelect.innerHTML = '<option value="">Selecione o Aluno...</option>';
            snap.forEach(child => {
                const opt = document.createElement('option');
                opt.value = child.key; opt.textContent = child.val().name;
                FinancePanel.elements.studentSelect.appendChild(opt);
            });
        });
    },

    loadInventoryForSelect: () => {
        FinancePanel.state.db.ref('finance/inventory').on('value', snap => {
            if(!FinancePanel.elements.productSelect) return;
            FinancePanel.elements.productSelect.innerHTML = '<option value="">Selecione o Produto...</option>';
            if(snap.exists()) {
                snap.forEach(child => {
                    const data = child.val();
                    const opt = document.createElement('option');
                    opt.value = child.key;
                    opt.textContent = `${data.name} (Qtd: ${data.quantity}) - R$ ${data.price.toFixed(2)}`;
                    FinancePanel.elements.productSelect.appendChild(opt);
                });
            }
        });
    },

    handleAddProduct: (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('prod-name').value,
            price: parseFloat(document.getElementById('prod-price').value),
            cost: parseFloat(document.getElementById('prod-cost').value || 0),
            quantity: parseInt(document.getElementById('prod-qty').value, 10),
            timestamp: Date.now()
        };
        FinancePanel.state.db.ref('finance/inventory').push(payload).then(() => {
            FinancePanel.elements.productForm.reset();
            alert("Produto cadastrado no estoque!");
        });
    },

    loadInventory: () => {
        FinancePanel.state.db.ref('finance/inventory').on('value', snap => {
            if(!FinancePanel.elements.inventoryList) return;
            FinancePanel.elements.inventoryList.innerHTML = '';
            if(!snap.exists()) return;

            snap.forEach(child => {
                const id = child.key; const data = child.val();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.name}</td>
                    <td>R$ ${data.price.toFixed(2)}</td>
                    <td><span class="badge ${data.quantity <= 5 ? 'badge-danger' : 'badge-success'}">${data.quantity}</span></td>
                    <td>
                        <button class="btn btn-danger btn-small" onclick="FinancePanel.deleteProduct('${id}')"><i class='bx bx-trash'></i></button>
                    </td>
                `;
                FinancePanel.elements.inventoryList.appendChild(tr);
            });
        });
    },

    deleteProduct: (id) => {
        if(confirm("Excluir produto do estoque?")) FinancePanel.state.db.ref(`finance/inventory/${id}`).remove();
    },

    handleAddTransaction: async (e) => {
        e.preventDefault();
        const payload = {
            type: document.getElementById('fin-type').value,
            category: document.getElementById('fin-category').value,
            amount: parseFloat(document.getElementById('fin-amount').value),
            date: document.getElementById('fin-date').value,
            description: document.getElementById('fin-description').value,
            studentId: document.getElementById('fin-student-select').value,
            productId: document.getElementById('fin-product-select').value,
            timestamp: Date.now()
        };

        if(payload.category === 'Venda' && payload.productId) {
            FinancePanel.updateStock(payload.productId, -1);
        }

        FinancePanel.state.db.ref('finance/transactions').push(payload).then(() => {
            FinancePanel.elements.transactionForm.reset();
            FinancePanel.elements.finCategory.dispatchEvent(new Event('change'));
            alert("Lançamento efetuado!");
        });
    },

    updateStock: (productId, change) => {
        const ref = FinancePanel.state.db.ref(`finance/inventory/${productId}/quantity`);
        ref.transaction(current => (current || 0) + change);
    },

    loadTransactions: () => {
        FinancePanel.state.db.ref('finance/transactions').orderByChild('date').on('value', snap => {
            if(!FinancePanel.elements.transactionsList) return;
            FinancePanel.elements.transactionsList.innerHTML = '';
            
            let tReceitas = 0; let tDespesas = 0;

            if(snap.exists()) {
                const trans = [];
                snap.forEach(c => trans.push({id: c.key, ...c.val()}));
                trans.sort((a,b) => new Date(b.date) - new Date(a.date));

                trans.forEach(t => {
                    if(t.type === 'receita') tReceitas += t.amount;
                    else tDespesas += t.amount;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${t.date.split('-').reverse().join('/')}</td>
                        <td>${t.description}</td>
                        <td><span class="badge" style="background:#eee;color:#333;">${t.category}</span></td>
                        <td style="color: ${t.type==='receita' ? 'var(--success-color)' : 'var(--danger-color)'}">
                            ${t.type==='receita'?'+':'-'} R$ ${t.amount.toFixed(2)}
                        </td>
                        <td><button class="btn btn-danger btn-small" onclick="FinancePanel.deleteTransaction('${t.id}')"><i class='bx bx-trash'></i></button></td>
                    `;
                    FinancePanel.elements.transactionsList.appendChild(tr);
                });
            }

            if(FinancePanel.elements.totalReceita) FinancePanel.elements.totalReceita.textContent = `R$ ${tReceitas.toFixed(2)}`;
            if(FinancePanel.elements.totalDespesa) FinancePanel.elements.totalDespesa.textContent = `R$ ${tDespesas.toFixed(2)}`;
            if(FinancePanel.elements.saldo) FinancePanel.elements.saldo.textContent = `R$ ${(tReceitas - tDespesas).toFixed(2)}`;
        });
    },

    deleteTransaction: (id) => {
        if(confirm("Excluir este lançamento?")) FinancePanel.state.db.ref(`finance/transactions/${id}`).remove();
    }
};
