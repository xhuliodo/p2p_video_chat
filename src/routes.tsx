import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import NotFound from "./pages/NotFound";
import { Call } from "./pages/Call";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    errorElement: <NotFound />,
  },
  {
    path: "/calls/:passphrase",
    element: <Call />,
    errorElement: <NotFound />,
  },
]);
