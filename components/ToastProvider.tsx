"use client";

import { Toaster } from "sonner";

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#1A1A1A",
          color: "white",
          border: "none",
          borderRadius: "0",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          padding: "16px 20px",
        },
      }}
    />
  );
}
