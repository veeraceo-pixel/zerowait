const firebaseConfig = {
  apiKey: "AIzaSyAJFGE5OFfn-OhDNJ_rWO5oi2d2CHl2fXE",
  authDomain: "zerowait-c21fc.firebaseapp.com",
  projectId: "zerowait-c21fc",
  storageBucket: "zerowait-c21fc.firebasestorage.app",
  messagingSenderId: "839269113134",
  appId: "1:839269113134:web:0411874b0e248a2a102ebf",
  measurementId: "G-NL2ZRQ1RKV"
};

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
    
    // Attempt Firestore persistence separately so it doesn't crash the Auth flow
    firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
        console.warn("Firestore persistence could not be enabled:", err.code);
    });
}

// Export these for use in your other scripts
const auth = firebase.auth();
const db = firebase.firestore();
