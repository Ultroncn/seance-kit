import { SeanceProvider } from "@seance/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { KitGallery } from "./KitGallery";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <SeanceProvider>
      <KitGallery />
    </SeanceProvider>
  </StrictMode>,
);
