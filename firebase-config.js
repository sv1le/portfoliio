/**
 * NexPulse Enterprise - Firebase Configuration
 * 
 * Instructions:
 * 1. Create a project at https://console.firebase.google.com/
 * 2. Enable Firebase Authentication (Email/Password provider)
 * 3. Enable Cloud Firestore Database (in Test Mode for development)
 * 4. Replace the values below with your Firebase Project Configuration keys.
 * 
 * If you haven't set up your Firebase project yet, don't worry!
 * The application detects unconfigured credentials and automatically runs in
 * persistent High-Fidelity Local Database mode so that all features work immediately!
 */

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-app-id.firebaseapp.com",
  projectId: "your-app-id",
  storageBucket: "your-app-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Check if actual configuration has been provided by the developer
export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "your-app-id"
  );
}
