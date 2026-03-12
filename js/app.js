/* =================================================================== */
/* APP.JS - VERSÃO MESTRA 11.9 (CORREÇÃO CRÍTICA TELA DE LOGIN)
/* LERUNNERS - SISTEMA DE TREINOS E GPS TRACKER
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
        if (typeof firebaseConfig === 'undefined') {
            console.error("Erro Crítico: firebaseConfig não foi encontrado!");
            return;
        }
        try {
            if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
        } catch (e) { console.error("Erro Firebase:", e); }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.injectStravaLogic();
            AppPrincipal.initPlatform();
        }
    },
    
    loadSystemConfigs: async () => {
        return new Promise((resolve) => {
            AppPrincipal.state.db.ref('config/apiKeys').once('value')
                .then(snap => {
                    if (snap.exists()) {
                        const keys = snap.val();
                        window.GEMINI_API_KEY = keys.geminiKey || "";
                        window.GOOGLE_MAPS_KEY = keys.mapsKey || "";
                        window.CLOUDINARY_CONFIG = {
                            cloudName: keys.cloudName || "",
                            uploadPreset: keys.cloudPreset || ""
                        };
                    }
                    resolve();
                })
                .catch(error => {
                    console.error("Falha ao carregar cofre de APIs:", error);
                    resolve(); 
                });
        });
    },

    injectStravaLogic: () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const scope = urlParams.get('scope');

        if (code && scope && scope.includes('activity:read_all')) {
            AppPrincipal.state.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const idToken = await user.getIdToken();
                        const response = await fetch('https://le-runners-rp.vercel.app/api/strava-exchange', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                            body: JSON.stringify({ code: code })
                        });
                        const result = await response.json();
                        if (response.ok) {
                            alert("Strava conectado com sucesso!");
                            window.history.replaceState({}, document.title, window.location.pathname);
                        } else throw new Error(result.error);
                    } catch (error) {
                        alert("Não foi possível completar a conexão. " + error.message);
                    }
                }
            });
        }
    },

    initPlatform: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutBtn: document.getElementById('logoutButton'),
            
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navMeuTreinoBtn: document.getElementById('nav-meu-treino-btn'),
            navFinanceBtn: document.getElementById('nav-finance-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            navProfileBtn: document.getElementById('nav-profile-btn'),
            mainContent: document.getElementById('app-main-content'),
            
            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            profilePicPreview: document.getElementById('profile-pic-preview'),
            profilePicUpload: document.getElementById('profile-pic-upload'),
            profileUploadFeedback: document.getElementById('profile-upload-feedback'),
            profileName: document.getElementById('profile-name'),
            profileBio: document.getElementById('profile-bio'),

            viewProfileModal: document.getElementById('view-profile-modal'),
            closeViewProfileModal: document.getElementById('close-view-profile-modal'),
            viewProfilePic: document.getElementById('view-profile-pic'),
            viewProfileName: document.getElementById('view-profile-name'),
            viewProfileBio: document.getElementById('view-profile-bio'),

            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackForm: document.getElementById('feedback-form'),
            commentsList: document.getElementById('comments-list'),
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),

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
                await AppPrincipal.loadSystemConfigs();
                AppPrincipal.loadUserData(user.uid);
            } else {
                window.location.href = 'index.html';
            }
        });

        AppPrincipal.setupEventListeners();
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('admins').once('value')
            .then(snapshot => {
                AppPrincipal.state.adminUIDs = snapshot.val() || {};
                
                AppPrincipal.state.db.ref('users/' + uid).on('value', userSnap => {
                    if (userSnap.exists()) {
                        AppPrincipal.state.userData = userSnap.val();
                        
                        if(AppPrincipal.elements.userDisplay) {
                            AppPrincipal.elements.userDisplay.textContent = AppPrincipal.state.userData.name;
                        }
                        
                        if(AppPrincipal.elements.loader) AppPrincipal.elements.loader.classList.add('hidden');
                        if(AppPrincipal.elements.appContainer) AppPrincipal.elements.appContainer.classList.remove('hidden');

                        if (AppPrincipal.state.adminUIDs[uid]) {
                            AppPrincipal.state.viewMode = 'admin';
                            if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.remove('hidden');
                            if(AppPrincipal.elements.navMeuTreinoBtn) AppPrincipal.elements.navMeuTreinoBtn.classList.remove('hidden');
                            document.body.classList.add('admin-view');
                        } else {
                            AppPrincipal.state.viewMode = 'atleta';
                            if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.add('hidden');
                            if(AppPrincipal.elements.navMeuTreinoBtn) AppPrincipal.elements.navMeuTreinoBtn.classList.add('hidden');
                            document.body.classList.add('atleta-view');
                        }

                        AppPrincipal.switchView(AppPrincipal.state.currentView);
                    } else {
                        AppPrincipal.state.auth.signOut();
                    }
                });
            })
            .catch(error => {
                if(AppPrincipal.elements.loader) AppPrincipal.elements.loader.classList.add('hidden');
                alert("Falha de conexão com o banco de dados.");
            });
    },

    setupEventListeners: () => {
        if(AppPrincipal.elements.logoutBtn) AppPrincipal.elements.logoutBtn.addEventListener('click', () => AppPrincipal.state.auth.signOut());
        if(AppPrincipal.elements.navPlanilhaBtn) AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.switchView('planilha'));
        if(AppPrincipal.elements.navMeuTreinoBtn) AppPrincipal.elements.navMeuTreinoBtn.addEventListener('click', () => AppPrincipal.switchView('meu-treino'));
        if(AppPrincipal.elements.navFeedBtn) AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.switchView('feed'));
        if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.addEventListener('click', () => AppPrincipal.switchView('financeiro'));

        if(AppPrincipal.elements.navProfileBtn) {
            AppPrincipal.elements.navProfileBtn.addEventListener('click', () => {
                AppPrincipal.elements.profileName.value = AppPrincipal.state.userData.name || '';
                AppPrincipal.elements.profileBio.value = AppPrincipal.state.userData.bio || '';
                AppPrincipal.elements.profilePicPreview.src = AppPrincipal.state.userData.photoUrl || `https://placehold.co/150x150/4169E1/FFFFFF?text=${AppPrincipal.state.userData.name.charAt(0)}`;
                AppPrincipal.elements.profileModal.classList.remove('hidden');
            });
        }

        if(AppPrincipal.elements.closeProfileModal) AppPrincipal.elements.closeProfileModal.addEventListener('click', () => AppPrincipal.elements.profileModal.classList.add('hidden'));

        if(AppPrincipal.elements.profilePicUpload) {
            AppPrincipal.elements.profilePicUpload.addEventListener('change', async (e) => {
                 const file = e.target.files[0];
                 if (!file) return;

                 if(!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName) {
                     alert("O Banco de Imagens não está configurado no Cofre de APIs.");
                     e.target.value = ""; return;
                 }

                 AppPrincipal.elements.profileUploadFeedback.textContent = "Fazendo upload...";
                 AppPrincipal.elements.profilePicUpload.disabled = true;

                 const formData = new FormData();
                 formData.append('file', file);
                 formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);

                 try {
                     const response = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: formData });
                     const data = await response.json();
                     if(data.secure_url) {
                         AppPrincipal.elements.profilePicPreview.src = data.secure_url;
                         AppPrincipal.elements.profileUploadFeedback.textContent = "Imagem carregada! Clique em Salvar.";
                         AppPrincipal.elements.profilePicPreview.dataset.newUrl = data.secure_url;
                     }
                 } catch (error) {
                     AppPrincipal.elements.profileUploadFeedback.textContent = "Erro no upload.";
                 } finally {
                     AppPrincipal.elements.profilePicUpload.disabled = false;
                 }
            });
        }

        if(AppPrincipal.elements.profileForm) {
            AppPrincipal.elements.profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newName = AppPrincipal.elements.profileName.value.trim();
                const newBio = AppPrincipal.elements.profileBio.value.trim();
                const newPhotoUrl = AppPrincipal.elements.profilePicPreview.dataset.newUrl || AppPrincipal.state.userData.photoUrl;

                AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name: newName, bio: newBio, photoUrl: newPhotoUrl })
                    .then(() => {
                        alert("Perfil atualizado com sucesso!");
                        AppPrincipal.elements.profileModal.classList.add('hidden');
                        AppPrincipal.updateUserPostsInfo(AppPrincipal.state.currentUser.uid, newName, newPhotoUrl);
                    });
            });
        }

        if(AppPrincipal.elements.closeViewProfileModal) AppPrincipal.elements.closeViewProfileModal.addEventListener('click', () => AppPrincipal.elements.viewProfileModal.classList.add('hidden'));
        if(AppPrincipal.elements.closeFeedbackModal) AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeModal);
        
        if(AppPrincipal.elements.closeLogActivityModal) {
            AppPrincipal.elements.closeLogActivityModal.addEventListener('click', () => {
                AppPrincipal.elements.logActivityModal.classList.add('hidden');
                AppPrincipal.elements.logActivityForm.reset();
            });
        }

        if(AppPrincipal.elements.closeWhoLikedModal) AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', () => AppPrincipal.elements.whoLikedModal.classList.add('hidden'));
        if(AppPrincipal.elements.closeIaAnalysisModal) AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', () => AppPrincipal.elements.iaAnalysisModal.classList.add('hidden'));

        if(AppPrincipal.elements.feedbackForm) AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        if(AppPrincipal.elements.commentForm) AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        if(AppPrincipal.elements.logActivityForm) AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);

        const photoUploadInput = document.getElementById('photo-upload-input');
        if(photoUploadInput) photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);

        if(AppPrincipal.elements.saveIaAnalysisBtn) AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.saveIaAnalysis);
    },

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

    openViewProfile: (uid) => {
        AppPrincipal.elements.viewProfileName.textContent = "Carregando...";
        AppPrincipal.elements.viewProfilePic.src = "https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta";
        AppPrincipal.elements.viewProfileModal.classList.remove('hidden');

        AppPrincipal.state.db.ref(`users/${uid}`).once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                AppPrincipal.elements.viewProfileName.textContent = data.name;
                AppPrincipal.elements.viewProfileBio.textContent = data.bio || "";
                AppPrincipal.elements.viewProfilePic.src = data.photoUrl || `https://placehold.co/150x150/4169E1/FFFFFF?text=${data.name.charAt(0)}`;
            }
        });
    },

    switchView: (viewName) => {
        AppPrincipal.state.currentView = viewName;
        
        if(AppPrincipal.elements.navPlanilhaBtn) AppPrincipal.elements.navPlanilhaBtn.classList.remove('active');
        if(AppPrincipal.elements.navMeuTreinoBtn) AppPrincipal.elements.navMeuTreinoBtn.classList.remove('active');
        if(AppPrincipal.elements.navFeedBtn) AppPrincipal.elements.navFeedBtn.classList.remove('active');
        if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.remove('active');
        
        if(AppPrincipal.elements.mainContent) AppPrincipal.elements.mainContent.innerHTML = '';
        AppPrincipal.clearAllListeners();

        if (viewName === 'planilha') {
            if(AppPrincipal.elements.navPlanilhaBtn) AppPrincipal.elements.navPlanilhaBtn.classList.add('active');
            if (AppPrincipal.state.viewMode === 'admin') {
                const template = document.getElementById('admin-panel-template');
                if(template) {
                    AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                    if(typeof AdminPanel !== 'undefined') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                }
            } else {
                const template = document.getElementById('atleta-panel-template');
                if(template) {
                    AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                    if(typeof AtletaPanel !== 'undefined') AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db, AppPrincipal.state.userData);
                }
            }
        } else if (viewName === 'meu-treino') { 
            if(AppPrincipal.elements.navMeuTreinoBtn) AppPrincipal.elements.navMeuTreinoBtn.classList.add('active');
            const template = document.getElementById('atleta-panel-template');
            if(template) {
                AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                if(typeof AtletaPanel !== 'undefined') AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db, AppPrincipal.state.userData);
            }
        } else if (viewName === 'feed') {
            if(AppPrincipal.elements.navFeedBtn) AppPrincipal.elements.navFeedBtn.classList.add('active');
            const template = document.getElementById('feed-panel-template');
            if(template) {
                AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                if(typeof FeedPanel !== 'undefined') FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db, AppPrincipal.state.userData);
            }
        } else if (viewName === 'financeiro' && AppPrincipal.state.viewMode === 'admin') {
            if(AppPrincipal.elements.navFinanceBtn) AppPrincipal.elements.navFinanceBtn.classList.add('active');
            const template = document.getElementById('finance-panel-template');
            if(template) {
                AppPrincipal.elements.mainContent.appendChild(template.content.cloneNode(true));
                if(typeof FinancePanel !== 'undefined') FinancePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        }
    },

    clearAllListeners: () => {
        for (const path in AppPrincipal.state.listeners) {
            if(AppPrincipal.state.listeners[path] && AppPrincipal.state.listeners[path].off) {
                AppPrincipal.state.listeners[path].off();
            }
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

    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if(!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName) {
            alert("O Banco de Imagens não está configurado no Cofre.");
            e.target.value = ""; return;
        }

        const feedbackEl = document.getElementById('photo-upload-feedback');
        feedbackEl.textContent = "Fazendo upload para a nuvem...";
        document.getElementById('save-feedback-btn').disabled = true;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: formData });
            const data = await response.json();
            
            if(data.secure_url) {
                AppPrincipal.state.modal.newPhotoUrl = data.secure_url;
                feedbackEl.textContent = "Upload concluído! Analisando imagem (IA)...";
                await AppPrincipal.extractDataWithGemini(data.secure_url);
            }
        } catch (error) {
            feedbackEl.textContent = "Erro no upload da imagem.";
        } finally {
            document.getElementById('save-feedback-btn').disabled = false;
        }
    },

    extractDataWithGemini: async (imageUrl) => {
        const feedbackEl = document.getElementById('photo-upload-feedback');
        if(!window.GEMINI_API_KEY) { feedbackEl.textContent = "IA Desativada: Chave Gemini ausente no Cofre."; return; }

        try {
            const fetchImg = await fetch(imageUrl);
            const blob = await fetchImg.blob();
            const reader = new FileReader();
            
            reader.readAsDataURL(blob); 
            reader.onloadend = async function() {
                const base64data = reader.result.split(',')[1];
                const prompt = `Analise esta imagem (print Strava/Garmin) e retorne APENAS um JSON válido. Ex: {"distancia": "5.02", "tempo": "30:15", "ritmo": "5:40 /km"}`;

                const bodyData = { contents: [{ parts: [{text: prompt}, {inlineData: {mimeType: "image/jpeg", data: base64data}}] }] };
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(bodyData)
                });

                if(!response.ok) throw new Error("Falha na API Gemini");
                const data = await response.json();
                
                let textResult = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                const extData = JSON.parse(textResult);
                
                document.getElementById('strava-data-display').classList.remove('hidden');
                document.getElementById('strava-data-distancia').textContent = `🎯 Distância: ${extData.distancia || '--'} km`;
                document.getElementById('strava-data-tempo').textContent = `⏱️ Tempo: ${extData.tempo || '--'}`;
                document.getElementById('strava-data-ritmo').textContent = `⚡ Ritmo: ${extData.ritmo || '--'}`;
                
                feedbackEl.textContent = "Análise concluída com sucesso!";
                AppPrincipal.state.modal.extractedData = extData;
            };
        } catch (error) {
            feedbackEl.textContent = "Não foi possível extrair dados automaticamente.";
        }
    },

    openFeedbackModal: (workoutId, ownerId) => {
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        AppPrincipal.state.modal.newPhotoUrl = null;
        AppPrincipal.state.modal.extractedData = null;

        document.getElementById('feedback-workout-id').value = workoutId;
        document.getElementById('feedback-workout-owner-id').value = ownerId;
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.value = '';
        
        const photoFeed = document.getElementById('photo-upload-feedback');
        if(photoFeed) photoFeed.textContent = '';
        
        const stravaDisp = document.getElementById('strava-data-display');
        if(stravaDisp) stravaDisp.classList.add('hidden');

        AppPrincipal.state.db.ref(`users/${ownerId}/workouts/${workoutId}`).once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if(data.status) document.getElementById('workout-status').value = data.status;
                if(data.feedback) document.getElementById('workout-feedback-text').value = data.feedback;
                if(data.photoUrl) {
                    AppPrincipal.state.modal.newPhotoUrl = data.photoUrl;
                    if(photoFeed) photoFeed.textContent = "Imagem anexada anteriormente.";
                }
            }
        });

        AppPrincipal.loadComments(workoutId);
        AppPrincipal.elements.feedbackModal.classList.remove('hidden');
    },

    closeModal: () => {
        if(AppPrincipal.elements.feedbackModal) AppPrincipal.elements.feedbackModal.classList.add('hidden');
        if (AppPrincipal.state.listeners.comments) AppPrincipal.state.listeners.comments.off();
    },

    handleFeedbackSubmit: (e) => {
        e.preventDefault();
        const workoutId = document.getElementById('feedback-workout-id').value;
        const ownerId = document.getElementById('feedback-workout-owner-id').value;
        const status = document.getElementById('workout-status').value;
        const feedback = document.getElementById('workout-feedback-text').value;
        
        const updates = { status: status, feedback: feedback };
        if(AppPrincipal.state.modal.newPhotoUrl) updates.photoUrl = AppPrincipal.state.modal.newPhotoUrl;
        if(AppPrincipal.state.modal.extractedData) updates.metrics = AppPrincipal.state.modal.extractedData;

        const btn = document.getElementById('save-feedback-btn');
        btn.disabled = true; btn.textContent = "Salvando...";

        AppPrincipal.state.db.ref(`users/${ownerId}/workouts/${workoutId}`).update(updates)
            .then(() => {
                if (status === 'realizado' || status === 'realizado_parcial') {
                    AppPrincipal.state.db.ref(`users/${ownerId}/workouts/${workoutId}`).once('value', s => {
                        const workoutData = s.val();
                        const publicData = { ...workoutData, ownerId: ownerId, ownerName: AppPrincipal.state.userData.name, originalId: workoutId };
                        if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
                        
                        AppPrincipal.state.db.ref('publicWorkouts').orderByChild('originalId').equalTo(workoutId).once('value', pubSnap => {
                            if(pubSnap.exists()) {
                                const pubKey = Object.keys(pubSnap.val())[0];
                                AppPrincipal.state.db.ref(`publicWorkouts/${pubKey}`).update(publicData);
                            } else {
                                AppPrincipal.state.db.ref('publicWorkouts').push(publicData);
                            }
                        });
                    });
                }
                alert('Feedback salvo!');
                AppPrincipal.closeModal();
            })
            .catch(error => alert('Erro: ' + error.message))
            .finally(() => { btn.disabled = false; btn.textContent = "Salvar Feedback"; });
    },

    loadComments: (workoutId) => {
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners.comments = commentsRef;
        
        commentsRef.on('value', async snapshot => {
            if(!AppPrincipal.elements.commentsList) return;
            AppPrincipal.elements.commentsList.innerHTML = '';
            if (snapshot.exists()) {
                const comments = [];
                snapshot.forEach(child => { comments.push(child.val()); });
                
                for (const comment of comments) {
                    const div = document.createElement('div');
                    div.className = 'comment-item';
                    const photoUrl = await AppPrincipal.getUserPhoto(comment.authorId);
                    const imgTag = photoUrl ? `<img src="${photoUrl}" style="width:20px; height:20px; border-radius:50%; vertical-align:middle; margin-right:5px; object-fit:cover;">` : '';
                    div.innerHTML = `${imgTag}<strong>${comment.author}</strong> <div style="margin-top: 4px;">${comment.text}</div>`;
                    AppPrincipal.elements.commentsList.appendChild(div);
                }
                AppPrincipal.elements.commentsList.scrollTop = AppPrincipal.elements.commentsList.scrollHeight;
            }
        });
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = AppPrincipal.elements.commentInput.value.trim();
        if (!text) return;
        
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            authorId: AppPrincipal.state.currentUser.uid,
            author: AppPrincipal.state.userData.name,
            text: text,
            timestamp: Date.now()
        }).then(() => AppPrincipal.elements.commentInput.value = '');
    },

    handleLogActivitySubmit: (e) => {
        e.preventDefault();
        const workoutData = {
            date: document.getElementById('log-activity-date').value,
            title: document.getElementById('log-activity-title').value,
            tipoTreino: document.getElementById('log-activity-type').value,
            feedback: document.getElementById('log-activity-feedback').value,
            status: 'realizado',
            timestamp: Date.now()
        };

        const uid = AppPrincipal.state.currentUser.uid;

        AppPrincipal.state.db.ref(`users/${uid}/workouts`).push(workoutData)
            .then((ref) => {
                const publicData = { ...workoutData, ownerId: uid, ownerName: AppPrincipal.state.userData.name, originalId: ref.key };
                if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
                AppPrincipal.state.db.ref('publicWorkouts').push(publicData);
                
                alert("Atividade salva!");
                AppPrincipal.elements.logActivityModal.classList.add('hidden');
            });
    },

    saveIaAnalysis: async () => {}
};

// ===================================================================
// MOTOR GPS NATIVO PREMIUM (UI STRAVA + WAKE LOCK)
// ===================================================================
window.GPSTracker = {
    map: null, polyline: null, marker: null, watchId: null, timerInterval: null, wakeLock: null,
    positions: [], totalDistance: 0, seconds: 0, isRunning: false, mapsLoaded: false,

    requestWakeLock: async () => {
        try {
            if ('wakeLock' in navigator) {
                window.GPSTracker.wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Falha no Wake Lock:', err);
        }
    },
    releaseWakeLock: () => {
        if (window.GPSTracker.wakeLock !== null) {
            window.GPSTracker.wakeLock.release().then(() => {
                window.GPSTracker.wakeLock = null;
            });
        }
    },

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
        
        // Estilo escuro para o mapa (premium look)
        const darkMapStyle = [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
        ];

        window.GPSTracker.map = new google.maps.Map(document.getElementById('gps-map'), {
            zoom: 16, center: {lat: -23.5505, lng: -46.6333}, disableDefaultUI: true, mapId: 'LERUNNERS_GPS',
            styles: darkMapStyle
        });
        window.GPSTracker.polyline = new google.maps.Polyline({
            map: window.GPSTracker.map, strokeColor: '#fc4c02', strokeWeight: 6, strokeOpacity: 0.8
        });
        
        window.GPSTracker.marker = new google.maps.Marker({
            map: window.GPSTracker.map, 
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7, fillColor: '#fc4c02', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2
            }
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
        if(window.GPSTracker.isRunning) {
            if(!confirm("A corrida está em andamento. Tem certeza que deseja fechar? O progresso será perdido.")) return;
            window.GPSTracker.stop(false);
        }
        document.getElementById('gps-tracker-modal').classList.add('hidden');
    },
    start: () => {
        if(window.GPSTracker.isRunning) return;
        window.GPSTracker.isRunning = true;
        
        window.GPSTracker.requestWakeLock();

        document.getElementById('btn-gps-start').classList.add('hidden');
        document.getElementById('btn-gps-pause').classList.remove('hidden');
        document.getElementById('btn-gps-stop').classList.remove('hidden');

        window.GPSTracker.timerInterval = setInterval(() => {
            window.GPSTracker.seconds++;
            window.GPSTracker.updateUI();
        }, 1000);

        window.GPSTracker.watchId = navigator.geolocation.watchPosition(pos => {
            if(!window.google || !window.google.maps || !window.google.maps.geometry) return;
            
            const accuracy = pos.coords.accuracy;
            
            const signalDot = document.getElementById('gps-signal-dot');
            const signalText = document.getElementById('gps-signal-text');
            if(accuracy < 10) {
                signalDot.className = 'signal-dot good'; signalText.innerText = 'GPS Forte';
            } else if (accuracy < 30) {
                signalDot.className = 'signal-dot ok'; signalText.innerText = 'GPS Médio';
            } else {
                signalDot.className = 'signal-dot'; signalText.innerText = `GPS Fraco (${Math.round(accuracy)}m)`;
            }

            if (accuracy > 30) return;

            const newPos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
            
            if(window.GPSTracker.positions.length > 0) {
                const lastPos = window.GPSTracker.positions[window.GPSTracker.positions.length - 1];
                const dist = google.maps.geometry.spherical.computeDistanceBetween(lastPos, newPos);
                
                if(dist > 1 && dist < 60) {
                    window.GPSTracker.totalDistance += dist;
                }
            }
            
            window.GPSTracker.positions.push(newPos);
            
            if(window.GPSTracker.polyline) window.GPSTracker.polyline.setPath(window.GPSTracker.positions);
            if(window.GPSTracker.marker) window.GPSTracker.marker.setPosition(newPos);
            if(window.GPSTracker.map) window.GPSTracker.map.panTo(newPos);
            
            window.GPSTracker.updateUI();
        }, err => {
            console.error("GPS Error:", err); 
            document.getElementById('gps-signal-dot').className = 'signal-dot';
            document.getElementById('gps-signal-text').innerText = 'Sem Sinal';
        }, {enableHighAccuracy: true, maximumAge: 0, timeout: 5000});
    },
    pause: () => {
        window.GPSTracker.isRunning = false;
        clearInterval(window.GPSTracker.timerInterval);
        navigator.geolocation.clearWatch(window.GPSTracker.watchId);
        window.GPSTracker.releaseWakeLock(); 
        
        const pauseBtn = document.getElementById('btn-gps-pause');
        pauseBtn.innerHTML = "<i class='bx bx-play' style='font-size: 3rem;'></i>";
        pauseBtn.onclick = window.GPSTracker.resume;
        pauseBtn.style.backgroundColor = "#28a745"; 
        pauseBtn.style.color = "white";
    },
    resume: () => {
        const pauseBtn = document.getElementById('btn-gps-pause');
        pauseBtn.innerHTML = "<i class='bx bx-pause' style='font-size: 3rem;'></i>";
        pauseBtn.onclick = window.GPSTracker.pause;
        pauseBtn.style.backgroundColor = "#ffc107";
        pauseBtn.style.color = "#333";
        window.GPSTracker.start();
    },
    stop: (askToSave = true) => {
        window.GPSTracker.isRunning = false;
        clearInterval(window.GPSTracker.timerInterval);
        if(window.GPSTracker.watchId) navigator.geolocation.clearWatch(window.GPSTracker.watchId);
        window.GPSTracker.releaseWakeLock(); 
        
        if(askToSave && window.GPSTracker.totalDistance > 50) { 
            if(confirm("Treino finalizado! Deseja guardar na sua planilha e publicar no Feed?")) {
                window.GPSTracker.saveWorkout();
            } else {
                window.GPSTracker.reset();
                window.GPSTracker.close();
            }
        } else {
            if(askToSave) alert("Treino muito curto (menos de 50 metros). Não será salvo.");
            window.GPSTracker.reset();
            window.GPSTracker.close();
        }
    },
    updateUI: () => {
        const h = Math.floor(window.GPSTracker.seconds / 3600);
        const m = Math.floor((window.GPSTracker.seconds % 3600) / 60);
        const s = window.GPSTracker.seconds % 60;
        
        let timeString = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (h > 0) timeString = `${h.toString().padStart(2,'0')}:${timeString}`;
        
        document.getElementById('gps-time').innerText = timeString;
        
        const km = (window.GPSTracker.totalDistance / 1000);
        document.getElementById('gps-distance').innerText = km.toFixed(2);
        
        if(km > 0.05) { 
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
        pauseBtn.innerHTML = "<i class='bx bx-pause' style='font-size: 3rem;'></i>";
        pauseBtn.onclick = window.GPSTracker.pause;
        pauseBtn.style.backgroundColor = "#ffc107";
        pauseBtn.style.color = "#333";

        document.getElementById('gps-time').innerText = `00:00`;
        document.getElementById('gps-distance').innerText = `0.00`;
        document.getElementById('gps-pace').innerText = `--:--`;
        
        document.getElementById('gps-signal-dot').className = 'signal-dot';
        document.getElementById('gps-signal-text').innerText = 'Aguardando Início...';
    },
    saveWorkout: async () => {
        const title = prompt("Dê um título para a sua corrida:", "Corrida Livre (GPS Nativo)");
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
            tipoTreino: "Corrida",
            status: "realizado",
            source: 'lerunners_gps',
            metrics: { distancia: km + " km", tempo: timeStr, pace: paceStr },
            timestamp: Date.now()
        };

        const uid = AppPrincipal.state.currentUser.uid;

        try {
            const ref = await AppPrincipal.state.db.ref(`users/${uid}/workouts`).push(workoutData);
            
            const publicData = { ...workoutData, ownerId: uid, ownerName: AppPrincipal.state.userData.name, originalId: ref.key };
            if(AppPrincipal.state.userData.photoUrl) publicData.ownerPhotoUrl = AppPrincipal.state.userData.photoUrl;
            await AppPrincipal.state.db.ref(`publicWorkouts`).push(publicData);
            
            alert("Treino salvo e postado no feed!");
            window.GPSTracker.reset();
            window.GPSTracker.close();
        } catch(e) {
            console.error(e); alert("Erro ao salvar corrida.");
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
        if(AuthLogic.elements.toggleToRegister) AuthLogic.elements.toggleToRegister.addEventListener('click', (e) => { e.preventDefault(); AuthLogic.showView('register'); });
        if(AuthLogic.elements.toggleToLogin) AuthLogic.elements.toggleToLogin.addEventListener('click', (e) => { e.preventDefault(); AuthLogic.showView('login'); });
        if(AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        if(AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        if(AuthLogic.elements.btnLogoutPending) AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
    },
    
    // --- CORREÇÃO CRÍTICA AQUI ---
    showView: (viewName) => {
        // Esconde todos os painéis com segurança
        if(AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.classList.add('hidden');
        if(AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.classList.add('hidden');
        if(AuthLogic.elements.pendingView) AuthLogic.elements.pendingView.classList.add('hidden');
        
        // Exibe o painel correto
        if (viewName === 'login' && AuthLogic.elements.loginForm) { 
            AuthLogic.elements.loginForm.classList.remove('hidden'); 
        } 
        else if (viewName === 'register' && AuthLogic.elements.registerForm) { 
            AuthLogic.elements.registerForm.classList.remove('hidden'); 
        } 
        else if (viewName === 'pending' && AuthLogic.elements.pendingView) { 
            AuthLogic.elements.pendingView.classList.remove('hidden'); 
        }
    },
    
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value; 
        const password = document.getElementById('loginPassword').value;
        if(AuthLogic.elements.loginErrorMsg) AuthLogic.elements.loginErrorMsg.textContent = "Conectando...";
        AuthLogic.auth.signInWithEmailAndPassword(email, password).catch(err => {
            if(AuthLogic.elements.loginErrorMsg) AuthLogic.elements.loginErrorMsg.textContent = "Credenciais inválidas.";
        });
    },
    handleRegister: (e) => {
        e.preventDefault(); 
        if(AuthLogic.elements.registerErrorMsg) AuthLogic.elements.registerErrorMsg.textContent = "Aguarde...";
        const name = document.getElementById('registerName').value; 
        const email = document.getElementById('registerEmail').value; 
        const password = document.getElementById('registerPassword').value;
        
        if(password.length < 6) {
            if(AuthLogic.elements.registerErrorMsg) AuthLogic.elements.registerErrorMsg.textContent = "Senha mínima 6 caracteres.";
            return;
        }
        
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((c) => AuthLogic.db.ref('pendingApprovals/'+c.user.uid).set({ name, email, requestDate: new Date().toISOString() }))
            .catch(e => {
                if(AuthLogic.elements.registerErrorMsg) AuthLogic.elements.registerErrorMsg.textContent = e.code === 'auth/email-already-in-use' ? "Email já existe." : "Erro ao criar conta.";
            });
    },
    handleLoginGuard: (user) => {
        if (!user) return AuthLogic.showView('login');
        
        AuthLogic.db.ref('admins/' + user.uid).once('value').then(s => {
            if (s.exists() && s.val()) return window.location.href = 'app.html';
            
            AuthLogic.db.ref('users/' + user.uid).once('value').then(s2 => {
                if (s2.exists()) return window.location.href = 'app.html';
                
                AuthLogic.db.ref('pendingApprovals/' + user.uid).once('value').then(s3 => {
                    if (s3.exists()) { 
                        if(AuthLogic.elements.pendingEmailDisplay) AuthLogic.elements.pendingEmailDisplay.textContent = user.email; 
                        AuthLogic.showView('pending'); 
                    }
                    else { 
                        AuthLogic.auth.signOut(); 
                        AuthLogic.showView('login'); 
                    }
                });
            });
        }).catch(err => { console.error(err); });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);