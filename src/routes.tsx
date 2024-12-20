import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import NotFound from "./pages/NotFound";
import { Call } from "./pages/Call";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/calls/:passphrase",
    element: <Call />,
  },
  { path: "*", element: <NotFound /> },
]);
