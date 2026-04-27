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

// Variáveis da Paginação
let currentAlbums = [];
let currentPage = 1;
const itemsPerPage = 12;

// Controle de Áudio Global
let currentAudio = null;
let currentPlayBtn = null;

// --- NAVEGAÇÃO COM BLUR ANIMADO ---
const showSection = (id) => {
    const overlay = document.getElementById('page-transition');
    const blurTargets = document.querySelectorAll('.blur-target');
    
    // Ativa o Blur
    blurTargets.forEach(el => el.classList.add('is-blurred'));
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'all';
    
    // Força reflow pra animação rodar
    void overlay.offsetWidth; 
    overlay.style.opacity = '1';

    setTimeout(() => {
        // Troca as telas no escuro
        document.getElementById('home').style.display = id === 'home' ? 'block' : 'none';
        document.getElementById('search-section').style.display = id === 'search-section' || id === 'home' ? 'block' : 'none';
        document.getElementById('network-section').style.display = id === 'network-section' ? 'block' : 'none';
        document.getElementById('album-view-section').style.display = id === 'album-view-section' ? 'block' : 'none';
        
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        // Remove o Blur
        overlay.style.opacity = '0';
        setTimeout(() => { 
            overlay.style.display = 'none'; 
            overlay.style.pointerEvents = 'none';
            blurTargets.forEach(el => el.classList.remove('is-blurred'));
        }, 400); // Tempo do fade out
    }, 400); // Tempo do fade in
};

document.getElementById('link-home').addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
document.getElementById('back-to-explore').addEventListener('click', () => {
    if(currentAudio) currentAudio.pause();
    showSection('search-section');
});

document.getElementById('link-explorar').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('search-section');
    if (!searchInput.value.trim()) {
        setTimeout(() => loadTrending(), 400); 
    } else {
        searchInput.focus(); 
    }
});

// --- CARREGA O DETALHE DO ÁLBUM (SPOTIFY VIEW) ---
const loadAlbumView = async (album) => {
    showSection('album-view-section');
    
    document.getElementById('album-view-cover').src = album.image;
    document.getElementById('album-view-title').innerText = album.name;
    document.getElementById('album-view-artist').innerText = album.artist;
    
    const trackContainer = document.getElementById('tracklist-container');
    trackContainer.innerHTML = '<p class="pulse-text">Buscando faixas na base de dados<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span></p>';
    
    try {
        // Bate direto na API do iTunes para puxar as tracks usando o ID
        const res = await fetch(`https://itunes.apple.com/lookup?id=${album.id}&entity=song`);
        const data = await res.json();
        const tracks = data.results.filter(t => t.wrapperType === 'track');
        
        // Puxa as notas salvas no Firestore para não perder nada
        let savedData = {};
        if(currentUser) {
            const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
            const docSnap = await getDoc(doc(db, "users", currentUser.uid, "ratings", safeId));
            if(docSnap.exists() && docSnap.data().tracks) {
                savedData = docSnap.data().tracks;
            }
        }
        
        trackContainer.innerHTML = '';
        
        if(tracks.length === 0) {
            trackContainer.innerHTML = '<p style="color:#aaa;">Nenhuma faixa individual listada para este registro.</p>';
            return;
        }

        tracks.forEach((track, index) => {
            const tId = String(track.trackId);
            const myTrackData = savedData[tId] || { rating: 0, comment: '' };
            
            const div = document.createElement('div');
            div.className = 'track-row liquid-glass';
            div.innerHTML = `
                <div class="track-info">
                    <span style="color:#666; font-size:0.8rem; width:15px;">${index + 1}</span>
                    <i class="ph ph-play-circle play-btn" data-url="${track.previewUrl}"></i>
                    <div>
                        <div style="color:#fff; font-size:0.9rem; font-weight:600;">${track.trackName}</div>
                        <div style="color:#888; font-size:0.7rem;">${album.artist}</div>
                    </div>
                </div>
                <div class="track-actions">
                    <div class="stars track-stars" data-track="${tId}">
                        ${[1,2,3,4,5].map(n => `<i class="${n <= myTrackData.rating ? 'ph-fill' : 'ph'} ph-star" data-val="${n}"></i>`).join('')}
                    </div>
                    <input type="text" class="track-comment" placeholder="Suas notas sobre a faixa..." value="${myTrackData.comment}" data-track="${tId}">
                </div>
            `;
            trackContainer.appendChild(div);

            // Logica do Audio
            const playBtn = div.querySelector('.play-btn');
            playBtn.addEventListener('click', () => {
                if(!track.previewUrl) return alert("Áudio indisponível no catálogo.");
                
                if (currentAudio && currentAudio.src === track.previewUrl) {
                    if (currentAudio.paused) { currentAudio.play(); playBtn.classList.replace('ph-play-circle', 'ph-pause-circle'); }
                    else { currentAudio.pause(); playBtn.classList.replace('ph-pause-circle', 'ph-play-circle'); }
                } else {
                    if (currentAudio) { currentAudio.pause(); currentPlayBtn.classList.replace('ph-pause-circle', 'ph-play-circle'); }
                    currentAudio = new Audio(track.previewUrl);
                    currentAudio.volume = 0.5;
                    currentAudio.play();
                    currentPlayBtn = playBtn;
                    playBtn.classList.replace('ph-play-circle', 'ph-pause-circle');
                    currentAudio.onended = () => playBtn.classList.replace('ph-pause-circle', 'ph-play-circle');
                }
            });

            // Logica de salvar as estrelas da Faixa
            const stars = Array.from(div.querySelectorAll('.track-stars i'));
            stars.forEach((star, sIndex) => {
                star.addEventListener('click', async () => {
                    if(!currentUser) return alert('Faça login.');
                    
                    stars.forEach((s, i) => {
                        if (i <= sIndex) { s.style.color = '#fff'; s.classList.replace('ph', 'ph-fill'); } 
                        else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                    });

                    const rating = sIndex + 1;
                    const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
                    const commentInput = div.querySelector('.track-comment').value;

                    // Salva no banco misturando a data e a nova nota da musica especifica
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                        name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200',
                        timestamp: new Date(),
                        tracks: { [tId]: { rating: rating, comment: commentInput } }
                    }, { merge: true });
                });
            });

            // Logica de salvar comentario ao digitar
            let timeout = null;
            div.querySelector('.track-comment').addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    if(!currentUser) return;
                    const safeId = album.name.replace(/[^a-zA-Z0-9]/g, '');
                    const currentStars = Array.from(div.querySelectorAll('.track-stars .ph-fill')).length;
                    
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                        name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200',
                        timestamp: new Date(),
                        tracks: { [tId]: { rating: currentStars, comment: e.target.value } }
                    }, { merge: true });
                }, 1000); // Salva 1 segundo depois de parar de digitar
            });
        });
        
    } catch(e) {
        trackContainer.innerHTML = '<p style="color:red;">Erro de conexão com o catálogo musical.</p>';
    }
};

const loadTrending = async () => {
    loadingText.style.display = 'block';
    albumGrid.innerHTML = '';
    document.getElementById('pagination-controls').style.display = 'none';

    try {
        const response = await fetch(`https://api-musicbox-m275.onrender.com/trending`);
        const data = await response.json();
        
        loadingText.style.display = 'none';

        if (!data || data.length === 0) {
            albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum lançamento encontrado.</p>';
            return;
        }
        currentAlbums = data;
        currentPage = 1;
        renderPage();
    } catch (error) {
        loadingText.style.display = 'none';
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão com o servidor falhou.</p>';
    }
};

// --- SISTEMA DE COMUNIDADE E FEED DE AMIGOS ---
const loadFriendsFeed = async () => {
    if(!currentUser) return;
    const feed = document.getElementById('friends-feed');
    feed.innerHTML = '<p class="pulse-text">Buscando rastros no banco de dados...</p>';

    try {
        const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
        if(friendsSnap.empty) {
            feed.innerHTML = '<p style="color:#aaa;">Você não segue ninguém. Adicione usuários para ver as avaliações deles aqui.</p>';
            return;
        }

        let allActivities = [];
        // Varre todos os amigos pra puxar as notas deles
        for(const friendDoc of friendsSnap.docs) {
            const friendId = friendDoc.id;
            const friendProf = await getDoc(doc(db, "users", friendId));
            const pData = friendProf.data();
            
            const ratingsSnap = await getDocs(collection(db, "users", friendId, "ratings"));
            ratingsSnap.forEach(rDoc => {
                const rData = rDoc.data();
                if(rData.timestamp) {
                    allActivities.push({
                        friendName: pData.name || 'Anônimo',
                        friendPfp: pData.photoURL || 'https://via.placeholder.com/40',
                        timeMs: rData.timestamp.toMillis ? rData.timestamp.toMillis() : 0,
                        ...rData
                    });
                }
            });
        }

        allActivities.sort((a,b) => b.timeMs - a.timeMs);
        const recentActs = allActivities.slice(0, 15); // Top 15 ultimas atividades globais

        if(recentActs.length === 0) {
            feed.innerHTML = '<p style="color:#aaa;">Seus amigos ainda não avaliaram nada.</p>';
            return;
        }

        feed.innerHTML = '';
        recentActs.forEach(act => {
            const overallRating = act.rating || 0;
            const div = document.createElement('div');
            div.className = 'feed-item liquid-glass';
            div.style.marginBottom = '15px';
            div.style.borderRadius = '12px';
            
            // Verifica se tem comentários nas tracks para mostrar no feed
            let highlightComment = '';
            if(act.tracks) {
                const tracksWithComments = Object.values(act.tracks).filter(t => t.comment && t.comment.trim() !== '');
                if(tracksWithComments.length > 0) highlightComment = `<p style="font-style:italic; color:#aaa; font-size:0.8rem; margin-top:5px;">"${tracksWithComments[0].comment}"</p>`;
            }

            div.innerHTML = `
                <img src="${act.friendPfp}" class="pfp">
                <div style="flex:1;">
                    <p style="font-size:0.8rem; color:#888;"><b>${act.friendName}</b> avaliou:</p>
                    <h4 style="color:#fff; margin:5px 0;">${act.name} <span style="color:#aaa; font-weight:normal; font-size:0.8rem;">- ${act.artist}</span></h4>
                    <p style="color:#1ed760; font-size:0.9rem;">${'★'.repeat(overallRating)}${'☆'.repeat(5 - overallRating)}</p>
                    ${highlightComment}
                </div>
                <img src="${act.image}" class="cover" data-id="open-album" title="Abrir Álbum">
            `;
            
            // Abre o album ao clicar na capa no feed
            div.querySelector('.cover').addEventListener('click', () => loadAlbumView(act));
            feed.appendChild(div);
        });

    } catch(e) {
        console.error(e);
        feed.innerHTML = '<p style="color:red;">Erro ao puxar o feed.</p>';
    }
};

const renderUsers = (usersList) => {
    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '';
    if (usersList.length === 0) { usersGrid.innerHTML = '<p style="color:#aaa;">Nenhum usuário encontrado.</p>'; return; }

    usersList.forEach(userObj => {
        const data = userObj.data;
        const uid = userObj.id;
        const userCard = document.createElement('div');
        userCard.className = 'user-card fade-in-up liquid-glass';
        userCard.innerHTML = `
            <div class="user-info-click" style="display:flex; align-items:center; gap:10px; width: 100%;">
                <img src="${data.photoURL || 'https://via.placeholder.com/50'}">
                <div>
                    <h4 class="glow-text" style="color:#fff;">${data.name || 'Anônimo'}</h4>
                    <p style="font-size:0.7rem; color:#aaa;">${data.bio ? data.bio.substring(0, 30) + '...' : 'Sem biografia'}</p>
                </div>
            </div>
            <button class="btn-follow" data-id="${uid}">Seguir</button>
        `;
        usersGrid.appendChild(userCard);
        userCard.querySelector('.user-info-click').addEventListener('click', () => openPublicProfile(uid, data));
    });

    document.querySelectorAll('.btn-follow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            if(!currentUser) return alert("Faça login para adicionar amigos.");
            const targetId = e.target.getAttribute('data-id');
            const followRef = doc(db, "users", currentUser.uid, "friends", targetId);
            
            if (e.target.classList.contains('following')) {
                await deleteDoc(followRef);
                e.target.classList.remove('following');
                e.target.innerText = 'Seguir';
            } else {
                await setDoc(followRef, { addedAt: new Date() });
                e.target.classList.add('following');
                e.target.innerText = 'Seguindo';
            }
            loadFriendsFeed(); // Recarrega feed na hora
        });
    });
};

document.getElementById('link-rede').addEventListener('click', async (e) => {
    e.preventDefault();
    showSection('network-section');
    loadFriendsFeed();

    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '<p class="pulse-text">Buscando usuários...</p>';

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        allUsersData = [];
        usersSnap.forEach(docSnap => {
            if(currentUser && docSnap.id === currentUser.uid) return; 
            allUsersData.push({ id: docSnap.id, data: docSnap.data() });
        });
        
        if (allUsersData.length === 0) usersGrid.innerHTML = '<p style="color:#aaa;">Você é o único usuário no momento.</p>';
        else renderUsers(allUsersData);
    } catch (err) { usersGrid.innerHTML = '<p style="color:#ff3333;">Falha ao acessar dados.</p>'; }
});

if(document.getElementById('user-search-input')) {
    document.getElementById('user-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allUsersData.filter(u => (u.data.name || "").toLowerCase().includes(term));
        renderUsers(filtered);
    });
}

// --- VER PERFIL PÚBLICO ---
const openPublicProfile = async (uid, userData) => {
    publicModal.style.display = 'flex';
    document.getElementById('public-name').innerText = userData.name || 'Anônimo';
    document.getElementById('public-pfp').src = userData.photoURL || 'https://via.placeholder.com/80';
    document.getElementById('public-bio').innerText = userData.bio || 'Este usuário não possui biografia.';
    
    const container = document.getElementById('public-rated-albums');
    container.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Buscando obras...</p>';
    
    try {
        const snap = await getDocs(collection(db, "users", uid, "ratings"));
        if (snap.empty) { container.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>'; return; }
        
        container.innerHTML = '';
        let animDelay = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'rated-album-mini';
            div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}">
                <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.8rem; color: #fff;">${'★'.repeat(data.rating || 0)}${'☆'.repeat(5 - (data.rating || 0))}</p>
            `;
            // Clica na capa do perfil dele e abre o detalhe do álbum
            div.addEventListener('click', () => { publicModal.style.display = 'none'; loadAlbumView(data); });
            container.appendChild(div);
            animDelay += 0.08; 
        });
    } catch (error) { container.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao carregar obras.</p>'; }
};
closePublicModal.addEventListener('click', () => publicModal.style.display = 'none');

// --- SISTEMA DE AUTENTICAÇÃO ---
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => { signOut(auth).then(() => { albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none'; }); });

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none'; userMenu.style.display = 'flex';
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            navPfp.src = data.photoURL || user.photoURL; modalPfp.src = data.photoURL || user.photoURL;
            editName.value = data.name || user.displayName; document.getElementById('edit-bio').value = data.bio || "";
        } else {
            navPfp.src = user.photoURL; modalPfp.src = user.photoURL; editName.value = user.displayName;
        }
    } else { loginBtn.style.display = 'block'; userMenu.style.display = 'none'; }
});

// --- SISTEMA DO SEU MODAL DE PERFIL ---
navPfp.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const ratedContainer = document.getElementById('user-rated-albums');
    if (!currentUser) return;
    
    ratedContainer.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Acessando dados da conta...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "ratings"));
        if (querySnapshot.empty) { ratedContainer.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>'; return; }
        
        ratedContainer.innerHTML = '';
        let animDelay = 0; 
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'rated-album-mini';
            div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}">
                <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.8rem; color: #fff;">${'★'.repeat(data.rating || 0)}${'☆'.repeat(5 - (data.rating || 0))}</p>
            `;
            // Clica na sua capa e abre o detalhe do álbum
            div.addEventListener('click', () => { modal.style.display = 'none'; loadAlbumView(data); });
            ratedContainer.appendChild(div);
            animDelay += 0.08; 
        });
    } catch (error) { ratedContainer.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao ler os dados.</p>'; }
});

closeModal.addEventListener('click', () => modal.style.display = 'none');

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = function(event) { modalPfp.src = event.target.result; }; reader.readAsDataURL(file); }
});

document.getElementById('save-profile').addEventListener('click', async () => {
    if (!currentUser) return alert("Faça login primeiro.");
    document.getElementById('save-profile').innerText = "Salvando...";
    try {
        await setDoc(doc(db, "users", currentUser.uid), { name: editName.value, bio: document.getElementById('edit-bio').value, photoURL: modalPfp.src }, { merge: true });
        navPfp.src = modalPfp.src;
        document.getElementById('save-profile').innerText = "Salvar Modificações";
        modal.style.display = 'none';
    } catch (error) { alert("Falha na gravação."); document.getElementById('save-profile').innerText = "Salvar Modificações"; }
});

// --- RENDERIZAÇÃO DA PAGINAÇÃO ---
const renderPage = () => {
    albumGrid.innerHTML = '';
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = currentAlbums.slice(start, start + itemsPerPage);

    if (currentAlbums.length > itemsPerPage) {
        document.getElementById('pagination-controls').style.display = 'flex';
        document.getElementById('page-info').innerText = `Página ${currentPage} de ${Math.ceil(currentAlbums.length / itemsPerPage)}`;
        document.getElementById('prev-page').style.visibility = currentPage === 1 ? 'hidden' : 'visible';
        document.getElementById('next-page').style.visibility = (start + itemsPerPage) >= currentAlbums.length ? 'hidden' : 'visible';
    } else { document.getElementById('pagination-controls').style.display = 'none'; }

    pageData.forEach(album => {
        const card = document.createElement('div');
        card.className = 'album-card fade-in-up liquid-glass';
        card.innerHTML = `
            <img src="${album.image || 'https://via.placeholder.com/200'}" alt="Capa" class="capa-click">
            <div class="album-title glow-text capa-click">${album.name}</div>
            <div class="album-artist">${album.artist}</div>
            <div class="rating-ui">
                <span style="font-size: 0.7rem; color: #aaa;">NOTA GERAL</span>
                <div class="stars card-stars">
                    <i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i>
                </div>
            </div>
        `;
        albumGrid.appendChild(card);

        // Clicar na imagem ou no titulo joga pra pagina do Album
        card.querySelectorAll('.capa-click').forEach(el => el.addEventListener('click', () => loadAlbumView(album)));

        const stars = Array.from(card.querySelectorAll('.card-stars i'));
        stars.forEach((star, index) => {
            star.addEventListener('click', async (e) => {
                e.stopPropagation(); // Evita abrir o album ao clicar na estrela
                if(!currentUser) return alert('Faça login para avaliar esta obra.'); 
                stars.forEach((s, i) => {
                    if (i <= index) { s.style.color = '#1ed760'; s.classList.replace('ph', 'ph-fill'); } 
                    else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                });
                const rating = index + 1;
                const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
                await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                    name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200',
                    rating: rating, timestamp: new Date()
                }, { merge: true });
            });
        });
    });
};

document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'instant' }); } });
document.getElementById('next-page').addEventListener('click', () => { if ((currentPage * itemsPerPage) < currentAlbums.length) { currentPage++; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'instant' }); } });

// --- SISTEMA DE BUSCA ---
searchBtn.addEventListener('click', async () => {
    let rawQuery = searchInput.value.trim();
    if (!rawQuery) { loadTrending(); return; }

    let finalQuery = rawQuery;
    if (filterYear.value) finalQuery += ` year:${filterYear.value}`;
    
    loadingText.style.display = 'block'; albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none';

    try {
        const type = filterType.value;
        const response = await fetch(`https://api-musicbox-m275.onrender.com/search?q=${encodeURIComponent(finalQuery)}&type=${type}`);
        const data = await response.json();
        
        loadingText.style.display = 'none';
        if (!data || data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado.</p>'; return; }

        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { loadingText.style.display = 'none'; albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão falhou.</p>'; }
});
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
