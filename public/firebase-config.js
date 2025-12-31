const firebaseConfig = {
  apiKey: "AIzaSyAJFGE5OFfn-OhDNJ_rWO5oi2d2CHl2fXE",
  authDomain: "zerowait-c21fc.firebaseapp.com",
  projectId: "zerowait-c21fc",
  storageBucket: "zerowait-c21fc.firebasestorage.app",
  messagingSenderId: "839269113134",
  appId: "1:839269113134:web:0411874b0e248a2a102ebf",
  measurementId: "G-NL2ZRQ1RKV"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
}

// Attach to window so other scripts can see them immediately
window.auth = firebase.auth();
window.db = firebase.firestore();
