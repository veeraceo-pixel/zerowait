// Firebase Configuration for ZeroWait
// IMPORTANT: Replace the values below with your actual credentials from the Firebase Console
// Go to: https://console.firebase.google.com/ → Select your project → Project Settings → Web App

const firebaseConfig = {
  // CRITICAL: Replace with your actual API key from Firebase Console
  // Without this, you'll get "auth/api-key-not-valid" error
  apiKey: "YOUR_ACTUAL_API_KEY_FROM_FIREBASE_CONSOLE",
  authDomain: "zerowait-c21fc.firebaseapp.com",
  projectId: "zerowait-c21fc",
  storageBucket: "zerowait-c21fc.firebasestorage.app",
  messagingSenderId: "839269113134",
  appId: "1:839269113134:web:0411874b0e248a2a102ebf",
  measurementId: "G-NL2ZRQ1RKV"
};

// Initialize Firebase using compat SDK (to match login.html)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  // Enable offline persistence
  firebase.firestore().settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
  firebase.firestore().enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not supported in this browser.');
    }
  });
  console.log("Firebase initialized successfully");
}
