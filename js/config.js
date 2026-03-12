// js/config.js
// CONFIGURAÇÕES GLOBAIS - VERSÃO MESTRA 11.0 (COFRE FIREBASE DINÂMICO)

// Apenas as chaves de acesso ao Firebase Realtime Database devem ficar aqui.
// Estas chaves são "públicas" por design no Firebase, pois as regras de segurança 
// (Database Rules) é que protegem os dados reais.
const firebaseConfig = {
  apiKey: "AIzaSyAGr4SzZOUoNpkgcfh8D5Pv4StMkqAAX_0",
  authDomain: "lerunnersmap.firebaseapp.com",
  projectId: "lerunnersmap",
  storageBucket: "lerunnersmap.firebasestorage.app",
  messagingSenderId: "913793840199",
  appId: "1:913793840199:web:09359bba5aeee3fda6ed62"
};

// ===================================================================
// VARIÁVEIS GLOBAIS (PREENCHIDAS DINAMICAMENTE PELO FIREBASE)
// ===================================================================
// NÃO DIGITE NENHUMA CHAVE AQUI. 
// O módulo loadSystemConfigs() no app.js buscará as chaves salvas 
// no nó 'config/apiKeys' do Firebase e as injetará abaixo em tempo de execução.

window.GEMINI_API_KEY = ""; 
window.GOOGLE_MAPS_KEY = ""; 

window.CLOUDINARY_CONFIG = {
  cloudName: "",
  uploadPreset: ""
};

// ===================================================================
// CONFIGURAÇÕES LEGADAS (MANTIDAS POR SEGURANÇA ESTRUTURAL)
// ===================================================================
// Caso o cliente decida reativar a ponte com o Strava no futuro.
const STRAVA_PUBLIC_CONFIG = {
    clientID: '185534', 
    redirectURI: 'https://le-runners-rp.vercel.app/app.html' // Modifique caso volte a usar Vercel
};
