import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userMenu = document.getElementById('user-menu');
const navPfp = document.getElementById('nav-pfp');
const modal = document.getElementById('profile-modal');
const publicModal = document.getElementById('public-profile-modal');
const artistModal = document.getElementById('artist-profile-modal'); 
const cropModal = document.getElementById('crop-modal');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const albumGrid = document.getElementById('album-grid');
const loadingText = document.getElementById('loading-text');
const renderToast = document.getElementById('render-toast');

let currentUser = null;
let allUsersData = [];
let currentAlbums = [];
let currentPage = 1;
const itemsPerPage = 12;
let isSearchMode = false;

const API_BASE_URL = 'https://api-musicbox-m275.onrender.com';

const toggleLightMode = document.getElementById('toggle-light-mode');
if(toggleLightMode) {
    toggleLightMode.checked = localStorage.getItem('echo_light_mode') === 'true';
    toggleLightMode.addEventListener('change', (e) => {
        localStorage.setItem('echo_light_mode', e.target.checked);
        // Avisa o HTML pra sumir só com o rádio, sem piscar a tela
        window.echoLightMode = e.target.checked;
    });
}

const getEmptyStateHTML = () => {
    return `
        <div style="text-align: center; width: 100%; padding: 30px 0; opacity: 0.6;">
            <i class="ph ph-vinyl-record" style="font-size: 3.5rem; margin-bottom: 10px; color: #aaa;"></i>
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #ccc;">Nenhuma obra na estante.</p>
            <button class="btn-ghost go-explore-btn" style="font-size: 0.8rem; border: 1px solid #444; padding: 6px 16px; border-radius: 20px; background: rgba(255,255,255,0.05);">Explorar Catálogo</button>
        </div>
    `;
};

const bindEmptyStateButton = (container) => {
    container.querySelectorAll('.go-explore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none'; publicModal.style.display = 'none';
            showSection('search-section');
        });
    });
};

const scrollObserver = new IntersectionObserver((entries) => {
    let delay = 0;
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            setTimeout(() => { entry.target.classList.add('scroll-animated'); }, delay);
            delay += 50; 
            scrollObserver.unobserve(entry.target); 
        }
    });
}, { threshold: 0.05, rootMargin: "0px 0px 150px 0px" });

document.querySelectorAll('.scroll-trigger').forEach(el => scrollObserver.observe(el));

// AQUI: OBSERVER DA TRACKLIST QUE ANIMA NA SUBIDA E DESCIDA
const trackObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('track-animated');
        } else {
            entry.target.classList.remove('track-animated');
        }
    });
}, { threshold: 0.1, rootMargin: "0px 0px -10px 0px" });

const sectionsMap = { '': 'home', '#home': 'home', '#explorar': 'search-section', '#rede': 'network-section', '#album': 'album-view-section' };

const showSection = (id, updateHash = true) => {
    const overlay = document.getElementById('page-transition');
    const sections = document.querySelectorAll('.section-page');
    const isHomeOrExplore = (id === 'home' || id === 'search-section');
    const isCurrentlyOnHomeOrExplore = (document.getElementById('home').style.display !== 'none');

    if (isHomeOrExplore && isCurrentlyOnHomeOrExplore) {
        if (id === 'search-section') { document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' }); } 
        else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        if(updateHash) { history.pushState(null, null, (id === 'home') ? '#home' : '#explorar'); }
        return;
    }

    overlay.style.display = 'flex'; void overlay.offsetWidth; overlay.style.opacity = '1';

    setTimeout(() => {
        sections.forEach(s => s.style.display = 'none');
        if (isHomeOrExplore) { 
            document.getElementById('home').style.display = 'block'; 
            document.getElementById('search-section').style.display = 'block';
            if (id === 'search-section') { setTimeout(() => document.getElementById('search-section').scrollIntoView({ behavior: 'instant' }), 50); } 
            else { window.scrollTo({ top: 0, behavior: 'instant' }); }
        } else {
            document.getElementById(id).style.display = 'block'; window.scrollTo({ top: 0, behavior: 'instant' });
        }
        if(updateHash) {
            const hash = Object.keys(sectionsMap).find(key => sectionsMap[key] === id) || '#home';
            history.pushState(null, null, hash);
        }
        overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }, 300);
};

// CONTROLE DO F5 (Recarrega na página do álbum se tiver)
window.addEventListener('load', () => { 
    const currentHash = window.location.hash; 
    if (currentHash === '#album') {
        const savedAlbum = sessionStorage.getItem('echo_current_album');
        if (savedAlbum) {
            loadAlbumView(JSON.parse(savedAlbum));
            return;
        } else {
            showSection('home', false);
            return;
        }
    }
    showSection(sectionsMap[currentHash] || 'home', false); 
});

window.addEventListener('hashchange', () => { 
    const hash = window.location.hash;
    if (hash === '#album') {
        const savedAlbum = sessionStorage.getItem('echo_current_album');
        if (savedAlbum) loadAlbumView(JSON.parse(savedAlbum));
        else showSection('home', false);
    } else {
        showSection(sectionsMap[hash] || 'home', false); 
    }
});

document.getElementById('link-home').addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
document.getElementById('link-explorar').addEventListener('click', (e) => { e.preventDefault(); showSection('search-section'); });
document.getElementById('back-to-explore').addEventListener('click', () => showSection('search-section'));

const minSlider = document.getElementById('filter-year-min');
const maxSlider = document.getElementById('filter-year-max');
const minValText = document.getElementById('year-min-val');
const maxValText = document.getElementById('year-max-val');
const sliderFill = document.getElementById('slider-fill');
const useYearFilter = document.getElementById('use-year-filter');
const sliderWrapper = document.getElementById('slider-wrapper');

function updateSlider() {
    let min = parseInt(minSlider.min); let max = parseInt(minSlider.max);
    let val1 = parseInt(minSlider.value); let val2 = parseInt(maxSlider.value);
    let percent1 = ((val1 - min) / (max - min)) * 100; let percent2 = ((val2 - min) / (max - min)) * 100;
    sliderFill.style.left = percent1 + "%"; sliderFill.style.width = (percent2 - percent1) + "%";
}

if(minSlider && maxSlider) {
    minSlider.addEventListener('input', () => { if (parseInt(minSlider.value) > parseInt(maxSlider.value) - 1) minSlider.value = parseInt(maxSlider.value) - 1; minValText.innerText = minSlider.value; updateSlider(); });
    maxSlider.addEventListener('input', () => { if (parseInt(maxSlider.value) < parseInt(minSlider.value) + 1) maxSlider.value = parseInt(minSlider.value) + 1; maxValText.innerText = maxSlider.value; updateSlider(); });
    updateSlider();

    useYearFilter.addEventListener('change', (e) => {
        if (e.target.checked) { sliderWrapper.style.opacity = '1'; sliderWrapper.style.pointerEvents = 'auto'; } 
        else { sliderWrapper.style.opacity = '0.3'; sliderWrapper.style.pointerEvents = 'none'; }
    });
}

let ytPlayer = null; 
let isPlayerReady = false; 
let currentTrackId = null; 
let progressInterval = null; 
let currentPlayBtnUI = null;
let currentAlbumData = null; 

const globalPlayer = document.getElementById('global-player');
const pPlayBtn = document.getElementById('player-play-btn');
const pTitle = document.getElementById('player-title');
const pArtist = document.getElementById('player-artist');
const pCover = document.getElementById('player-cover');
const pBarFill = document.getElementById('progress-bar-fill');
const pTimeCurr = document.getElementById('player-time-current');
const pTimeTot = document.getElementById('player-time-total');
const volSlider = document.getElementById('volume-slider');

pCover.style.cursor = 'pointer';
pCover.addEventListener('click', () => {
    if (currentAlbumData) {
        if(modal) modal.style.display = 'none';
        if(publicModal) publicModal.style.display = 'none';
        if(artistModal) artistModal.style.display = 'none';
        loadAlbumView(currentAlbumData);
    }
});

const loadArtistProfile = async (artistName, artistImage) => {
    artistModal.style.display = 'flex';
    document.getElementById('artist-profile-name').innerText = artistName;
    document.getElementById('artist-profile-image').src = artistImage;

    const albumsGrid = document.getElementById('artist-albums-grid');
    const singlesGrid = document.getElementById('artist-singles-grid');
    albumsGrid.innerHTML = '<p style="color:#aaa;">Buscando álbuns...</p>';
    singlesGrid.innerHTML = '<p style="color:#aaa;">Buscando singles...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(artistName)}&type=artist_works`);
        const data = await response.json();

        albumsGrid.innerHTML = '';
        singlesGrid.innerHTML = '';

        const albums = data.filter(d => d.type === 'album');
        const singles = data.filter(d => d.type === 'single' || d.type === 'ep');

        const renderCards = (list, container) => {
            if(list.length === 0) { container.innerHTML = '<p style="color:#666; font-size: 0.8rem;">Nada encontrado nesta categoria.</p>'; return; }
            list.forEach(item => {
                const div = document.createElement('div');
                div.className = 'rated-album-mini liquid-glass';
                div.style.flexShrink = '0';
                div.style.minWidth = '130px';
                div.style.padding = '10px';
                div.innerHTML = `
                    <img src="${item.image}" style="width: 100%; height: 110px; border-radius: 8px; object-fit: cover;">
                    <p style="font-size: 0.8rem; color: #fff; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="${item.name}">${item.name}</p>
                    <p style="font-size: 0.65rem; color: #aaa; text-transform:uppercase; letter-spacing:1px; margin-top: 2px;">${item.type === 'single' ? 'Single' : (item.type === 'ep' ? 'EP' : 'Álbum')}</p>
                `;
                div.addEventListener('click', () => { artistModal.style.display = 'none'; loadAlbumView(item); });
                container.appendChild(div);
            });
        };

        renderCards(albums, albumsGrid);
        renderCards(singles, singlesGrid);
    } catch (e) {
        albumsGrid.innerHTML = '<p style="color:red;">Erro ao carregar discografia.</p>';
        singlesGrid.innerHTML = '';
    }
};

document.getElementById('close-artist-modal').addEventListener('click', () => { artistModal.style.display = 'none'; });

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
    document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('yt-player', {
        height: '250', width: '250', videoId: 'M7lc1UVf-VE',
        playerVars: { 'autoplay': 1, 'mute': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'origin': window.location.origin, 'enablejsapi': 1 },
        events: {
            'onReady': () => { 
                isPlayerReady = true; 
                ytPlayer.unMute();
                if(volSlider) ytPlayer.setVolume(volSlider.value * 100); 
                ytPlayer.pauseVideo(); 
            },
            'onStateChange': onPlayerStateChange
        }
    });
};

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        pPlayBtn.classList.replace('ph-play-circle', 'ph-pause-circle');
        if (currentPlayBtnUI) { currentPlayBtnUI.classList.remove('ph-spinner'); currentPlayBtnUI.classList.add('ph-pause-circle'); }
        clearInterval(progressInterval); progressInterval = setInterval(updateProgressBar, 500);
    } else if (event.data === YT.PlayerState.PAUSED) {
        pPlayBtn.classList.replace('ph-pause-circle', 'ph-play-circle');
        if (currentPlayBtnUI) currentPlayBtnUI.classList.replace('ph-pause-circle', 'ph-play-circle');
        clearInterval(progressInterval);
    } else if (event.data === YT.PlayerState.ENDED) {
        pPlayBtn.classList.replace('ph-pause-circle', 'ph-play-circle');
        if (currentPlayBtnUI) currentPlayBtnUI.classList.replace('ph-pause-circle', 'ph-play-circle');
        clearInterval(progressInterval); pBarFill.style.width = '0%'; pTimeCurr.innerText = '0:00';
    }
}

function updateProgressBar() {
    if(!ytPlayer || !ytPlayer.getDuration) return;
    const duration = ytPlayer.getDuration(); const current = ytPlayer.getCurrentTime();
    if(duration > 0) {
        pBarFill.style.width = `${(current / duration) * 100}%`;
        let curMins = Math.floor(current / 60); let curSecs = Math.floor(current % 60);
        pTimeCurr.innerText = `${curMins}:${curSecs < 10 ? '0'+curSecs : curSecs}`;
        let durMins = Math.floor(duration / 60); let durSecs = Math.floor(duration % 60);
        pTimeTot.innerText = `${durMins}:${durSecs < 10 ? '0'+durSecs : durSecs}`;
    }
}

if(volSlider) volSlider.addEventListener('input', (e) => { if(isPlayerReady) ytPlayer.setVolume(e.target.value * 100); });
if(document.getElementById('progress-bar-bg')) {
    document.getElementById('progress-bar-bg').addEventListener('click', (e) => {
        if(!isPlayerReady || !currentTrackId) return;
        const rect = e.target.getBoundingClientRect(); ytPlayer.seekTo(ytPlayer.getDuration() * ((e.clientX - rect.left) / rect.width), true);
    });
}
if(pPlayBtn) {
    pPlayBtn.addEventListener('click', () => {
        if(isPlayerReady && currentTrackId) { if(ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); }
    });
}

const animateStars = (starArray, targetIndex) => {
    starArray.forEach((s) => { s.classList.remove('star-animate', 'star-explode'); s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); });
    for(let i = 0; i <= targetIndex; i++) {
        setTimeout(() => {
            const s = starArray[i]; s.style.color = '#fff'; s.classList.replace('ph', 'ph-fill');
            if (i === 4 && targetIndex === 4) s.classList.add('star-explode'); else s.classList.add('star-animate');
        }, i * 80); 
    }
};

const loadAlbumView = async (album) => {
    showSection('album-view-section', false);
    
    sessionStorage.setItem('echo_current_album', JSON.stringify(album));
    history.pushState(null, null, '#album');

    document.getElementById('album-view-cover').src = album.image;
    document.getElementById('album-view-title').innerText = album.name;
    document.getElementById('album-view-artist').innerText = album.artist;
    document.getElementById('album-view-extra-info').innerText = ''; 
    
    const mediaTypeText = document.getElementById('album-view-media-type');
    const originalType = album.type || 'album';
    if (originalType === 'single') mediaTypeText.innerText = 'Single'; else if (originalType === 'ep') mediaTypeText.innerText = 'EP'; else mediaTypeText.innerText = 'Álbum';

    const trackContainer = document.getElementById('tracklist-container');
    trackContainer.innerHTML = Array(5).fill('<div class="skeleton skel-row"></div>').join('');
    
    let warningText = document.getElementById('album-rating-warning');
    if (!warningText) {
        const starsContainer = document.getElementById('album-view-stars').parentElement;
        warningText = document.createElement('div'); warningText.id = 'album-rating-warning';
        warningText.style.cssText = 'margin-top: 15px; padding: 12px 15px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 10px; align-items: flex-start; max-width: 420px;';
        warningText.innerHTML = `
            <i class="ph ph-info" style="color: #aaa; font-size: 1.2rem; margin-top: 2px;"></i>
            <div>
                <p style="color:#fff; font-size:0.75rem; font-weight:600; margin-bottom: 4px;">Avaliação Rápida</p>
                <p style="color:#aaa; font-size:0.65rem; line-height: 1.4;">A nota dada aqui será distribuída para todas as faixas. Para curadoria precisa, avalie abaixo.</p>
            </div>`;
        starsContainer.parentElement.appendChild(warningText);
    }

    const favBtn = document.getElementById('btn-favorite-album');
    let isFav = false; let userFavorites = [];
    if(currentUser) {
        const uDoc = await getDoc(doc(db, "users", currentUser.uid));
        if(uDoc.exists() && uDoc.data().favorites) {
            userFavorites = uDoc.data().favorites;
            isFav = userFavorites.some(f => f.id === String(album.id));
        }
    }
    const favIcon = favBtn.querySelector('i');
    if(isFav) { favIcon.className = 'ph-fill ph-heart'; favIcon.style.color = '#1ed760'; } 
    else { favIcon.className = 'ph ph-heart'; favIcon.style.color = 'inherit'; }

    const newFavBtn = favBtn.cloneNode(true); favBtn.parentNode.replaceChild(newFavBtn, favBtn);
    newFavBtn.addEventListener('click', async () => {
        if(!currentUser) return alert('Faça login.');
        const uDoc = await getDoc(doc(db, "users", currentUser.uid));
        let currentFavs = uDoc.exists() && uDoc.data().favorites ? uDoc.data().favorites : [];
        const existingIndex = currentFavs.findIndex(f => f.id === String(album.id));
        
        if(existingIndex >= 0) {
            currentFavs.splice(existingIndex, 1);
            newFavBtn.querySelector('i').className = 'ph ph-heart'; newFavBtn.querySelector('i').style.color = 'inherit';
        } else {
            if(currentFavs.length >= 3) return alert('Você já possui 3 obras favoritas fixadas no perfil. Remova uma primeiro.');
            currentFavs.push({ id: String(album.id), name: album.name, artist: album.artist, image: album.image, type: originalType });
            newFavBtn.querySelector('i').className = 'ph-fill ph-heart'; newFavBtn.querySelector('i').style.color = '#1ed760';
        }
        await setDoc(doc(db, "users", currentUser.uid), { favorites: currentFavs }, { merge: true });
    });

    try {
        let url = `https://itunes.apple.com/lookup?id=${album.id}&entity=song&country=BR`;
        if (originalType === 'single' || !album.id || isNaN(album.id)) url = `https://itunes.apple.com/search?term=${encodeURIComponent(album.name + ' ' + album.artist)}&entity=song&limit=25&country=BR`;

        const res = await fetch(url); const data = await res.json();
        let tracks = data.results.filter(t => t.wrapperType === 'track');
        if (originalType === 'single' || isNaN(album.id)) tracks = tracks.filter(t => (t.collectionName && t.collectionName.includes(album.name)) || (t.trackName && t.trackName.includes(album.name)));

        let totalMs = 0; tracks.forEach(t => totalMs += (t.trackTimeMillis || 0));
        let min = Math.floor(totalMs / 60000); let sec = ((totalMs % 60000) / 1000).toFixed(0);
        if(sec == 60) { min++; sec = 0; }
        document.getElementById('album-view-extra-info').innerText = ` • ${album.year} • ${tracks.length} músicas, ${min}min ${sec}s`;

        let savedData = {};
        if(currentUser) {
            const docSnap = await getDoc(doc(db, "users", currentUser.uid, "ratings", String(album.id)));
            if(docSnap.exists()) {
                if (docSnap.data().tracks) savedData = docSnap.data().tracks;
                const overallRating = docSnap.data().rating || 0;
                Array.from(document.querySelectorAll('#album-view-stars i')).forEach((s, i) => {
                    if (i < overallRating) { s.style.color = '#fff'; s.classList.replace('ph', 'ph-fill'); } else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                });
            } else {
                Array.from(document.querySelectorAll('#album-view-stars i')).forEach(s => { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); });
            }
        }
        
        const albumStarsArray = Array.from(document.querySelectorAll('#album-view-stars i'));
        albumStarsArray.forEach((star, index) => {
            const newStar = star.cloneNode(true); star.parentNode.replaceChild(newStar, star);
            newStar.addEventListener('click', async () => {
                if(!currentUser) return alert('Faça login para avaliar.');
                const currentStarsNodes = Array.from(document.querySelectorAll('#album-view-stars i'));
                const isAlreadyRated = currentStarsNodes[index].classList.contains('ph-fill') && (index === 4 || !currentStarsNodes[index+1]?.classList.contains('ph-fill'));
                const finalRating = isAlreadyRated ? 0 : index + 1;
                animateStars(currentStarsNodes, finalRating - 1);
                
                tracks.forEach(track => {
                    const tId = String(track.trackId); savedData[tId] = savedData[tId] || { comment: '' }; savedData[tId].rating = finalRating;
                    const trackStarsContainer = document.querySelector(`.track-stars[data-track="${tId}"]`);
                    if(trackStarsContainer) animateStars(Array.from(trackStarsContainer.querySelectorAll('i')), finalRating - 1);
                });

                const docRef = doc(db, "users", currentUser.uid, "ratings", String(album.id));
                if(finalRating === 0) await deleteDoc(docRef);
                else await setDoc(docRef, { id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: finalRating, timestamp: new Date(), type: originalType, tracks: savedData }, { merge: true });
            });
        });
        
        trackContainer.innerHTML = '';
        if(tracks.length === 0) { trackContainer.innerHTML = '<p style="color:#aaa;">Nenhuma faixa individual encontrada para este registro.</p>'; return; }

        tracks.forEach((track, index) => {
            const tId = String(track.trackId); const myTrackData = savedData[tId] || { rating: 0, comment: '' };
            const div = document.createElement('div'); div.className = 'track-row liquid-glass track-trigger'; 
            div.innerHTML = `
                <div class="track-info">
                    <span style="color:#666; font-size:0.8rem; width:15px;">${index + 1}</span><i class="ph ph-play-circle play-btn"></i>
                    <div class="track-info-text"><div class="t-name">${track.trackName}</div><div style="color:#888; font-size:0.7rem;">${album.artist}</div></div>
                </div>
                <div class="track-actions">
                    <div class="stars track-stars" data-track="${tId}">${[1,2,3,4,5].map(n => `<i class="${n <= myTrackData.rating ? 'ph-fill' : 'ph'} ph-star" style="color: ${n <= myTrackData.rating ? '#fff' : '#444'}"></i>`).join('')}</div>
                    <textarea class="track-comment custom-scroll" placeholder="Suas notas (máx 150 letras)..." data-track="${tId}" maxlength="150">${myTrackData.comment}</textarea>
                </div>`;
            trackContainer.appendChild(div); trackObserver.observe(div); 

            const playBtn = div.querySelector('.play-btn');
            playBtn.addEventListener('click', async () => {
                if(!isPlayerReady) return alert("O reprodutor está iniciando, aguarde um momento.");
                globalPlayer.style.display = 'flex';
                currentAlbumData = album; 

                if (currentTrackId === tId) { if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); } 
                else {
                    if (currentPlayBtnUI) { currentPlayBtnUI.classList.remove('ph-spinner', 'ph-pause-circle'); currentPlayBtnUI.classList.add('ph-play-circle'); }
                    currentPlayBtnUI = playBtn; playBtn.classList.replace('ph-play-circle', 'ph-spinner'); playBtn.classList.remove('ph-pause-circle');
                    try {
                        const ytRes = await fetch(`${API_BASE_URL}/yt-search?track=${encodeURIComponent(track.trackName)}&artist=${encodeURIComponent(album.artist)}`);
                        const ytData = await ytRes.json();
                        if(ytData.videoId) { currentTrackId = tId; ytPlayer.loadVideoById(ytData.videoId); pTitle.innerText = track.trackName; pArtist.innerText = album.artist; pCover.src = album.image; } 
                        else { alert("Faixa não encontrada no YouTube Music."); playBtn.classList.replace('ph-spinner', 'ph-play-circle'); }
                    } catch(e) { alert("Erro ao conectar com o servidor musical."); playBtn.classList.replace('ph-spinner', 'ph-play-circle'); }
                }
            });

            const stars = Array.from(div.querySelectorAll('.track-stars i'));
            stars.forEach((star, sIndex) => {
                star.addEventListener('click', async () => {
                    if(!currentUser) return alert('Faça login.');
                    const isAlreadyRated = stars[sIndex].classList.contains('ph-fill') && (sIndex === 4 || !stars[sIndex+1]?.classList.contains('ph-fill'));
                    const finalRating = isAlreadyRated ? 0 : sIndex + 1;
                    animateStars(stars, finalRating - 1);

                    savedData[tId] = savedData[tId] || { comment: '' }; savedData[tId].rating = finalRating;

                    let sum = 0; let count = 0;
                    Object.values(savedData).forEach(t => { if (t.rating && t.rating > 0) { sum += t.rating; count++; } });
                    const avgRating = count > 0 ? Math.round(sum / count) : 0;
                    animateStars(Array.from(document.querySelectorAll('#album-view-stars i')), avgRating - 1);

                    const docRef = doc(db, "users", currentUser.uid, "ratings", String(album.id));
                    if (avgRating === 0 && count === 0) await deleteDoc(docRef);
                    else await setDoc(docRef, { id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: avgRating, timestamp: new Date(), type: originalType, tracks: savedData }, { merge: true });
                });
            });

            let timeout = null;
            div.querySelector('.track-comment').addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    if(!currentUser) return;
                    savedData[tId] = savedData[tId] || { rating: 0 }; savedData[tId].comment = e.target.value;
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", String(album.id)), { id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', timestamp: new Date(), type: originalType, tracks: savedData }, { merge: true });
                }, 1000);
            });
        });
    } catch(e) { trackContainer.innerHTML = '<p style="color:red;">Erro de conexão com o catálogo musical.</p>'; }
};

const renderHomeTrending = (data) => {
    const homeGrid = document.getElementById('home-trending-grid');
    if(!homeGrid) return;
    homeGrid.innerHTML = '';
    
    data.slice(0, 12).forEach((album, i) => {
        const div = document.createElement('div');
        div.className = 'rated-album-mini liquid-glass';
        div.style.minWidth = '140px'; div.style.padding = '10px'; div.style.borderRadius = '10px';
        div.style.animationDelay = `${i * 0.05}s`;
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <img src="${album.image}" style="width: 100%; height: 120px; border-radius: 6px; object-fit: cover; margin-bottom: 8px;">
            <p style="font-size: 0.85rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;" title="${album.name}">${album.name}</p>
            <p style="font-size: 0.7rem; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${album.artist}</p>
        `;
        div.addEventListener('click', () => loadAlbumView(album));
        homeGrid.appendChild(div);
    });
};

const getGridSkeletons = () => Array(8).fill('<div class="skeleton skel-card"></div>').join('');

const loadTrending = async () => {
    isSearchMode = false;
    loadingText.style.display = 'none'; 
    document.getElementById('top-result-wrapper').style.display = 'none';
    document.getElementById('pagination-controls').style.display = 'none';

    const cachedTrending = localStorage.getItem('echo_trending_cache');
    if (cachedTrending) {
        try {
            const data = JSON.parse(cachedTrending);
            if (Array.isArray(data) && data.length > 0 && !data.error) {
                currentAlbums = data;
                currentPage = 1;
                renderPage();
                renderHomeTrending(data);
            } else {
                localStorage.removeItem('echo_trending_cache');
                albumGrid.innerHTML = getGridSkeletons();
            }
        } catch(e) {
            console.error("Erro ao ler cache", e);
            localStorage.removeItem('echo_trending_cache');
            albumGrid.innerHTML = getGridSkeletons();
        }
    } else {
        albumGrid.innerHTML = getGridSkeletons();
    }

    let timeoutAlert = setTimeout(() => {
        if(renderToast && !cachedTrending) renderToast.classList.add('show');
    }, 3000);

    try {
        const response = await fetch(`${API_BASE_URL}/trending`);
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');

        const data = await response.json();

        if (!data || data.error || !Array.isArray(data) || data.length === 0) {
            if(!cachedTrending) albumGrid.innerHTML = '<p style="text-align:center; color:#666;">Nenhum lançamento encontrado.</p>';
            return;
        }

        localStorage.setItem('echo_trending_cache', JSON.stringify(data));

        currentAlbums = data;
        currentPage = 1;
        renderPage();
        renderHomeTrending(data);

    } catch (error) {
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');
        if(!cachedTrending) {
            albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333;">Conexão falhou.</p>';
        }
    }
};

const performSearch = async () => {
    let rawQuery = searchInput.value.trim();
    if (!rawQuery) { loadTrending(); return; }

    isSearchMode = true;
    loadingText.style.display = 'none'; 
    albumGrid.innerHTML = getGridSkeletons(); 
    document.getElementById('top-result-wrapper').style.display = 'none';
    document.getElementById('pagination-controls').style.display = 'none';
    let timeoutAlert = setTimeout(() => { if(renderToast) renderToast.classList.add('show'); }, 3000);

    try {
        const selectedType = document.querySelector('input[name="search-type"]:checked').value;
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(rawQuery)}&type=${selectedType}`);
        clearTimeout(timeoutAlert); if(renderToast) renderToast.classList.remove('show');

        if (!response.ok) throw new Error('A API devolveu um erro.');
        let data = await response.json(); 
        
        if (data.error || !data || data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado.</p>'; return; }

        if (document.getElementById('use-year-filter').checked) {
            const minYear = parseInt(minSlider.value) || 0; const maxYear = parseInt(maxSlider.value) || 9999;
            data = data.filter(album => { const year = parseInt(album.year); return isNaN(year) ? true : (year >= minYear && year <= maxYear); });
        }

        if (data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado nesta faixa de anos.</p>'; return; }
        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { 
        clearTimeout(timeoutAlert); if(renderToast) renderToast.classList.remove('show');
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão falhou. Tente novamente.</p>'; 
    }
};

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
document.querySelectorAll('input[name="search-type"]').forEach(radio => { radio.addEventListener('change', performSearch); });
minSlider.addEventListener('change', performSearch); maxSlider.addEventListener('change', performSearch); useYearFilter.addEventListener('change', performSearch);

const loadFriendsFeed = async () => {
    if(!currentUser) return;
    const feed = document.getElementById('friends-feed');
    feed.innerHTML = '<p class="pulse-text">Buscando rastros...</p>';

    try {
        const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
        if(friendsSnap.empty) { feed.innerHTML = '<p style="color:#aaa;">Você não segue ninguém.</p>'; return; }

        let allActivities = [];
        for(const friendDoc of friendsSnap.docs) {
            const friendId = friendDoc.id; const friendProf = await getDoc(doc(db, "users", friendId)); const pData = friendProf.data() || {};
            const ratingsSnap = await getDocs(collection(db, "users", friendId, "ratings"));
            ratingsSnap.forEach(rDoc => {
                const rData = rDoc.data();
                if(rData.timestamp) allActivities.push({ friendName: pData.name || 'Anônimo', friendPfp: pData.photoURL || 'https://placehold.co/40x40/1a1a1a/888888?text=U', timeMs: rData.timestamp.toMillis ? rData.timestamp.toMillis() : 0, ...rData });
            });
        }

        allActivities.sort((a,b) => b.timeMs - a.timeMs);
        const recentActs = allActivities.slice(0, 15);

        if(recentActs.length === 0) { feed.innerHTML = '<p style="color:#aaa;">Sem avaliações recentes.</p>'; return; }

        feed.innerHTML = '';
        recentActs.forEach(act => {
            const overallRating = act.rating || 0;
            const originalType = act.type || 'album';
            let typeLabel = 'Álbum'; if (originalType === 'single') typeLabel = 'Single'; else if (originalType === 'ep') typeLabel = 'EP';

            let highlightComment = '';
            if(act.tracks) {
                const tracksWithComments = Object.values(act.tracks).filter(t => t.comment && t.comment.trim() !== '');
                if(tracksWithComments.length > 0) highlightComment = tracksWithComments[0].comment;
            }

            const div = document.createElement('div');
            div.className = 'feed-item liquid-glass scroll-trigger'; 
            div.style.marginBottom = '15px'; div.style.borderRadius = '12px';
            div.style.maxWidth = '800px'; 
            
            div.innerHTML = `
                <div class="pfp-container-mini" style="flex-shrink: 0;"><img src="${act.friendPfp}"></div>
                <div style="flex:1; min-width: 0; display: flex; flex-direction: column;">
                    <p style="font-size:0.75rem; color:#888; margin-bottom:10px;"><b>${act.friendName}</b> avaliou um ${typeLabel}:</p>
                    
                    <div style="display: flex; gap: 15px; align-items: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); width: 100%;">
                        <img src="${act.image}" class="cover" data-id="open-album" title="Abrir Álbum" style="width: 70px !important; height: 70px !important; border-radius: 6px; cursor: pointer; flex-shrink: 0; object-fit: cover; margin: 0;">
                        
                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                            <h4 style="color:#fff; margin: 0 0 5px 0; cursor:pointer; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="feed-title">${act.name} <span style="color:#aaa; font-weight:normal; font-size:0.8rem;">- ${act.artist}</span></h4>
                            <p style="color:#fff; font-size:1.1rem; text-shadow: 0 0 10px rgba(255,255,255,0.3); margin: 0 0 ${highlightComment ? '8px' : '0'} 0;">${'★'.repeat(overallRating)}${'<span style="color:#444; text-shadow:none;">' + '☆'.repeat(5 - overallRating) + '</span>'}</p>
                            ${highlightComment ? `<p style="color:#ddd; font-size:0.85rem; font-style: italic; line-height: 1.4; border-left: 2px solid #555; padding-left: 10px; margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">"${highlightComment}"</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
            div.querySelector('.cover').addEventListener('click', () => loadAlbumView(act));
            div.querySelector('.feed-title').addEventListener('click', () => loadAlbumView(act));
            feed.appendChild(div); scrollObserver.observe(div); 
        });
    } catch(e) { feed.innerHTML = '<p style="color:red;">Erro ao puxar o feed.</p>'; }
};

const renderUsers = (usersList) => {
    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '';
    if (usersList.length === 0) { usersGrid.innerHTML = '<p style="color:#aaa;">Nenhum usuário encontrado.</p>'; return; }

    usersList.forEach(userObj => {
        const data = userObj.data; const uid = userObj.id;
        const userCard = document.createElement('div'); userCard.className = 'user-card liquid-glass scroll-trigger'; 
        userCard.innerHTML = `
            <div class="user-info-click" style="display:flex; align-items:center; gap:10px; flex: 1; min-width: 0;">
                <div class="pfp-container-mini" style="flex-shrink: 0;"><img src="${data.photoURL || 'https://placehold.co/50x50/1a1a1a/888888?text=U'}"></div>
                <div style="overflow: hidden; flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                    <h4 class="glow-text" style="color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 0 3px 0;">${data.name || 'Anônimo'}</h4>
                    <p style="font-size:0.7rem; color:#aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${data.bio ? data.bio : 'Sem biografia'}</p>
                </div>
            </div>
            <button class="btn-follow" data-id="${uid}" style="flex-shrink: 0; padding: 6px 16px; margin: 0;">Seguir</button>
        `;
        usersGrid.appendChild(userCard); scrollObserver.observe(userCard); 
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
    const usersGrid = document.getElementById('users-grid'); usersGrid.innerHTML = '<p class="pulse-text">Buscando usuários...</p>';
    try {
        const usersSnap = await getDocs(collection(db, "users")); allUsersData = [];
        usersSnap.forEach(docSnap => { if(currentUser && docSnap.id === currentUser.uid) return; allUsersData.push({ id: docSnap.id, data: docSnap.data() }); });
        if (allUsersData.length === 0) usersGrid.innerHTML = '<p style="color:#aaa;">Você é o único usuário no momento.</p>'; else renderUsers(allUsersData);
    } catch (err) { usersGrid.innerHTML = '<p style="color:#ff3333;">Falha ao acessar dados.</p>'; }
});

if(document.getElementById('user-search-input')) {
    document.getElementById('user-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderUsers(allUsersData.filter(u => (u.data.name || "").toLowerCase().includes(term)));
    });
}

const renderFavorites = (favoritesArray, containerId) => {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    
    for(let i=0; i<3; i++) {
        const slot = document.createElement('div');
        slot.className = 'fav-slot liquid-glass';
        if(favoritesArray && favoritesArray[i]) {
            slot.innerHTML = `<img src="${favoritesArray[i].image}" title="${favoritesArray[i].name}">`;
            slot.style.cursor = 'pointer';
            slot.addEventListener('click', () => { modal.style.display='none'; publicModal.style.display='none'; loadAlbumView(favoritesArray[i]); });
        } else {
            slot.innerHTML = `<i class="ph ph-plus" style="font-size: 1.5rem; opacity: 0.3;"></i>`;
        }
        container.appendChild(slot);
    }
};

const openPublicProfile = async (uid, userData) => {
    publicModal.style.display = 'flex';
    document.getElementById('public-name').innerText = userData.name || 'Anônimo';
    document.getElementById('public-pfp').src = userData.photoURL || 'https://placehold.co/80x80/1a1a1a/888888?text=U';
    document.getElementById('public-bio').innerText = userData.bio || 'Este usuário não possui biografia.';
    
    renderFavorites(userData.favorites || [], 'public-favorite-albums');

    const container = document.getElementById('public-rated-albums');
    container.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Buscando obras...</p>';
    try {
        const snap = await getDocs(collection(db, "users", uid, "ratings"));
        if (snap.empty) { container.innerHTML = getEmptyStateHTML(); bindEmptyStateButton(container); return; }
        container.innerHTML = ''; let animDelay = 0;
        
        let groupedAlbums = {};
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if(!groupedAlbums[data.image]) {
                groupedAlbums[data.image] = data;
            } else {
                groupedAlbums[data.image].type = 'album';
            }
        });

        Object.values(groupedAlbums).forEach((data) => {
            const originalType = data.type || 'album';
            let typeLabel = 'Álbum'; if (originalType === 'single') typeLabel = 'Single'; else if (originalType === 'ep') typeLabel = 'EP';

            const div = document.createElement('div'); div.className = 'rated-album-mini'; div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}" style="width: 110px; height: 110px; border-radius: 8px; object-fit: cover; border: 1px solid #333; transition: border-color 0.2s;">
                <p style="font-size: 0.75rem; color: #fff; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.6rem; color: #aaa; text-transform:uppercase; letter-spacing:1px; margin-top: 2px;">${typeLabel}</p>
                <p style="font-size: 1rem; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); white-space: nowrap; margin-top: 5px;">${'★'.repeat(data.rating || 0)}${'<span style="color:#444; text-shadow:none;">' + '☆'.repeat(5 - (data.rating || 0)) + '</span>'}</p>
            `;
            div.addEventListener('click', () => { publicModal.style.display = 'none'; loadAlbumView(data); });
            container.appendChild(div); animDelay += 0.08; 
        });
    } catch (error) { container.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao carregar obras.</p>'; }
};
document.getElementById('close-public-modal').addEventListener('click', () => publicModal.style.display = 'none');

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

navPfp.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const ratedContainer = document.getElementById('user-rated-albums');
    if (!currentUser) return;
    
    const uDoc = await getDoc(doc(db, "users", currentUser.uid));
    renderFavorites(uDoc.exists() && uDoc.data().favorites ? uDoc.data().favorites : [], 'user-favorite-albums');

    ratedContainer.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Acessando dados da conta...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "ratings"));
        if (querySnapshot.empty) { ratedContainer.innerHTML = getEmptyStateHTML(); bindEmptyStateButton(ratedContainer); return; }
        ratedContainer.innerHTML = ''; let animDelay = 0; 
        
        let groupedAlbums = {};
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if(!groupedAlbums[data.image]) {
                groupedAlbums[data.image] = data;
            } else {
                groupedAlbums[data.image].type = 'album';
            }
        });

        Object.values(groupedAlbums).forEach((data) => {
            const originalType = data.type || 'album';
            let typeLabel = 'Álbum'; if (originalType === 'single') typeLabel = 'Single'; else if (originalType === 'ep') typeLabel = 'EP';

            const div = document.createElement('div'); div.className = 'rated-album-mini'; div.style.animationDelay = `${animDelay}s`;
            div.innerHTML = `
                <img src="${data.image}" style="width: 110px; height: 110px; border-radius: 8px; object-fit: cover; border: 1px solid #333; transition: border-color 0.2s;">
                <p style="font-size: 0.75rem; color: #fff; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="${data.name}">${data.name}</p>
                <p style="font-size: 0.6rem; color: #aaa; text-transform:uppercase; letter-spacing:1px; margin-top: 2px;">${typeLabel}</p>
                <p style="font-size: 1rem; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); white-space: nowrap; margin-top: 5px;">${'★'.repeat(data.rating || 0)}${'<span style="color:#444; text-shadow:none;">' + '☆'.repeat(5 - (data.rating || 0)) + '</span>'}</p>
            `;
            div.addEventListener('click', () => { modal.style.display = 'none'; loadAlbumView(data); });
            ratedContainer.appendChild(div); animDelay += 0.08; 
        });
    } catch (error) { ratedContainer.innerHTML = '<p style="color: #ff3333; font-size: 0.8rem;">Erro ao ler os dados.</p>'; }
});

document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');

let cropper;
document.getElementById('edit-pfp-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('crop-image').src = event.target.result;
            cropModal.style.display = 'flex';
            if (cropper) cropper.destroy();
            cropper = new Cropper(document.getElementById('crop-image'), { aspectRatio: 1, viewMode: 1, background: false });
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; 
});

document.getElementById('close-crop-modal').addEventListener('click', () => { cropModal.style.display = 'none'; if (cropper) cropper.destroy(); });

document.getElementById('save-crop-btn').addEventListener('click', () => {
    if (cropper) {
        const canvas = cropper.getCroppedCanvas({ width: 250, height: 250 });
        document.getElementById('modal-pfp').src = canvas.toDataURL('image/jpeg');
        cropModal.style.display = 'none'; cropper.destroy();
    }
});

document.getElementById('save-profile').addEventListener('click', async () => {
    if (!currentUser) return alert("Faça login primeiro.");
    const btn = document.getElementById('save-profile');
    btn.innerText = "Salvando na Nuvem...";
    try {
        let pfpSrc = document.getElementById('modal-pfp').src;
        if (pfpSrc.startsWith('data:image')) {
            const storageRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}.jpg`);
            await uploadString(storageRef, pfpSrc, 'data_url');
            pfpSrc = await getDownloadURL(storageRef);
            document.getElementById('modal-pfp').src = pfpSrc;
        }

        await setDoc(doc(db, "users", currentUser.uid), { 
            name: document.getElementById('edit-name').value, 
            bio: document.getElementById('edit-bio').value, 
            photoURL: pfpSrc 
        }, { merge: true });
        
        navPfp.src = pfpSrc; 
        btn.innerText = "Salvar Modificações"; 
        modal.style.display = 'none';
    } catch (error) { 
        console.error("Erro no Storage:", error);
        alert("Falha na gravação."); 
        btn.innerText = "Salvar Modificações"; 
    }
});

const renderPage = () => {
    const topResultWrapper = document.getElementById('top-result-wrapper');
    const topResultContainer = document.getElementById('top-result-container');
    
    albumGrid.innerHTML = '';
    topResultContainer.innerHTML = '';
    topResultWrapper.style.display = 'none';

    let itemsToRender = currentAlbums;

    if (isSearchMode && currentPage === 1 && currentAlbums.length > 0) {
        topResultWrapper.style.display = 'block';
        const topAlbum = currentAlbums[0];
        itemsToRender = currentAlbums.slice(1);
        
        const originalType = topAlbum.type || 'album';
        let typeLabel = 'Álbum'; 
        if (originalType === 'single') typeLabel = 'Single'; 
        else if (originalType === 'ep') typeLabel = 'EP';
        else if (originalType === 'artist') typeLabel = 'Artista';

        const topCard = document.createElement('div');
        topCard.className = 'top-result-card liquid-glass scroll-trigger';
        
        if (originalType === 'artist') {
            topCard.innerHTML = `
                <img src="${topAlbum.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Artista'}" alt="Capa" style="border-radius: 50%;">
                <div class="top-result-info">
                    <h2 class="glow-text" style="font-size: 2rem; margin-bottom: 5px; line-height: 1.1;">${topAlbum.name}</h2>
                    <div style="color: #aaa; font-size: 1rem; margin-bottom: 15px;">Perfil do Artista</div>
                    <div class="rating-ui" style="border: none; justify-content: flex-start; gap: 20px; padding: 0;">
                        <span style="font-size: 0.7rem; color: #888; text-transform:uppercase; letter-spacing:1px; border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 10px;">${typeLabel}</span>
                    </div>
                </div>
            `;
            topCard.addEventListener('click', () => loadArtistProfile(topAlbum.name, topAlbum.image));
        } else {
            topCard.innerHTML = `
                <img src="${topAlbum.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa'}" alt="Capa">
                <div class="top-result-info">
                    <h2 class="glow-text" style="font-size: 2rem; margin-bottom: 5px; line-height: 1.1;">${topAlbum.name}</h2>
                    <div style="color: #aaa; font-size: 1rem; margin-bottom: 15px;">${topAlbum.artist}</div>
                    <div class="rating-ui" style="border: none; justify-content: flex-start; gap: 20px; padding: 0;">
                        <span style="font-size: 0.7rem; color: #888; text-transform:uppercase; letter-spacing:1px; border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 10px;">${typeLabel}</span>
                        <div class="stars card-stars">
                            <i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i>
                        </div>
                    </div>
                </div>
            `;
            topCard.addEventListener('click', (e) => {
                if(!e.target.closest('.card-stars')) loadAlbumView(topAlbum);
            });
            const stars = Array.from(topCard.querySelectorAll('.card-stars i'));
            stars.forEach((star, index) => {
                star.addEventListener('click', async (e) => {
                    e.stopPropagation(); 
                    if(!currentUser) return alert('Faça login para avaliar esta obra.'); 
                    animateStars(stars, index); 
                    const rating = index + 1;
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", String(topAlbum.id)), {
                        id: String(topAlbum.id), name: topAlbum.name, artist: topAlbum.artist, image: topAlbum.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: rating, timestamp: new Date(), type: originalType
                    }, { merge: true });
                });
            });
        }
        
        topResultContainer.appendChild(topCard);
        scrollObserver.observe(topCard);
    }

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = itemsToRender.slice(start, start + itemsPerPage);

    if (itemsToRender.length > itemsPerPage) {
        document.getElementById('pagination-controls').style.display = 'flex';
        document.getElementById('page-info').innerText = `Página ${currentPage} de ${Math.ceil(itemsToRender.length / itemsPerPage)}`;
        document.getElementById('prev-page').style.visibility = currentPage === 1 ? 'hidden' : 'visible';
        document.getElementById('next-page').style.visibility = (start + itemsPerPage) >= itemsToRender.length ? 'hidden' : 'visible';
    } else { document.getElementById('pagination-controls').style.display = 'none'; }

    pageData.forEach(album => {
        const card = document.createElement('div'); card.className = 'album-card liquid-glass scroll-trigger'; card.style.cursor = 'pointer'; 
        const originalType = album.type || 'album';
        let typeLabel = 'Álbum'; 
        if (originalType === 'single') typeLabel = 'Single'; 
        else if (originalType === 'ep') typeLabel = 'EP';
        else if (originalType === 'artist') typeLabel = 'Artista';

        if (originalType === 'artist') {
            card.innerHTML = `
                <img src="${album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Artista'}" alt="Capa" class="capa-click" style="border-radius: 50%; width: 140px; height: 140px; object-fit: cover; margin: 0 auto 15px auto; display: block;">
                <div class="album-title glow-text capa-click" style="text-align: center;">${album.name}</div>
                <div style="text-align: center; color: #aaa; font-size: 0.8rem; margin-bottom: 10px;">Perfil do Artista</div>
                <div style="text-align: center;">
                    <span style="font-size: 0.6rem; color: #888; text-transform:uppercase; letter-spacing:1px; border: 1px solid rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">${typeLabel}</span>
                </div>
            `;
            albumGrid.appendChild(card); scrollObserver.observe(card);
            card.addEventListener('click', () => loadArtistProfile(album.name, album.image));
        } else {
            card.innerHTML = `
                <img src="${album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa'}" alt="Capa" class="capa-click">
                <div class="album-title glow-text capa-click">${album.name}</div>
                <div class="album-artist">${album.artist}</div>
                <div class="rating-ui">
                    <span style="font-size: 0.6rem; color: #888; text-transform:uppercase; letter-spacing:1px; border: 1px solid rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">${typeLabel}</span>
                    <div class="stars card-stars"><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i></div>
                </div>`;
            albumGrid.appendChild(card); scrollObserver.observe(card);

            card.addEventListener('click', (e) => {
                if(!e.target.closest('.card-stars')) loadAlbumView(album);
            });

            const stars = Array.from(card.querySelectorAll('.card-stars i'));
            stars.forEach((star, index) => {
                star.addEventListener('click', async (e) => {
                    e.stopPropagation(); 
                    if(!currentUser) return alert('Faça login para avaliar esta obra.'); 
                    animateStars(stars, index); 
                    const rating = index + 1;
                    await setDoc(doc(db, "users", currentUser.uid, "ratings", String(album.id)), { id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: rating, timestamp: new Date(), type: originalType }, { merge: true });
                });
            });
        }
    });
};

document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' }); } });
document.getElementById('next-page').addEventListener('click', () => { if ((currentPage * itemsPerPage) < currentAlbums.length) { currentPage++; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' }); } });

window.addEventListener('DOMContentLoaded', () => { if (currentAlbums.length === 0) { loadTrending(); } });
