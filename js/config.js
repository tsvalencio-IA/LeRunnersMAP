// js/config.js
// CONFIGURAÇÕES GLOBAIS - VERSÃO MESTRA Vercel (MIGRAÇÃO)

const firebaseConfig = {
  apiKey: "AIzaSyDEfyw4v2UlVw85swueLoEnGjYY95xh2NI",
  authDomain: "lerunners-a6de2.firebaseapp.com",
  databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com",
  projectId: "lerunners-a6de2",
  storageBucket: "lerunners-a6de2.firebasestorage.app",
  messagingSenderId: "24483751716",
  appId: "1:24483751716:web:313b3013bd11c75e2eb5b1"
};

// --- TÉCNICA DE OFUSCAÇÃO DE CHAVE (GEMINI) ---
const GEMINI_PART_A = "AIzaSy"; 
const GEMINI_PART_B = "D2L7-vh645XH6pDZszlxNokE-u33lE1fs"; 

const GEMINI_API_KEY = GEMINI_PART_A + GEMINI_PART_B;

// --- Configuração do CLOUDINARY ---
const CLOUDINARY_CONFIG = {
  cloudName: "djtiaygrs",
  uploadPreset: "LeRunners"
};

// --- Configuração do STRAVA (CONEXÃO HÍBRIDA) ---
const STRAVA_PUBLIC_CONFIG = {
    clientID: '185534', 
    
    // 1. FRONTEND NOVO (Seu site seguro na Vercel)
    // Isso corrige o erro de login do Strava
    redirectURI: 'https://le-runners-rp.vercel.app/app.html', 
    
    // 2. BACKEND ANTIGO (Onde as chaves secretas já funcionam)
    // Não mexemos aqui, pois o motor está perfeito
    vercelAPI: 'https://le-runners2.vercel.app/api/strava-exchange',
    vercelRefreshAPI: 'https://le-runners2.vercel.app/api/strava-refresh'
};

// ===================================================================
// EXPORTAÇÃO GLOBAL
// ===================================================================
window.firebaseConfig = firebaseConfig;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.STRAVA_PUBLIC_CONFIG = STRAVA_PUBLIC_CONFIG;
