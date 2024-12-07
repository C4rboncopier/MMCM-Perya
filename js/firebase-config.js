import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyDAMZeWghZdg-GkNSxL-_NQQqmHZ64VK3g",
    authDomain: "mmcm-ticket.firebaseapp.com",
    projectId: "mmcm-ticket",
    storageBucket: "mmcm-ticket.firebasestorage.app",
    messagingSenderId: "724065308492",
    appId: "1:724065308492:web:ff1179173669493a60c9e9",
    measurementId: "G-KZ76V2RQ6D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { db, auth }; 