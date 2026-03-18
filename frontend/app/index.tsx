import React, { useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import SplashScreenPage from "./splash";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const hasOnboarded = await SecureStore.getItemAsync("hasOnboarded");

        await new Promise((resolve) => setTimeout(resolve, 1200));

        if (hasOnboarded === "true") {
          router.replace("/login");
          return;
        }

        router.replace("/onboarding");
      } catch (e) {
        console.log("[INDEX BOOTSTRAP ERROR]", e);
        router.replace("/login");
      }
    };

    bootstrap();
  }, [router]);

  return <SplashScreenPage />;
}