import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// COLA TUAS CHAVES REAIS DO FIREBASE AQUI MANO
const firebaseConfig = {
  apiKey: "AIzaSyCvRd8N7UQaGLsV-0rxjLn-Z4Ys14KH3pY",
  authDomain: "mvp-rede-social.firebaseapp.com",
  projectId: "mvp-rede-social",
  storageBucket: "mvp-rede-social.firebasestorage.app",
  messagingSenderId: "245441998885",
  appId: "1:245441998885:web:ab16004bc2ed9af9e30fcc",
  measurementId: "G-6BEHZM47SL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userMenu = document.getElementById('user-menu');
const navPfp = document.getElementById('nav-pfp');
const profileBtn = document.getElementById('profile-btn');

const modal = document.getElementById('profile-modal');
const closeModal = document.getElementById('close-modal');
const modalPfp = document.getElementById('modal-pfp');
const editName = document.getElementById('edit-name');

const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const filterYear = document.getElementById('filter-year');
const albumGrid = document.getElementById('album-grid');
const loadingText = document.getElementById('loading-text');

let currentUser = null;

// --- SISTEMA DE AUTENTICAÇÃO ---
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        albumGrid.innerHTML = ''; // Limpa a tela
    });
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        navPfp.src = user.photoURL || 'https://via.placeholder.com/40';
        modalPfp.src = user.photoURL || 'https://via.placeholder.com/40';
        editName.value = user.displayName;
    } else {
        loginBtn.style.display = 'block';
        userMenu.style.display = 'none';
    }
});

// --- SISTEMA DE PERFIL (UI) ---
profileBtn.addEventListener('click', () => modal.style.display = 'flex');
closeModal.addEventListener('click', () => modal.style.display = 'none');

document.getElementById('save-profile').addEventListener('click', () => {
    // Na próxima etapa a gente conecta isso no Firestore pra salvar de verdade
    alert("Interface pronta! Na próxima a gente injeta o banco de dados pra salvar o manifesto e a foto.");
    modal.style.display = 'none';
});

// --- SISTEMA DE BUSCA COM FILTROS ---
searchBtn.addEventListener('click', async () => {
    const rawQuery = searchInput.value.trim();
    if (!rawQuery) return;

    // Montando a query avançada pro Spotify
    let finalQuery = rawQuery;
    if (filterYear.value) finalQuery += ` year:${filterYear.value}`;
    
    // Mostra animação de loading e limpa grid
    loadingText.style.display = 'block';
    albumGrid.innerHTML = '';

    try {
        // Usa o type do select (album ou track/single)
        const type = filterType.value;
        const url = `https://api-musicbox-m275.onrender.com/search?q=${encodeURIComponent(finalQuery)}&type=${type}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        loadingText.style.display = 'none'; // Some com o loading

        if (!data || data.length === 0) {
            albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado no abismo.</p>';
            return;
        }

        // Desenha os cards sombrios com as estrelas
        data.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card fade-in-up';
            card.innerHTML = `
                <img src="${album.image || 'https://via.placeholder.com/200'}" alt="Capa">
                <div class="album-title">${album.name}</div>
                <div class="album-artist">${album.artist}</div>
                
                <div class="rating-ui">
                    <span style="font-size: 0.7rem; color: #666;">AVALIAR</span>
                    <div class="stars">
                        <i class="ph-fill ph-star"></i>
                        <i class="ph-fill ph-star"></i>
                        <i class="ph-fill ph-star"></i>
                        <i class="ph-fill ph-star"></i>
                        <i class="ph-fill ph-star"></i>
                    </div>
                </div>
            `;
            albumGrid.appendChild(card);
        });

        // Script rápido pras estrelas brilharem (UI only)
        document.querySelectorAll('.stars i').forEach(star => {
            star.addEventListener('click', (e) => {
                if(!currentUser) { alert('Faça login para corromper este álbum com sua nota.'); return; }
                const siblings = Array.from(e.target.parentNode.children);
                const index = siblings.indexOf(e.target);
                siblings.forEach((s, i) => s.style.color = i <= index ? '#fff' : '#444');
            });
        });

    } catch (error) {
        console.error("Erro:", error);
        loadingText.style.display = 'none';
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão com os servidores falhou.</p>';
    }
});

// ENTER pra buscar
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});
