/* =================================================================== */
/* ARQUIVO DE MÓDULOS (V7.3 - COFRE DE APIS & STRAVA COMPLIANCE)
/* =================================================================== */

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V7.3: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            // Abas
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            tabConfiguracoesBtn: document.querySelector('[data-tab="configuracoes"]'), // <--- NOVO COFRE
            
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            adminTabConfiguracoes: document.getElementById('admin-tab-configuracoes'), // <--- NOVO COFRE
            
            // Cofre de APIs
            apiConfigForm: document.getElementById('api-config-form'),
            configMapsKey: document.getElementById('config-maps-key'),
            configGeminiKey: document.getElementById('config-gemini-key'),
            configCloudName: document.getElementById('config-cloud-name'),
            configCloudPreset: document.getElementById('config-cloud-preset'),

            // Conteúdo Aba 1 (Prescrição)
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutDate: document.getElementById('workout-date'),
            workoutTitle: document.getElementById('workout-title'),
            workoutModalidade: document.getElementById('workout-modalidade'),
            workoutTipo: document.getElementById('workout-tipo-treino'),
            workoutIntensidade: document.getElementById('workout-intensidade'),
            workoutPercurso: document.getElementById('workout-percurso'),
            workoutDistancia: document.getElementById('workout-distancia'),
            workoutTempo: document.getElementById('workout-tempo'),
            workoutPace: document.getElementById('workout-pace'),
            workoutVelocidade: document.getElementById('workout-velocidade'),
            workoutObservacoes: document.getElementById('workout-observacoes'),
            workoutsList: document.getElementById('workouts-list'),
            
            // Conteúdo Aba 2 (IA)
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
        AdminPanel.setupListeners();
        AdminPanel.setupTabs();
        AdminPanel.loadConfigToForm(); // <--- PREENCHE O COFRE
    },

    setupTabs: () => {
        const tabs = [
            { btn: AdminPanel.elements.tabPrescreverBtn, content: AdminPanel.elements.adminTabPrescrever },
            { btn: AdminPanel.elements.tabKpisBtn, content: AdminPanel.elements.adminTabKpis },
            { btn: AdminPanel.elements.tabConfiguracoesBtn, content: AdminPanel.elements.adminTabConfiguracoes } // <--- NOVO
        ];

        tabs.forEach(t => {
            if(t.btn) {
                t.btn.addEventListener('click', () => {
                    tabs.forEach(x => { 
                        if(x.btn) x.btn.classList.remove('active'); 
                        if(x.content) x.content.classList.remove('active'); 
                    });
                    t.btn.classList.add('active');
                    if(t.content) t.content.classList.add('active');
                });
            }
        });
    },

    // --- NOVA LÓGICA DO COFRE DE APIS ---
    loadConfigToForm: () => {
        AdminPanel.state.db.ref('config/apiKeys').once('value', snap => {
            if(snap.exists()) {
                const keys = snap.val();
                if(AdminPanel.elements.configMapsKey) AdminPanel.elements.configMapsKey.value = keys.mapsKey || "";
                if(AdminPanel.elements.configGeminiKey) AdminPanel.elements.configGeminiKey.value = keys.geminiKey || "";
                if(AdminPanel.elements.configCloudName) AdminPanel.elements.configCloudName.value = keys.cloudinaryName || "";
                if(AdminPanel.elements.configCloudPreset) AdminPanel.elements.configCloudPreset.value = keys.cloudinaryPreset || "";
            }
        });
    },

    handleConfigSubmit: (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const oldText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
        btn.disabled = true;

        const payload = {
            mapsKey: AdminPanel.elements.configMapsKey.value.trim(),
            geminiKey: AdminPanel.elements.configGeminiKey.value.trim(),
            cloudinaryName: AdminPanel.elements.configCloudName.value.trim(),
            cloudinaryPreset: AdminPanel.elements.configCloudPreset.value.trim()
        };

        AdminPanel.state.db.ref('config/apiKeys').update(payload)
            .then(() => {
                alert("Configurações salvas e criptografadas no cofre de dados!");
                // O listener global no app.js vai atualizar as variaveis em tempo real
            })
            .catch(err => alert("Erro ao salvar: " + err.message))
            .finally(() => {
                btn.innerHTML = oldText;
                btn.disabled = false;
            });
    },

    setupListeners: () => {
        if(AdminPanel.elements.apiConfigForm) {
            AdminPanel.elements.apiConfigForm.addEventListener('submit', AdminPanel.handleConfigSubmit);
        }

        AdminPanel.elements.athleteSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const items = AdminPanel.elements.athleteList.querySelectorAll('.athlete-list-item');
            items.forEach(item => {
                const name = item.querySelector('span').textContent.toLowerCase();
                item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        AdminPanel.elements.addWorkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!AdminPanel.state.selectedAthleteId) return alert('Selecione um atleta!');

            const date = AdminPanel.elements.workoutDate.value;
            const title = AdminPanel.elements.workoutTitle.value;
            const modalidade = AdminPanel.elements.workoutModalidade.value;
            const tipo = AdminPanel.elements.workoutTipo.value;
            const intensidade = AdminPanel.elements.workoutIntensidade.value;
            const percurso = AdminPanel.elements.workoutPercurso.value;
            const distancia = AdminPanel.elements.workoutDistancia.value;
            const tempo = AdminPanel.elements.workoutTempo.value;
            const pace = AdminPanel.elements.workoutPace.value;
            const velocidade = AdminPanel.elements.workoutVelocidade.value;
            const observacoes = AdminPanel.elements.workoutObservacoes.value;

            // Formatação bonita para exibição (mesclando os campos no body)
            let detailsHtml = `🎯 Modalidade: ${modalidade}\n`;
            detailsHtml += `🏃 Tipo: ${tipo}\n`;
            detailsHtml += `🔥 Intensidade: ${intensidade}\n`;
            detailsHtml += `🗺️ Percurso: ${percurso}\n`;
            if (distancia) detailsHtml += `📍 Distância: ${distancia}\n`;
            if (tempo) detailsHtml += `⏱️ Tempo: ${tempo}\n`;
            if (pace) detailsHtml += `⚡ Pace: ${pace}\n`;
            if (velocidade) detailsHtml += `🏎️ Velocidade: ${velocidade}\n`;
            if (observacoes) detailsHtml += `\n📝 Observações:\n${observacoes}`;

            AdminPanel.state.db.ref(`workouts/${AdminPanel.state.selectedAthleteId}`).push({
                date: date,
                title: title,
                body: detailsHtml, // Salvando tudo formatado no body
                status: 'planejado',
                timestamp: Date.now()
            }).then(() => {
                AdminPanel.elements.addWorkoutForm.reset();
            });
        });

        AdminPanel.elements.deleteAthleteBtn.addEventListener('click', () => {
            if (!AdminPanel.state.selectedAthleteId) return;
            if (confirm(`Tem certeza que deseja excluir o atleta ${AdminPanel.state.athletes[AdminPanel.state.selectedAthleteId].name}?`)) {
                const uid = AdminPanel.state.selectedAthleteId;
                AdminPanel.state.db.ref(`users/${uid}`).remove();
                AdminPanel.state.db.ref(`workouts/${uid}`).remove();
                AdminPanel.state.db.ref(`clinicalAnalysis/${uid}`).remove(); // Remove historico de IA tambem
                AdminPanel.state.selectedAthleteId = null;
                AdminPanel.elements.athleteDetailContent.classList.add('hidden');
                AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
                AdminPanel.elements.addWorkoutForm.reset();
                AdminPanel.elements.workoutsList.innerHTML = '';
            }
        });

        // Evento para chamar a IA no app.js (Bridge)
        AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', () => {
            if(AdminPanel.state.selectedAthleteId && typeof AppPrincipal !== 'undefined') {
                AppPrincipal.generateIaAnalysis(AdminPanel.state.selectedAthleteId);
            }
        });
    },

    loadPendingApprovals: () => {
        AdminPanel.state.db.ref('pendingApprovals').on('value', snapshot => {
            AdminPanel.elements.pendingList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const data = child.val();
                    const div = document.createElement('div');
                    div.className = 'pending-item';
                    div.innerHTML = `
                        <div class="pending-item-info">
                            <strong>${data.name}</strong><br>
                            ${data.email}
                        </div>
                        <div class="pending-item-actions">
                            <button class="btn btn-success btn-small" onclick="AdminPanel.approveUser('${child.key}', '${data.name}', '${data.email}')">Aprovar</button>
                            <button class="btn btn-danger btn-small" onclick="AdminPanel.rejectUser('${child.key}')">Rejeitar</button>
                        </div>
                    `;
                    AdminPanel.elements.pendingList.appendChild(div);
                });
            } else {
                AdminPanel.elements.pendingList.innerHTML = '<p>Nenhuma aprovação pendente.</p>';
            }
        });
    },

    approveUser: (uid, name, email) => {
        AdminPanel.state.db.ref(`users/${uid}`).set({ name, email, role: 'atleta' })
            .then(() => AdminPanel.state.db.ref(`pendingApprovals/${uid}`).remove());
    },

    rejectUser: (uid) => {
        AdminPanel.state.db.ref(`pendingApprovals/${uid}`).remove();
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').on('value', snapshot => {
            AdminPanel.elements.athleteList.innerHTML = '';
            AdminPanel.state.athletes = {};
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    if (!AdminPanel.state.adminUIDs[child.key]) {
                        const data = child.val();
                        AdminPanel.state.athletes[child.key] = data;
                        const div = document.createElement('div');
                        div.className = 'athlete-list-item';
                        
                        // Avatar no Admin List
                        const photoHtml = data.photoUrl ? 
                            `<img src="${data.photoUrl}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-right:10px;">` :
                            `<div style="width:30px; height:30px; border-radius:50%; background:var(--primary-color); color:white; display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold; font-size:12px;">${data.name.charAt(0)}</div>`;

                        div.innerHTML = `<div style="display:flex; align-items:center;">${photoHtml} <span>${data.name}</span></div> <i class='bx bx-chevron-right'></i>`;
                        div.onclick = () => AdminPanel.selectAthlete(child.key, div);
                        AdminPanel.elements.athleteList.appendChild(div);
                    }
                });
            }
        });
    },

    selectAthlete: (uid, element) => {
        document.querySelectorAll('.athlete-list-item').forEach(el => el.classList.remove('selected'));
        if (element) element.classList.add('selected');

        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.athleteDetailName.textContent = `Atleta: ${AdminPanel.state.athletes[uid].name}`;
        AdminPanel.elements.athleteDetailContent.classList.remove('hidden');

        AdminPanel.loadAthleteWorkouts(uid);
        AdminPanel.loadAthleteIaHistory(uid);
    },

    loadAthleteWorkouts: (uid) => {
        AdminPanel.state.db.ref(`workouts/${uid}`).orderByChild('date').on('value', snapshot => {
            AdminPanel.elements.workoutsList.innerHTML = '';
            if (snapshot.exists()) {
                const workouts = [];
                snapshot.forEach(child => { workouts.push({ id: child.key, ...child.val() }); });
                workouts.reverse(); // Mais recentes primeiro

                workouts.forEach(w => {
                    const div = document.createElement('div');
                    div.className = 'workout-card';
                    
                    const fDate = w.date.split('-').reverse().join('/');
                    let statusHtml = `<span class="status-tag ${w.status}">${w.status.replace('_', ' ')}</span>`;
                    
                    div.innerHTML = `
                        <div class="workout-card-header">
                            <span class="date">${fDate}</span>
                            <span class="title">${w.title}</span>
                            ${statusHtml}
                        </div>
                        <div class="workout-card-body">
                            <p>${escapeHtml(w.body || w.description || "")}</p>
                            ${w.feedback ? `<div class="feedback-text"><strong>Feedback do Atleta:</strong><br>${escapeHtml(w.feedback)}</div>` : ''}
                            ${w.photoUrl ? `<img src="${w.photoUrl}" class="workout-image" alt="Treino">` : ''}
                            
                            ${w.stravaData ? `
                            <fieldset class="strava-data-display" style="display:block; margin-top:10px;">
                                <legend><i class='bx bxl-strava'></i> Dados Extraídos</legend>
                                <p>🎯 Distância: ${w.stravaData.distancia || '--'} km</p>
                                <p>⏱️ Tempo: ${w.stravaData.tempo || '--'}</p>
                                <p>⚡ Ritmo: ${w.stravaData.ritmo || '--'}</p>
                            </fieldset>
                            ` : ''}
                        </div>
                        <div class="workout-card-footer" style="justify-content: flex-end;">
                             <button class="btn btn-danger btn-small" onclick="AdminPanel.deleteWorkout('${uid}', '${w.id}')"><i class='bx bx-trash'></i> Excluir Treino</button>
                        </div>
                    `;
                    AdminPanel.elements.workoutsList.appendChild(div);
                });
            } else {
                AdminPanel.elements.workoutsList.innerHTML = '<p style="color:#666; text-align:center;">Nenhum treino prescrito.</p>';
            }
        });
    },

    loadAthleteIaHistory: (uid) => {
        AdminPanel.state.db.ref(`clinicalAnalysis/${uid}`).orderByChild('timestamp').on('value', snapshot => {
            AdminPanel.elements.iaHistoryList.innerHTML = '';
            if (snapshot.exists()) {
                const history = [];
                snapshot.forEach(child => { history.push({ id: child.key, ...child.val() }); });
                history.reverse(); 

                history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'workout-card'; // Reutilizando classe visual
                    const dateStr = new Date(item.timestamp).toLocaleDateString('pt-BR');
                    
                    div.innerHTML = `
                        <div class="workout-card-header">
                            <span class="date">${dateStr}</span>
                            <span class="title">Análise de Performance</span>
                        </div>
                        <div class="workout-card-body">
                            <p>${escapeHtml(item.report)}</p>
                        </div>
                        <div class="workout-card-footer" style="justify-content: flex-end;">
                             <button class="btn btn-danger btn-small" onclick="AdminPanel.deleteIaHistory('${uid}', '${item.id}')"><i class='bx bx-trash'></i></button>
                        </div>
                    `;
                    AdminPanel.elements.iaHistoryList.appendChild(div);
                });
            } else {
                AdminPanel.elements.iaHistoryList.innerHTML = '<p style="color:#666; text-align:center;">Nenhum histórico salvo.</p>';
            }
        });
    },

    deleteWorkout: (uid, workoutId) => {
        if (confirm("Excluir este treino?")) {
            AdminPanel.state.db.ref(`workouts/${uid}/${workoutId}`).remove();
        }
    },
    
    deleteIaHistory: (uid, reportId) => {
        if (confirm("Excluir esta análise salva?")) {
            AdminPanel.state.db.ref(`clinicalAnalysis/${uid}/${reportId}`).remove();
        }
    }
};

// ===================================================================
// 4. AthletePanel (Lógica do Painel do Atleta)
// ===================================================================
const AthletePanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AthletePanel: Inicializado.");
        AthletePanel.state = { db, currentUser: user };
        AthletePanel.elements = {
            workoutsList: document.getElementById('atleta-workouts-list'),
            welcomeName: document.getElementById('atleta-welcome-name'),
            logManualBtn: document.getElementById('log-manual-activity-btn')
        };

        if (typeof AppPrincipal !== 'undefined' && AppPrincipal.state.userData) {
            AthletePanel.elements.welcomeName.textContent = AppPrincipal.state.userData.name.split(' ')[0];
        }

        AthletePanel.loadMyWorkouts();
        
        AthletePanel.elements.logManualBtn.addEventListener('click', () => {
             document.getElementById('log-activity-date').value = new Date().toISOString().split('T')[0];
             document.getElementById('log-activity-modal').classList.remove('hidden');
        });
    },

    loadMyWorkouts: () => {
        const uid = AthletePanel.state.currentUser.uid;
        AthletePanel.state.db.ref(`workouts/${uid}`).orderByChild('date').on('value', snapshot => {
            AthletePanel.elements.workoutsList.innerHTML = '';
            if (snapshot.exists()) {
                const workouts = [];
                snapshot.forEach(child => { workouts.push({ id: child.key, ...child.val() }); });
                
                // Ordena: mais recentes primeiro (ou futuros em cima se quiser)
                workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

                workouts.forEach(w => {
                    const div = document.createElement('div');
                    div.className = 'workout-card';
                    
                    const fDate = w.date.split('-').reverse().join('/');
                    let statusHtml = `<span class="status-tag ${w.status}">${w.status.replace('_', ' ')}</span>`;
                    
                    div.innerHTML = `
                        <div class="workout-card-header">
                            <span class="date">${fDate}</span>
                            <span class="title">${w.title}</span>
                            ${statusHtml}
                        </div>
                        <div class="workout-card-body">
                            <p>${escapeHtml(w.body || w.description || "")}</p>
                            ${w.feedback ? `<div class="feedback-text"><strong>Seu Feedback:</strong><br>${escapeHtml(w.feedback)}</div>` : ''}
                            ${w.photoUrl ? `<img src="${w.photoUrl}" class="workout-image" alt="Treino">` : ''}
                            
                            ${w.stravaData ? `
                            <fieldset class="strava-data-display" style="display:block; margin-top:10px;">
                                <legend><i class='bx bxl-strava'></i> Dados Extraídos</legend>
                                <p>🎯 Distância: ${w.stravaData.distancia || '--'} km</p>
                                <p>⏱️ Tempo: ${w.stravaData.tempo || '--'}</p>
                                <p>⚡ Ritmo: ${w.stravaData.ritmo || '--'}</p>
                            </fieldset>
                            ` : ''}
                        </div>
                        <div class="workout-card-footer">
                            <span style="font-size:0.8rem; color:var(--text-light);"><i class='bx bx-message-square-dots'></i> Ver comentários e dar feedback</span>
                        </div>
                    `;
                    
                    // Clicar no card abre o modal de feedback/comentários
                    div.addEventListener('click', () => {
                        if(typeof AppPrincipal !== 'undefined') AppPrincipal.openFeedbackModal(w.id, uid);
                    });

                    AthletePanel.elements.workoutsList.appendChild(div);
                });
            } else {
                AthletePanel.elements.workoutsList.innerHTML = '<p style="color:#666; text-align:center;">Sua planilha está vazia. Aguarde o Coach.</p>';
            }
        });
    }
};

// ===================================================================
// 5. FeedPanel (Social / Comunidade)
// ===================================================================
const FeedPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V3.0: Inicializado.");
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = {
            feedList: document.getElementById('feed-list')
        };
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        FeedPanel.state.db.ref('publicWorkouts').orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
            FeedPanel.elements.feedList.innerHTML = '';
            if (snapshot.exists()) {
                const posts = [];
                snapshot.forEach(child => { posts.push({ id: child.key, ...child.val() }); });
                posts.reverse(); 

                posts.forEach(post => {
                    const isOwner = post.ownerId === FeedPanel.state.currentUser.uid;
                    const fDate = new Date(post.timestamp).toLocaleDateString('pt-BR');
                    
                    const div = document.createElement('div');
                    div.className = 'workout-card';
                    
                    // Lógica de Avatar (V3.0)
                    const avatarUrl = post.ownerPhotoUrl || `https://placehold.co/150x150/4169E1/FFFFFF?text=${post.ownerName.charAt(0)}`;

                    div.innerHTML = `
                        <div class="workout-card-header">
                            <img src="${avatarUrl}" class="athlete-avatar" alt="Avatar" data-uid="${post.ownerId}">
                            <span class="athlete-name" data-uid="${post.ownerId}">${escapeHtml(post.ownerName)}</span>
                            <span class="date">${fDate} - ${escapeHtml(post.title)}</span>
                            <span class="status-tag ${post.status}">${post.status.replace('_', ' ')}</span>
                        </div>
                        <div class="workout-card-body">
                            ${post.feedback ? `<div class="feedback-text">"${escapeHtml(post.feedback)}"</div>` : '<div class="feedback-text" style="color:#999;">Treino concluído sem feedback escrito.</div>'}
                            ${post.photoUrl ? `<img src="${post.photoUrl}" class="workout-image" alt="Treino">` : ''}
                            
                            ${post.stravaData ? `
                            <fieldset class="strava-data-display" style="display:block; margin-top:10px;">
                                <legend><i class='bx bxl-strava'></i> Dados Extraídos</legend>
                                <p>🎯 Distância: ${post.stravaData.distancia || '--'} km | ⏱️ Tempo: ${post.stravaData.tempo || '--'} | ⚡ Ritmo: ${post.stravaData.ritmo || '--'}</p>
                            </fieldset>
                            ` : ''}
                        </div>
                        <div class="workout-card-footer">
                            <div class="workout-actions">
                                <button class="action-btn btn-like" id="like-btn-${post.id}" ${isOwner ? 'disabled title="Você não pode curtir seu próprio treino"' : ''}>
                                    <i class='bx bx-like'></i> <span id="like-count-${post.id}">0</span>
                                </button>
                                <button class="action-btn btn-comment" onclick="event.stopPropagation(); AppPrincipal.openFeedbackModal('${post.originalId}', '${post.ownerId}')">
                                    <i class='bx bx-comment'></i> <span id="comment-count-${post.id}">0</span>
                                </button>
                            </div>
                        </div>
                    `;

                    // Clique na foto ou nome abre perfil (V3.2)
                    const avatarImg = div.querySelector('.athlete-avatar');
                    const nameSpan = div.querySelector('.athlete-name');
                    const openProfileHandler = (e) => {
                        e.stopPropagation();
                        AppPrincipal.openViewProfile(post.ownerId);
                    };
                    avatarImg.addEventListener('click', openProfileHandler);
                    nameSpan.addEventListener('click', openProfileHandler);


                    // Clicar no card inteiro abre detalhes/comentários
                    div.addEventListener('click', () => {
                         if(typeof AppPrincipal !== 'undefined') AppPrincipal.openFeedbackModal(post.originalId, post.ownerId);
                    });

                    FeedPanel.elements.feedList.appendChild(div);
                    FeedPanel.attachSocialListeners(post.id, isOwner);
                });
            } else {
                FeedPanel.elements.feedList.innerHTML = '<p style="color:#666; text-align:center;">Feed vazio. Vá treinar e poste os resultados!</p>';
            }
        });
    },

    attachSocialListeners: (workoutId, isOwner) => {
        const likeBtn = document.getElementById(`like-btn-${workoutId}`);
        const likeCount = document.getElementById(`like-count-${workoutId}`);
        const commentCount = document.getElementById(`comment-count-${workoutId}`);

        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = FeedPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`feed_likes_${workoutId}`] = likesRef;
        
        likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`feed_comments_${workoutId}`] = commentsRef;
        
        commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    }
};

// ===================================================================
// 6. FinancePanel (Módulo Financeiro V2.8) - PRESERVADO
// ===================================================================
const FinancePanel = {
    state: { db: null, currentUser: null, products: {} },
    elements: {},

    init: (user, db) => {
        FinancePanel.state = { db, currentUser: user, products: {} };
        FinancePanel.elements = {
            totalReceita: document.getElementById('fin-total-receita'),
            totalDespesa: document.getElementById('fin-total-despesa'),
            saldoAtual: document.getElementById('fin-saldo'),
            
            tabLancamentosBtn: document.querySelector('[data-fin-tab="lancamentos"]'),
            tabEstoqueBtn: document.querySelector('[data-fin-tab="estoque"]'),
            tabLancamentos: document.getElementById('fin-tab-lancamentos'),
            tabEstoque: document.getElementById('fin-tab-estoque'),

            transactionForm: document.getElementById('finance-transaction-form'),
            finType: document.getElementById('fin-type'),
            finCategory: document.getElementById('fin-category'),
            finStudentSelector: document.getElementById('fin-student-selector'),
            finStudentSelect: document.getElementById('fin-student-select'),
            finProductSelector: document.getElementById('fin-product-selector'),
            finProductSelect: document.getElementById('fin-product-select'),
            finDescription: document.getElementById('fin-description'),
            finAmount: document.getElementById('fin-amount'),
            finDate: document.getElementById('fin-date'),
            transactionsList: document.getElementById('finance-transactions-list'),

            productForm: document.getElementById('finance-product-form'),
            prodName: document.getElementById('prod-name'),
            prodPrice: document.getElementById('prod-price'),
            prodCost: document.getElementById('prod-cost'),
            prodQty: document.getElementById('prod-qty'),
            inventoryList: document.getElementById('finance-inventory-list'),
        };

        FinancePanel.setupTabs();
        FinancePanel.setupDynamicForm();
        FinancePanel.loadStudents();
        FinancePanel.loadInventory();
        FinancePanel.loadTransactions();

        FinancePanel.elements.transactionForm.addEventListener('submit', FinancePanel.handleTransactionSubmit);
        FinancePanel.elements.productForm.addEventListener('submit', FinancePanel.handleProductSubmit);
    },

    setupTabs: () => {
        const btns = [FinancePanel.elements.tabLancamentosBtn, FinancePanel.elements.tabEstoqueBtn];
        const contents = [FinancePanel.elements.tabLancamentos, FinancePanel.elements.tabEstoque];

        btns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                contents.forEach(c => c.classList.add('hidden'));
                contents.forEach(c => c.classList.remove('active')); // Reset safe

                btn.classList.add('active');
                contents[index].classList.remove('hidden');
                contents[index].classList.add('active');
            });
        });
    },

    setupDynamicForm: () => {
        FinancePanel.elements.finType.addEventListener('change', () => {
            const type = FinancePanel.elements.finType.value;
            FinancePanel.elements.finCategory.innerHTML = '';
            
            if (type === 'receita') {
                FinancePanel.elements.finCategory.innerHTML = `
                    <option value="Mensalidade">Mensalidade</option>
                    <option value="Venda">Venda de Produto</option>
                    <option value="Outro">Outro</option>
                `;
            } else {
                FinancePanel.elements.finCategory.innerHTML = `
                    <option value="Salario">Salário/Pró-labore</option>
                    <option value="Marketing">Marketing/Anúncios</option>
                    <option value="Estrutura">Estrutura (Aluguel, Água...)</option>
                    <option value="Impostos">Impostos/Taxas</option>
                    <option value="Fornecedor">Compra de Estoque (Fornecedor)</option>
                    <option value="Outro">Outro</option>
                `;
            }
            FinancePanel.elements.finCategory.dispatchEvent(new Event('change'));
        });

        FinancePanel.elements.finCategory.addEventListener('change', () => {
            const cat = FinancePanel.elements.finCategory.value;
            FinancePanel.elements.finStudentSelector.classList.add('hidden');
            FinancePanel.elements.finProductSelector.classList.add('hidden');
            
            if (cat === 'Mensalidade') {
                FinancePanel.elements.finStudentSelector.classList.remove('hidden');
            } else if (cat === 'Venda') {
                FinancePanel.elements.finStudentSelector.classList.remove('hidden');
                FinancePanel.elements.finProductSelector.classList.remove('hidden');
            } else if (cat === 'Fornecedor') {
                FinancePanel.elements.finProductSelector.classList.remove('hidden');
            }
        });
        
        FinancePanel.elements.finProductSelect.addEventListener('change', () => {
            const prodId = FinancePanel.elements.finProductSelect.value;
            if(prodId && FinancePanel.state.products[prodId]) {
                const prod = FinancePanel.state.products[prodId];
                const cat = FinancePanel.elements.finCategory.value;
                if(cat === 'Venda') {
                    FinancePanel.elements.finAmount.value = prod.price;
                    FinancePanel.elements.finDescription.value = `Venda: ${prod.name}`;
                } else if (cat === 'Fornecedor') {
                    FinancePanel.elements.finAmount.value = prod.cost || 0;
                    FinancePanel.elements.finDescription.value = `Reposição: ${prod.name}`;
                }
            }
        });
    },

    loadStudents: () => {
        FinancePanel.state.db.ref('users').once('value', snap => {
            let html = '<option value="">Selecione o Aluno...</option>';
            if (snap.exists()) {
                snap.forEach(child => {
                    const user = child.val();
                    if(user.role !== 'admin') {
                        html += `<option value="${child.key}">${user.name}</option>`;
                    }
                });
            }
            FinancePanel.elements.finStudentSelect.innerHTML = html;
        });
    },

    loadInventory: () => {
        FinancePanel.state.db.ref('finance/inventory').on('value', snap => {
            FinancePanel.elements.inventoryList.innerHTML = '';
            FinancePanel.state.products = {};
            let selHtml = '<option value="">Selecione o Produto...</option>';

            if (snap.exists()) {
                snap.forEach(child => {
                    const prod = child.val();
                    FinancePanel.state.products[child.key] = prod;
                    selHtml += `<option value="${child.key}">${prod.name} (Estoque: ${prod.qty})</option>`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${prod.name}</strong><br><small style="color:#666;">Custo: R$ ${parseFloat(prod.cost||0).toFixed(2)}</small></td>
                        <td style="color:var(--success-color); font-weight:bold;">R$ ${parseFloat(prod.price).toFixed(2)}</td>
                        <td>${prod.qty}</td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="FinancePanel.updateStock('${child.key}', 1)">+1</button>
                            <button class="btn btn-small btn-danger" onclick="FinancePanel.deleteProduct('${child.key}')"><i class='bx bx-trash'></i></button>
                        </td>
                    `;
                    FinancePanel.elements.inventoryList.appendChild(tr);
                });
            } else {
                FinancePanel.elements.inventoryList.innerHTML = '<tr><td colspan="4" style="text-align:center;">Estoque vazio.</td></tr>';
            }
            FinancePanel.elements.finProductSelect.innerHTML = selHtml;
        });
    },

    loadTransactions: () => {
        FinancePanel.state.db.ref('finance/transactions').on('value', snap => {
            FinancePanel.elements.transactionsList.innerHTML = '';
            let totalReceita = 0;
            let totalDespesa = 0;

            if (snap.exists()) {
                const trxs = [];
                snap.forEach(child => trxs.push({id: child.key, ...child.val()}));
                trxs.sort((a,b) => new Date(b.date) - new Date(a.date)); // Mais recentes

                trxs.forEach(t => {
                    const isReceita = t.type === 'receita';
                    const valNum = parseFloat(t.amount);
                    if (isReceita) totalReceita += valNum; else totalDespesa += valNum;

                    const badgeClass = isReceita ? 'badge-success' : 'badge-danger';
                    const colorVal = isReceita ? 'var(--success-color)' : 'var(--danger-color)';
                    const sinal = isReceita ? '+' : '-';

                    let extraInfo = '';
                    if(t.studentName) extraInfo += `<br><small style="color:#666;"><i class='bx bx-user'></i> ${t.studentName}</small>`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${t.date.split('-').reverse().join('/')}</td>
                        <td><strong>${t.description}</strong>${extraInfo}</td>
                        <td><span class="badge ${badgeClass}">${t.category}</span></td>
                        <td style="color:${colorVal}; font-weight:bold;">${sinal} R$ ${valNum.toFixed(2)}</td>
                        <td>
                            <button class="btn btn-small btn-danger" onclick="FinancePanel.deleteTransaction('${t.id}')"><i class='bx bx-x'></i></button>
                        </td>
                    `;
                    FinancePanel.elements.transactionsList.appendChild(tr);
                });
            } else {
                FinancePanel.elements.transactionsList.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum lançamento registrado.</td></tr>';
            }

            const saldo = totalReceita - totalDespesa;
            FinancePanel.elements.totalReceita.textContent = `R$ ${totalReceita.toFixed(2)}`;
            FinancePanel.elements.totalDespesa.textContent = `R$ ${totalDespesa.toFixed(2)}`;
            FinancePanel.elements.saldoAtual.textContent = `R$ ${saldo.toFixed(2)}`;
            FinancePanel.elements.saldoAtual.style.color = saldo >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        });
    },

    handleProductSubmit: (e) => {
        e.preventDefault();
        const payload = {
            name: FinancePanel.elements.prodName.value,
            price: parseFloat(FinancePanel.elements.prodPrice.value),
            cost: parseFloat(FinancePanel.elements.prodCost.value || 0),
            qty: parseInt(FinancePanel.elements.prodQty.value)
        };
        FinancePanel.state.db.ref('finance/inventory').push(payload).then(() => {
            FinancePanel.elements.productForm.reset();
        });
    },

    updateStock: (id, change) => {
        const prodRef = FinancePanel.state.db.ref(`finance/inventory/${id}/qty`);
        prodRef.transaction(currentQty => (currentQty || 0) + change);
    },

    deleteProduct: (id) => {
        if(confirm("Excluir este produto do estoque?")) {
            FinancePanel.state.db.ref(`finance/inventory/${id}`).remove();
        }
    },

    handleTransactionSubmit: async (e) => {
        e.preventDefault();
        
        const type = FinancePanel.elements.finType.value;
        const category = FinancePanel.elements.finCategory.value;
        const amount = parseFloat(FinancePanel.elements.finAmount.value);
        const date = FinancePanel.elements.finDate.value;
        const description = FinancePanel.elements.finDescription.value;
        const studentId = FinancePanel.elements.finStudentSelect.value;
        const productId = FinancePanel.elements.finProductSelect.value;

        const payload = { type, category, amount, date, description, timestamp: Date.now() };

        if (studentId) {
            const sSnap = await FinancePanel.state.db.ref(`users/${studentId}`).once('value');
            if(sSnap.exists()) payload.studentName = sSnap.val().name;
            payload.studentId = studentId;
        }

        // Lógica de abatimento/incremento de estoque automático
        if (category === 'Venda' && productId) {
            FinancePanel.updateStock(productId, -1); // Baixa 1 no estoque
            payload.productId = productId;
        } else if (category === 'Fornecedor' && productId) {
            // Se for compra pro fornecedor, vamos assumir que comprou 1 unidade pro estoque.
            // Para sistemas complexos, pediria a QTD da compra.
            FinancePanel.updateStock(productId, 1);
            payload.productId = productId;
        }

        FinancePanel.state.db.ref('finance/transactions').push(payload).then(() => {
            FinancePanel.elements.transactionForm.reset();
            FinancePanel.elements.finCategory.dispatchEvent(new Event('change')); // Reseta selects
        });
    },

    deleteTransaction: (id) => {
        if(confirm("Excluir este lançamento financeiro?")) {
            FinancePanel.state.db.ref(`finance/transactions/${id}`).remove();
        }
    }
};
