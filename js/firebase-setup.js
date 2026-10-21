/* =====================================================
   JES 2026 — firebase-setup.js
   Inicializa o Firebase (Firestore, Auth, Storage) via CDN modular
   ===================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyBny-GK_-KIdB8s-olEFUIjVYuU3joHB-U",
  authDomain: "jes-2026-906cf.firebaseapp.com",
  projectId: "jes-2026-906cf",
  storageBucket: "jes-2026-906cf.firebasestorage.app",
  messagingSenderId: "686701500681",
  appId: "1:686701500681:web:9734146c32e0ada1a09bd8",
  measurementId: "G-J2KVLYX4E2"
};

const app = initializeApp(firebaseConfig);
window.__firebase = {
  app: app,
  db: getFirestore(app),
  auth: getAuth(app),
  storage: getStorage(app)
};

/* Defer to next microtask so app.js (also a module) has a chance to register its listener */
setTimeout(function () {
  window.dispatchEvent(new Event('firebase-ready'));
}, 0);
