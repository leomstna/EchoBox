// Imports do Firebase (SDK v9)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- COLA SUA CONFIGURAÇÃO DO FIREBASE AQUI ---
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_APP.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_APP.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Elementos da UI
const loginBtn = document.getElementById('login-btn');
const userInfo = document.getElementById('user-info');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const albumGrid = document.getElementById('album-grid');

// Login com Google
loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Erro no login mano:", error);
    });
});

// Listener de Estado de Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginBtn.style.display = 'none';
        userInfo.style.display = 'block';
        userInfo.textContent = `Logado como ${user.displayName}`;
    } else {
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
});

// Busca de Álbuns (Bate no Flask)
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    albumGrid.innerHTML = '<p>Buscando...</p>';

    try {
        // Flask rodando na porta 5000
        const response = await fetch(`https://echobox-api.onrender.com/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        albumGrid.innerHTML = ''; // Limpa o loading

        if (data.length === 0) {
            albumGrid.innerHTML = '<p>Nenhum álbum encontrado.</p>';
            return;
        }

        data.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <img src="${album.image || 'https://via.placeholder.com/200'}" alt="${album.name}">
                <div class="album-title">${album.name}</div>
                <div class="album-artist">${album.artist}</div>
            `;
            albumGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Deu ruim no fetch:", error);
        albumGrid.innerHTML = '<p>Erro ao buscar os álbuns, verifica se o Flask tá rodando tlgd.</p>';
    }
});

// Pra buscar dando ENTER
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});