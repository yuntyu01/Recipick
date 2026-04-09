import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyApJQBjRtWqm-3TltqZOXIycRuivuYlork",
  authDomain: "recipick-auth.firebaseapp.com",
  projectId: "recipick-auth",
  storageBucket: "recipick-auth.firebasestorage.app",
  messagingSenderId: "1035075506580",
  appId: "1:1035075506580:web:a2088323b2f13ec4daff81",
};

// 앱 중복 초기화 방지
const alreadyInitialized = getApps().length > 0;
const app = alreadyInitialized ? getApp() : initializeApp(firebaseConfig);

// React Native에서 앱 재시작 후에도 익명 세션을 유지하기 위해
// AsyncStorage 기반 persistence 사용
// initializeAuth는 앱당 한 번만 호출 가능 (hot reload 시 getAuth로 폴백)
export const auth = alreadyInitialized
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export default app;