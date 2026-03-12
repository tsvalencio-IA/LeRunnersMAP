/* =================================================================== */
/* ALUNO IA - V47 (CORREÇÃO DEFINITIVA DE EVENTOS SOCIAL)
/* 1. VISUAL: Mantido V43 (Limpo e Tracejado).
/* 2. SOCIAL: Feed Estável (Sem conflito de cliques).
/* 3. IA VISION: Blindada contra erros de leitura.
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    userData: null,
    stravaAuth: null,
    stravaData: null,
    workoutsCache: [],
    feedCache: [],
    currentView: 'plan', 
    modalState: { isOpen: false, currentWorkoutId: null },

    // --- 1. INICIALIZAÇÃO ---
    init: () => {
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppIA.auth = firebase.auth();
        AppIA.db = firebase.database();

        AppIA.setupAuthListeners();
        AppIA.setupModalListeners();
        
        if(document.getElementById('btn-tab-plan')) AppIA.switchTab('plan');

        AppIA.auth.onAuthStateChanged(user => {
            const loader = document.getElementById('loader');
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            
            if(loader) loader.classList.add('hidden');

            if (user) {
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppIA.user = user;
                        AppIA.userData = snapshot.val(); 
                        
                        if(authContainer) authContainer.classList.add('hidden');
                        if(appContainer) appContainer.classList.remove('hidden');
                        document.getElementById('user-name-display').textContent = snapshot.val().name;
                        
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts(); 
                        AppIA.loadGlobalFeed(); 
                    } else {
                        document.getElementById('pending-view').classList.remove('hidden'); 
                    }
                });
            } else {
                if(authContainer) authContainer.classList.remove('hidden');
                if(appContainer) appContainer.classList.add('hidden');
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    // --- 2. LISTENERS ---
    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            AppIA.auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .catch(err => alert("Erro Login: " + err.message));
        };

        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            AppIA.auth.createUserWithEmailAndPassword(document.getElementById('registerEmail').value, document.getElementById('registerPassword').value)
                .then((cred) => AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ name: document.getElementById('registerName').value, email: document.getElementById('registerEmail').value }))
                .catch(err => alert("Erro Registro: " + err.message));
        };

        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppIA.auth.signOut();
        
        document.getElementById('btn-generate-plan').onclick = AppIA.generatePlanWithAI;
        document.getElementById('btn-analyze-progress').onclick = AppIA.analyzeProgressWithAI;
    },

    setupModalListeners: () => {
        document.getElementById('close-feedback-modal').onclick = AppIA.closeFeedbackModal;
        document.getElementById('feedback-form').addEventListener('submit', AppIA.handleFeedbackSubmit);
        
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) {
            photoInput.addEventListener('change', AppIA.handlePhotoAnalysis);
        }
        
        document.getElementById('btn-log-manual').onclick = AppIA.openLogActivityModal;
        document.getElementById('close-log-activity-modal').onclick = AppIA.closeLogActivityModal;
        document.getElementById('log-activity-form').onsubmit = AppIA.handleLogActivitySubmit;
        
        document.getElementById('close-ia-report-modal').onclick = () => document.getElementById('ia-report-modal').classList.add('hidden');
    },

    // --- 3. DATA ENGINE ---
    getTimestamp: (dateStr) => {
        if (!dateStr) return 0;
        try {
            let s = dateStr.toString().trim().replace(/[\s\.]/g, '-');
            if (s.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) {
                const p = s.split(/[\/-]/);
                return new Date(`${p[2]}-${p[1]}-${p[0]}T12:00:00`).getTime();
            }
            if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return new Date(s + 'T12:00:00').getTime();
            }
            return new Date(s).getTime();
        } catch (e) { return 0; }
    },

    // --- 4. MOTOR DE SINCRONIZAÇÃO ---
    checkStravaConnection: () => {
        AppIA.db.ref(`users/${AppIA.user.uid}/stravaAuth`).on('value', snapshot => {
            AppIA.stravaAuth = snapshot.val(); 
            
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            
            if (snapshot.exists()) {
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Conectado ao Strava.";
                if(btnSync) btnSync.onclick = AppIA.handleSync; 
            } else {
                if(btnConnect) btnConnect.classList.remove('hidden');
                if(btnSync) btnSync.classList.add('hidden');
                if(status) status.textContent = "";
                if(btnConnect) btnConnect.onclick = () => {
                    const config = window.STRAVA_PUBLIC_CONFIG;
                    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${config.clientID}&response_type=code&redirect_uri=${config.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all`;
                };
            }
        });
    },

    handleStravaCallback: async (code) => {
        try {
            const checkUser = setInterval(async () => {
                const user = firebase.auth().currentUser;
                if (user) {
                    clearInterval(checkUser);
                    const token = await user.getIdToken();
                    await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                        body: JSON.stringify({code})
                    });
                    window.location.href = "aluno-ia.html";
                }
            }, 500);
        } catch(e) { alert("Erro ao conectar Strava."); }
    },

    refreshStravaToken: async () => {
        const token = await AppIA.user.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelRefreshAPI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error);
        return json.accessToken;
    },

    handleSync: async () => {
        const btn = document.getElementById('btn-sync-strava');
        const statusEl = document.getElementById('status-strava');
        
        if (!AppIA.stravaAuth || !AppIA.stravaAuth.accessToken) return alert("Erro de Token.");
        
        btn.disabled = true;
        const originalText = statusEl.textContent;
        statusEl.textContent = "🔄 Sincronizando...";

        try {
            let accessToken = AppIA.stravaAuth.accessToken;
            const nowSeconds = Math.floor(Date.now() / 1000);
            
            if (nowSeconds >= (AppIA.stravaAuth.expiresAt - 300)) {
                statusEl.textContent = "🔄 Renovando token...";
                accessToken = await AppIA.refreshStravaToken();
            }

            statusEl.textContent = "🔄 Buscando atividades...";
            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error("Falha na API do Strava.");
            const activities = await response.json();
            
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            const existing = snap.val() || {};
            
            const updates = {};
            let countNew = 0, countMerged = 0;

            for (const act of activities) {
                let exists = false;
                for (let k in existing) {
                    if (String(existing[k].stravaActivityId) === String(act.id)) { exists = true; break; }
                }
                if (exists) continue;

                const distKm = (act.distance / 1000).toFixed(2) + " km";
                const tempoStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                let paceStr = "0:00 /km";
                if(act.moving_time > 0 && act.distance > 0) {
                    const min = Math.floor((act.moving_time/60) / (act.distance/1000));
                    const sec = Math.floor(((act.moving_time/60) / (act.distance/1000) - min)*60);
                    paceStr = `${min}:${sec.toString().padStart(2,'0')} /km`;
                }

                const stravaPayload = {
                    distancia: distKm, tempo: tempoStr, ritmo: paceStr,
                    mapLink: `https://www.strava.com/activities/${act.id}`,
                    splits: [] 
                };
                
                if(act.splits_metric) {
                    stravaPayload.splits = act.splits_metric.map((s, idx) => ({
                        km: idx + 1,
                        pace: "0:00",
                        ele: s.elevation_difference || 0
                    }));
                }

                const actDate = act.start_date.split('T')[0];
                let matchKey = null;
                for (let k in existing) {
                    if (existing[k].date === actDate && existing[k].status === 'planejado') { matchKey = k; break; }
                }

                if (matchKey) {
                    updates[`data/${AppIA.user.uid}/workouts/${matchKey}/status`] = "realizado";
                    updates[`data/${AppIA.user.uid}/workouts/${matchKey}/stravaActivityId`] = String(act.id);
                    updates[`data/${AppIA.user.uid}/workouts/${matchKey}/stravaData`] = stravaPayload;
                    if(!existing[matchKey].feedback) updates[`data/${AppIA.user.uid}/workouts/${matchKey}/feedback`] = "Sincronizado via Strava.";
                    
                    updates[`publicWorkouts/${matchKey}`] = {
                        ...existing[matchKey],
                        status: "realizado",
                        stravaData: stravaPayload,
                        ownerId: AppIA.user.uid, 
                        ownerName: AppIA.userData.name,
                        realizadoAt: new Date().toISOString()
                    };
                    countMerged++;
                } else {
                    const newKey = AppIA.db.ref().push().key;
                    const wData = {
                        title: act.name, date: actDate, description: `[Importado]: ${act.type}`,
                        status: "realizado", createdBy: AppIA.user.uid, feedback: "Treino importado.",
                        stravaActivityId: String(act.id), stravaData: stravaPayload, createdAt: new Date().toISOString(),
                        realizadoAt: new Date().toISOString()
                    };
                    updates[`data/${AppIA.user.uid}/workouts/${newKey}`] = wData;
                    updates[`publicWorkouts/${newKey}`] = {
                        ownerId: AppIA.user.uid,
                        ownerName: AppIA.userData.name,
                        ...wData
                    };
                    countNew++;
                }
            }

            if (Object.keys(updates).length > 0) {
                await AppIA.db.ref().update(updates);
                alert(`Sucesso! ${countNew} novos, ${countMerged} vinculados.`);
            } else {
                alert("Tudo atualizado!");
            }

        } catch(e) {
            alert("Erro Sync: " + e.message);
        } finally {
            btn.disabled = false;
            statusEl.textContent = originalText;
        }
    },

    // --- 5. RENDERIZAÇÃO PLANILHA ---
    loadWorkouts: () => {
        const list = document.getElementById('workout-list');
        if(!list) return;
        
        list.innerHTML = "<p style='text-align:center; padding:1rem;'>Carregando...</p>";
        
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            list.innerHTML = ""; 
            AppIA.workoutsCache = []; 
            
            if(!snapshot.exists()) { 
                list.innerHTML = "<p style='text-align:center;'>Nenhum treino. Gere uma planilha com a IA.</p>"; 
                return; 
            }
            
            let arr = [];
            snapshot.forEach(childSnapshot => {
                arr.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });

            arr.sort((a,b) => AppIA.getTimestamp(a.date) - AppIA.getTimestamp(b.date));
            AppIA.workoutsCache = arr;

            arr.forEach(w => {
                const card = AppIA.createWorkoutCard(w);
                list.prepend(card); 
            });
        });
    },

    createWorkoutCard: (w) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        const s = (w.status || 'planejado').toLowerCase();
        const isDone = s.includes('realizado') || s.includes('concluido') || s.includes('feito');

        const btnHtml = isDone ? 
            `<button class="btn-open-feedback" style="background:var(--primary-color); color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-edit'></i> Editar</button>` :
            `<button class="btn-open-feedback" style="background:var(--success-color); color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-check-circle'></i> Registrar</button>`;

        el.innerHTML = `
            <div class="workout-card-header">
                <div><strong style="font-size:1.1em;">${w.date}</strong> <span style="color:#555;">${w.title}</span></div>
                <span class="status-tag" style="background:${isDone ? '#28a745' : '#ffc107'}; color:${isDone?'white':'#333'}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${isDone ? 'Concluído' : 'Planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${w.description || ''}</p>
                ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; margin-top:10px; border-radius:8px;">` : ''}
                ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; background:#f9f9f9; padding:8px;">"${w.feedback}"</p>` : ''}
            </div>
            <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:5px;">
                <button class="btn-delete" style="background:#ff4444; color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-trash'></i></button>
                ${btnHtml}
            </div>
        `;

        el.querySelector('.btn-open-feedback').onclick = (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); };
        el.querySelector('.btn-delete').onclick = (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); };
        el.onclick = (e) => { if (!e.target.closest('button')) AppIA.openFeedbackModal(w.id, w.title, w.date); };
        return el;
    },

    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        let splits = '';
        
        if (stravaData.splits && Array.isArray(stravaData.splits)) {
            let rows = stravaData.splits.map(s => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:4px; width:30%;">Km ${s.km}</td>
                    <td style="padding:4px; width:30%; font-weight:bold; text-align:center;">${s.pace}</td>
                    <td style="padding:4px; width:40%; text-align:right; color:#777; font-size:0.9em;">(${s.ele}m)</td>
                </tr>`).join('');
            
            splits = `
                <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #ccc;">
                    <strong style="display:block; margin-bottom:5px; font-size:0.85rem; color:#555;">🏁 Parciais:</strong>
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                        ${rows}
                    </table>
                </div>`;
        }
        
        return `
            <fieldset class="strava-data-display" style="border:1px solid #fc4c02; background:#fff5f0; padding:10px; border-radius:5px; margin-top:10px;">
                <legend style="color:#fc4c02; font-weight:bold; font-size:0.9rem;">
                    <img src="img/strava.png" alt="Strava" style="height:20px; vertical-align:middle; margin-right:5px;">Dados
                </legend>
                <div style="font-family:monospace; font-weight:bold; font-size:1rem; color:#333; margin-bottom:5px;">
                    Dist: ${stravaData.distancia} | Tempo: ${stravaData.tempo} | Pace: ${stravaData.ritmo}
                </div>
                ${stravaData.mapLink ? `<a href="${stravaData.mapLink}" target="_blank" style="font-size:0.85rem; color:#fc4c02; text-decoration:underline;">🗺️ Ver no Strava</a>` : ''}
                ${splits}
            </fieldset>
        `;
    },

    // --- 6. CÉREBRO IA ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');
        try {
            let history = AppIA.workoutsCache;
            let prompt = "";
            const today = new Date().toISOString().split('T')[0];

            if (!history || history.length === 0) {
                prompt = `
                ATUE COMO: Fisiologista Sênior e Treinador de Elite.
                ALUNO: Iniciante (Sem histórico).
                OBJETIVO: Criar microciclo de ADAPTAÇÃO (3 treinos).
                FOCO: Caminhada/Trote leve.
                SAÍDA JSON: [ { "date": "YYYY-MM-DD", "title": "...", "description": "..." } ]
                `;
            } else {
                history.sort((a,b) => AppIA.getTimestamp(a.date) - AppIA.getTimestamp(b.date));
                const recent = history.slice(-15).map(w => ({ date: w.date, title: w.title, dist: w.stravaData?.distancia }));
                
                prompt = `
                ATUE COMO: Fisiologista Sênior da Seleção Brasileira.
                HISTÓRICO: ${JSON.stringify(recent)}. DATA REF: ${today}.
                MISSÃO: Prescrever APENAS as 3 próximas sessões de treino físico.
                REGRAS:
                1. 🚫 PROIBIDO criar cards de "Análise" ou "Texto".
                2. O JSON deve conter APENAS treinos.
                3. Se o último foi forte, prescreva regenerativo.
                SAÍDA ESTRITAMENTE JSON: [ { "date": "YYYY-MM-DD", "title": "...", "description": "..." } ]
                `;
            }

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const json = await r.json();
            const text = json.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const newW = JSON.parse(text);
            
            const updates = {};
            newW.forEach(w => {
                const k = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${k}`] = { ...w, status: 'planejado', createdBy: 'IA_PHYSIO', createdAt: new Date().toISOString() };
            });
            await AppIA.db.ref().update(updates);
            alert("Planilha Gerada com Sucesso!");
        } catch (e) { alert(e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');
        try {
            let history = AppIA.workoutsCache;
            if (!history || history.length === 0) throw new Error("Sem histórico.");
            history.sort((a,b) => AppIA.getTimestamp(a.date) - AppIA.getTimestamp(b.date));
            const lastWorkouts = history.slice(-15).map(w => ({
                data: w.date, treino: w.title, status: w.status,
                dist: w.stravaData?.distancia || 'N/A', pace: w.stravaData?.ritmo || 'N/A',
                feedback: w.feedback || ""
            }));
                        const prompt = `
            ATUE COMO: Treinador de Corrida.
            
            HISTÓRICO RECENTE (Cronológico - O último item é o mais recente):
            ${JSON.stringify(lastWorkouts)}
            
            MISSÃO:
            1. Analise o último treino REALIZADO (Confirme a data exata que está no JSON, não converta fuso).
            2. Analise a evolução dos últimos 5 treinos realizados. O volume está subindo ou descendo?
            3. Dê uma recomendação para a próxima semana.
            `;
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const json = await r.json();
            document.getElementById('ia-report-content').textContent = json.candidates[0].content.parts[0].text; 
            document.getElementById('ia-report-modal').classList.remove('hidden');
        } catch(e) { alert("Erro: " + e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- 7. UTEIS E MANUAL ---
    deleteWorkout: async (workoutId) => {
        if(confirm("Apagar?")) {
            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove();
            await AppIA.db.ref(`publicWorkouts/${workoutId}`).remove();
        }
    },

    openLogActivityModal: () => {
        document.getElementById('log-activity-form').reset();
        document.getElementById('log-activity-modal').classList.remove('hidden');
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    },
    closeLogActivityModal: () => document.getElementById('log-activity-modal').classList.add('hidden'),
    
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('log-activity-form').querySelector('button');
        btn.disabled = true;
        try {
            const d = { 
                date: document.getElementById('log-date').value, 
                title: document.getElementById('log-title').value, 
                description: document.getElementById('log-description').value, 
                status: 'realizado', createdBy: 'MANUAL', createdAt: new Date().toISOString() 
            };
            const ref = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(d);
            await AppIA.db.ref(`publicWorkouts/${ref.key}`).set({
                ownerId: AppIA.user.uid, ownerName: AppIA.userData ? AppIA.userData.name : "Atleta", ...d
            });
            document.getElementById('log-activity-modal').classList.add('hidden');
        } catch(err) { alert(err.message); } finally { btn.disabled = false; }
    },

        openFeedbackModal: (id, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = id;
        
        // --- CORREÇÃO: Limpar dados residuais da IA ---
        // Isso garante que dados de fotos anteriores não apareçam neste novo treino
        AppIA.stravaData = null; 
        const stravaDisplay = document.getElementById('strava-data-display');
        if(stravaDisplay) {
            stravaDisplay.innerHTML = '';
            stravaDisplay.classList.add('hidden');
        }
        // ----------------------------------------------

        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('photo-upload-input').value = null;
        
        document.getElementById('feedback-modal').classList.remove('hidden');
        
        // Lógica original para inserir o campo de data, se não existir
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const d = document.createElement('div'); d.className = 'form-group';
            d.innerHTML = `<label>Data Realizada</label><input type="date" id="feedback-date-realized" style="width:100%;">`;
            form.prepend(d); 
        }

        // Lógica original de formatação da data (DD/MM/AAAA -> YYYY-MM-DD)
        let s = originalDate ? originalDate.toString().trim().replace(/[\s\.]/g, '-') : '';
        if(s.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) { 
            const p = s.split(/[\/-]/); 
            s = `${p[2]}-${p[1]}-${p[0]}`; 
        }
        
        // Preenche a data no input
        const dateInput = document.getElementById('feedback-date-realized');
        if(dateInput) dateInput.value = s;
    },
    
    closeFeedbackModal: () => document.getElementById('feedback-modal').classList.add('hidden'),
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-feedback-btn'); btn.disabled = true;
        try {
            const updates = {
                status: document.getElementById('workout-status').value,
                feedback: document.getElementById('workout-feedback-text').value,
                date: document.getElementById('feedback-date-realized').value,
                realizadoAt: new Date().toISOString()
            };
            const file = document.getElementById('photo-upload-input').files[0];
            if(file) {
                const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
                const d = await r.json(); updates.imageUrl = d.secure_url;
            }
            if(AppIA.stravaData) updates.stravaData = AppIA.stravaData;
            
            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${AppIA.modalState.currentWorkoutId}`).update(updates);
            
            if(updates.status === 'realizado') {
                const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${AppIA.modalState.currentWorkoutId}`).once('value');
                const fullData = snap.val();
                await AppIA.db.ref(`publicWorkouts/${AppIA.modalState.currentWorkoutId}`).set({
                    ownerId: AppIA.user.uid, ownerName: AppIA.userData ? AppIA.userData.name : "Atleta", ...fullData
                });
            } else {
                await AppIA.db.ref(`publicWorkouts/${AppIA.modalState.currentWorkoutId}`).remove();
            }

            document.getElementById('feedback-modal').classList.add('hidden');
            alert("Salvo!");
        } catch(err) { alert(err.message); } finally { btn.disabled = false; }
    },

        // --- 8. FUNÇÃO DE FOTO BLINDADA (CORRIGIDA) ---
    handlePhotoAnalysis: async (e) => {
        const file = e.target.files[0]; 
        if (!file) return;

        const disp = document.getElementById('strava-data-display');
        // Limpa dados anteriores para evitar salvar lixo
        AppIA.stravaData = null; 

        if(disp) {
            disp.classList.remove('hidden');
            disp.innerHTML = `<div style="text-align:center; color:#666; padding:10px;"><i class='bx bx-loader-alt bx-spin' style="font-size:1.5em;"></i><br>Lendo dados da foto...</div>`;
        }

        try {
            const base64 = await new Promise((r,j)=>{
                const d=new FileReader();
                d.onload=()=>r(d.result.split(',')[1]);
                d.onerror=j;
                d.readAsDataURL(file)
            });

            // PROMPT MELHORADO: Força o formato string para evitar erros de cálculo na visualização
            const promptText = `
                Analise esta imagem de painel de esteira ou relógio GPS.
                Extraia EXATAMENTE neste formato JSON (mantenha como strings):
                {
                    "distancia": "5.00 km", 
                    "tempo": "00:00:00", 
                    "ritmo": "0:00 /km"
                }
                Se não encontrar algum dado, tente estimar ou use "0". Responda APENAS o JSON.
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    contents:[{
                        parts:[
                            {text: promptText},
                            {inlineData:{mimeType:file.type, data:base64}}
                        ]
                    }]
                })
            });
            
            const d = await r.json();
            
            // EXTRAÇÃO CIRÚRGICA DO JSON (Ignora textos antes ou depois)
            let text = d.candidates[0].content.parts[0].text;
            const firstOpen = text.indexOf('{');
            const lastClose = text.lastIndexOf('}');
            
            if(firstOpen !== -1 && lastClose !== -1) {
                text = text.substring(firstOpen, lastClose + 1);
                AppIA.stravaData = JSON.parse(text);

                if (disp) {
                    disp.classList.remove('hidden');
                    disp.innerHTML = `
                        <fieldset class="strava-data-display" style="border:1px solid #28a745; background:#f0fff4; padding:10px; border-radius:5px; margin-top:10px;">
                            <legend style="color:#28a745; font-weight:bold; font-size:0.9rem;">
                                <i class='bx bx-camera'></i> Dados Extraídos
                            </legend>
                            <div style="font-weight:bold; font-size:1rem; color:#333; text-align:center;">
                                🏃 ${AppIA.stravaData.distancia} <br> 
                                ⏱️ ${AppIA.stravaData.tempo} <br> 
                                ⚡ ${AppIA.stravaData.ritmo}
                            </div>
                        </fieldset>
                    `;
                }
            } else {
                throw new Error("Não foi possível ler os números na imagem.");
            }

        } catch(e) { 
            console.error(e);
            if(disp) disp.innerHTML = `<div style="color:red; text-align:center;">Erro ao ler foto. Digite manualmente.</div>`;
            AppIA.stravaData = null;
        }
    },


    // --- 9. MÓDULO FEED SOCIAL (CORRIGIDO) ---
    switchTab: (view) => {
        AppIA.currentView = view;
        const btnPlan = document.getElementById('btn-tab-plan');
        const btnFeed = document.getElementById('btn-tab-feed');
        const viewPlan = document.getElementById('view-plan');
        const viewFeed = document.getElementById('view-feed');

        if(view === 'plan') {
            if(btnPlan) btnPlan.style.background = '#007bff'; btnPlan.style.color = 'white';
            if(btnFeed) btnFeed.style.background = '#eee'; btnFeed.style.color = '#555';
            if(viewPlan) viewPlan.classList.remove('hidden');
            if(viewFeed) viewFeed.classList.add('hidden');
        } else {
            if(btnPlan) btnPlan.style.background = '#eee'; btnPlan.style.color = '#555';
            if(btnFeed) btnFeed.style.background = '#007bff'; btnFeed.style.color = 'white';
            if(viewPlan) viewPlan.classList.add('hidden');
            if(viewFeed) viewFeed.classList.remove('hidden');
            AppIA.loadGlobalFeed(); 
        }
    },

    loadGlobalFeed: () => {
        const feedList = document.getElementById('feed-list');
        const feedLoading = document.getElementById('feed-loading');
        if(!feedList) return;

        AppIA.db.ref('publicWorkouts').limitToLast(50).on('value', snapshot => {
            if(feedLoading) feedLoading.classList.add('hidden');
            feedList.innerHTML = "";
            
            if(!snapshot.exists()) {
                feedList.innerHTML = "<p style='text-align:center;'>Nenhum treino público ainda.</p>";
                return;
            }

            const arr = [];
            snapshot.forEach(child => {
                arr.push({ id: child.key, ...child.val() });
            });

            const getT = (d) => d ? new Date(d).getTime() : 0;
            arr.sort((a,b) => getT(b.realizadoAt || b.date) - getT(a.realizadoAt || a.date));

            arr.forEach(post => {
                feedList.appendChild(AppIA.createFeedCard(post));
            });
        });
    },

        createFeedCard: (post) => {
        const el = document.createElement('div');
        el.className = 'feed-card';
        // Estilo adicionado diretamente para garantir visualização
        el.style.cssText = "background:white; padding:15px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border:1px solid #eee; margin-bottom:15px;";
        
        const myUid = AppIA.user ? AppIA.user.uid : null;
        const likes = post.likes || {};
        const isLiked = myUid && likes[myUid] === true;
        const likeCount = Object.keys(likes).length;
        
        // Renderização dos dados do Strava ou Foto IA
        let stravaHtml = "";
        if(post.stravaData) {
            stravaHtml = `
            <div style="background:#f8f9fa; border-left:4px solid #fc4c02; padding:10px; margin:10px 0; font-size:0.9em; color:#333; border-radius:0 4px 4px 0;">
                <div style="font-weight:bold; color:#fc4c02; margin-bottom:4px;">Resumo do Treino:</div>
                <span>📍 ${post.stravaData.distancia}</span> • 
                <span>⏱️ ${post.stravaData.tempo}</span> • 
                <span>⚡ ${post.stravaData.ritmo}</span>
            </div>`;
        }

        const comments = post.comments || {};
        // Ordena comentários para o mais recente ficar embaixo
        const commentsHtml = Object.values(comments).map(c => 
            `<div style="font-size:0.85em; border-top:1px solid #f0f0f0; padding:6px 0;">
                <strong style="color:#333;">${c.author}:</strong> <span style="color:#555;">${c.text}</span>
             </div>`
        ).join('');

        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:40px; height:40px; background:#e9ecef; color:#007bff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.1em;">
                        ${post.ownerName ? post.ownerName.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div>
                        <div style="font-weight:bold; font-size:1em; color:#222;">${post.ownerName || 'Atleta'}</div>
                        <div style="font-size:0.8em; color:#888;">${post.date}</div>
                    </div>
                </div>
            </div>
            
            <h3 style="margin:0 0 5px 0; font-size:1.1em; color:#333;">${post.title}</h3>
            <p style="font-size:0.95em; color:#666; line-height:1.4;">${post.description || ''}</p>
            
            ${stravaHtml}
            ${post.imageUrl ? `<div style="margin-top:10px; border-radius:8px; overflow:hidden;"><img src="${post.imageUrl}" style="width:100%; display:block;"></div>` : ''}
            
            <div style="margin-top:15px; display:flex; align-items:center; gap:20px; border-top:1px solid #eee; padding-top:12px;">
                <button class="btn-like-action" data-id="${post.id}" style="background:none; border:none; cursor:pointer; color:${isLiked ? '#e91e63' : '#666'}; font-weight:600; display:flex; align-items:center; gap:6px; font-size:0.95em; transition: transform 0.1s;">
                    <i class='bx ${isLiked ? 'bxs-heart' : 'bx-heart'}' style="font-size:1.2em;"></i> <span>${likeCount}</span>
                </button>
                <div style="color:#666; display:flex; align-items:center; gap:6px; font-size:0.95em;">
                    <i class='bx bx-message-rounded' style="font-size:1.2em;"></i> Comentários
                </div>
            </div>
            
            <div style="margin-top:12px; background:#fafafa; padding:12px; border-radius:8px;">
                <div style="max-height:150px; overflow-y:auto; margin-bottom:10px;">${commentsHtml}</div>
                <form class="comment-form-action" style="display:flex; gap:8px;">
                    <input type="text" placeholder="Escreva um comentário..." style="flex:1; padding:8px 12px; border:1px solid #ddd; border-radius:20px; font-size:0.9em; outline:none;" required>
                    <button type="submit" style="background:#007bff; color:white; border:none; padding:6px 15px; border-radius:20px; font-size:0.9em; font-weight:bold; cursor:pointer;">Enviar</button>
                </form>
            </div>
        `;

        // --- CORREÇÃO DOS LISTENERS ---
        
        // 1. Like (Usando referência direta ao botão criado)
        const likeBtn = el.querySelector('.btn-like-action');
        likeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Feedback visual imediato (Otimista)
            likeBtn.style.transform = "scale(1.2)";
            setTimeout(() => likeBtn.style.transform = "scale(1)", 150);
            AppIA.toggleLike(post.id, !isLiked);
        };

        // 2. Comentário (Submit do Form)
        const commentForm = el.querySelector('.comment-form-action');
        commentForm.onsubmit = (e) => {
            e.preventDefault(); // Impede recarregar a página
            const input = commentForm.querySelector('input');
            const text = input.value.trim();
            if(text) {
                AppIA.addComment(post.id, text);
                input.value = ''; // Limpa o campo
                input.blur(); // Fecha o teclado no mobile
            }
        };

        return el;
    },

    toggleLike: (workoutId, shouldLike) => {
        if(!AppIA.user) return;
        const uid = AppIA.user.uid;
        const ref = AppIA.db.ref(`publicWorkouts/${workoutId}/likes/${uid}`);
        if(shouldLike) ref.set(true);
        else ref.remove();
    },

    addComment: (workoutId, text) => {
        if(!AppIA.user) return;
        const uid = AppIA.user.uid;
        const name = AppIA.userData.name || "Anônimo";
        AppIA.db.ref(`publicWorkouts/${workoutId}/comments`).push({
            authorId: uid,
            author: name,
            text: text,
            timestamp: new Date().toISOString()
        });
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);