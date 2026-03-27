import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { firebaseLogin, firebaseSignup } from './api';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuthRequest() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId:
      '1035075506580-3kof887vb36b6res4m0ejg9dn0dnep4j.apps.googleusercontent.com',
    iosClientId:
      '1035075506580-kmbkqr39j5f4e7bilcjr5ivpfrqvj0t9.apps.googleusercontent.com',
    webClientId:
      '1035075506580-8sha9t1t2mi2o66q2onjh3q4i7eq9c28.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri({
      scheme: 'recipick',
      native: 'com.teamrecipick.recipick:/oauth2redirect/google',
    }),
  });

  return { request, response, promptAsync };
}

export async function signInToFirebaseWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return userCredential;
}

export async function loginToBackendWithFirebase() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Firebase 로그인 유저 정보가 없어.');
  }

  const idToken = await user.getIdToken();
  const nickname =
    user.displayName || user.email?.split('@')[0] || 'RecipickUser';
  const profileImage = user.photoURL || '';

  try {
    return await firebaseLogin({
      id_token: idToken,
      nickname,
      profile_image: profileImage,
    });
  } catch {
    return await firebaseSignup({
      id_token: idToken,
      nickname,
      profile_image: profileImage,
    });
  }
}

