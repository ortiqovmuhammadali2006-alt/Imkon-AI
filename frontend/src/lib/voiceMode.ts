import {
  createRecognition,
  fallbackLanguage,
  onSpeakingChange,
  recognitionErrorMessage,
  type Recognition,
} from "./speech";

type Handlers = {
  onCommand: (text: string) => void;
  onHeard?: (text: string) => void; // gapirayotgan paytdagi matn
  onFatal: (message: string) => void; // tinglashni davom ettirib bo'lmaydi (masalan, mikrofonga ruxsat yo'q)
};

const FATAL = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];

// Doimiy tinglash ("Ovoz rejimi"). React'dan tashqarida — sahifa almashganda ham uzilmaydi.
// Ovoz o'qilayotganda mikrofon to'xtaydi (o'z ovozini buyruq deb olmasin), tugagach yana tinglaydi.
class VoiceMode {
  private on = false;
  private speaking = false;
  private rec: Recognition | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Handlers | null = null;
  private subscribed = false;

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
        if (speaking) this.stopRec();
        else this.schedule();
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
    if (!this.on || this.speaking || this.rec) return;
    const r = createRecognition(true, true);
    if (!r) return this.fatal("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning");
    this.rec = r;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        this.handlers?.onHeard?.(text);
        if (e.results[i].isFinal) this.handlers?.onCommand(text);
      }
    };
    r.onerror = (e) => {
      if (e.error === "language-not-supported" && fallbackLanguage()) return; // onend qayta ishga tushiradi
      if (FATAL.includes(e.error)) this.fatal(recognitionErrorMessage(e.error) ?? "Mikrofon ishlamayapti");
    };
    // Brauzer jimlikdan keyin tinglashni o'zi to'xtatadi — yoniq bo'lsa, qayta boshlaymiz
    r.onend = () => {
      if (this.rec === r) this.rec = null;
      if (this.on && !this.speaking) this.schedule();
    };
    try {
      r.start();
    } catch {
      this.rec = null;
      this.schedule(1000);
    }
  }

  private stopRec() {
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

  private fatal(message: string) {
    this.disable();
    this.handlers?.onFatal(message);
  }
}

export const voiceMode = new VoiceMode();
