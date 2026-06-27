import { HelmetProvider } from "react-helmet-async";
import { AuthModalProvider } from "../context/AuthModalContext";
import { UserProvider } from "../context/UserContext";
import { GameProvider } from "../context/GameContext";
import { MusicProvider } from "../context/MusicContext";
import { UIProvider } from "../context/UIContext";
import { SyncProvider } from "../context/SyncContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HelmetProvider>
      <AuthModalProvider>
        <UserProvider>
          <GameProvider>
            <MusicProvider>
              <UIProvider>
                <SyncProvider>{children}</SyncProvider>
              </UIProvider>
            </MusicProvider>
          </GameProvider>
        </UserProvider>
      </AuthModalProvider>
    </HelmetProvider>
  );
}
