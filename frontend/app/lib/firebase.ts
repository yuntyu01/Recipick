import { initializeApp, getApps, getApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    initializeAuth,
    getReactNativePersistence,
    getAuth,
} from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyApJQBjRtWqm-3TltqZOXIycRuivuYlork",
    authDomain: "recipick-auth.firebaseapp.com",
    projectId: "recipick-auth",
    storageBucket: "recipick-auth.firebasestorage.app",
    messagingSenderId: "1035075506580",
    appId: "1:1035075506580:web:a2088323b2f13ec4daff81",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
} catch {
    auth = getAuth(app);
}

export { auth };
export default app;