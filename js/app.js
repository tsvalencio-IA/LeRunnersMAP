/* =================================================================== */
/* APP.JS - VERSÃO MESTRA 11.0 (COFRE DE CHAVES BLINDADO NO FIREBASE)
/* LERUNNERS - SISTEMA DE TREINOS E GPS TRACKER
/* FIX: Escopo global de constantes (correção de inicialização silenciosa)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        viewMode: 'admin', 
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaTokenData: null,
        currentAnalysisData: null
    },
    elements: {},

    // --- INICIALIZAÇÃO ---
    init: () => {
        // CORREÇÃO CRÍTICA: Variáveis "const" não vão para o objeto "window".
        // Lemos "firebaseConfig" diretamente do escopo global.
        if (typeof firebaseConfig === 'undefined') {
            console.error("Erro Crítico: firebaseConfig não foi encontrado!");
            return;
        }
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
        } catch (e) {
            console.error("Erro Firebase:", e);
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.injectStravaLogic();
            AppPrincipal.initPlatform();
        }
    },
    
    // --- NOVO: BUSCA DE CHAVES NO COFRE (FIREBASE) ---
    loadSystemConfigs: async () => {
        return new Promise((resolve) => {
            AppPrincipal.state.db.ref('config/apiKeys').on('value', snap => {
                if (snap.exists()) {
                    const keys = snap.val();
                    window.GEMINI_API_KEY = keys.geminiKey || "";
                    window.GOOGLE_MAPS_KEY = keys.mapsKey || "";
                    window.CLOUDINARY_CONFIG = {
                        cloudName: keys.cloudinaryName || "",
                        uploadPreset: keys.cloudinaryPreset || ""
                    };
                    
                    // Se o Google Maps não foi carregado ainda, mas a chave existe, inicializa.
                    if (window.GOOGLE_MAPS_KEY && window.GPSTracker && !window.GPSTracker.mapsLoaded) {
                        // Apenas prepara, a função real é chamada ao abrir o modal
                    }
                }
                resolve();
            });
        });
    },

    injectStravaLogic: () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const scope = urlParams.get('scope');

        if (code && scope && scope.includes('activity:read_all')) {
            console.log("Código Strava recebido. Chamando Vercel...");
            
            AppPrincipal.state.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const idToken = await user.getIdToken();
                        
                        // Chamada para seu backend serverless (Vercel)
                        const response = await fetch('https://le-runners-rp.vercel.app/api/strava-exchange', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({ code: code })
                        });

                        const result = await response.json();
                        
                        if (response.ok) {
                            alert("Strava conectado com sucesso!");
                            // Limpa a URL
                            window.history.replaceState({}, document.title, window.location.pathname);
                        } else {
                            throw new Error(result.error || "Falha na conexão com Strava.");
                        }
                    } catch (error) {
                        console.error("Erro OAuth Strava:", error);
                        alert("Não foi possível completar a conexão com o Strava. " + error.message);
                    }
                }
            });
        } else if (code) {
             alert("Atenção: Você precisa autorizar a leitura das atividades para o sistema funcionar.");
             window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    initPlatform: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutBtn: document.getElementById('logoutButton'),
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            mainContent: document.getElementById('app-main-content'),
            
            // Perfil
            navProfileBtn: document.getElementById('nav-profile-btn'),
            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            profilePicPreview: document.getElementById('profile-pic-preview'),
            profilePicUpload: document.getElementById('profile-pic-upload'),
            profileUploadFeedback: document.getElementById('profile-upload-feedback'),
            profileName: document.getElementById('profile-name'),
            profileBio: document.getElementById('profile-bio'),

            // View de Perfil
            viewProfileModal: document.getElementById('view-profile-modal'),
            closeViewProfileModal: document.getElementById('close-view-profile-modal'),
            viewProfilePic: document.getElementById('view-profile-pic'),
            viewProfileName: document.getElementById('view-profile-name'),
            viewProfileBio: document.getElementById('view-profile-bio'),
            
            // Financeiro
            navFinanceBtn: document.getElementById('nav-finance-btn'),

            // Modais de Treino (Preservados)
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackForm: document.getElementById('feedback-form'),
            commentsList: document.getElementById('comments-list'),
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),

            // Atividade Avulsa
            logActivityModal: document.getElementById('log-activity-modal'),
            closeLogActivityModal: document.getElementById('close-log-activity-modal'),
            logActivityForm: document.getElementById('log-activity-form'),

            whoLikedModal: document.getElementById('who-liked-modal'),
            closeWhoLikedModal: document.getElementById('close-who-liked-modal'),
            whoLikedList: document.getElementById('who-liked-list'),

            iaAnalysisModal: document.getElementById('ia-analysis-modal'),
            closeIaAnalysisModal: document.getElementById('close-ia-analysis-modal'),
            iaAnalysisOutput: document.getElementById('ia-analysis-output'),
            saveIaAnalysisBtn: document.getElementById('save-ia-analysis-btn')
        };

        AppPrincipal.state.auth.onAuthStateChanged(async user => {
            if (user) {
                AppPrincipal.state.currentUser = user;
                // AGUARDA AS CHAVES DO COFRE ANTES DE RENDERIZAR O PAINEL
                await AppPrincipal.loadSystemConfigs();
                AppPrincipal.loadUserData(user.uid);
            } else {
                window.location.href = 'index.html';
            }
        });

        AppPrincipal.setupEventListeners();
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('admins').once('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
            
            AppPrincipal.state.db.ref('users/' + uid).on('value', userSnap => {
                if (userSnap.exists()) {
                    AppPrincipal.state.userData = userSnap.val();
                    AppPrincipal.elements.userDisplay.textContent = AppPrincipal.state.userData.name;
                    AppPrincipal.elements.loader.classList.add('hidden');
                    AppPrincipal.elements.appContainer.classList.remove('hidden');

                    if (AppPrincipal.state.adminUIDs[uid]) {
                        AppPrincipal.state.viewMode = 'admin';
                        if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.remove('hidden');
                        document.body.classList.remove('atleta-view');
                        document.body.classList.add('admin-view');
                    } else {
                        AppPrincipal.state.viewMode = 'atleta';
                        if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.add('hidden');
                        document.body.classList.remove('admin-view');
                        document.body.classList.add('atleta-view');
                    }

                    AppPrincipal.switchView(AppPrincipal.state.currentView);
                } else {
                    AppPrincipal.state.auth.signOut();
                }
            });
        });
    },

    setupEventListeners: () => {
        AppPrincipal.elements.logoutBtn.addEventListener('click', () => AppPrincipal.state.auth.signOut());
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.switchView('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.switchView('feed'));
        
        if (AppPrincipal.elements.navFinanceBtn) {
            AppPrincipal.elements.navFinanceBtn.addEventListener('click', () => AppPrincipal.switchView('financeiro'));
        }

        // Navegação Perfil
        AppPrincipal.elements.navProfileBtn.addEventListener('click', () => {
            AppPrincipal.elements.profileName.value = AppPrincipal.state.userData.name || '';
            AppPrincipal.elements.profileBio.value = AppPrincipal.state.userData.bio || '';
            AppPrincipal.elements.profilePicPreview.src = AppPrincipal.state.userData.photoUrl || `https://placehold.co/150x150/4169E1/FFFFFF?text=${AppPrincipal.state.userData.name.charAt(0)}`;
            AppPrincipal.elements.profileModal.classList.remove('hidden');
        });
        AppPrincipal.elements.closeProfileModal.addEventListener('click', () => {
            AppPrincipal.elements.profileModal.classList.add('hidden');
        });

        // Upload de Imagem de Perfil via Cloudinary
        AppPrincipal.elements.profilePicUpload.addEventListener('change', async (e) => {
             const file = e.target.files[0];
             if (!file) return;

             if(!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName || !window.CLOUDINARY_CONFIG.uploadPreset) {
                 alert("O Banco de Imagens (Cloudinary) não está configurado no Cofre de APIs.");
                 e.target.value = "";
                 return;
             }

             AppPrincipal.elements.profileUploadFeedback.textContent = "Fazendo upload da imagem...";
             AppPrincipal.elements.profilePicUpload.disabled = true;

             const formData = new FormData();
             formData.append('file', file);
             formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);

             try {
                 const response = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                     method: 'POST',
                     body: formData
                 });
                 const data = await response.json();
                 
                 if(data.secure_url) {
                     AppPrincipal.elements.profilePicPreview.src = data.secure_url;
                     AppPrincipal.elements.profileUploadFeedback.textContent = "Imagem carregada! Clique em Salvar.";
                     AppPrincipal.elements.profilePicPreview.dataset.newUrl = data.secure_url;
                 }
             } catch (error) {
                 AppPrincipal.elements.profileUploadFeedback.textContent = "Erro no upload. Tente novamente.";
                 console.error(error);
             } finally {
                 AppPrincipal.elements.profilePicUpload.disabled = false;
             }
        });

        // Salvar Perfil
        AppPrincipal.elements.profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = AppPrincipal.elements.profileName.value.trim();
            const newBio = AppPrincipal.elements.profileBio.value.trim();
            const newPhotoUrl = AppPrincipal.elements.profilePicPreview.dataset.newUrl || AppPrincipal.state.userData.photoUrl;

            const updates = {
                name: newName,
                bio: newBio,
                photoUrl: newPhotoUrl
            };

            AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update(updates)
                .then(() => {
                    alert("Perfil atualizado com sucesso!");
                    AppPrincipal.elements.profileModal.classList.add('hidden');
                    // Atualiza posts antigos no feed com a nova foto e nome
                    AppPrincipal.updateUserPostsInfo(AppPrincipal.state.currentUser.uid, newName, newPhotoUrl);
                })
                .catch(error => alert("Erro ao atualizar: " + error.message));
        });

        // Modal View Profile
        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', () => {
             AppPrincipal.elements.viewProfileModal.classList.add('hidden');
        });

        // Modais Atividade/Feedback
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeModal);
        
        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', () => {
            AppPrincipal.elements.logActivityModal.classList.add('hidden');
            AppPrincipal.elements.logActivityForm.reset();
        });

        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', () => {
            AppPrincipal.elements.whoLikedModal.classList.add('hidden');
        });

        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', () => {
             AppPrincipal.elements.iaAnalysisModal.classList.add('hidden');
        });

        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);

        document.getElementById('photo-upload-input').addEventListener('change', AppPrincipal.handlePhotoUpload);

        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.saveIaAnalysis);
    },

    // --- LÓGICA DE UPDATE EM MASSA (FEED) ---
    updateUserPostsInfo: (uid, newName, newPhotoUrl) => {
        AppPrincipal.state.db.ref('publicWorkouts').orderByChild('ownerId').equalTo(uid).once('value', snapshot => {
            if(snapshot.exists()) {
                const updates = {};
                snapshot.forEach(child => {
                    updates[`${child.key}/ownerName`] = newName;
                    updates[`${child.key}/ownerPhotoUrl`] = newPhotoUrl;
                });
                AppPrincipal.state.db.ref('publicWorkouts').update(updates);
            }
        });
    },

    // --- EXIBIR PERFIL PÚBLICO ---
    openViewProfile: (uid) => {
        AppPrincipal.elements.viewProfileName.textContent = "Carregando...";
        AppPrincipal.elements.viewProfileBio.textContent = "";
        AppPrincipal.elements.viewProfilePic.src = "https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta";
        AppPrincipal.elements.viewProfileModal.classList.remove('hidden');

        // Busca direto no banco em vez de usar cache para garantir dados frescos
        AppPrincipal.state.db.ref(`users/${uid}`).once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                AppPrincipal.elements.viewProfileName.textContent = data.name;
                AppPrincipal.elements.viewProfileBio.textContent = data.bio || "Nenhuma biografia informada.";
                if(data.photoUrl) {
                    AppPrincipal.elements.viewProfilePic.src = data.photoUrl;
                } else {
                    AppPrincipal.elements.viewProfilePic.src = `https://placehold.co/150x150/4169E1/FFFFFF?text=${data.name.charAt(0)}`;
                }
            } else {
                AppPrincipal.elements.viewProfileName.textContent = "Usuário não encontrado";
            }
        });
    },

    switchView: (viewName) => {
        AppPrincipal.state.currentView = viewName;
        
        AppPrincipal.elements.navPlanilhaBtn.classList.remove('active');
        AppPrincipal.elements.navFeedBtn.classList.remove('active');
        if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.remove('active');
        
        AppPrincipal.elements.mainContent.innerHTML = '';
        AppPrincipal.clearAllListeners();

        if (viewName === 'planilha') {
            AppPrincipal.elements.navPlanilhaBtn.classList.add('active');
            if (AppPrincipal.state.viewMode === 'admin') {
                const template = document.getElementById('admin-panel-template');
                AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                if(typeof AdminPanel !== 'undefined') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                const template = document.getElementById('atleta-panel-template');
                AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                if(typeof AthletePanel !== 'undefined') AthletePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (viewName === 'feed') {
            AppPrincipal.elements.navFeedBtn.classList.add('active');
            const template = document.getElementById('feed-panel-template');
            AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
            if(typeof FeedPanel !== 'undefined') FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else if (viewName === 'financeiro' && AppPrincipal.state.viewMode === 'admin') {
            AppPrincipal.elements.navFinanceBtn.classList.add('active');
            const template = document.getElementById('finance-panel-template');
            AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
            if(typeof FinancePanel !== 'undefined') FinancePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
    },

    clearAllListeners: () => {
        for (const path in AppPrincipal.state.listeners) {
            AppPrincipal.state.listeners[path].off();
        }
        AppPrincipal.state.listeners = {};
    },

    getUserName: async (uid) => {
        if (AppPrincipal.state.userCache[uid]) return AppPrincipal.state.userCache[uid].name;
        const snap = await AppPrincipal.state.db.ref('users/' + uid).once('value');
        if (snap.exists()) {
            AppPrincipal.state.userCache[uid] = snap.val();
            return snap.val().name;
        }
        return "Usuário Desconhecido";
    },
    
    getUserPhoto: async (uid) => {
        if (AppPrincipal.state.userCache[uid] && AppPrincipal.state.userCache[uid].photoUrl) return AppPrincipal.state.userCache[uid].photoUrl;
        const snap = await AppPrincipal.state.db.ref('users/' + uid).once('value');
        if (snap.exists() && snap.val().photoUrl) {
            if(!AppPrincipal.state.userCache[uid]) AppPrincipal.state.userCache[uid] = snap.val();
            return snap.val().photoUrl;
        }
        return null;
    },

    // --- GESTÃO DE IMAGENS E STRAVA ---
    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if(!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName || !window.CLOUDINARY_CONFIG.uploadPreset) {
            alert("O Banco de Imagens (Cloudinary) não está configurado no Cofre de APIs.");
            e.target.value = "";
            return;
        }

        const feedbackEl = document.getElementById('photo-upload-feedback');
        feedbackEl.textContent = "Fazendo upload para a nuvem...";
        document.getElementById('save-feedback-btn').disabled = true;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if(data.secure_url) {
                AppPrincipal.state.modal.newPhotoUrl = data.secure_url;
                feedbackEl.textContent = "Upload concluído! Analisando imagem (IA)...";
                await AppPrincipal.extractDataWithGemini(data.secure_url);
            } else {
                throw new Error("Falha no retorno do Cloudinary.");
            }
        } catch (error) {
            feedbackEl.textContent = "Erro no upload da imagem.";
            console.error(error);
        } finally {
            document.getElementById('save-feedback-btn').disabled = false;
        }
    },

    extractDataWithGemini: async (imageUrl) => {
        const feedbackEl = document.getElementById('photo-upload-feedback');
        
        if(!window.GEMINI_API_KEY) {
            feedbackEl.textContent = "IA Desativada: Chave Gemini não configurada no Cofre.";
            return;
        }

        try {
            const fetchImg = await fetch(imageUrl);
            const blob = await fetchImg.blob();
            const reader = new FileReader();
            
            reader.readAsDataURL(blob); 
            reader.onloadend = async function() {
                const base64data = reader.result.split(',')[1];
                
                const prompt = `
                Você é um assistente de extração de dados do Strava/Garmin/Coros.
                Analise esta imagem de um treino e retorne APENAS um JSON válido.
                Não invente dados. Se não achar, retorne null no campo.
                
                Formato:
                {
                    "distancia": "valor numérico em km (ex: 5.02)",
                    "tempo": "tempo total (ex: 30:15)",
                    "ritmo": "ritmo médio (ex: 5:40 /km)"
                }
                `;

                const bodyData = {
                    contents: [{
                        parts: [
                            {text: prompt},
                            {inlineData: {mimeType: "image/jpeg", data: base64data}}
                        ]
                    }]
                };

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(bodyData)
                });

                if(!response.ok) throw new Error("Falha na API Gemini");
                const data = await response.json();
                
                let textResult = data.candidates[0].content.parts[0].text;
                textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const extData = JSON.parse(textResult);
                
                // Exibe no HUD
                document.getElementById('strava-data-display').classList.remove('hidden');
                document.getElementById('strava-data-distancia').textContent = `🎯 Distância: ${extData.distancia || '--'} km`;
                document.getElementById('strava-data-tempo').textContent = `⏱️ Tempo: ${extData.tempo || '--'}`;
                document.getElementById('strava-data-ritmo').textContent = `⚡ Ritmo: ${extData.ritmo || '--'}`;
                
                feedbackEl.textContent = "Análise concluída com sucesso!";

                // Salva no estado para despachar junto com o form
                AppPrincipal.state.modal.extractedData = extData;

            };
        } catch (error) {
            console.error("Erro Gemini Vision:", error);
            feedbackEl.textContent = "Não foi possível extrair dados da imagem.";
        }
    },

    // --- MODAIS (LÓGICA PRESERVADA) ---
    openFeedbackModal: (workoutId, ownerId) => {
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        AppPrincipal.state.modal.newPhotoUrl = null;
        AppPrincipal.state.modal.extractedData = null;

        AppPrincipal.elements.feedbackWorkoutId.value = workoutId;
        AppPrincipal.elements.feedbackWorkoutOwnerId.value = ownerId;
        
        AppPrincipal.elements.workoutStatus.value = 'planejado';
        AppPrincipal.elements.workoutFeedbackText.value = '';
        document.getElementById('photo-upload-input').value = '';
        document.getElementById('photo-upload-feedback').textContent = '';
        document.getElementById('strava-data-display').classList.add('hidden');

        // Busca dados atuais do treino
        AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}`).once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if(data.status) AppPrincipal.elements.workoutStatus.value = data.status;
                if(data.feedback) AppPrincipal.elements.workoutFeedbackText.value = data.feedback;
                if(data.photoUrl) {
                    AppPrincipal.state.modal.newPhotoUrl = data.photoUrl;
                    document.getElementById('photo-upload-feedback').textContent = "Imagem já anexada anteriormente.";
                }
                
                // Se já tinha dados do Strava/IA gravados, exibe
                if(data.stravaData) {
                    document.getElementById('strava-data-display').classList.remove('hidden');
                    document.getElementById('strava-data-distancia').textContent = `🎯 Distância: ${data.stravaData.distancia || '--'} km`;
                    document.getElementById('strava-data-tempo').textContent = `⏱️ Tempo: ${data.stravaData.tempo || '--'}`;
                    document.getElementById('strava-data-ritmo').textContent = `⚡ Ritmo: ${data.stravaData.ritmo || '--'}`;
                }
            }
        });

        AppPrincipal.loadComments(workoutId);
        AppPrincipal.elements.feedbackModal.classList.remove('hidden');
        AppPrincipal.state.modal.isOpen = true;
    },

    closeModal: () => {
        AppPrincipal.elements.feedbackModal.classList.add('hidden');
        AppPrincipal.state.modal.isOpen = false;
        if (AppPrincipal.state.listeners.comments) {
            AppPrincipal.state.listeners.comments.off();
        }
    },

    handleFeedbackSubmit: (e) => {
        e.preventDefault();
        const workoutId = AppPrincipal.elements.feedbackWorkoutId.value;
        const ownerId = AppPrincipal.elements.feedbackWorkoutOwnerId.value;
        const status = AppPrincipal.elements.workoutStatus.value;
        const feedback = AppPrincipal.elements.workoutFeedbackText.value;
        
        const updates = { 
            status: status, 
            feedback: feedback 
        };

        if(AppPrincipal.state.modal.newPhotoUrl) {
            updates.photoUrl = AppPrincipal.state.modal.newPhotoUrl;
        }
        
        if(AppPrincipal.state.modal.extractedData) {
            updates.stravaData = AppPrincipal.state.modal.extractedData;
        }

        const btn = document.getElementById('save-feedback-btn');
        btn.disabled = true;
        btn.textContent = "Salvando...";

        AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}`).update(updates)
            .then(() => {
                // Publicar no feed se foi realizado e for o próprio atleta editando
                if ((status === 'realizado' || status === 'realizado_parcial') && ownerId === AppPrincipal.state.currentUser.uid) {
                    AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}`).once('value', s => {
                        const workoutData = s.val();
                        // Prepara objeto para o feed
                        const publicData = { ...workoutData, ownerId: ownerId, ownerName: AppPrincipal.state.userData.name };
                        // Se atleta tem foto de perfil, manda junto
                        if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
                        
                        // Atualiza no feed (busca se já existe pra não duplicar infinitamente)
                        AppPrincipal.state.db.ref('publicWorkouts').orderByChild('originalId').equalTo(workoutId).once('value', pubSnap => {
                            if(pubSnap.exists()) {
                                const pubKey = Object.keys(pubSnap.val())[0];
                                AppPrincipal.state.db.ref(`publicWorkouts/${pubKey}`).update(publicData);
                            } else {
                                publicData.originalId = workoutId;
                                AppPrincipal.state.db.ref('publicWorkouts').push(publicData);
                            }
                        });
                    });
                }

                alert('Treino salvo com sucesso!');
                AppPrincipal.closeModal();
            })
            .catch(error => {
                alert('Erro ao salvar: ' + error.message);
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = "Salvar Feedback";
            });
    },

    loadComments: (workoutId) => {
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners.comments = commentsRef;
        
        commentsRef.on('value', async snapshot => {
            AppPrincipal.elements.commentsList.innerHTML = '';
            if (snapshot.exists()) {
                const comments = [];
                snapshot.forEach(child => { comments.push(child.val()); });
                
                for (const comment of comments) {
                    const div = document.createElement('div');
                    div.className = 'comment-item';
                    
                    // Busca foto do autor (V3.0)
                    const photoUrl = await AppPrincipal.getUserPhoto(comment.authorId);
                    const imgTag = photoUrl ? `<img src="${photoUrl}" style="width:20px; height:20px; border-radius:50%; vertical-align:middle; margin-right:5px; object-fit:cover;">` : '';

                    div.innerHTML = `
                        ${imgTag}<strong>${comment.author}</strong> 
                        <span style="font-size:0.7rem; color:#999;">${new Date(comment.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                        <div style="margin-top: 4px; padding-left:25px;">${escapeHtml(comment.text)}</div>
                    `;
                    AppPrincipal.elements.commentsList.appendChild(div);
                }
                // Scroll para o fim
                AppPrincipal.elements.commentsList.scrollTop = AppPrincipal.elements.commentsList.scrollHeight;
            } else {
                AppPrincipal.elements.commentsList.innerHTML = '<p style="color:#999; font-size:0.9rem; text-align:center;">Nenhum comentário ainda.</p>';
            }
        });
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = AppPrincipal.elements.commentInput.value.trim();
        if (!text) return;
        
        const workoutId = AppPrincipal.state.modal.currentWorkoutId;
        const uid = AppPrincipal.state.currentUser.uid;
        const name = AppPrincipal.state.userData.name;

        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).push({
            authorId: uid,
            author: name,
            text: text,
            timestamp: Date.now()
        }).then(() => {
            AppPrincipal.elements.commentInput.value = '';
        });
    },

    handleLogActivitySubmit: (e) => {
        e.preventDefault();
        const date = document.getElementById('log-activity-date').value;
        const type = document.getElementById('log-activity-type').value;
        const title = document.getElementById('log-activity-title').value;
        const feedback = document.getElementById('log-activity-feedback').value;

        const workoutData = {
            date: date,
            title: title,
            type: type,
            feedback: feedback,
            status: 'realizado',
            timestamp: Date.now()
        };

        const uid = AppPrincipal.state.currentUser.uid;

        AppPrincipal.state.db.ref(`workouts/${uid}`).push(workoutData)
            .then((ref) => {
                const publicData = { ...workoutData, ownerId: uid, ownerName: AppPrincipal.state.userData.name, originalId: ref.key };
                if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
                AppPrincipal.state.db.ref('publicWorkouts').push(publicData);
                
                alert("Atividade registrada e publicada no feed!");
                AppPrincipal.elements.logActivityModal.classList.add('hidden');
                AppPrincipal.elements.logActivityForm.reset();
            });
    },

    openWhoLikedModal: (workoutId) => {
        AppPrincipal.elements.whoLikedList.innerHTML = '<li>Carregando...</li>';
        AppPrincipal.elements.whoLikedModal.classList.remove('hidden');

        AppPrincipal.state.db.ref(`workoutLikes/${workoutId}`).once('value', snapshot => {
            AppPrincipal.elements.whoLikedList.innerHTML = '';
            if (snapshot.exists()) {
                const promises = [];
                snapshot.forEach(child => {
                    promises.push(AppPrincipal.getUserName(child.key));
                });
                
                Promise.all(promises).then(names => {
                    names.forEach(name => {
                        const li = document.createElement('li');
                        li.textContent = name;
                        AppPrincipal.elements.whoLikedList.appendChild(li);
                    });
                });
            } else {
                 AppPrincipal.elements.whoLikedList.innerHTML = '<li>Ninguém curtiu ainda.</li>';
            }
        });
    },

    // IA LOGIC (Coach Side)
    generateIaAnalysis: async (athleteId) => {
        const btn = document.getElementById('analyze-athlete-btn-ia');
        const output = AppPrincipal.elements.iaAnalysisOutput;
        
        if(!window.GEMINI_API_KEY) {
            alert("IA Desativada: A Chave do Gemini não foi configurada no Cofre de APIs.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processando dados...";
        output.textContent = "Coletando histórico do atleta no Firebase...\n";
        AppPrincipal.elements.saveIaAnalysisBtn.classList.add('hidden');
        AppPrincipal.elements.iaAnalysisModal.classList.remove('hidden');

        try {
            // 1. Busca treinos das últimas 4 semanas
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            const isoDate = fourWeeksAgo.toISOString().split('T')[0];

            const snap = await AppPrincipal.state.db.ref(`workouts/${athleteId}`).orderByChild('date').startAt(isoDate).once('value');
            
            let historyText = "";
            let workoutsCount = 0;
            let realizedCount = 0;

            if (snap.exists()) {
                snap.forEach(child => {
                    const w = child.val();
                    workoutsCount++;
                    if(w.status === 'realizado' || w.status === 'realizado_parcial') realizedCount++;

                    historyText += `Data: ${w.date} | Titulo: ${w.title} | Status: ${w.status} | Feedback Atleta: "${w.feedback || 'Sem feedback'}"`;
                    if(w.stravaData) {
                        historyText += ` | Real (Strava/GPS): Dist:${w.stravaData.distancia || '-'}, Tempo:${w.stravaData.tempo || '-'}`;
                    }
                    historyText += "\n";
                });
            }

            if (workoutsCount === 0) {
                 output.textContent = "Atleta não possui treinos registrados no último mês para análise.";
                 btn.disabled = false;
                 btn.innerHTML = "<i class='bx bxs-brain'></i> Gerar Nova Análise (Gemini)";
                 return;
            }

            output.textContent += `Foram encontrados ${workoutsCount} treinos (${realizedCount} concluídos). Enviando ao Fisiologista Virtual (Gemini 2.0)...\n\n`;

            // 2. Monta Prompt
            const prompt = `
            Você é um Fisiologista e Treinador de Corrida de Elite (Coach).
            Faça uma análise de performance e engajamento deste atleta com base no histórico das últimas 4 semanas.
            
            DADOS DOS TREINOS (Cronológico):
            ${historyText}

            INSTRUÇÕES PARA O RELATÓRIO:
            1. Consistência: Avalie se o atleta cumpriu o planejado (taxa de adesão).
            2. Evolução/Feedback: O que os comentários dele indicam? (Dores, cansaço, melhora de pace).
            3. Cruzamento IA/Strava: Se houver dados reais (Strava/GPS), compare com a sensação dele.
            4. Recomendação Clínica: Dê 2 sugestões práticas de ajuste para a próxima planilha (ex: reduzir volume, focar na mobilidade, manter a base).
            
            Formatação: Use tópicos curtos e profissionais em markdown (texto puro).
            `;

            // 3. Chama Gemini
            const bodyData = {
                contents: [{ parts: [{text: prompt}] }]
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(bodyData)
            });

            if(!response.ok) throw new Error("Falha na API Gemini");
            const data = await response.json();
            
            const markdownResult = data.candidates[0].content.parts[0].text;
            output.textContent = markdownResult;

            // Armazena no state para poder salvar
            AppPrincipal.state.currentAnalysisData = {
                athleteId: athleteId,
                report: markdownResult,
                timestamp: Date.now()
            };

            AppPrincipal.elements.saveIaAnalysisBtn.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            output.textContent += "ERRO: Não foi possível gerar a análise.\nVerifique a API Key no Cofre e sua conexão.";
        } finally {
            btn.disabled = false;
            btn.innerHTML = "<i class='bx bxs-brain'></i> Gerar Nova Análise (Gemini)";
        }
    },

    saveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        const data = AppPrincipal.state.currentAnalysisData;
        const btn = AppPrincipal.elements.saveIaAnalysisBtn;
        
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";

        try {
            await AppPrincipal.state.db.ref(`clinicalAnalysis/${data.athleteId}`).push({
                report: data.report,
                timestamp: data.timestamp,
                coachId: AppPrincipal.state.currentUser.uid
            });
            alert("Análise salva no prontuário do atleta!");
            AppPrincipal.elements.iaAnalysisModal.classList.add('hidden');
        } catch(e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = "<i class='bx bx-save'></i> Salvar Análise";
        }
    }
};

/* =================================================================== */
/* MOTOR STRAVA CLONE PROPRIETÁRIO (LeRunners GPS)
/* Rastreio Híbrido Independente
/* =================================================================== */
window.GPSTracker = {
    map: null, polyline: null, marker: null, watchId: null, timerInterval: null,
    positions: [], totalDistance: 0, seconds: 0, isRunning: false, mapsLoaded: false,

    initGoogleMaps: () => {
        if(window.GPSTracker.mapsLoaded) return;
        if(typeof window.GOOGLE_MAPS_KEY === 'undefined' || window.GOOGLE_MAPS_KEY === "") {
            alert("Atenção: A chave do Google Maps não foi configurada no Cofre. Peça ao Admin para configurar em 'Configurações & APIs'.");
            return;
        }
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_KEY}&libraries=geometry&callback=GPSTracker.onMapsLoaded`;
        s.async = true; s.defer = true;
        document.head.appendChild(s);
    },
    onMapsLoaded: () => {
        window.GPSTracker.mapsLoaded = true;
        window.GPSTracker.map = new google.maps.Map(document.getElementById('gps-map'), {
            zoom: 16, center: {lat: -23.5505, lng: -46.6333}, disableDefaultUI: true, mapId: 'LERUNNERS_GPS'
        });
        window.GPSTracker.polyline = new google.maps.Polyline({
            map: window.GPSTracker.map, strokeColor: '#fc4c02', strokeWeight: 6, strokeOpacity: 0.8
        });
        window.GPSTracker.marker = new google.maps.Marker({
            map: window.GPSTracker.map, icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });
        
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(p => {
                const pos = {lat: p.coords.latitude, lng: p.coords.longitude};
                window.GPSTracker.map.setCenter(pos);
                window.GPSTracker.marker.setPosition(pos);
            });
        }
    },
    open: () => {
        document.getElementById('gps-tracker-modal').classList.remove('hidden');
        window.GPSTracker.initGoogleMaps();
    },
    close: () => {
        if(window.GPSTracker.isRunning) window.GPSTracker.stop(false);
        document.getElementById('gps-tracker-modal').classList.add('hidden');
    },
    start: () => {
        if(window.GPSTracker.isRunning) return;
        window.GPSTracker.isRunning = true;
        document.getElementById('btn-gps-start').classList.add('hidden');
        document.getElementById('btn-gps-pause').classList.remove('hidden');
        document.getElementById('btn-gps-stop').classList.remove('hidden');

        window.GPSTracker.timerInterval = setInterval(() => {
            window.GPSTracker.seconds++;
            window.GPSTracker.updateUI();
        }, 1000);

        if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(console.error);

        window.GPSTracker.watchId = navigator.geolocation.watchPosition(pos => {
            if(!window.google || !window.google.maps || !window.google.maps.geometry) return;

            const newPos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
            
            if(window.GPSTracker.positions.length > 0) {
                const lastPos = window.GPSTracker.positions[window.GPSTracker.positions.length - 1];
                const dist = google.maps.geometry.spherical.computeDistanceBetween(lastPos, newPos);
                // Filtro logístico anti-ruído: só conta se for avanço real e plausível (evita pulos)
                if(dist > 0 && dist < 50) window.GPSTracker.totalDistance += dist;
            }
            
            window.GPSTracker.positions.push(newPos);
            
            if(window.GPSTracker.polyline) window.GPSTracker.polyline.setPath(window.GPSTracker.positions);
            if(window.GPSTracker.marker) window.GPSTracker.marker.setPosition(newPos);
            if(window.GPSTracker.map) window.GPSTracker.map.panTo(newPos);
            
            window.GPSTracker.updateUI();
        }, err => {
            console.error("GPS Error:", err); alert("Ative a localização exata do seu celular.");
        }, {enableHighAccuracy: true, maximumAge: 0, timeout: 5000});
    },
    pause: () => {
        window.GPSTracker.isRunning = false;
        clearInterval(window.GPSTracker.timerInterval);
        navigator.geolocation.clearWatch(window.GPSTracker.watchId);
        const pauseBtn = document.getElementById('btn-gps-pause');
        pauseBtn.innerHTML = "<i class='bx bx-play'></i>";
        pauseBtn.onclick = window.GPSTracker.resume;
        pauseBtn.style.backgroundColor = "var(--success-color)";
    },
    resume: () => {
        const pauseBtn = document.getElementById('btn-gps-pause');
        pauseBtn.innerHTML = "<i class='bx bx-pause'></i>";
        pauseBtn.onclick = window.GPSTracker.pause;
        pauseBtn.style.backgroundColor = "var(--warning-color)";
        window.GPSTracker.start();
    },
    stop: (askToSave = true) => {
        window.GPSTracker.isRunning = false;
        clearInterval(window.GPSTracker.timerInterval);
        if(window.GPSTracker.watchId) navigator.geolocation.clearWatch(window.GPSTracker.watchId);
        
        if(askToSave && window.GPSTracker.totalDistance > 50) { 
            if(confirm("Treino finalizado! Deseja salvar na sua planilha e postar no Feed?")) {
                window.GPSTracker.saveWorkout();
            } else {
                window.GPSTracker.reset();
                window.GPSTracker.close();
            }
        } else {
            window.GPSTracker.reset();
            window.GPSTracker.close();
        }
    },
    updateUI: () => {
        const h = Math.floor(window.GPSTracker.seconds / 3600);
        const m = Math.floor((window.GPSTracker.seconds % 3600) / 60);
        const s = window.GPSTracker.seconds % 60;
        document.getElementById('gps-time').innerText = `${h > 0 ? h+':' : ''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        const km = (window.GPSTracker.totalDistance / 1000);
        document.getElementById('gps-distance').innerHTML = `${km.toFixed(2)} <span style="font-size:0.8rem">km</span>`;
        
        if(km > 0.05) { // Threshold de cálculo do pace
            const paceMinPerKm = (window.GPSTracker.seconds / 60) / km;
            if(paceMinPerKm < 60) { 
                const pm = Math.floor(paceMinPerKm);
                const ps = Math.round((paceMinPerKm - pm) * 60);
                document.getElementById('gps-pace').innerText = `${pm}:${ps.toString().padStart(2,'0')}`;
            }
        }
    },
    reset: () => {
        window.GPSTracker.seconds = 0; window.GPSTracker.totalDistance = 0; window.GPSTracker.positions = [];
        if(window.GPSTracker.polyline) window.GPSTracker.polyline.setPath([]);
        
        document.getElementById('btn-gps-start').classList.remove('hidden');
        document.getElementById('btn-gps-pause').classList.add('hidden');
        document.getElementById('btn-gps-stop').classList.add('hidden');
        
        const pauseBtn = document.getElementById('btn-gps-pause');
        pauseBtn.innerHTML = "<i class='bx bx-pause'></i>";
        pauseBtn.onclick = window.GPSTracker.pause;
        pauseBtn.style.backgroundColor = "var(--warning-color)";

        window.GPSTracker.updateUI();
        document.getElementById('gps-distance').innerHTML = `0.00 <span style="font-size:0.8rem">km</span>`;
        document.getElementById('gps-pace').innerText = `--:--`;
    },
    saveWorkout: async () => {
        const title = prompt("Dê um título para sua corrida:", "Corrida Livre (LeRunners GPS)");
        if(!title) { window.GPSTracker.resume(); return; }
        
        const km = (window.GPSTracker.totalDistance / 1000).toFixed(2);
        const h = Math.floor(window.GPSTracker.seconds / 3600);
        const m = Math.floor((window.GPSTracker.seconds % 3600) / 60);
        const s = window.GPSTracker.seconds % 60;
        const timeStr = `${h > 0 ? h+'h ' : ''}${m}m ${s}s`;
        
        const paceMinPerKm = (window.GPSTracker.seconds / 60) / (window.GPSTracker.totalDistance / 1000);
        const pm = Math.floor(paceMinPerKm);
        const ps = Math.round((paceMinPerKm - pm) * 60);
        const paceStr = `${pm}:${ps.toString().padStart(2,'0')} /km`;

        const workoutData = {
            title: title,
            date: new Date().toISOString().split('T')[0],
            distancia: km + " km", // Compatibility match com o banco atual
            tempo: timeStr,
            pace: paceStr,
            type: "Corrida",
            isGpsTracked: true,
            status: "realizado",
            ownerId: AppPrincipal.state.currentUser.uid,
            ownerName: AppPrincipal.state.userData.name || "Atleta"
        };

        try {
            const dbRef = AppPrincipal.state.db || firebase.database();
            const pRef = await dbRef.ref(`workouts/${workoutData.ownerId}`).push(workoutData);
            
            // Preparação pro Feed Social preservada
            const publicData = { ...workoutData, originalId: pRef.key };
            if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
            await dbRef.ref(`publicWorkouts`).push(publicData);
            
            alert("Treino salvo com sucesso! O Coach já tem acesso.");
            window.GPSTracker.reset();
            window.GPSTracker.close();
        } catch(e) {
            console.error(e); alert("Erro de conexão ao salvar corrida.");
        }
    }
};

const AuthLogic = {
    auth: null, db: null, elements: {},
    init: (authRef, dbRef) => {
        AuthLogic.auth = authRef; AuthLogic.db = dbRef;
        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            loginErrorMsg: document.getElementById('login-error'),
            registerErrorMsg: document.getElementById('register-error'),
            pendingView: document.getElementById('pending-view'),
            pendingEmailDisplay: document.getElementById('pending-email-display'),
            btnLogoutPending: document.getElementById('btn-logout-pending')
        };
        AuthLogic.setupListeners();
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    setupListeners: () => {
        AuthLogic.elements.toggleToRegister.addEventListener('click', (e) => { e.preventDefault(); AuthLogic.showView('register'); });
        AuthLogic.elements.toggleToLogin.addEventListener('click', (e) => { e.preventDefault(); AuthLogic.showView('login'); });
        AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        if(AuthLogic.elements.btnLogoutPending) AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
    },
    showView: (viewName) => {
        AuthLogic.elements.loginForm.classList.add('hidden');
        AuthLogic.elements.registerForm.classList.add('hidden');
        if(AuthLogic.elements.pendingView) AuthLogic.elements.pendingView.classList.add('hidden');
        document.querySelector('.toggle-link:nth-of-type(1)').classList.add('hidden');
        document.querySelector('.toggle-link:nth-of-type(2)').classList.add('hidden');
        if (viewName === 'login') { AuthLogic.elements.loginForm.classList.remove('hidden'); document.querySelector('.toggle-link:nth-of-type(1)').classList.remove('hidden'); } 
        else if (viewName === 'register') { AuthLogic.elements.registerForm.classList.remove('hidden'); document.querySelector('.toggle-link:nth-of-type(2)').classList.remove('hidden'); } 
        else if (viewName === 'pending') { if(AuthLogic.elements.pendingView) AuthLogic.elements.pendingView.classList.remove('hidden'); }
    },
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value;
        AuthLogic.elements.loginErrorMsg.textContent = "Conectando...";
        AuthLogic.auth.signInWithEmailAndPassword(email, password).catch(err => AuthLogic.elements.loginErrorMsg.textContent = "Acesso Negado: Credenciais inválidas.");
    },
    handleRegister: (e) => {
        e.preventDefault(); AuthLogic.elements.registerErrorMsg.textContent = "Aguarde...";
        const name = document.getElementById('registerName').value; const email = document.getElementById('registerEmail').value; const password = document.getElementById('registerPassword').value;
        if(password.length<6) return AuthLogic.elements.registerErrorMsg.textContent = "Senha mínima 6 caracteres.";
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((c) => AuthLogic.db.ref('pendingApprovals/'+c.user.uid).set({ name, email, requestDate: new Date().toISOString() }))
            .catch(e => AuthLogic.elements.registerErrorMsg.textContent = e.code === 'auth/email-already-in-use' ? "Email já existe." : "Erro ao criar conta.");
    },
    handleLoginGuard: (user) => {
        if (!user) return AuthLogic.showView('login');
        AuthLogic.db.ref('admins/' + user.uid).once('value', s => {
            if (s.exists() && s.val()) return window.location.href = 'app.html';
            AuthLogic.db.ref('users/' + user.uid).once('value', s2 => {
                if (s2.exists()) return window.location.href = 'app.html';
                AuthLogic.db.ref('pendingApprovals/' + user.uid).once('value', s3 => {
                    if (s3.exists()) { if(AuthLogic.elements.pendingEmailDisplay) AuthLogic.elements.pendingEmailDisplay.textContent = user.email; AuthLogic.showView('pending'); }
                    else { AuthLogic.auth.signOut(); AuthLogic.showView('login'); }
                });
            });
        });
    }
};

// Start 
document.addEventListener('DOMContentLoaded', AppPrincipal.init);
