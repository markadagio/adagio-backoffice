import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// No React.StrictMode: react-quill calls findDOMNode in its mount effect,
// which StrictMode's double-invoke-on-mount makes throw. StrictMode is a
// dev-only aid; production rendering is unaffected either way.
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
