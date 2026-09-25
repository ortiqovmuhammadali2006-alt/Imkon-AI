"use client";

import { use } from "react";
import TutorSession from "@/components/tutor/TutorSession";

// AI Tutor: dars bo'yicha interaktiv, ovozli seans
export default function StudentTutorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TutorSession lessonId={Number(id)} />;
}
