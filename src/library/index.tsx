import React from "react";
import { createRoot } from "react-dom/client";
import { LibraryPage } from "./LibraryPage";
import "./library.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LibraryPage />
  </React.StrictMode>
);
