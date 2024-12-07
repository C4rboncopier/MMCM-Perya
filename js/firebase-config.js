import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { loadEnvVariables } from './env-config.js';

let app, auth, db;
let initializationPromise;

// Initialize Firebase with environment variables
async function initializeFirebase() {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise(async (resolve) => {
        try {
            const env = await loadEnvVariables();
            
            const firebaseConfig = {
                apiKey: env.FIREBASE_API_KEY,
                authDomain: env.FIREBASE_AUTH_DOMAIN,
                projectId: env.FIREBASE_PROJECT_ID,
                storageBucket: env.FIREBASE_STORAGE_BUCKET,
                messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
                appId: env.FIREBASE_APP_ID,
                measurementId: env.FIREBASE_MEASUREMENT_ID
            };

            // Initialize Firebase
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            
            resolve({ auth, db });
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            resolve({ auth: null, db: null });
        }
    });

    return initializationPromise;
}

// Initialize Firebase when the page loads
initializeFirebase();

// Export the Firebase instances and initialization function
export { db, auth, initializeFirebase }; 