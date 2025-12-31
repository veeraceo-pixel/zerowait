# Firebase API Key Fix - "auth/api-key-not-valid" Error

## Problem
You're seeing this error when trying to login:
```
Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)
```

## Root Cause
The `firebase-config.js` file contains a placeholder API key instead of your actual Firebase API key:
```javascript
apiKey: "YOUR_ACTUAL_API_KEY_FROM_FIREBASE_CONSOLE"
```

Firebase rejects this placeholder value because it's not a valid key from your project.

## Solution
You need to replace the placeholder with your **real API key** from the Firebase Console.

### Step-by-Step Fix

#### 1. Get Your Real API Key from Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Look for your project "zerowait-c21fc" and click on it
3. Click the **Settings gear icon** (⚙️) in the top-left sidebar
4. Select **"Project settings"**
5. Look for the **"Your apps"** section (scroll down if needed)
6. Find your **Web App** - you should see an app configuration
7. Copy the entire Firebase config code, OR
8. Copy just the **apiKey** value from the config

#### 2. Update firebase-config.js

1. Go to your `firebase-config.js` file in your repository
2. Find **line 8** which currently has:
   ```javascript
   apiKey: "YOUR_ACTUAL_API_KEY_FROM_FIREBASE_CONSOLE",
   ```
3. Replace `YOUR_ACTUAL_API_KEY_FROM_FIREBASE_CONSOLE` with your actual API key
4. Your API key will look something like: `AIzaSyD1234567890_abcdefgh...` (about 39 characters)
5. Keep it inside the quotes!

#### 3. Example (After Replacement)

```javascript
const firebaseConfig = {
  // ✅ CORRECT - with real API key
  apiKey: "AIzaSyD1234567890_abcdefghijklmnop",
  authDomain: "zerowait-c21fc.firebaseapp.com",
  projectId: "zerowait-c21fc",
  storageBucket: "zerowait-c21fc.firebasestorage.app",
  messagingSenderId: "839269113134",
  appId: "1:839269113134:web:0411874b0e248a2a102ebf",
  measurementId: "G-NL2ZRQ1RKV"
};
```

#### 4. Commit and Deploy

1. After updating the API key, commit your changes
2. Push to GitHub: `git push origin main`
3. If using Firebase Hosting, redeploy: `firebase deploy`
4. Clear your browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
5. Try logging in again

## Important Notes

✅ **What's Already Correct:**
- `authDomain` ✓
- `projectId` ✓ 
- `storageBucket` ✓
- `messagingSenderId` ✓
- `appId` ✓
- `measurementId` ✓

❌ **Only This Needs Fixing:**
- `apiKey` - Replace with your real Firebase API key

## Why This Error Occurs

Firebase validates the API key on every login attempt to:
1. Confirm the key belongs to a real Firebase project
2. Ensure the key has the right permissions
3. Prevent unauthorized access

A placeholder or invalid key will always fail authentication.

## Troubleshooting

### Still Getting the Error?

1. **Double-check the API key** - Copy it again from Firebase Console
2. **Ensure no extra spaces** - The API key should have no leading/trailing spaces
3. **Check the quotes** - Make sure the value is inside double quotes: `"YOUR_KEY"`
4. **Verify the project** - Make sure you're copying from the `zerowait-c21fc` project
5. **Clear browser cache** - Old cached JavaScript might still have the old value
6. **Hard refresh** - Press Ctrl+Shift+R (Cmd+Shift+R on Mac) to hard refresh

### Browser Console Debugging

1. Open DevTools (F12 or right-click → Inspect)
2. Go to **Console** tab
3. Check for error messages with stack traces
4. Look for messages like "Firebase initialized successfully" to confirm it's working

## Need More Help?

If you're still having issues:
1. Check that your Firebase project is active and not deleted
2. Verify the authentication method is enabled (Email/Password)
3. Look at [Firebase Console → Authentication → Sign-in methods](https://console.firebase.google.com/project/_/authentication/providers)
4. Ensure Email/Password provider is enabled
