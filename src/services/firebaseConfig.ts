import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import {
    initializeAuth,
    getReactNativePersistence
} from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyCccVpOYTW2xLXfB2tWVqjJ9VCSTl5SuZY",
    authDomain: "gardenmate-3e7c5.firebaseapp.com",
    databaseURL: "https://gardenmate-3e7c5-default-rtdb.firebaseio.com",
    projectId: "gardenmate-3e7c5",
    storageBucket: "gardenmate-3e7c5.firebasestorage.app",
    messagingSenderId: "429528664912",
    appId: "1:429528664912:web:9b7f02104bb744ce697a55",
    measurementId: "G-VC0ZHSYL06"
};

// Initialize Firebase app
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('🔥 Firebase app initialized');
} else {
    app = getApp();
    console.log('🔥 Using existing Firebase app');
}

// CRITICAL: Always use initializeAuth with AsyncStorage persistence
// Do NOT use getAuth() as it initializes without persistence
// The try-catch handles the "already initialized" error on hot reloads
let auth: ReturnType<typeof initializeAuth>;

try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
    console.log('🔐 Firebase Auth initialized with AsyncStorage persistence');
} catch (error: any) {
    // This error occurs on hot reload when auth is already initialized
    // In this case, we need to import getAuth to get the existing instance
    if (error.code === 'auth/already-initialized') {
        // Dynamic import to avoid calling getAuth before initializeAuth
        const { getAuth } = require('firebase/auth');
        auth = getAuth(app);
        console.log('🔐 Using existing Firebase Auth instance (hot reload)');
    } else {
        console.error('Firebase Auth initialization error:', error);
        throw error;
    }
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
