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

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userMenu = document.getElementById('user-menu');
const navPfp = document.getElementById('nav-pfp');
const modal = document.getElementById('profile-modal');
const publicModal = document.getElementById('public-profile-modal');
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

const API_BASE_URL = 'https://api-musicbox-m275.onrender.com';

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

// --- LÓGICA DE ROTAS E SCROLL SMOOTH BLINDADA ---
const sectionsMap = {
    '': 'home',
    '#home': 'home',
    '#explorar': 'search-section',
    '#rede': 'network-section'
};

const showSection = (id, updateHash = true) => {
    const overlay = document.getElementById('page-transition');
    const sections = document.querySelectorAll('.section-page');
    
    const isHomeOrExplore = (id === 'home' || id === 'search-section');
    const isCurrentlyOnHomeOrExplore = (document.getElementById('home').style.display !== 'none');

    // Navegação suave se estiver transitando apenas entre Home e Explorar
    if (isHomeOrExplore && isCurrentlyOnHomeOrExplore) {
        if (id === 'search-section') {
            document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if(updateHash) {
            const hash = (id === 'home') ? '#home' : '#explorar';
            history.pushState(null, null, hash); // Muda a URL sem quebrar a tela
        }
        return;
    }

    // Transição com tela preta para outras seções
    overlay.style.display = 'flex'; void overlay.offsetWidth; overlay.style.opacity = '1';

    setTimeout(() => {
        sections.forEach(s => s.style.display = 'none');
        
        if (isHomeOrExplore) { 
            document.getElementById('home').style.display = 'block'; 
            document.getElementById('search-section').style.display = 'block';
            if (id === 'search-section') {
                setTimeout(() => document.getElementById('search-section').scrollIntoView({ behavior: 'instant' }), 50);
            } else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        } else {
            document.getElementById(id).style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        if(updateHash) {
            const hash = Object.keys(sectionsMap).find(key => sectionsMap[key] === id) || '#home';
            history.pushState(null, null, hash);
        }

        overlay.style.opacity = '0'; 
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }, 300);
};

window.addEventListener('load', () => {
    const currentHash = window.location.hash;
    const sectionId = sectionsMap[currentHash] || 'home';
    showSection(sectionId, false);
});

// Só dispara pelo "Voltar/Avançar" do navegador
window.addEventListener('hashchange', () => {
    const sectionId = sectionsMap[window.location.hash] || 'home';
    showSection(sectionId, false);
});

// Botões da NAV
document.getElementById('link-home').addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
document.getElementById('link-explorar').addEventListener('click', (e) => { e.preventDefault(); showSection('search-section'); });
document.getElementById('back-to-explore').addEventListener('click', () => showSection('search-section'));

// --- FILTROS E SLIDERS ---
const minSlider = document.getElementById('filter-year-min');
const maxSlider = document.getElementById('filter-year-max');
const minValText = document.getElementById('year-min-val');
const maxValText = document.getElementById('year-max-val');
const sliderFill = document.getElementById('slider-fill');
const useYearFilter = document.getElementById('use-year-filter');
const sliderWrapper = document.getElementById('slider-wrapper');

function updateSlider() {
    let min = parseInt(minSlider.min);
    let max = parseInt(minSlider.max);
    let val1 = parseInt(minSlider.value);
    let val2 = parseInt(maxSlider.value);
    let percent1 = ((val1 - min) / (max - min)) * 100;
    let percent2 = ((val2 - min) / (max - min)) * 100;
    sliderFill.style.left = percent1 + "%";
    sliderFill.style.width = (percent2 - percent1) + "%";
}

if(minSlider && maxSlider) {
    minSlider.addEventListener('input', () => {
        if (parseInt(minSlider.value) > parseInt(maxSlider.value) - 1) minSlider.value = parseInt(maxSlider.value) - 1;
        minValText.innerText = minSlider.value; updateSlider();
    });

    maxSlider.addEventListener('input', () => {
        if (parseInt(maxSlider.value) < parseInt(minSlider.value) + 1) maxSlider.value = parseInt(minSlider.value) + 1;
        maxValText.innerText = maxSlider.value; updateSlider();
    });
    updateSlider();

    useYearFilter.addEventListener('change', (e) => {
        if (e.target.checked) {
            sliderWrapper.style.opacity = '1'; sliderWrapper.style.pointerEvents = 'auto';
        } else {
            sliderWrapper.style.opacity = '0.3'; sliderWrapper.style.pointerEvents = 'none';
        }
    });
}

// --- PLAYER DE MÚSICA YOUTUBE ---
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
        height: '1', width: '1', videoId: 'M7lc1UVf-VE',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'fs': 0, 'origin': window.location.origin },
        events: {
            'onReady': () => { isPlayerReady = true; if(volSlider) ytPlayer.setVolume(volSlider.value * 100); ytPlayer.pauseVideo(); },
            'onStateChange': onPlayerStateChange
        }
    });
};

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        pPlayBtn.classList.replace('ph-play-circle', 'ph-pause-circle');
        if (currentPlayBtnUI) { currentPlayBtnUI.classList.remove('ph-spinner'); currentPlayBtnUI.classList.add('ph-pause-circle'); }
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
        pBarFill.style.width = '0%'; pTimeCurr.innerText = '0:00';
    }
}

function updateProgressBar() {
    if(!ytPlayer || !ytPlayer.getDuration) return;
    const duration = ytPlayer.getDuration();
    const current = ytPlayer.getCurrentTime();
    if(duration > 0) {
        const progress = (current / duration) * 100;
        pBarFill.style.width = `${progress}%`;
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
        const rect = e.target.getBoundingClientRect(); const percent = (e.clientX - rect.left) / rect.width;
        ytPlayer.seekTo(ytPlayer.getDuration() * percent, true);
    });
}

if(pPlayBtn) {
    pPlayBtn.addEventListener('click', () => {
        if(isPlayerReady && currentTrackId) {
            if(ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
            else ytPlayer.playVideo();
        }
    });
}

const animateStars = (starArray, targetIndex) => {
    starArray.forEach((s) => {
        s.classList.remove('star-animate', 'star-explode');
        s.style.color = '#444';
        s.classList.replace('ph-fill', 'ph');
    });
    
    for(let i = 0; i <= targetIndex; i++) {
        setTimeout(() => {
            const s = starArray[i];
            s.style.color = '#fff';
            s.classList.replace('ph', 'ph-fill');
            if (i === 4 && targetIndex === 4) s.classList.add('star-explode');
            else s.classList.add('star-animate');
        }, i * 80); 
    }
};

// --- ÁLBUM VIEW ---
const loadAlbumView = async (album) => {
    showSection('album-view-section', false);
    document.getElementById('album-view-cover').src = album.image;
    document.getElementById('album-view-title').innerText = album.name;
    document.getElementById('album-view-artist').innerText = album.artist;
    
    const mediaTypeText = document.getElementById('album-view-media-type');
    const originalType = album.type || 'album';
    if (originalType === 'single') mediaTypeText.innerText = 'Single';
    else if (originalType === 'ep') mediaTypeText.innerText = 'EP';
    else mediaTypeText.innerText = 'Álbum';

    const trackContainer = document.getElementById('tracklist-container');
    trackContainer.innerHTML = '<p class="pulse-text">Buscando faixas<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span></p>';
    
    let warningText = document.getElementById('album-rating-warning');
    if (!warningText) {
        const starsContainer = document.getElementById('album-view-stars').parentElement;
        warningText = document.createElement('div');
        warningText.id = 'album-rating-warning';
        
        warningText.style.marginTop = '15px';
        warningText.style.padding = '12px 15px';
        warningText.style.borderRadius = '10px';
        warningText.style.background = 'rgba(255, 255, 255, 0.05)';
        warningText.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        warningText.style.display = 'flex';
        warningText.style.gap = '10px';
        warningText.style.alignItems = 'flex-start';
        warningText.style.maxWidth = '420px';

        warningText.innerHTML = `
            <i class="ph ph-info" style="color: #aaa; font-size: 1.2rem; margin-top: 2px;"></i>
            <div>
                <p style="color:#fff; font-size:0.75rem; font-weight:600; margin-bottom: 4px;">Avaliação Rápida</p>
                <p style="color:#aaa; font-size:0.65rem; line-height: 1.4;">A nota dada aqui será distribuída para todas as faixas. Para uma curadoria precisa, avalie as músicas individualmente abaixo.</p>
            </div>
        `;
        starsContainer.parentElement.appendChild(warningText);
    }

    try {
        let url = `https://itunes.apple.com/lookup?id=${album.id}&entity=song`;
        if (originalType === 'single' || !album.id || isNaN(album.id)) {
            url = `https://itunes.apple.com/search?term=${encodeURIComponent(album.name + ' ' + album.artist)}&entity=song&limit=25`;
        }

        const res = await fetch(url);
        const data = await res.json();
        let tracks = data.results.filter(t => t.wrapperType === 'track');
        if (originalType === 'single' || isNaN(album.id)) tracks = tracks.filter(t => (t.collectionName && t.collectionName.includes(album.name)) || (t.trackName && t.trackName.includes(album.name)));

        let savedData = {};
        if(currentUser) {
            const docSnap = await getDoc(doc(db, "users", currentUser.uid, "ratings", String(album.id)));
            if(docSnap.exists()) {
                if (docSnap.data().tracks) savedData = docSnap.data().tracks;
                
                const overallRating = docSnap.data().rating || 0;
                const albumStars = Array.from(document.querySelectorAll('#album-view-stars i'));
                albumStars.forEach((s, i) => {
                    if (i < overallRating) { s.style.color = '#fff'; s.classList.replace('ph', 'ph-fill'); } 
                    else { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); }
                });
            } else {
                const albumStars = Array.from(document.querySelectorAll('#album-view-stars i'));
                albumStars.forEach((s) => { s.style.color = '#444'; s.classList.replace('ph-fill', 'ph'); });
            }
        }
        
        const albumStarsArray = Array.from(document.querySelectorAll('#album-view-stars i'));
        albumStarsArray.forEach((star, index) => {
            const newStar = star.cloneNode(true);
            star.parentNode.replaceChild(newStar, star);
            
            newStar.addEventListener('click', async () => {
                if(!currentUser) return alert('Faça login para avaliar.');
                const currentStarsNodes = Array.from(document.querySelectorAll('#album-view-stars i'));
                
                const isAlreadyRated = currentStarsNodes[index].classList.contains('ph-fill') && (index === 4 || !currentStarsNodes[index+1]?.classList.contains('ph-fill'));
                const finalRating = isAlreadyRated ? 0 : index + 1;

                animateStars(currentStarsNodes, finalRating - 1);
                
                tracks.forEach(track => {
                    const tId = String(track.trackId);
                    savedData[tId] = savedData[tId] || { comment: '' };
                    savedData[tId].rating = finalRating;
                    
                    const trackStarsContainer = document.querySelector(`.track-stars[data-track="${tId}"]`);
                    if(trackStarsContainer) {
                        const tNodes = Array.from(trackStarsContainer.querySelectorAll('i'));
                        animateStars(tNodes, finalRating - 1);
                    }
                });

                const docRef = doc(db, "users", currentUser.uid, "ratings", String(album.id));
                if(finalRating === 0) {
                    await deleteDoc(docRef);
                } else {
                    await setDoc(docRef, {
                        id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: finalRating, timestamp: new Date(), type: originalType,
                        tracks: savedData
                    }, { merge: true });
                }
            });
        });
        
        trackContainer.innerHTML = '';
        if(tracks.length === 0) { trackContainer.innerHTML = '<p style="color:#aaa;">Nenhuma faixa individual encontrada para este registro.</p>'; return; }

        tracks.forEach((track, index) => {
            const tId = String(track.trackId);
            const myTrackData = savedData[tId] || { rating: 0, comment: '' };
            
            const div = document.createElement('div');
            div.className = 'track-row liquid-glass scroll-trigger'; 
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
                        ${[1,2,3,4,5].map(n => `<i class="${n <= myTrackData.rating ? 'ph-fill' : 'ph'} ph-star" style="color: ${n <= myTrackData.rating ? '#fff' : '#444'}"></i>`).join('')}
                    </div>
                    <input type="text" class="track-comment" placeholder="Suas notas sobre a faixa..." value="${myTrackData.comment}" data-track="${tId}">
                </div>
            `;
            trackContainer.appendChild(div);
            scrollObserver.observe(div); 

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
                        const searchUrl = `${API_BASE_URL}/yt-search?track=${encodeURIComponent(track.trackName)}&artist=${encodeURIComponent(album.artist)}`;
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
                    
                    const isAlreadyRated = stars[sIndex].classList.contains('ph-fill') && (sIndex === 4 || !stars[sIndex+1]?.classList.contains('ph-fill'));
                    const finalRating = isAlreadyRated ? 0 : sIndex + 1;
                    
                    animateStars(stars, finalRating - 1);

                    savedData[tId] = savedData[tId] || { comment: '' };
                    savedData[tId].rating = finalRating;

                    let sum = 0; let count = 0;
                    Object.values(savedData).forEach(t => {
                        if (t.rating && t.rating > 0) { sum += t.rating; count++; }
                    });
                    const avgRating = count > 0 ? Math.round(sum / count) : 0;

                    const albumStarsNodes = Array.from(document.querySelectorAll('#album-view-stars i'));
                    animateStars(albumStarsNodes, avgRating - 1);

                    const docRef = doc(db, "users", currentUser.uid, "ratings", String(album.id));
                    
                    if (avgRating === 0 && count === 0) {
                        await deleteDoc(docRef);
                    } else {
                        await setDoc(docRef, {
                            id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: avgRating, timestamp: new Date(), type: originalType,
                            tracks: savedData
                        }, { merge: true });
                    }
                });
            });

            let timeout = null;
            div.querySelector('.track-comment').addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    if(!currentUser) return;
                    const currentStars = Array.from(div.querySelectorAll('.track-stars .ph-fill')).length;
                    
                    savedData[tId] = savedData[tId] || { rating: 0 };
                    savedData[tId].comment = e.target.value;

                    await setDoc(doc(db, "users", currentUser.uid, "ratings", String(album.id)), {
                        id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', timestamp: new Date(), type: originalType,
                        tracks: savedData
                    }, { merge: true });
                }, 1000);
            });
        });
    } catch(e) { trackContainer.innerHTML = '<p style="color:red;">Erro de conexão com o catálogo musical.</p>'; }
};

// --- BUSCA E FEED ---
const loadTrending = async () => {
    loadingText.innerHTML = 'Buscando registros<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span>';
    loadingText.style.display = 'block'; albumGrid.innerHTML = ''; document.getElementById('pagination-controls').style.display = 'none';
    
    let timeoutAlert = setTimeout(() => { if(renderToast) renderToast.classList.add('show'); }, 3000);

    try {
        const response = await fetch(`${API_BASE_URL}/trending`);
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');
        const data = await response.json();
        loadingText.style.display = 'none';
        if (!data || data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666;">Nenhum lançamento encontrado.</p>'; return; }
        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { 
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');
        loadingText.style.display = 'none'; albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333;">Conexão falhou.</p>'; 
    }
};

const performSearch = async () => {
    let rawQuery = searchInput.value.trim();
    if (!rawQuery) { loadTrending(); return; }

    loadingText.innerHTML = 'Buscando registros<span class="wavy-dot">.</span><span class="wavy-dot">.</span><span class="wavy-dot">.</span>';
    loadingText.style.display = 'block';
    albumGrid.innerHTML = ''; 
    document.getElementById('pagination-controls').style.display = 'none';

    let timeoutAlert = setTimeout(() => { if(renderToast) renderToast.classList.add('show'); }, 3000);

    try {
        const selectedType = document.querySelector('input[name="search-type"]:checked').value;
        let fetchUrl = `${API_BASE_URL}/search?q=${encodeURIComponent(rawQuery)}&type=${selectedType}`;
        
        const response = await fetch(fetchUrl);
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');

        if (!response.ok) throw new Error('A API devolveu um erro.');

        let data = await response.json();
        loadingText.style.display = 'none';
        
        if (data.error || !data || data.length === 0) { 
            albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado.</p>'; 
            return; 
        }

        const useYear = document.getElementById('use-year-filter').checked;
        if (useYear) {
            const minYear = parseInt(minSlider.value) || 0;
            const maxYear = parseInt(maxSlider.value) || 9999;
            data = data.filter(album => {
                const year = parseInt(album.year);
                if (isNaN(year)) return true;
                return year >= minYear && year <= maxYear;
            });
        }

        if (data.length === 0) { albumGrid.innerHTML = '<p style="text-align:center; color:#666; width:100%;">Nenhum registro encontrado nesta faixa de anos.</p>'; return; }

        currentAlbums = data; currentPage = 1; renderPage();
    } catch (error) { 
        clearTimeout(timeoutAlert);
        if(renderToast) renderToast.classList.remove('show');
        loadingText.style.display = 'none'; 
        albumGrid.innerHTML = '<p style="text-align:center; color:#ff3333; width:100%;">A conexão falhou. Tente novamente.</p>'; 
    }
};

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

document.querySelectorAll('input[name="search-type"]').forEach(radio => { radio.addEventListener('change', performSearch); });
minSlider.addEventListener('change', performSearch);
maxSlider.addEventListener('change', performSearch);
useYearFilter.addEventListener('change', performSearch);

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
                        friendName: pData.name || 'Anônimo', friendPfp: pData.photoURL || 'https://placehold.co/40x40/1a1a1a/888888?text=U',
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
            const originalType = act.type || 'album';
            let typeLabel = 'Álbum';
            if (originalType === 'single') typeLabel = 'Single';
            else if (originalType === 'ep') typeLabel = 'EP';

            const div = document.createElement('div');
            div.className = 'feed-item liquid-glass scroll-trigger'; 
            div.style.marginBottom = '15px'; div.style.borderRadius = '12px';
            
            let highlightComment = '';
            if(act.tracks) {
                const tracksWithComments = Object.values(act.tracks).filter(t => t.comment && t.comment.trim() !== '');
                if(tracksWithComments.length > 0) highlightComment = `<p style="font-style:italic; color:#aaa; font-size:0.8rem; margin-top:5px;">"${tracksWithComments[0].comment}"</p>`;
            }

            div.innerHTML = `
                <div class="pfp-container-mini"><img src="${act.friendPfp}"></div>
                <div style="flex:1;">
                    <p style="font-size:0.8rem; color:#888;"><b>${act.friendName}</b> avaliou um ${typeLabel}:</p>
                    <h4 style="color:#fff; margin:5px 0; cursor:pointer;" class="feed-title">${act.name} <span style="color:#aaa; font-weight:normal; font-size:0.8rem;">- ${act.artist}</span></h4>
                    <p style="color:#fff; font-size:1rem; text-shadow: 0 0 10px rgba(255,255,255,0.5);">${'★'.repeat(overallRating)}${'<span style="color:#444; text-shadow:none;">' + '☆'.repeat(5 - overallRating) + '</span>'}</p>
                    ${highlightComment}
                </div>
                <img src="${act.image}" class="cover" data-id="open-album" title="Abrir Álbum">
            `;
            div.querySelector('.cover').addEventListener('click', () => loadAlbumView(act));
            div.querySelector('.feed-title').addEventListener('click', () => loadAlbumView(act));
            feed.appendChild(div);
            scrollObserver.observe(div); 
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
        userCard.className = 'user-card liquid-glass scroll-trigger'; 
        userCard.innerHTML = `
            <div class="user-info-click" style="display:flex; align-items:center; gap:10px; width: 100%;">
                <div class="pfp-container-mini"><img src="${data.photoURL || 'https://placehold.co/50x50/1a1a1a/888888?text=U'}"></div>
                <div>
                    <h4 class="glow-text" style="color:#fff;">${data.name || 'Anônimo'}</h4>
                    <p style="font-size:0.7rem; color:#aaa;">${data.bio ? data.bio.substring(0, 30) + '...' : 'Sem biografia'}</p>
                </div>
            </div>
            <button class="btn-follow" data-id="${uid}">Seguir</button>
        `;
        usersGrid.appendChild(userCard);
        scrollObserver.observe(userCard); 
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

const openPublicProfile = async (uid, userData) => {
    publicModal.style.display = 'flex';
    document.getElementById('public-name').innerText = userData.name || 'Anônimo';
    document.getElementById('public-pfp').src = userData.photoURL || 'https://placehold.co/80x80/1a1a1a/888888?text=U';
    document.getElementById('public-bio').innerText = userData.bio || 'Este usuário não possui biografia.';
    const container = document.getElementById('public-rated-albums');
    container.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Buscando obras...</p>';
    try {
        const snap = await getDocs(collection(db, "users", uid, "ratings"));
        if (snap.empty) { container.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>'; return; }
        container.innerHTML = ''; let animDelay = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const originalType = data.type || 'album';
            let typeLabel = 'Álbum';
            if (originalType === 'single') typeLabel = 'Single';
            else if (originalType === 'ep') typeLabel = 'EP';

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
    ratedContainer.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Acessando dados da conta...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "ratings"));
        if (querySnapshot.empty) { ratedContainer.innerHTML = '<p style="color: #444; font-size: 0.8rem;">Nenhuma obra avaliada.</p>'; return; }
        ratedContainer.innerHTML = ''; let animDelay = 0; 
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const originalType = data.type || 'album';
            let typeLabel = 'Álbum';
            if (originalType === 'single') typeLabel = 'Single';
            else if (originalType === 'ep') typeLabel = 'EP';

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
    document.getElementById('save-profile').innerText = "Salvando...";
    try {
        const pfpSrc = document.getElementById('modal-pfp').src;
        await setDoc(doc(db, "users", currentUser.uid), { name: document.getElementById('edit-name').value, bio: document.getElementById('edit-bio').value, photoURL: pfpSrc }, { merge: true });
        navPfp.src = pfpSrc; document.getElementById('save-profile').innerText = "Salvar Modificações"; modal.style.display = 'none';
    } catch (error) { alert("Falha na gravação."); document.getElementById('save-profile').innerText = "Salvar Modificações"; }
});

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
        card.className = 'album-card liquid-glass scroll-trigger'; 
        card.style.cursor = 'pointer'; 
        
        const originalType = album.type || 'album';
        let typeLabel = 'Álbum';
        if (originalType === 'single') typeLabel = 'Single';
        else if (originalType === 'ep') typeLabel = 'EP';

        card.innerHTML = `
            <img src="${album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa'}" alt="Capa">
            <div class="album-title glow-text">${album.name}</div>
            <div class="album-artist">${album.artist}</div>
            <div class="rating-ui">
                <span style="font-size: 0.6rem; color: #888; text-transform:uppercase; letter-spacing:1px; border: 1px solid rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">${typeLabel}</span>
                <div class="stars card-stars">
                    <i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i><i class="ph ph-star"></i>
                </div>
            </div>
        `;
        albumGrid.appendChild(card);
        scrollObserver.observe(card);

        // CLIQUE PRA ABRIR O ÁLBUM NO CARD INTEIRO
        card.addEventListener('click', () => loadAlbumView(album));

        const stars = Array.from(card.querySelectorAll('.card-stars i'));
        stars.forEach((star, index) => {
            star.addEventListener('click', async (e) => {
                e.stopPropagation(); // ISSO AQUI impede que clicar na estrela abra a tela de músicas junto
                
                if(!currentUser) return alert('Faça login para avaliar esta obra.'); 
                
                const isAlreadyRated = stars[index].classList.contains('ph-fill') && (index === 4 || !stars[index+1]?.classList.contains('ph-fill'));
                const finalRating = isAlreadyRated ? 0 : index + 1;
                
                animateStars(stars, finalRating - 1); 
                
                const docRef = doc(db, "users", currentUser.uid, "ratings", String(album.id));
                if (finalRating === 0) {
                    await deleteDoc(docRef);
                } else {
                    await setDoc(docRef, {
                        id: String(album.id), name: album.name, artist: album.artist, image: album.image || 'https://placehold.co/200x200/1a1a1a/888888?text=Capa', rating: finalRating, timestamp: new Date(), type: originalType
                    }, { merge: true });
                }
            });
        });
    });
};

document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' }); } });
document.getElementById('next-page').addEventListener('click', () => { if ((currentPage * itemsPerPage) < currentAlbums.length) { currentPage++; renderPage(); document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' }); } });

// Inicia a busca silenciosamente no fundo assim que o site abre
window.addEventListener('DOMContentLoaded', () => {
    if (currentAlbums.length === 0) {
        loadTrending();
    }
});
