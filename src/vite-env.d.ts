/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_WEBSOCKET_URL: string;
  readonly STUN_SERVER_URL: string;
  readonly TURN_SERVER_URL: string;
  readonly TURN_SERVER_USERNAME: string;
  readonly TURN_SERVER_PASSWORD: string;
  readonly TURNS_SERVER_URL: string;
  readonly TURNS_SERVER_USERNAME: string;
  readonly TURNS_SERVER_PASSWORD: string;
}
