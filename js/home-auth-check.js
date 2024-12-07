import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        // If user is authenticated, redirect to their specific booth
        const boothType = localStorage.getItem('boothType');
        if (boothType) {
            const boothUrls = {
                'ticket-booth': '/pages/ticket-booth.html',
                'game-booth': '/pages/game-booth.html',
                'prize-booth': '/pages/prize-booth.html'
            };
            window.location.href = boothUrls[boothType];
        }
    }
}); 