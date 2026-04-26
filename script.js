import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const modal = document.getElementById('profile-modal');
const closeModal = document.getElementById('close-modal');
const modalPfp = document.getElementById('modal-pfp');
const editName = document.getElementById('edit-name');
const fileInput = document.getElementById('edit-pfp-file');

const publicModal = document.getElementById('public-profile-modal');
const closePublicModal = document.getElementById('close-public-modal');

const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const filterYear = document.getElementById('filter-year');
const albumGrid = document.getElementById('album-grid');
const loadingText = document.getElementById('loading-text');

let currentUser = null;
let allUsersData = [];

// --- NAVEGAÇÃO ---
const showSection = (id) => {
    document.getElementById('home').style.display = id === 'home' ? 'block' : 'none';
    document.getElementById('search-section').style.display = id === 'search-section' ? 'block' : 'none';
    document.getElementById('network-section').style.display = id === 'network-section' ? 'block' : 'none';
};

document.getElementById('link-home').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('home');
    document.getElementById('search-section').style.display = 'block'; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('link-explorar').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('search-section');
    if (!searchInput.value.trim()) {
        searchInput.value = "Em alta";
        filterYear.value = "2026";
        setTimeout(() => searchBtn.click(), 100); 
    } else {
        searchInput.focus(); 
    }
});

// --- SISTEMA DE COMUNIDADE (REDE & AMIGOS) ---
const renderUsers = (usersList) => {
    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '';
    
    if (usersList.length === 0) {
        usersGrid.innerHTML = '<p style="color:#aaa; text-align:center; width:100%; margin-top:20px;">Nenhum utilizador encontrado com esse nome.</p>';
        return;
    }

    usersList.forEach(userObj => {
        const data = userObj.data;
        const uid = userObj.id;
        
        const userCard = document.createElement('div');
        userCard.className = 'user-card fade-in-up liquid-glass';
        userCard.innerHTML = `
            <div class="user-info-click" style="display:flex; align-items:center; gap:10px; width: 100%;">
                <img src="${data.photoURL || 'https://via.placeholder.com/50'}" alt="Foto">
                <div>
                    <h4 class="glow-text" style="color:#fff;">${data.name || 'Anónimo'}</h4>
                    <p style="font-size:0.7rem; color:#aaa;">${data.bio ? data.bio.substring(0, 30) + '...' : 'Sem biografia'}</p>
                </div>
            </div>
            <button class="btn-follow" data-id="${uid}">Adicionar Amigo</button>
        `;
        usersGrid.appendChild(userCard);

        userCard.querySelector('.user-info-click').addEventListener('click', () => openPublicProfile(uid, data));
    });

    document.querySelectorAll('.btn-follow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            if(!currentUser) return alert("Faz login para adicionares amigos.");
            
            const targetId = e.target.getAttribute('data-id');
            const followRef = doc(db, "users", currentUser.uid, "friends", targetId);
            
            if (e.target.classList.contains('following')) {
                await deleteDoc(followRef);
                e.target.classList.remove('following');
                e.target.innerText = 'Adicionar Amigo';
            } else {
                await setDoc(followRef, { addedAt: new Date() });
                e.target.classList.add('following');
                e.target.innerText = 'Amigo Adicionado';
            }
        });
    });
};

document.getElementById('link-rede').addEventListener('click', async (e) => {
    e.preventDefault();
    showSection('network-section');
    
    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '<p class="pulse-text">Buscando utilizadores na rede<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span></p>';

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        allUsersData = [];
        
        usersSnap.forEach(docSnap => {
            if(currentUser && docSnap.id === currentUser.uid) return; 
            allUsersData.push({ id: docSnap.id, data: docSnap.data() });
        });
        
        if (allUsersData.length === 0) {
            usersGrid.innerHTML = '<p style="color:#aaa; text-align:center; width:100%; margin-top:20px;">És o único utilizador na plataforma no momento. Convida outras pessoas!</p>';
        } else {
            renderUsers(allUsersData);
        }
    } catch (err) {
        console.error("Erro ao carregar rede:", err);
        usersGrid.innerHTML = '<p style="color:#ff3333; text-align:center;">Falha ao aceder aos dados da comunidade.</p>';
    }
});

if(document.getElementById('user-search-input')) {
    document.getElementById('user-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allUsersData.filter(u => (u.data.name || "").toLowerCase().includes(term));
        renderUsers(filtered);
    });
}

// --- VER PERFIL DE OUTRA PESSOA ---
const openPublicProfile = async (uid, userData) => {
    publicModal.style.display = 'flex';
    document.getElementById('public-name').innerText = userData.name || 'Anónimo';
    document.getElementById('public-pfp').src = userData.photoURL || 'https://via.placeholder.com/80';
    document.getElementById('public-bio').innerText = userData.bio || 'Este utilizador não possui biografia.';
    
    const container = document.getElementById('public-rated-albums');
    container.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Buscando obras...</p>';
    
    try {
        const snap = await getDocs(collection(db, "users", uid, "ratings"));
        if (snap.empty) {
            container.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>';
            return;
        }
        
        container.innerHTML = '';
        let animDelay = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            container.innerHTML += `
                <div class="rated-album-mini" style="animation-delay: ${animDelay}s;">
                    <img src="${data.image}">
                    <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                    <p style="font-size: 0.8rem; color: #fff;">${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</p>
                </div>
            `;
            animDelay += 0.08; 
        });
    } catch (error) {
        container.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao carregar obras.</p>';
    }
};
closePublicModal.addEventListener('click', () => publicModal.style.display = 'none');

// --- SISTEMA DE AUTENTICAÇÃO ---
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        albumGrid.innerHTML = ''; 
    });
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            navPfp.src = data.photoURL || user.photoURL;
            modalPfp.src = data.photoURL || user.photoURL;
            editName.value = data.name || user.displayName;
            document.getElementById('edit-bio').value = data.bio || "";
        } else {
            navPfp.src = user.photoURL;
            modalPfp.src = user.photoURL;
            editName.value = user.displayName;
        }
    } else {
        loginBtn.style.display = 'block';
        userMenu.style.display = 'none';
    }
});

// --- SISTEMA DO SEU MODAL DE PERFIL ---
navPfp.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const ratedContainer = document.getElementById('user-rated-albums');
    
    if (!currentUser) return;
    
    ratedContainer.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Aceder a dados da conta...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "ratings"));
        
        if (querySnapshot.empty) {
            ratedContainer.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Ainda não avaliaste nenhuma obra.</p>';
            return;
        }
        
        ratedContainer.innerHTML = '';
        let animDelay = 0; 
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            ratedContainer.innerHTML += `
                <div class="rated-album-mini" style="animation-delay: ${animDelay}s;">
                    <img src="${data.image}">
                    <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                    <p style="font-size: 0.8rem; color: #fff;">${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</p>
                </div>
            `;
            animDelay += 0.08; 
        });
    } catch (error) {
        console.error("Erro ao carregar álbuns:", error);
        ratedContainer.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao ler os dados.</p>';
    }
});

closeModal.addEventListener('click', () => modal.style.display = 'none');

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            modalPfp.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }
});

// --- SALVA O PERFIL ---
document.getElementById('save-profile').addEventListener('click', async () => {
    if (!currentUser) return alert("Faz login primeiro.");

    const newName = document.getElementById('edit-name').value;
    const newBio = document.getElementById('edit-bio').value;
    const newPfp = modalPfp.src; 
    
    document.getElementById('save-profile').innerText = "A guardar...";

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            name: newName,
            bio: newBio,
            photoURL: newPfp
        }, { merge: true });
        
        navPfp.src = newPfp;
        
        document.getElementById('save-profile').innerText = "Salvar Modificações";
        modal.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("A conexão com a base de dados falhou.");
        document.getElementById('save-profile').innerText = "Salvar Modificações";
    }
});

// --- SISTEMA DE BUSCA E ESTRELAS ---
searchBtn.addEventListener('click', async () => {
    let rawQuery = searchInput.value.trim();
    if (!rawQuery) {
        rawQuery = "Lançamentos"; 
        searchInput.value = rawQuery;
    }

    let finalQuery = rawQuery;
    if (filterYear.value) finalQuery += ` year:${filterYear.value}`;
    
    loadingText.style.display = 'block';
    albumGrid.innerHTML = '';

    try {
        const type = filterType.value;
        const url = `https://api-musicbox-m275.onrender.com/search?q=${encodeURIComponent(finalQuery)}&type=${type}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        loadingText.style.display = 'none';

        if (!data || data.length === 0) {
            albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registo encontrado.</p>';
            return;
        }

        data.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card fade-in-up liquid-glass';
            card.innerHTML = `
                <img src="${album.image || 'https://via.placeholder.com/200'}" alt="Capa">
                <div class="album-title glow-text">${album.name}</div>
                <div class="album-artist">${album.artist}</div>
                
                <div class="rating-ui">
                    <span style="font-size: 0.7rem; color: #aaa;">AVALIAR</span>
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

            const stars = Array.from(card.querySelectorAll('.stars i'));
            stars.forEach((star, index) => {
                star.addEventListener('click', () => {
                    if(!currentUser) { 
                        alert('Faz login para avaliar esta obra.'); 
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

                    const rating = index + 1;
                    const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
                    
                    setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                        name: album.name,
                        artist: album.artist,
                        image: album.image || 'https://via.placeholder.com/200',
                        rating: rating
                    }).catch(err => console.error("Erro ao guardar nota:", err));
                });
            });
        });

    } catch (error) {
        console.error("Erro:", error);
        loadingText.style.display = 'none';
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão aos servidores falhou. Verifica o link do Render.</p>';
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});
