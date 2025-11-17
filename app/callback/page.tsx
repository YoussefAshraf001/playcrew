"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation"; // or next/router for pages router
import { useMusic } from "../context/MusicContext";

export default function SpotifyCallback() {
  const router = useRouter();
  const { setAccessToken } = useMusic();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      console.error("No code in URL");
      return;
    }

    // Exchange the code for access token via your API route
    fetch(`/api/spotify-token?code=${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.access_token) {
          setAccessToken(data.access_token); // store token in MusicProvider
          router.push("/"); // redirect back to home or wherever
        } else {
          console.error("Failed to get access token:", data);
        }
      })
      .catch(console.error);
  }, [router, setAccessToken]);

  return <p>Logging in to Spotify...</p>;
}
