import React from "react";
import { createRoot } from "react-dom/client";
import { ReplicaReview } from "./replicas/ReplicaReview.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ReplicaReview />
  </React.StrictMode>,
);
