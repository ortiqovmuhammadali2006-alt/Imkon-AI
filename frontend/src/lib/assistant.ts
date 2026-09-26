import { api } from "./api";

// Imkon robot-yordamchi: o'quvchining erkin gapini tushunib, platformadagi amalni tanlaydi (backend: POST /student/assistant)
export type AssistantAction =
  | "open_home"
  | "open_lessons"
  | "open_lesson"
  | "tutor"
  | "open_assignments"
  | "open_schedule"
  | "open_grades"
  | "open_chat"
  | "voice_chat"
  | "answer"
  | "unknown"; // "faqat buyruq" rejimida: gap buyruq emas (savol yoki suhbat) — hech narsa bajarilmaydi

export type AssistantResult = { action: AssistantAction; lesson_id: number | null; reply: string };

// commandOnly — ovoz rejimidan kelgan buyruq: savolga javob berilmaydi, faqat platforma amali bajariladi
export async function askAssistant(text: string, pathname: string, commandOnly = false) {
  return (await api.post<AssistantResult>("/student/assistant", { text, pathname, command_only: commandOnly })).data;
}

// Amal -> sahifa (null — sahifa o'zgarmaydi, faqat javob)
export function actionHref(r: AssistantResult): string | null {
  switch (r.action) {
    case "open_home":
      return "/student";
    case "open_lessons":
      return "/student/lessons";
    case "open_lesson":
      return r.lesson_id ? `/student/lessons/${r.lesson_id}` : "/student/lessons";
    case "tutor":
      return r.lesson_id ? `/student/lessons/${r.lesson_id}/tutor` : "/student/lessons";
    case "open_assignments":
      return "/student/assignments";
    case "open_schedule":
      return "/student/schedule";
    case "open_grades":
      return "/student/grades";
    case "open_chat":
      return "/student/chat";
    case "voice_chat":
      requestVoiceChat();
      return "/student/chat";
    default:
      return null;
  }
}

// "Ovozli suhbat": chat sahifasi ochilgach ovozli oyna darhol ochilsin (belgi seansda, sahifa uni o'qib o'chiradi)
export const OPEN_VOICE_KEY = "imkon_open_voice_chat";

export function requestVoiceChat() {
  try {
    sessionStorage.setItem(OPEN_VOICE_KEY, "1");
  } catch {}
}

// Ovozli boshqaruv tanimagan gap robotga uzatiladi (robot uni AI bilan tushunadi va bajaradi)
export const ROBOT_ASK_EVENT = "imkon:robot-ask";

export type RobotAsk = { text: string; commandOnly?: boolean };

export function askRobot(text: string, opts: { commandOnly?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<RobotAsk>(ROBOT_ASK_EVENT, { detail: { text, ...opts } }));
}
