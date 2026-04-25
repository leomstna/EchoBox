import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// !!! COLA TUAS CHAVES DO FIREBASE AQUI !!!
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

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userMenu = document.getElementById('user-menu');
const navPfp = document.getElementById('nav-pfp');

const modal = document.getElementById('profile-modal');
const closeModal = document.getElementById('close-modal');
const modalPfp = document.getElementById('modal-pfp');
const editName = document.getElementById('edit-name');
const fileInput = document.getElementById('edit-pfp-file');

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
        albumGrid.innerHTML = ''; 
    });
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        navPfp.src = user.photoURL || 'https://via.placeholder.com/40';
        modalPfp.src = user.photoURL || 'https://via.placeholder.com/60';
        editName.value = user.displayName;
    } else {
        loginBtn.style.display = 'block';
        userMenu.style.display = 'none';
    }
});

// --- LÓGICA DA NAVBAR E MENU EXTRAS ---
document.getElementById('link-home').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('link-explorar').addEventListener('click', (e) => {
    e.preventDefault();
    searchInput.value = ''; 
    filterYear.value = '2026'; 
    searchBtn.click(); 
    document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
});

// --- SISTEMA DO MODAL DE PERFIL ---
// Abre o perfil clicando na foto da navbar
navPfp.addEventListener('click', () => modal.style.display = 'flex');
closeModal.addEventListener('click', () => modal.style.display = 'none');

// Lógica de Upload da Nova Foto
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            modalPfp.src = event.target.result; // Muda a foto no modal na hora
        }
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile').addEventListener('click', () => {
    alert("Interface pronta! Na próxima a gente injeta o banco de dados pra salvar o manifesto e a foto permanentemente.");
    modal.style.display = 'none';
});

// --- SISTEMA DE BUSCA E ESTRELAS ---
searchBtn.addEventListener('click', async () => {
    const rawQuery = searchInput.value.trim();
    if (!rawQuery) return;

    let finalQuery = rawQuery;
    if (filterYear.value) finalQuery += ` year:${filterYear.value}`;
    
    loadingText.style.display = 'block';
    albumGrid.innerHTML = '';

    try {
        const type = filterType.value;
        
        // !!! COLA TEU LINK DO RENDER AQUI EMBAIXO !!!
        const url = `https://api-musicbox-m275.onrender.com/search?q=${encodeURIComponent(finalQuery)}&type=${type}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        loadingText.style.display = 'none';

        if (!data || data.length === 0) {
            albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado no abismo.</p>';
            return;
        }

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
                        <i class="ph ph-star"></i>
                        <i class="ph ph-star"></i>
                        <i class="ph ph-star"></i>
                        <i class="ph ph-star"></i>
                        <i class="ph ph-star"></i>
                    </div>
                </div>
            `;
            albumGrid.appendChild(card);
        });

        // Lógica de pintar as estrelas perfeitamente
        document.querySelectorAll('.stars').forEach(starContainer => {
            const stars = Array.from(starContainer.children);
            stars.forEach((star, index) => {
                star.addEventListener('click', () => {
                    if(!currentUser) { 
                        alert('Faça login para corromper este álbum com sua nota.'); 
                        return; 
                    }
                    stars.forEach((s, i) => {
                        if (i <= index) {
                            s.style.color = '#fff';
                            s.classList.remove('ph');
                            s.classList.add('ph-fill');
                        } else {
                            s.style.color = '#444';
                            s.classList.remove('ph-fill');
                            s.classList.add('ph');
                        }
                    });
                });
            });
        });

    } catch (error) {
        console.error("Erro:", error);
        loadingText.style.display = 'none';
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão com os servidores falhou. Verifique o link do Render.</p>';
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});
