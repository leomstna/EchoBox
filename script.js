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

const showSection = (id) => {
    const overlay = document.getElementById('page-transition');
    const sections = document.querySelectorAll('.section-page');
    overlay.style.display = 'flex'; void overlay.offsetWidth; overlay.style.opacity = '1';
    
    // Chama a atualização do cenário 3D se a função existir
    if (window.update3DScene) {
        window.update3DScene(id);
    }

    setTimeout(() => {
        sections.forEach(s => s.style.display = 'none');
        if(id === 'home') { 
            document.getElementById('home').style.display = 'block'; 
            document.getElementById('search-section').style.display = 'block'; 
        } else {
            document.getElementById(id).style.display = 'block';
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        overlay.style.opacity = '0'; 
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }, 300);
};

document.getElementById('link-home').addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
document.getElementById('back-to-explore').addEventListener('click', () => showSection('search-section'));
document.getElementById('link-explorar').addEventListener('click', (e) => { e.preventDefault(); showSection('search-section'); });
document.getElementById('link-rede').addEventListener('click', (e) => { e.preventDefault(); showSection('network-section'); });

// Resto do código original (Firebase, Player, etc) suprimido para brevidade no exemplo mas deve ser mantido
