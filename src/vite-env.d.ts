/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_STUN_SERVER_URL: string;
  readonly VITE_TURN_SERVER_URL: string;
  readonly VITE_TURNS_SERVER_URL: string;
}
