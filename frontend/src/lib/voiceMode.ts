import {
  bargeInKind,
  createRecognition,
  fallbackLanguage,
  onSpeakingChange,
  recognitionErrorMessage,
  type Recognition,
} from "./speech";

type Handlers = {
  onCommand: (text: string) => void;
  onHeard?: (text: string) => void; // gapirayotgan paytdagi matn
  onFatal: (message: string, code: string) => void; // tinglashni davom ettirib bo'lmaydi (code: "not-allowed", "audio-capture"...)
  onBargeIn?: (kind: "stop" | "command", text: string) => void; // AI gapirayotganda aytilgan buyruq
};

const UTTERANCE_PAUSE_MS = 1300; // shuncha jimlikdan keyin gap tugagan hisoblanadi
const AFTER_SPEECH_MS = 700; // AI gapirib bo'lgach mikrofonni qayta yoqishdan oldin kutish

const FATAL = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];

// Doimiy tinglash ("Ovoz rejimi"). React'dan tashqarida — sahifa almashganda ham uzilmaydi.
// AI gapirayotganda ham tinglaydi, lekin faqat "to'xta" va sahifa buyruqlarini qabul qiladi
// (AI'ning o'z ovozi — aks-sado — lib/speech.ts: bargeInKind ichida ajratiladi).
class VoiceMode {
  private on = false;
  private speaking = false;
  private rec: Recognition | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Handlers | null = null;
  private subscribed = false;
  private pending = ""; // hali yuborilmagan gap bo'laklari
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private quietUntil = 0; // shu vaqtgacha oddiy gaplar qabul qilinmaydi (AI ovozining oxiri)

  get enabled() {
    return this.on;
  }

  setHandlers(handlers: Handlers) {
    this.handlers = handlers;
  }

  enable() {
    if (!this.subscribed) {
      this.subscribed = true;
      onSpeakingChange((speaking) => {
        this.speaking = speaking;
        // Gapirish boshlansa — yig'ilgan chala gapni tashlaymiz; tugasa — ovozning oxiri buyruq bo'lib ketmasin
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = null;
        this.pending = "";
        if (!speaking) this.quietUntil = Date.now() + AFTER_SPEECH_MS;
        if (this.on && !this.rec) this.schedule();
      });
    }
    this.on = true;
    this.schedule();
  }

  disable() {
    this.on = false;
    this.stopRec();
  }

  private schedule(delay = 300) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.startRec(), delay);
  }

  private startRec() {
    this.timer = null;
    if (!this.on || this.rec) return;
    const r = createRecognition(true, true);
    if (!r) return this.fatal("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning", "unsupported");
    this.rec = r;

    // Brauzer gapni pauzalarda bo'lib-bo'lib beradi ("Nima uchun kun" + "va tun almashadi").
    // Bo'laklarni yig'amiz va jimlikdan keyin bitta gap sifatida yuboramiz — aks holda chala savol ketadi
    r.onresult = (e) => {
      // AI gapirayotganda (yoki endigina tugatganda) — faqat buyruqlar
      if (this.speaking || Date.now() < this.quietUntil) {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          const kind = bargeInKind(text);
          if (kind === "stop" || (kind === "command" && e.results[i].isFinal)) {
            this.quietUntil = Date.now() + AFTER_SPEECH_MS; // shu buyruqning qolgan bo'laklari qayta ishlanmasin
            this.handlers?.onBargeIn?.(kind, text);
            return;
          }
        }
        return;
      }
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) this.pending = `${this.pending} ${text}`.trim();
        else interim += ` ${text}`;
      }
      const shown = `${this.pending} ${interim}`.trim();
      if (shown) this.handlers?.onHeard?.(shown);
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), UTTERANCE_PAUSE_MS);
    };
    r.onerror = (e) => {
      if (e.error === "language-not-supported" && fallbackLanguage()) return; // onend qayta ishga tushiradi
      if (FATAL.includes(e.error)) this.fatal(recognitionErrorMessage(e.error) ?? "Mikrofon ishlamayapti", e.error);
    };
    // Brauzer jimlikdan keyin tinglashni o'zi to'xtatadi — yoniq bo'lsa, qayta boshlaymiz
    r.onend = () => {
      if (this.rec === r) this.rec = null;
      this.flush();
      if (this.on) this.schedule();
    };
    try {
      r.start();
    } catch {
      this.rec = null;
      this.schedule(1000);
    }
  }

  private flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const text = this.pending.trim();
    this.pending = "";
    if (text && this.on && !this.speaking) this.handlers?.onCommand(text);
  }

  private stopRec() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending = "";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const r = this.rec;
    this.rec = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {}
    }
  }

  private fatal(message: string, code: string) {
    this.disable();
    this.handlers?.onFatal(message, code);
  }
}

export const voiceMode = new VoiceMode();

// Login'dan keyin o'quvchi panelida bir marta: ovoz rejimini yoqib, qayerdaligini aytish (sessionStorage)
export const LOGIN_WELCOME_KEY = "imkon_login_welcome";
// Shu brauzer seansida o'quvchi paneli allaqachon ochilganmi (yangi seans = "tizimga kirish")
export const SESSION_STARTED_KEY = "imkon_voice_session";
