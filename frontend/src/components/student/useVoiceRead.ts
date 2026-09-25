"use client";

import { useEffect, useRef } from "react";
import { onVoiceAction, speak } from "@/lib/speech";

// "O'qib ber" ovozli buyrug'ida sahifa mazmunini o'qish
export default function useVoiceRead(text: string | null) {
  const ref = useRef(text);
  useEffect(() => {
    ref.current = text;
  });
  useEffect(
    () =>
      onVoiceAction((action) => {
        if (action === "read" && ref.current) speak(ref.current, { quick: true });
      }),
    []
  );
}
