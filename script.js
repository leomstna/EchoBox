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

// DOM
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userMenu = document.getElementById('user-menu');
const navPfp = document.getElementById('nav-pfp');
const modal = document.getElementById('profile-modal');
const publicModal = document.getElementById('public-profile-modal');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const albumGrid = document.getElementById('album-grid');
const loadingText = document.getElementById('loading-text');

let currentUser = null;
let allUsersData = [];
let currentAlbums = [];
let currentPage = 1;
const itemsPerPage = 12;

// --- MOTOR INVISÍVEL DO YOUTUBE MUSIC ---
let ytPlayer = null;
let isPlayerReady = false;
let currentTrackId = null;
let progressInterval = null;
let currentPlayBtnUI = null;

const globalPlayer = document.getElementById('global-player');
const pPlayBtn = document.getElementById('player-play-btn');
const pTitle = document.getElementById('player-title');
const pArtist = document.getElementById('player-artist');
const pCover = document.getElementById('player-cover');
const pBarFill = document.getElementById('progress-bar-fill');
const pTimeCurr = document.getElementById('player-time-current');
const pTimeTot = document.getElementById('player-time-total');
const volSlider = document.getElementById('volume-slider');

window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('yt-player', {
        height: '1', width: '1', videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'fs': 0 },
        events: {
            'onReady': () => { isPlayerReady = true; ytPlayer.setVolume(volSlider.value * 100); },
            'onStateChange': onPlayerStateChange
        }
    });
};

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        pPlayBtn.classList.replace('ph-play-circle', 'ph-pause-circle');
        if (currentPlayBtnUI) {
            currentPlayBtnUI.classList.remove('ph-spinner');
            currentPlayBtnUI.classList.add('ph-pause-circle');
        }
        clearInterval(progressInterval);
        progressInterval = setInterval(updateProgressBar, 500);
    } else if (event.data === YT.PlayerState.PAUSED) {
        pPlayBtn.classList.replace('ph-pause-circle', 'ph-play-circle');
        if (currentPlayBtnUI) currentPlayBtnUI.classList.replace('ph-pause-circle', 'ph-play-circle');
        clearInterval(progressInterval);
    } else if (event.data === YT.PlayerState.ENDED) {
        pPlayBtn.classList.replace('ph-pause-circle', 'ph-play-circle');
        if (currentPlayBtnUI) currentPlayBtnUI.classList.replace('ph-pause-circle', 'ph-play-circle');
        clearInterval(progressInterval);
        pBarFill.style.width = '0%';
        pTimeCurr.innerText = '0:00';
    }
}

function updateProgressBar() {
    if(!ytPlayer || !ytPlayer.getDuration) return;
    const duration = ytPlayer.getDuration();
    const current = ytPlayer.getCurrentTime();
    if(duration > 0) {
        const progress = (current / duration) * 100;
        pBarFill.style.width = `${progress}%`;
        
        let curMins = Math.floor(current / 60);
        let curSecs = Math.floor(current % 60);
        pTimeCurr.innerText = `${curMins}:${curSecs < 10 ? '0'+curSecs : curSecs}`;
        
        let durMins = Math.floor(duration / 60);
        let durSecs = Math.floor(duration % 60);
        pTimeTot.innerText = `${durMins}:${durSecs < 10 ? '0'+durSecs : durSecs}`;
    }
}

volSlider.addEventListener('input', (e) => { if(isPlayerReady) ytPlayer.setVolume(e.target.value * 100); });

document.getElementById('progress-bar-bg').addEventListener('click', (e) => {
    if(!isPlayerReady || !currentTrackId) return;
    const rect = e.target.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    ytPlayer.seekTo(ytPlayer.getDuration() * percent, true);
});

pPlayBtn.addEventListener('click', () => {
    if(isPlayerReady && currentTrackId) {
        if(ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
        else ytPlayer.playVideo();
    }
});

// --- NAVEGAÇÃO COM FADE LIMPO ---
const showSection = (id) => {
    const overlay = document.getElementById('page-transition');
    const sections = document.querySelectorAll('.section-page');
    
    overlay.style.display = 'flex';
    void overlay.offsetWidth; 
    overlay.style.opacity = '1';

    setTimeout(() => {
        sections.forEach(s => s.style.display = 'none');
        if(id === 'home') { document.getElementById('home').style.display = 'block'; document.getElementById('search-section').style.display = 'block'; }
        else document.getElementById(id).style.display = 'block';
        
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }, 300);
};

document.getElementById('link-home').addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
document.getElementById('back-to-explore').addEventListener('click', () => showSection('search-section'));

document.getElementById('link-explorar').addEventListener('click', (e) => {
    e.preventDefault(); showSection('search-section');
    if (!searchInput.value.trim()) { setTimeout(() => loadTrending(), 400); } 
    else { searchInput.focus(); }
});

// --- CARREGA DETALHES DO ÁLBUM ---
const loadAlbumView = async (album) => {
    showSection('album-view-section');
    document.getElementById('album-view-cover').src = album.image;
    document.getElementById('album-view-title').innerText = album.name;
    document.getElementById('album-view-artist').innerText = album.artist;
    
    const trackContainer = document.getElementById('tracklist-container');
    trackContainer.innerHTML = '<p class="pulse-text">Buscando faixas na base de dados<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span></p>';
    
    try {
        let url = `https://itunes.apple.com/lookup?id=${album.id}&entity=song`;
        if (!album.id || isNaN(album.id)) {
            url = `https://itunes.apple.com/search?term=${encodeURIComponent(album.name + ' ' + album.artist)}&entity=song&limit=25`;
        }

        const res = await fetch(url);
        const data = await res.json();
        let tracks = data.results.filter(t => t.wrapperType === 'track');
        if(isNaN(album.id)) tracks = tracks.filter(t => t.collectionName && t.collectionName.includes(album.name));

        let savedData = {};
        if(currentUser) {
            const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
            const docSnap = await getDoc(doc(db, "users", currentUser.uid, "ratings", safeId));
            if(docSnap.exists() && docSnap.data().tracks) savedData = docSnap.data().tracks;
        }
        
        trackContainer.innerHTML = '';
        if(tracks.length === 0) { trackContainer.innerHTML = '<p style="color:#aaa;">Nenhuma faixa individual encontrada para este registro.</p>'; return; }

        tracks.forEach((track, index) => {
            const tId = String(track.trackId);
            const myTrackData = savedData[tId] || { rating: 0, comment: '' };
            
            const div = document.createElement('div');
            div.className = 'track-row liquid-glass';
            div.innerHTML = `
                <div class="track-info">
                    <span style="color:#666; font-size:0.8rem; width:15px;">${index + 1}</span>
                    <i class="ph ph-play-circle play-btn"></i>
                    <div class="track-info-text">
                        <div class="t-name">${track.trackName}</div>
                        <div style="color:#888; font-size:0.7rem;">${album.artist}</div>
                    </div>
                </div>
                <div class="track-actions">
                    <div class="stars track-stars" data-track="${tId}">
                        ${[1,2,3,4,5].map(n => `<i class="${n <= myTrackData.rating ? 'ph-fill' : 'ph'} ph-star" style="color: ${n <= myTrackData.rating ? '#1ed760' : '#444'}"></i>`).join('')}
                    </div>
                    <input type="text" class="track-comment" placeholder="Suas notas sobre a faixa..." value="${myTrackData.comment}" data-track="${tId}">
                </div>
            `;
            trackContainer.appendChild(div);

            const playBtn = div.querySelector('.play-btn');
            playBtn.addEventListener('click', async () => {
                if(!isPlayerReady) return alert("O reprodutor está iniciando, aguarde um momento.");
                globalPlayer.style.display = 'flex';
                
                if (currentTrackId === tId) {
                    if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
                    else ytPlayer.playVideo();
                } else {
                    if (currentPlayBtnUI) {
                        currentPlayBtnUI.classList.remove('ph-spinner');
                        currentPlayBtnUI.classList.add('ph-play-circle');
                        currentPlayBtnUI.classList.remove('ph-pause-circle');
                    }
                    currentPlayBtnUI = playBtn;
                    
                    playBtn.classList.replace('ph-play-circle', 'ph-spinner');
                    playBtn.classList.remove('ph-pause-circle');
                    
                    try {
                        const searchUrl = `https://api-musicbox-m275.onrender.com/yt-search?track=${encodeURIComponent(track.trackName)}&artist=${encodeURIComponent(album.artist)}`;
                        const ytRes = await fetch(searchUrl);
                        const ytData = await ytRes.json();
                        
                        if(ytData.videoId) {
                            currentTrackId = tId;
                            ytPlayer.loadVideoById(ytData.videoId);
                            pTitle.innerText = track.trackName; pArtist.innerText = album.artist; pCover.src = album.image;
                        } else {
                            alert("Faixa não encontrada no YouTube Music.");
                            playBtn.classList.replace('ph-spinner', 'ph-play-circle');
                        }
                    } catch(e) {
                        alert("Erro ao conectar com o servidor musical.");
                        playBtn.classList.replace('ph-spinner', 'ph-play-circle');
                    }
                }
            });

            const stars = Array.from(div.querySelectorAll('.track-stars i'));
            stars.forEach((star, sIndex) => {
                star.addEventListener('click', async () => {
                    if(!currentUser) return alert('Faça login.');
                    stars.forEach((s, i) => {
                        if (i <= sIndex) { s.style.color = '#1ed760'; s.classList.replace('ph', 'ph-fill'); } 
                        else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                    });
                    const rating = sIndex + 1;
                    const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                        name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200', timestamp: new Date(),
                        tracks: { [tId]: { rating: rating, comment: div.querySelector('.track-comment').value } }
                    }, { merge: true });
                });
            });

            let timeout = null;
            div.querySelector('.track-comment').addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    if(!currentUser) return;
                    const safeId = album.name.replace(/[^a-zA-Z0-9]/g, '');
                    const currentStars = Array.from(div.querySelectorAll('.track-stars .ph-fill')).length;
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                        name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200', timestamp: new Date(),
                        tracks: { [tId]: { rating: currentStars, comment: e.target.value } }
                    }, { merge: true });
                }, 1000);
            });
        });
    } catch(e) { trackContainer.innerHTML = '<p style="color:red;">Erro de conexão com o catálogo musical.</p>'; }
};

// --- TRENDING ---
const loadTrending = async () => {
    loadingText.style.display = 'block'; albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none';
    try {
        const response = await fetch(`https://api-musicbox-m275.onrender.com/trending`);
        const data = await response.json();
        loadingText.style.display = 'none';
        if (!data || data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666;">Nenhum lançamento encontrado.</p>'; return; }
        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { loadingText.style.display = 'none'; albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333;">Conexão falhou.</p>'; }
};

// --- COMUNIDADE ---
const loadFriendsFeed = async () => {
    if(!currentUser) return;
    const feed = document.getElementById('friends-feed');
    feed.innerHTML = '<p class="pulse-text">Buscando rastros...</p>';

    try {
        const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
        if(friendsSnap.empty) { feed.innerHTML = '<p style="color:#aaa;">Você não segue ninguém.</p>'; return; }

        let allActivities = [];
        for(const friendDoc of friendsSnap.docs) {
            const friendId = friendDoc.id;
            const friendProf = await getDoc(doc(db, "users", friendId));
            const pData = friendProf.data() || {};
            
            const ratingsSnap = await getDocs(collection(db, "users", friendId, "ratings"));
            ratingsSnap.forEach(rDoc => {
                const rData = rDoc.data();
                if(rData.timestamp) {
                    allActivities.push({
                        friendName: pData.name || 'Anônimo', friendPfp: pData.photoURL || 'https://via.placeholder.com/40',
                        timeMs: rData.timestamp.toMillis ? rData.timestamp.toMillis() : 0, ...rData
                    });
                }
            });
        }

        allActivities.sort((a,b) => b.timeMs - a.timeMs);
        const recentActs = allActivities.slice(0, 15);

        if(recentActs.length === 0) { feed.innerHTML = '<p style="color:#aaa;">Sem avaliações recentes.</p>'; return; }

        feed.innerHTML = '';
        recentActs.forEach(act => {
            const overallRating = act.rating || 0;
            const div = document.createElement('div');
            div.className = 'feed-item liquid-glass';
            div.style.marginBottom = '15px'; div.style.borderRadius = '12px';
            
            let highlightComment = '';
            if(act.tracks) {
                const tracksWithComments = Object.values(act.tracks).filter(t => t.comment && t.comment.trim() !== '');
                if(tracksWithComments.length > 0) highlightComment = `<p style="font-style:italic; color:#aaa; font-size:0.8rem; margin-top:5px;">"${tracksWithComments[0].comment}"</p>`;
            }

            div.innerHTML = `
                <div class="pfp-container-mini"><img src="${act.friendPfp}"></div>
                <div style="flex:1;">
                    <p style="font-size:0.8rem; color:#888;"><b>${act.friendName}</b> avaliou:</p>
                    <h4 style="color:#fff; margin:5px 0; cursor:pointer;" class="feed-title">${act.name} <span style="color:#aaa; font-weight:normal; font-size:0.8rem;">- ${act.artist}</span></h4>
                    <p style="color:#1ed760; font-size:0.9rem;">${'★'.repeat(overallRating)}${'☆'.repeat(5 - overallRating)}</p>
                    ${highlightComment}
                </div>
                <img src="${act.image}" class="cover" data-id="open-album" title="Abrir Álbum">
            `;
            div.querySelector('.cover').addEventListener('click', () => loadAlbumView(act));
            div.querySelector('.feed-title').addEventListener('click', () => loadAlbumView(act));
            feed.appendChild(div);
        });
    } catch(e) { feed.innerHTML = '<p style="color:red;">Erro ao puxar o feed.</p>'; }
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
                <div class="pfp-container-mini"><img src="${data.photoURL || 'https://via.placeholder.com/50'}"></div>
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
            if (e.target.classList.contains('following')) { await deleteDoc(followRef); e.target.classList.remove('following'); e.target.innerText = 'Seguir'; } 
            else { await setDoc(followRef, { addedAt: new Date() }); e.target.classList.add('following'); e.target.innerText = 'Seguindo'; }
            loadFriendsFeed(); 
        });
    });
};

document.getElementById('link-rede').addEventListener('click', async (e) => {
    e.preventDefault(); showSection('network-section'); loadFriendsFeed();
    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '<p class="pulse-text">Buscando usuários...</p>';
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        allUsersData = [];
        usersSnap.forEach(docSnap => { if(currentUser && docSnap.id === currentUser.uid) return; allUsersData.push({ id: docSnap.id, data: docSnap.data() }); });
        if (allUsersData.length === 0) usersGrid.innerHTML = '<p style="color:#aaa;">Você é o único usuário no momento.</p>'; else renderUsers(allUsersData);
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
        container.innerHTML = ''; let animDelay = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div'); div.className = 'rated-album-mini'; div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}">
                <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.8rem; color: #1ed760;">${'★'.repeat(data.rating || 0)}${'☆'.repeat(5 - (data.rating || 0))}</p>
            `;
            div.addEventListener('click', () => { publicModal.style.display = 'none'; loadAlbumView(data); });
            container.appendChild(div); animDelay += 0.08; 
        });
    } catch (error) { container.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao carregar obras.</p>'; }
};
document.getElementById('close-public-modal').addEventListener('click', () => publicModal.style.display = 'none');

// --- AUTENTICAÇÃO ---
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => { signOut(auth).then(() => { albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none'; }); });

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none'; userMenu.style.display = 'flex';
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            navPfp.src = data.photoURL || user.photoURL; document.getElementById('modal-pfp').src = data.photoURL || user.photoURL;
            document.getElementById('edit-name').value = data.name || user.displayName; document.getElementById('edit-bio').value = data.bio || "";
        } else {
            navPfp.src = user.photoURL; document.getElementById('modal-pfp').src = user.photoURL; document.getElementById('edit-name').value = user.displayName;
        }
    } else { loginBtn.style.display = 'block'; userMenu.style.display = 'none'; }
});

// --- SEU PERFIL ---
navPfp.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const ratedContainer = document.getElementById('user-rated-albums');
    if (!currentUser) return;
    ratedContainer.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Acessando dados da conta...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "ratings"));
        if (querySnapshot.empty) { ratedContainer.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>'; return; }
        ratedContainer.innerHTML = ''; let animDelay = 0; 
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div'); div.className = 'rated-album-mini'; div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}">
                <p style="font-size: 0.7rem; color: #fff; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.8rem; color: #1ed760;">${'★'.repeat(data.rating || 0)}${'☆'.repeat(5 - (data.rating || 0))}</p>
            `;
            div.addEventListener('click', () => { modal.style.display = 'none'; loadAlbumView(data); });
            ratedContainer.appendChild(div); animDelay += 0.08; 
        });
    } catch (error) { ratedContainer.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao ler os dados.</p>'; }
});

document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');

document.getElementById('edit-pfp-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = function(event) { document.getElementById('modal-pfp').src = event.target.result; }; reader.readAsDataURL(file); }
});

document.getElementById('save-profile').addEventListener('click', async () => {
    if (!currentUser) return alert("Faça login primeiro.");
    document.getElementById('save-profile').innerText = "Salvando...";
    try {
        const pfpSrc = document.getElementById('modal-pfp').src;
        await setDoc(doc(db, "users", currentUser.uid), { name: document.getElementById('edit-name').value, bio: document.getElementById('edit-bio').value, photoURL: pfpSrc }, { merge: true });
        navPfp.src = pfpSrc; document.getElementById('save-profile').innerText = "Salvar Modificações"; modal.style.display = 'none';
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

        card.querySelectorAll('.capa-click').forEach(el => el.addEventListener('click', () => loadAlbumView(album)));

        const stars = Array.from(card.querySelectorAll('.card-stars i'));
        stars.forEach((star, index) => {
            star.addEventListener('click', async (e) => {
                e.stopPropagation(); 
                if(!currentUser) return alert('Faça login para avaliar esta obra.'); 
                stars.forEach((s, i) => {
                    if (i <= index) { s.style.color = '#1ed760'; s.classList.replace('ph', 'ph-fill'); } 
                    else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                });
                const rating = index + 1;
                const safeId = album.name.replace(/[^a-zA-Z0-9]/g, ''); 
                await setDoc(doc(db, "users", currentUser.uid, "ratings", safeId), {
                    name: album.name, artist: album.artist, image: album.image || 'https://via.placeholder.com/200', rating: rating, timestamp: new Date()
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

    loadingText.style.display = 'block'; albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none';

    try {
        const type = filterType.value;
        const response = await fetch(`https://api-musicbox-m275.onrender.com/search?q=${encodeURIComponent(rawQuery)}&type=${type}`);
        let data = await response.json();
        
        loadingText.style.display = 'none';
        if (!data || data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado.</p>'; return; }

        const minYear = parseInt(document.getElementById('filter-year-min').value) || 0;
        const maxYear = parseInt(document.getElementById('filter-year-max').value) || 9999;
        
        if (minYear > 0 || maxYear < 9999) {
            data = data.filter(album => {
                const year = parseInt(album.year);
                return year >= minYear && year <= maxYear;
            });
        }

        if (data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado nesta faixa de anos.</p>'; return; }

        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { loadingText.style.display = 'none'; albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão falhou.</p>'; }
});
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
