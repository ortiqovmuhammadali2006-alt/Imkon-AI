-- Foydalanuvchilar (admin, o'qituvchi, o'quvchi) — umumiy login uchun
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  phone         VARCHAR(20),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- O'qituvchi ma'lumotlari
CREATE TABLE IF NOT EXISTS teachers (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subject        VARCHAR(100),
  monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- O'quvchi ma'lumotlari. Toifa: general (oddiy), visual (ko'rish), hearing (eshitish), physical (harakat)
CREATE TABLE IF NOT EXISTS students (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category   VARCHAR(20) NOT NULL DEFAULT 'general'
             CHECK (category IN ('general', 'visual', 'hearing', 'physical')),
  grade      VARCHAR(20),
  birth_date DATE
);

-- Qaysi o'qituvchi qaysi o'quvchilarga dars beradi
CREATE TABLE IF NOT EXISTS teacher_students (
  teacher_id INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, student_id)
);

-- O'qituvchilarga to'langan oyliklar
CREATE TABLE IF NOT EXISTS salary_payments (
  id         SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  month      DATE NOT NULL,
  note       TEXT,
  paid_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dars materiallari. category NULL bo'lsa — barcha toifalar uchun
CREATE TABLE IF NOT EXISTS lessons (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  content     TEXT,
  file_url    TEXT,
  category    VARCHAR(20) CHECK (category IN ('general', 'visual', 'hearing', 'physical')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dars bo'yicha uy vazifalari
CREATE TABLE IF NOT EXISTS assignments (
  id          SERIAL PRIMARY KEY,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- O'quvchilar topshirgan vazifalar
CREATE TABLE IF NOT EXISTS submissions (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  answer_text   TEXT,
  file_url      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

-- Davomat
CREATE TABLE IF NOT EXISTS attendance (
  id         SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  UNIQUE (teacher_id, student_id, date)
);

-- Baholar (1–5)
CREATE TABLE IF NOT EXISTS grades (
  id         SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  lesson_id  INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3-bosqich: o'qituvchi topshirilgan vazifani baholaydi
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score     SMALLINT CHECK (score BETWEEN 1 AND 5);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS feedback  TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;ALTER TABLE lessons     ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Dars jadvali (admin tuzadi). day_of_week: 1 — Dushanba ... 7 — Yakshanba
CREATE TABLE IF NOT EXISTS schedule (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  subject     VARCHAR(100),
  room        VARCHAR(50),
  group_name  VARCHAR(50),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS schedule_teacher_day_idx ON schedule (teacher_id, day_of_week);
-- Qulaylik to'plami: o'qituvchi bergan subtitr + avtomatik yaratilgan matn, subtitr, tavsif, oddiy til, atamalar
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subtitle_url  TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subtitle_name TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS a11y JSONB NOT NULL DEFAULT '{}'::jsonb;