import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyApJQBjRtWqm-3TltqZOXIycRuivuYlork",
  authDomain: "recipick-auth.firebaseapp.com",
  projectId: "recipick-auth",
  storageBucket: "recipick-auth.firebasestorage.app",
  messagingSenderId: "1035075506580",
  appId: "1:1035075506580:web:a2088323b2f13ec4daff81",
};

// 앱 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 🔥 그냥 이 한 줄이면 끝
export const auth = getAuth(app);

export default app;