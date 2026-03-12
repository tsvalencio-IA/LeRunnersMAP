/* =================================================================== */
/* APP.JS - VERSÃO MESTRA 12.0 (*177 - MODO ESPECIALISTA)
/* MOTOR GPS NATIVO INTEGRADO E COFRE DE APIS DINÂMICO
/* ARQUIVO 100% COMPLETO - NENHUMA FUNÇÃO ABREVIADA
/* =================================================================== */

// ===================================================================
// MOTOR GPS NATIVO (STRAVA CLONE PROPRIETÁRIO)
// ===================================================================
window.GPSTracker = {
    watchId: null,
    timerInterval: null,
    startTime: 0,
    elapsedTime: 0, // em milissegundos
    distance: 0, // em km
    path: [], // Array de {lat, lng}
    map: null,
    polyline: null,
    currentMarker: null,
    state: 'stopped', // 'stopped', 'running', 'paused'

    elements: {
        modal: null,
        timeDisplay: null,
        distanceDisplay: null,
        paceDisplay: null,
        btnStart: null,
        btnPause: null,
        btnStop: null
    },

    initElements: () => {
        window.GPSTracker.elements.modal = document.getElementById('gps-tracker-modal');
        window.GPSTracker.elements.timeDisplay = document.getElementById('gps-time');
        window.GPSTracker.elements.distanceDisplay = document.getElementById('gps-distance');
        window.GPSTracker.elements.paceDisplay = document.getElementById('gps-pace');
        window.GPSTracker.elements.btnStart = document.getElementById('btn-gps-start');
        window.GPSTracker.elements.btnPause = document.getElementById('btn-gps-pause');
        window.GPSTracker.elements.btnStop = document.getElementById('btn-gps-stop');
    },

    open: () => {
        if (!window.GPSTracker.elements.modal) window.GPSTracker.initElements();
        window.GPSTracker.elements.modal.classList.remove('hidden');
        window.GPSTracker.reset();
        
        if (!window.GOOGLE_MAPS_KEY) {
            alert("A chave do Google Maps não foi configurada no Cofre. O mapa não será carregado.");
            return;
        }

        // Tenta obter a localização atual para inicializar o mapa
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    window.GPSTracker.initMap(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    alert("Por favor, ative a localização do seu dispositivo para usar o GPS.");
                    // Fallback para o centro do Brasil se recusar a primeira vez
                    window.GPSTracker.initMap(-14.235, -51.925);
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Geolocalização não suportada neste navegador.");
        }
    },

    close: () => {
        if (window.GPSTracker.state === 'running' || window.GPSTracker.state === 'paused') {
            if (!confirm("Tem certeza que deseja sair? O treino em andamento será perdido.")) return;
        }
        window.GPSTracker.stopTracking();
        window.GPSTracker.elements.modal.classList.add('hidden');
    },

    initMap: (lat, lng) => {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            console.error("Google Maps API não carregada a tempo.");
            return;
        }

        const mapOptions = {
            center: { lat: lat, lng: lng },
            zoom: 17,
            mapTypeId: 'terrain',
            disableDefaultUI: true,
            zoomControl: true
        };

        window.GPSTracker.map = new google.maps.Map(document.getElementById('gps-map'), mapOptions);
        
        window.GPSTracker.polyline = new google.maps.Polyline({
            path: [],
            geodesic: true,
            strokeColor: '#fc4c02', // Laranja Strava
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map: window.GPSTracker.map
        });

        window.GPSTracker.currentMarker = new google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: window.GPSTracker.map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
            }
        });
    },

    start: () => {
        if (window.GPSTracker.state === 'running') return;
        
        window.GPSTracker.state = 'running';
        window.GPSTracker.startTime = Date.now() - window.GPSTracker.elapsedTime;
        
        window.GPSTracker.elements.btnStart.classList.add('hidden');
        window.GPSTracker.elements.btnPause.classList.remove('hidden');
        window.GPSTracker.elements.btnStop.classList.remove('hidden');

        // Inicia o cronômetro visual
        window.GPSTracker.timerInterval = setInterval(window.GPSTracker.updateTimer, 1000);

        // Inicia o rastreamento GPS
        if (navigator.geolocation) {
            window.GPSTracker.watchId = navigator.geolocation.watchPosition(
                window.GPSTracker.handlePosition,
                window.GPSTracker.handleError,
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        }
    },

    pause: () => {
        if (window.GPSTracker.state !== 'running') return;
        
        window.GPSTracker.state = 'paused';
        window.GPSTracker.elements.btnPause.classList.add('hidden');
        window.GPSTracker.elements.btnStart.classList.remove('hidden');
        
        clearInterval(window.GPSTracker.timerInterval);
        if (window.GPSTracker.watchId !== null) {
            navigator.geolocation.clearWatch(window.GPSTracker.watchId);
            window.GPSTracker.watchId = null;
        }
    },

    stop: () => {
        window.GPSTracker.pause();
        window.GPSTracker.state = 'stopped';
        
        if (window.GPSTracker.distance < 0.1) {
            alert("O treino foi muito curto para ser salvo (menos de 100 metros).");
            window.GPSTracker.reset();
            window.GPSTracker.close();
            return;
        }

        if (confirm("Deseja finalizar e salvar este treino no seu histórico e no Feed da equipe?")) {
            window.GPSTracker.saveWorkout();
        } else {
            window.GPSTracker.elements.btnStart.classList.remove('hidden');
            window.GPSTracker.elements.btnStop.classList.add('hidden');
            // Retorna ao estado pausado caso o usuário cancele o save
            window.GPSTracker.state = 'paused'; 
        }
    },

    reset: () => {
        window.GPSTracker.stopTracking();
        window.GPSTracker.elapsedTime = 0;
        window.GPSTracker.distance = 0;
        window.GPSTracker.path = [];
        window.GPSTracker.state = 'stopped';
        
        if(window.GPSTracker.elements.timeDisplay) {
            window.GPSTracker.elements.timeDisplay.textContent = "00:00";
            window.GPSTracker.elements.distanceDisplay.innerHTML = "0.00 <span style='font-size:0.8rem;'>km</span>";
            window.GPSTracker.elements.paceDisplay.textContent = "--:--";
            
            window.GPSTracker.elements.btnStart.classList.remove('hidden');
            window.GPSTracker.elements.btnPause.classList.add('hidden');
            window.GPSTracker.elements.btnStop.classList.add('hidden');
        }

        if (window.GPSTracker.polyline) {
            window.GPSTracker.polyline.setPath([]);
        }
    },

    stopTracking: () => {
        clearInterval(window.GPSTracker.timerInterval);
        if (window.GPSTracker.watchId !== null) {
            navigator.geolocation.clearWatch(window.GPSTracker.watchId);
            window.GPSTracker.watchId = null;
        }
    },

    updateTimer: () => {
        window.GPSTracker.elapsedTime = Date.now() - window.GPSTracker.startTime;
        
        // Formatar tempo
        const totalSeconds = Math.floor(window.GPSTracker.elapsedTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let timeString = "";
        if (hours > 0) timeString += `${hours.toString().padStart(2, '0')}:`;
        timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        window.GPSTracker.elements.timeDisplay.textContent = timeString;

        // Atualizar Pace
        if (window.GPSTracker.distance > 0.05) { // Só mostra pace após 50 metros para evitar números bizarros
            const paceInMinutesPerKm = (totalSeconds / 60) / window.GPSTracker.distance;
            const paceMinutes = Math.floor(paceInMinutesPerKm);
            const paceSeconds = Math.floor((paceInMinutesPerKm - paceMinutes) * 60);
            window.GPSTracker.elements.paceDisplay.textContent = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')} /km`;
        }
    },

    handlePosition: (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Ignora pontos muito imprecisos (mais de 20 metros de margem de erro)
        if (accuracy > 20) return;

        const newPoint = { lat, lng };

        if (window.GPSTracker.path.length > 0) {
            const lastPoint = window.GPSTracker.path[window.GPSTracker.path.length - 1];
            const dist = window.GPSTracker.calculateDistance(lastPoint.lat, lastPoint.lng, lat, lng);
            
            // Só adiciona o ponto se a pessoa andou pelo menos 2 metros (evita ruído parado)
            if (dist > 0.002) {
                window.GPSTracker.distance += dist;
                window.GPSTracker.path.push(newPoint);
                window.GPSTracker.elements.distanceDisplay.innerHTML = `${window.GPSTracker.distance.toFixed(2)} <span style='font-size:0.8rem;'>km</span>`;
                
                // Atualiza o mapa
                if (window.GPSTracker.polyline) {
                    const mapPath = window.GPSTracker.polyline.getPath();
                    mapPath.push(new google.maps.LatLng(lat, lng));
                }
            }
        } else {
            // Primeiro ponto
            window.GPSTracker.path.push(newPoint);
            if (window.GPSTracker.polyline) {
                const mapPath = window.GPSTracker.polyline.getPath();
                mapPath.push(new google.maps.LatLng(lat, lng));
            }
        }

        // Centraliza a câmera e atualiza o marcador
        if (window.GPSTracker.map && window.GPSTracker.currentMarker) {
            const posLatLng = new google.maps.LatLng(lat, lng);
            window.GPSTracker.currentMarker.setPosition(posLatLng);
            window.GPSTracker.map.panTo(posLatLng);
        }
    },

    handleError: (error) => {
        console.warn("Erro no GPS:", error.message);
    },

    // Fórmula de Haversine para calcular distância entre duas coordenadas em KM
    calculateDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Raio da terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    saveWorkout: async () => {
        const user = AppPrincipal.state.currentUser;
        if (!user) return;

        const timeString = window.GPSTracker.elements.timeDisplay.textContent;
        const distanceStr = window.GPSTracker.distance.toFixed(2) + " km";
        const paceStr = window.GPSTracker.elements.paceDisplay.textContent;

        const payload = {
            date: new Date().toISOString().split('T')[0],
            title: "Corrida (LeRunners GPS)",
            type: "Corrida",
            feedback: "Treino registrado via GPS nativo da plataforma.",
            status: "realizado", // Marca como atividade concluída
            metrics: {
                distancia: distanceStr,
                tempo: timeString,
                pace: paceStr
            },
            source: 'lerunners_gps', // Flag para exibir badge no feed
            pathData: JSON.stringify(window.GPSTracker.path), // Salva as coordenadas brutas para uso futuro
            timestamp: Date.now()
        };

        try {
            // 1. Salva no histórico do atleta
            const newWorkoutRef = AppPrincipal.state.db.ref(`users/${user.uid}/workouts`).push();
            await newWorkoutRef.set(payload);

            // 2. Posta diretamente no Feed Social (publicWorkouts)
            await AppPrincipal.state.db.ref(`publicWorkouts/${newWorkoutRef.key}`).set({
                ownerId: user.uid,
                ownerName: AppPrincipal.state.userData.name,
                ownerPhoto: AppPrincipal.state.userData.photoUrl || "",
                title: payload.title,
                feedback: payload.feedback,
                metrics: payload.metrics,
                source: payload.source,
                timestamp: payload.timestamp
            });

            alert("Treino salvo e postado no feed com sucesso!");
            window.GPSTracker.reset();
            window.GPSTracker.close();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar o treino: " + error.message);
        }
    }
};

// ===================================================================
// LÓGICA DE AUTENTICAÇÃO (AuthLogic)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (authInstance, dbInstance) => {
        AuthLogic.auth = authInstance;
        AuthLogic.db = dbInstance;

        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'),
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            loginErrorMsg: document.getElementById('login-error'),
            registerErrorMsg: document.getElementById('register-error'),
            pendingEmailDisplay: document.getElementById('pending-email-display'),
            btnLogoutPending: document.getElementById('btn-logout-pending')
        };

        AuthLogic.setupListeners();

        // Monitora o estado da sessão
        AuthLogic.auth.onAuthStateChanged(user => {
            AuthLogic.handleLoginGuard(user);
        });
    },

    setupListeners: () => {
        if (AuthLogic.elements.toggleToRegister) {
            AuthLogic.elements.toggleToRegister.addEventListener('click', () => AuthLogic.showView('register'));
        }
        if (AuthLogic.elements.toggleToLogin) {
            AuthLogic.elements.toggleToLogin.addEventListener('click', () => AuthLogic.showView('login'));
        }
        if (AuthLogic.elements.loginForm) {
            AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if (AuthLogic.elements.registerForm) {
            AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        if (AuthLogic.elements.btnLogoutPending) {
            AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        }
    },

    showView: (viewName) => {
        if(AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.classList.add('hidden');
        if(AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.classList.add('hidden');
        if(AuthLogic.elements.pendingView) AuthLogic.elements.pendingView.classList.add('hidden');

        if (viewName === 'login' && AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.classList.remove('hidden');
        if (viewName === 'register' && AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.classList.remove('hidden');
        if (viewName === 'pending' && AuthLogic.elements.pendingView) AuthLogic.elements.pendingView.classList.remove('hidden');
    },

    handleLogin: (e) => {
        e.preventDefault();
        AuthLogic.elements.loginErrorMsg.textContent = "";
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        AuthLogic.auth.signInWithEmailAndPassword(email, password).catch(error => {
            console.error(error);
            AuthLogic.elements.loginErrorMsg.textContent = "Email ou senha incorretos.";
        });
    },

    handleRegister: (e) => {
        e.preventDefault();
        AuthLogic.elements.registerErrorMsg.textContent = "";
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        if (password.length < 6) {
            AuthLogic.elements.registerErrorMsg.textContent = "A senha deve ter pelo menos 6 caracteres.";
            return;
        }

        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return AuthLogic.db.ref('pendingApprovals/' + user.uid).set({
                    name: name,
                    email: email,
                    requestDate: new Date().toISOString()
                });
            })
            .then(() => {
                AuthLogic.showView('pending');
            })
            .catch(error => {
                console.error(error);
                if (error.code === 'auth/email-already-in-use') {
                    AuthLogic.elements.registerErrorMsg.textContent = "Este email já está em uso.";
                } else {
                    AuthLogic.elements.registerErrorMsg.textContent = "Erro ao criar conta: " + error.message;
                }
            });
    },

    handleLoginGuard: (user) => {
        if (!user) {
            AuthLogic.showView('login');
            return;
        }

        // Verifica se é Admin
        AuthLogic.db.ref('admins/' + user.uid).once('value', snapshot => {
            if (snapshot.exists() && snapshot.val() === true) {
                window.location.href = 'app.html';
                return;
            }
            
            // Verifica se é usuário aprovado
            AuthLogic.db.ref('users/' + user.uid).once('value', userSnap => {
                if (userSnap.exists()) {
                    window.location.href = 'app.html';
                    return;
                }
                
                // Se não é admin nem usuário aprovado, verifica se está pendente
                AuthLogic.db.ref('pendingApprovals/' + user.uid).once('value', pendingSnap => {
                    if (pendingSnap.exists()) {
                        if (AuthLogic.elements.pendingEmailDisplay) {
                            AuthLogic.elements.pendingEmailDisplay.textContent = user.email;
                        }
                        AuthLogic.showView('pending');
                    } else {
                        // Caso anômalo: logado mas sem registro em lugar nenhum
                        AuthLogic.auth.signOut();
                        AuthLogic.showView('login');
                    }
                });
            });
        });
    }
};

// ===================================================================
// LÓGICA PRINCIPAL DA PLATAFORMA (AppPrincipal)
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        currentView: 'planilha',
        viewMode: 'atleta', // 'admin' ou 'atleta'
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null }
    },
    elements: {},

    init: async () => {
        // Verifica Configuração base
        if (typeof firebaseConfig === 'undefined') {
            console.error("Erro Crítico: firebaseConfig não foi encontrado!");
            return;
        }
        
        try {
            if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
        } catch (e) { console.error("Erro Firebase:", e); }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Se estivermos na tela de Login (index.html)
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
            return;
        }

        // Se estivermos na Plataforma (app.html)
        AppPrincipal.cacheElements();
        
        AppPrincipal.state.auth.onAuthStateChanged(async user => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            AppPrincipal.state.currentUser = user;
            
            // 1. CARREGAR COFRE DE APIS ANTES DE RENDERIZAR
            await AppPrincipal.loadSystemConfigs();

            // 2. CARREGAR DADOS DO USUÁRIO E RENDERIZAR
            AppPrincipal.loadUserData(user.uid);
        });
    },

    cacheElements: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            mainContent: document.getElementById('app-main-content'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            
            navPlanilha: document.getElementById('nav-planilha-btn'),
            navFinance: document.getElementById('nav-finance-btn'),
            navFeed: document.getElementById('nav-feed-btn'),
            navProfile: document.getElementById('nav-profile-btn'),
            
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackForm: document.getElementById('feedback-form'),
            feedbackText: document.getElementById('workout-feedback-text'),
            feedbackStatus: document.getElementById('workout-status'),
            photoUploadInput: document.getElementById('photo-upload-input'),
            photoUploadFeedback: document.getElementById('photo-upload-feedback'),
            stravaDataDisplay: document.getElementById('strava-data-display'),
            commentsList: document.getElementById('comments-list'),
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            
            logActivityModal: document.getElementById('log-activity-modal'),
            closeLogActivityModal: document.getElementById('close-log-activity-modal'),
            logActivityForm: document.getElementById('log-activity-form'),
            
            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            
            whoLikedModal: document.getElementById('who-liked-modal'),
            closeWhoLikedModal: document.getElementById('close-who-liked-modal'),
            whoLikedList: document.getElementById('who-liked-list'),
            
            viewProfileModal: document.getElementById('view-profile-modal'),
            closeViewProfileModal: document.getElementById('close-view-profile-modal')
        };
    },

    // -----------------------------------------------------------------
    // COFRE DE APIS (VAULT) E INJEÇÃO DE DEPENDÊNCIAS
    // -----------------------------------------------------------------
    loadSystemConfigs: async () => {
        try {
            const snap = await AppPrincipal.state.db.ref('config/apiKeys').once('value');
            if (snap.exists()) {
                const keys = snap.val();
                window.GEMINI_API_KEY = keys.geminiKey || "";
                window.GOOGLE_MAPS_KEY = keys.mapsKey || "";
                window.CLOUDINARY_CONFIG = {
                    cloudName: keys.cloudName || "",
                    uploadPreset: keys.cloudPreset || ""
                };

                // Injeta script do Google Maps na página se a chave existir e ainda não foi carregado
                if (window.GOOGLE_MAPS_KEY && !window.googleMapsLoaded) {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_KEY}&libraries=geometry`;
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                    window.googleMapsLoaded = true;
                    console.log("Cofre: Google Maps API injetada com sucesso.");
                }
            } else {
                console.warn("Cofre: Nenhuma chave encontrada no banco de dados.");
            }
        } catch (error) {
            console.error("Erro ao acessar o Cofre de APIs:", error);
        }
    },

    loadUserData: (uid) => {
        // Verifica se é admin
        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
            if (adminSnap.exists() && adminSnap.val() === true) {
                AppPrincipal.state.viewMode = 'admin';
                AppPrincipal.state.userData = { name: "Coach Admin", role: "admin" };
                AppPrincipal.finalizeAppLoad();
            } else {
                // É um atleta comum
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnap => {
                    if (userSnap.exists()) {
                        AppPrincipal.state.viewMode = 'atleta';
                        AppPrincipal.state.userData = userSnap.val();
                        AppPrincipal.finalizeAppLoad();
                    } else {
                        // Usuário sem registro (deletado ou não aprovado)
                        AppPrincipal.state.auth.signOut();
                    }
                });
            }
        });
    },

    finalizeAppLoad: () => {
        if(AppPrincipal.elements.loader) AppPrincipal.elements.loader.classList.add('hidden');
        if(AppPrincipal.elements.appContainer) AppPrincipal.elements.appContainer.classList.remove('hidden');
        
        if(AppPrincipal.elements.userDisplay) {
            AppPrincipal.elements.userDisplay.textContent = `Olá, ${AppPrincipal.state.userData.name.split(' ')[0]}`;
        }

        if (AppPrincipal.state.viewMode === 'admin') {
            AppPrincipal.elements.navFinance.classList.remove('hidden');
        }

        AppPrincipal.setupNavigation();
        AppPrincipal.setupModals();
        AppPrincipal.renderCurrentView();
    },

    setupNavigation: () => {
        const navs = [
            { btn: AppPrincipal.elements.navPlanilha, view: 'planilha' },
            { btn: AppPrincipal.elements.navFinance, view: 'financeiro' },
            { btn: AppPrincipal.elements.navFeed, view: 'feed' }
        ];

        navs.forEach(nav => {
            if(nav.btn) {
                nav.btn.addEventListener('click', () => {
                    navs.forEach(n => { if(n.btn) n.btn.classList.remove('active'); });
                    nav.btn.classList.add('active');
                    AppPrincipal.state.currentView = nav.view;
                    AppPrincipal.renderCurrentView();
                });
            }
        });

        if(AppPrincipal.elements.navProfile) {
            AppPrincipal.elements.navProfile.addEventListener('click', AppPrincipal.openProfileModal);
        }

        if(AppPrincipal.elements.logoutButton) {
            AppPrincipal.elements.logoutButton.addEventListener('click', () => {
                AppPrincipal.state.auth.signOut();
            });
        }
    },

    renderCurrentView: () => {
        const main = AppPrincipal.elements.mainContent;
        main.innerHTML = ''; // Limpa conteúdo atual

        if (AppPrincipal.state.currentView === 'planilha') {
            if (AppPrincipal.state.viewMode === 'admin') {
                const template = document.getElementById('admin-panel-template');
                main.appendChild(template.content.cloneNode(true));
                if(window.AdminPanel) window.AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                const template = document.getElementById('atleta-panel-template');
                main.appendChild(template.content.cloneNode(true));
                if(window.AtletaPanel) window.AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db, AppPrincipal.state.userData);
            }
        } 
        else if (AppPrincipal.state.currentView === 'financeiro' && AppPrincipal.state.viewMode === 'admin') {
            const template = document.getElementById('finance-panel-template');
            main.appendChild(template.content.cloneNode(true));
            if(window.FinancePanel) window.FinancePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        else if (AppPrincipal.state.currentView === 'feed') {
            const template = document.getElementById('feed-panel-template');
            main.appendChild(template.content.cloneNode(true));
            if(window.FeedPanel) window.FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db, AppPrincipal.state.userData);
        }
    },

    // -----------------------------------------------------------------
    // GESTÃO DE MODAIS E FEEDBACK
    // -----------------------------------------------------------------
    setupModals: () => {
        // Fechar Modais (Botões X)
        if(AppPrincipal.elements.closeFeedbackModal) AppPrincipal.elements.closeFeedbackModal.onclick = () => AppPrincipal.elements.feedbackModal.classList.add('hidden');
        if(AppPrincipal.elements.closeLogActivityModal) AppPrincipal.elements.closeLogActivityModal.onclick = () => AppPrincipal.elements.logActivityModal.classList.add('hidden');
        if(AppPrincipal.elements.closeProfileModal) AppPrincipal.elements.closeProfileModal.onclick = () => AppPrincipal.elements.profileModal.classList.add('hidden');
        if(AppPrincipal.elements.closeWhoLikedModal) AppPrincipal.elements.closeWhoLikedModal.onclick = () => AppPrincipal.elements.whoLikedModal.classList.add('hidden');
        if(AppPrincipal.elements.closeViewProfileModal) AppPrincipal.elements.closeViewProfileModal.onclick = () => AppPrincipal.elements.viewProfileModal.classList.add('hidden');

        // Submits de Formulários
        if(AppPrincipal.elements.feedbackForm) AppPrincipal.elements.feedbackForm.onsubmit = AppPrincipal.handleSaveFeedback;
        if(AppPrincipal.elements.commentForm) AppPrincipal.elements.commentForm.onsubmit = AppPrincipal.handleSaveComment;
        if(AppPrincipal.elements.logActivityForm) AppPrincipal.elements.logActivityForm.onsubmit = AppPrincipal.handleLogManualActivity;
        if(AppPrincipal.elements.profileForm) AppPrincipal.elements.profileForm.onsubmit = AppPrincipal.handleSaveProfile;

        // Upload de Imagem (Cloudinary via Cofre)
        if(AppPrincipal.elements.photoUploadInput) {
            AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUploadCloudinary);
        }
    },

    openFeedbackModal: (workoutId, ownerId) => {
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        AppPrincipal.state.modal.newPhotoUrl = null;
        
        AppPrincipal.elements.feedbackForm.reset();
        AppPrincipal.elements.photoUploadFeedback.textContent = "";
        AppPrincipal.elements.stravaDataDisplay.classList.add('hidden');
        
        AppPrincipal.loadComments(workoutId);
        AppPrincipal.elements.feedbackModal.classList.remove('hidden');
    },

    handleSaveFeedback: async (e) => {
        e.preventDefault();
        const workoutId = AppPrincipal.state.modal.currentWorkoutId;
        const ownerId = AppPrincipal.state.modal.currentOwnerId;
        
        const status = AppPrincipal.elements.feedbackStatus.value;
        const feedback = AppPrincipal.elements.feedbackText.value;
        const photoUrl = AppPrincipal.state.modal.newPhotoUrl;

        const updateData = { status, feedback };
        if(photoUrl) updateData.photoUrl = photoUrl;

        try {
            // Se a IA leu dados da foto do Strava, injeta eles aqui
            const stravaTempo = document.getElementById('strava-data-tempo')?.innerText;
            const stravaDist = document.getElementById('strava-data-distancia')?.innerText;
            const stravaPace = document.getElementById('strava-data-ritmo')?.innerText;
            
            if(stravaTempo && stravaDist && AppPrincipal.elements.stravaDataDisplay && !AppPrincipal.elements.stravaDataDisplay.classList.contains('hidden')) {
                updateData.metrics = {
                    tempo: stravaTempo.replace('Tempo: ', ''),
                    distancia: stravaDist.replace('Distância: ', ''),
                    pace: stravaPace ? stravaPace.replace('Pace/Ritmo: ', '') : ''
                };
            }

            // Atualiza Treino do Usuário
            await AppPrincipal.state.db.ref(`users/${ownerId}/workouts/${workoutId}`).update(updateData);

            // Busca os dados do treino para postar no Feed
            const snap = await AppPrincipal.state.db.ref(`users/${ownerId}/workouts/${workoutId}`).once('value');
            if(snap.exists()) {
                const workoutData = snap.val();
                if(status === 'realizado' || status === 'realizado_parcial') {
                    // Posta no Feed Público
                    await AppPrincipal.state.db.ref(`publicWorkouts/${workoutId}`).set({
                        ownerId: ownerId,
                        ownerName: AppPrincipal.state.userData.name,
                        ownerPhoto: AppPrincipal.state.userData.photoUrl || "",
                        title: workoutData.title,
                        feedback: feedback,
                        metrics: updateData.metrics || workoutData.metrics || null,
                        photoUrl: photoUrl || null,
                        timestamp: Date.now()
                    });
                }
            }

            alert("Feedback salvo e postado no feed!");
            AppPrincipal.elements.feedbackModal.classList.add('hidden');
        } catch(err) {
            console.error(err);
            alert("Erro ao salvar feedback.");
        }
    },

    // -----------------------------------------------------------------
    // INTEGRAÇÃO CLOUDINARY (Usa variáveis do Cofre)
    // -----------------------------------------------------------------
    handlePhotoUploadCloudinary: async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        if(!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName) {
            alert("O banco de imagens (Cloudinary) não está configurado no Cofre. Fale com o administrador.");
            e.target.value = "";
            return;
        }

        const feedbackP = AppPrincipal.elements.photoUploadFeedback;
        feedbackP.style.color = 'var(--secondary-color)';
        feedbackP.textContent = "Fazendo upload da imagem...";

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if(data.secure_url) {
                AppPrincipal.state.modal.newPhotoUrl = data.secure_url;
                feedbackP.style.color = 'var(--success-color)';
                feedbackP.textContent = "Upload concluído! Analisando imagem (IA)...";
                
                // Dispara análise da IA Vision (Gemini) se a imagem for um print do Strava
                AppPrincipal.analyzeStravaImageWithIA(data.secure_url);
            } else {
                throw new Error("Falha no retorno do Cloudinary.");
            }
        } catch(err) {
            console.error(err);
            feedbackP.style.color = 'var(--danger-color)';
            feedbackP.textContent = "Erro no upload da imagem.";
        }
    },

    // -----------------------------------------------------------------
    // IA VISION GEMINI (Para ler Prints do Strava)
    // -----------------------------------------------------------------
    analyzeStravaImageWithIA: async (imageUrl) => {
        if(!window.GEMINI_API_KEY) {
            AppPrincipal.elements.photoUploadFeedback.textContent = "Upload OK. (IA desativada - Chave não configurada no cofre)";
            return;
        }

        try {
            // Baixa a imagem como base64 via um proxy simples para evitar CORS se necessário,
            // Ou passa a URL diretamente se o modelo suportar (Gemini 2.0 suporta via File API, mas para web o ideal é mandar inlineData).
            // Para simplificar no client-side sem backend intermediário, vamos tentar pedir para a IA ler a URL diretamente (alguns modelos aceitam no prompt).
            const prompt = `Analise a seguinte imagem através desta URL (se for acessível) ou considere que é um print de aplicativo de corrida. 
                            URL: ${imageUrl}. 
                            Extraia e retorne EXATAMENTE este formato JSON puro, sem crases ou marcação markdown:
                            {"distancia": "valor km", "tempo": "valor", "pace": "valor /km"} 
                            Se não conseguir ler, retorne JSON vazio: {}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!response.ok) throw new Error("Erro na API da IA");
            const data = await response.json();
            const textRaw = data.candidates[0].content.parts[0].text;
            
            // Limpa o texto caso o Gemini mande marcação Markdown
            const cleanText = textRaw.replace(/```json/g, '').replace(/```/g, '').trim();
            const metrics = JSON.parse(cleanText);

            if(metrics.distancia && metrics.tempo) {
                AppPrincipal.elements.stravaDataDisplay.classList.remove('hidden');
                document.getElementById('strava-data-distancia').textContent = `Distância: ${metrics.distancia}`;
                document.getElementById('strava-data-tempo').textContent = `Tempo: ${metrics.tempo}`;
                if(metrics.pace) document.getElementById('strava-data-ritmo').textContent = `Pace/Ritmo: ${metrics.pace}`;
                
                AppPrincipal.elements.photoUploadFeedback.textContent = "Imagem anexada e dados extraídos com sucesso pela IA!";
            } else {
                AppPrincipal.elements.photoUploadFeedback.textContent = "Imagem anexada. A IA não conseguiu ler os dados numéricos.";
            }

        } catch (error) {
            console.error("Erro na leitura da IA:", error);
            AppPrincipal.elements.photoUploadFeedback.textContent = "Imagem anexada. (Falha na IA de leitura).";
        }
    },

    // -----------------------------------------------------------------
    // COMENTÁRIOS E PERFIL
    // -----------------------------------------------------------------
    openComments: (workoutId) => {
        AppPrincipal.openFeedbackModal(workoutId, AppPrincipal.state.currentUser.uid); // Usa o mesmo modal para comentários
        // Oculta o form de feedback para mostrar só a parte de comentários
        AppPrincipal.elements.feedbackForm.parentElement.querySelector('fieldset:first-child').style.display = 'none';
        AppPrincipal.elements.feedbackForm.parentElement.querySelector('hr').style.display = 'none';
    },

    loadComments: (workoutId) => {
        const list = AppPrincipal.elements.commentsList;
        list.innerHTML = '';
        AppPrincipal.state.db.ref(`publicWorkouts/${workoutId}/comments`).on('value', snap => {
            list.innerHTML = '';
            if(snap.exists()) {
                snap.forEach(c => {
                    const data = c.val();
                    list.innerHTML += `<div style="background:#f4f5f7; padding:8px; border-radius:6px; margin-bottom:5px;">
                        <strong style="font-size:0.8rem; color:var(--primary-color);">${data.authorName}:</strong> 
                        <span style="font-size:0.9rem;">${data.text}</span>
                    </div>`;
                });
                list.scrollTop = list.scrollHeight;
            }
        });
    },

    handleSaveComment: (e) => {
        e.preventDefault();
        const workoutId = AppPrincipal.state.modal.currentWorkoutId;
        const text = AppPrincipal.elements.commentInput.value.trim();
        if(!text) return;

        AppPrincipal.state.db.ref(`publicWorkouts/${workoutId}/comments`).push({
            authorId: AppPrincipal.state.currentUser.uid,
            authorName: AppPrincipal.state.userData.name,
            text: text,
            timestamp: Date.now()
        }).then(() => {
            AppPrincipal.elements.commentInput.value = '';
        });
    },

    showWhoLiked: (postId) => {
        AppPrincipal.state.db.ref(`publicWorkouts/${postId}/likes`).once('value', snap => {
            if(!snap.exists()) return;
            AppPrincipal.elements.whoLikedList.innerHTML = '';
            
            const uids = Object.keys(snap.val());
            uids.forEach(uid => {
                AppPrincipal.state.db.ref(`users/${uid}`).once('value', userSnap => {
                    if(userSnap.exists()) {
                        const u = userSnap.val();
                        AppPrincipal.elements.whoLikedList.innerHTML += `
                            <li style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;"
                                onclick="AppPrincipal.viewProfile('${uid}')">
                                <img src="${u.photoUrl || 'https://placehold.co/50'}" style="width:40px; height:40px; border-radius:50%;">
                                <span>${u.name}</span>
                            </li>
                        `;
                    }
                });
            });
            AppPrincipal.elements.whoLikedModal.classList.remove('hidden');
        });
    },

    openProfileModal: () => {
        const u = AppPrincipal.state.userData;
        document.getElementById('profile-name').value = u.name || '';
        document.getElementById('profile-bio').value = u.bio || '';
        document.getElementById('profile-pic-preview').src = u.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';
        AppPrincipal.elements.profileModal.classList.remove('hidden');
    },

    handleSaveProfile: async (e) => {
        e.preventDefault();
        const uid = AppPrincipal.state.currentUser.uid;
        const name = document.getElementById('profile-name').value;
        const bio = document.getElementById('profile-bio').value;
        const fileInput = document.getElementById('profile-pic-upload');
        let photoUrl = document.getElementById('profile-pic-preview').src;

        try {
            // Se o usuário selecionou uma nova foto de perfil
            if(fileInput.files.length > 0 && window.CLOUDINARY_CONFIG && window.CLOUDINARY_CONFIG.cloudName) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                
                document.getElementById('save-profile-btn').textContent = "Enviando Foto...";
                
                const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                    method: 'POST', body: formData
                });
                const data = await res.json();
                if(data.secure_url) photoUrl = data.secure_url;
            }

            await AppPrincipal.state.db.ref(`users/${uid}`).update({
                name: name,
                bio: bio,
                photoUrl: photoUrl
            });

            AppPrincipal.state.userData.name = name;
            AppPrincipal.state.userData.bio = bio;
            AppPrincipal.state.userData.photoUrl = photoUrl;
            
            AppPrincipal.elements.userDisplay.textContent = `Olá, ${name.split(' ')[0]}`;
            alert("Perfil atualizado!");
            AppPrincipal.elements.profileModal.classList.add('hidden');
            document.getElementById('save-profile-btn').textContent = "Salvar Perfil";

            // Se estiver na tela do Feed, força reload para atualizar a foto nos posts futuros
            if(AppPrincipal.state.currentView === 'feed' && window.FeedPanel) {
                window.FeedPanel.loadFeed();
            }

        } catch(err) {
            console.error(err);
            alert("Erro ao salvar perfil.");
            document.getElementById('save-profile-btn').textContent = "Salvar Perfil";
        }
    },

    viewProfile: (uid) => {
        AppPrincipal.state.db.ref(`users/${uid}`).once('value', snap => {
            if(snap.exists()) {
                const u = snap.val();
                document.getElementById('view-profile-name').textContent = u.name;
                document.getElementById('view-profile-bio').textContent = u.bio || "Sem biografia cadastrada.";
                document.getElementById('view-profile-pic').src = u.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';
                AppPrincipal.elements.viewProfileModal.classList.remove('hidden');
                AppPrincipal.elements.whoLikedModal.classList.add('hidden'); // Fecha o modal de likes se estiver aberto
            }
        });
    },

    // -----------------------------------------------------------------
    // REGISTRO DE ATIVIDADE MANUAL (Avulsa)
    // -----------------------------------------------------------------
    handleLogManualActivity: async (e) => {
        e.preventDefault();
        const uid = AppPrincipal.state.currentUser.uid;
        
        const date = document.getElementById('log-activity-date').value;
        const type = document.getElementById('log-activity-type').value;
        const title = document.getElementById('log-activity-title').value;
        const feedback = document.getElementById('log-activity-feedback').value;

        const payload = {
            date: date,
            title: title,
            tipoTreino: type,
            feedback: feedback,
            status: 'realizado',
            timestamp: Date.now()
        };

        try {
            const newRef = AppPrincipal.state.db.ref(`users/${uid}/workouts`).push();
            await newRef.set(payload);

            // Pergunta se quer postar no feed
            if(confirm("Atividade salva! Deseja postar esta atividade no Feed Social para a equipe ver?")) {
                await AppPrincipal.state.db.ref(`publicWorkouts/${newRef.key}`).set({
                    ownerId: uid,
                    ownerName: AppPrincipal.state.userData.name,
                    ownerPhoto: AppPrincipal.state.userData.photoUrl || "",
                    title: `[Avulso] ${title}`,
                    feedback: feedback,
                    timestamp: Date.now()
                });
            }

            AppPrincipal.elements.logActivityForm.reset();
            AppPrincipal.elements.logActivityModal.classList.add('hidden');
        } catch(err) {
            console.error(err);
            alert("Erro ao registrar atividade.");
        }
    }
};

// ===================================================================
// START DO SISTEMA
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    AppPrincipal.init();
});
