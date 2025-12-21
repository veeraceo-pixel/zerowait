// Firebase Configuration for ZeroWait
// Replace the values below with your actual credentials from the Firebase Console
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
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    firebase.firestore().settings({ experimentalForceLongPolling: true });
    console.log("Firebase initialized successfully");
}
