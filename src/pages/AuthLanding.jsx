import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LogIn,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { API_BASE } from "../lib/api.js";

const passwordChecks = [
  { id: "length", label: "Не меньше 8 символов", test: (value) => value.length >= 8 },
  { id: "upper", label: "Минимум одна заглавная буква", test: (value) => /[A-ZА-Я]/.test(value) },
  { id: "lower", label: "Минимум одна строчная буква", test: (value) => /[a-zа-я]/.test(value) },
  { id: "number", label: "Минимум одна цифра", test: (value) => /\d/.test(value) },
  { id: "symbol", label: "Спецсимвол или знак пунктуации", test: (value) => /[^\w\s]/.test(value) },
];

const strengthLabels = [
  { threshold: 0.8, label: "Надёжный пароль", tone: "text-emerald-500", bar: "bg-emerald-500" },
  { threshold: 0.6, label: "Хорошая защита", tone: "text-lime-400", bar: "bg-lime-400" },
  { threshold: 0.4, label: "Средний уровень", tone: "text-amber-400", bar: "bg-amber-400" },
  { threshold: 0.2, label: "Слабовато", tone: "text-orange-400", bar: "bg-orange-400" },
  { threshold: 0, label: "Очень слабый пароль", tone: "text-red-400", bar: "bg-red-500" },
];

function PasswordStrengthMeter({ value }) {
  const score = useMemo(() => {
    if (!value) return 0;
    const passed = passwordChecks.filter((check) => check.test(value)).length;
    return passed / passwordChecks.length;
  }, [value]);

  const descriptor = useMemo(() => strengthLabels.find((item) => score >= item.threshold) ?? strengthLabels.at(-1), [score]);

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(score, 0.1) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className={`rounded-full ${descriptor.bar}`}
        />
      </div>
      <p className={`text-xs font-medium ${descriptor.tone}`}>{descriptor.label}</p>
      <ul className="grid grid-cols-1 gap-1 text-xs text-stone-400 sm:grid-cols-2" aria-live="polite">
        {passwordChecks.map((check) => {
          const isDone = check.test(value ?? "");
          return (
            <li key={check.id} className="flex items-center gap-2">
              <CheckCircle2 className={`h-3.5 w-3.5 ${isDone ? "text-emerald-500" : "text-stone-600"}`} />
              <span className={isDone ? "text-stone-300" : undefined}>{check.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FormField({ label, id, hint, error, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-stone-200">
        {Icon && <Icon className="h-4 w-4 text-amber-400" />}
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const baseForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  remember: true,
};

function validate({ mode, form }) {
  const errors = {};
  if (mode === "signup" && !form.fullName.trim()) {
    errors.fullName = "Укажите ваше имя";
  }
  if (!form.email.trim()) {
    errors.email = "Введите рабочий e-mail";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Формат e-mail некорректен";
  }
  if (!form.password) {
    errors.password = "Придумайте пароль";
  } else if (form.password.length < 8) {
    errors.password = "Минимум 8 символов";
  }
  if (mode === "signup") {
    if (!form.confirmPassword) {
      errors.confirmPassword = "Повторите пароль";
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Пароли не совпадают";
    }
  }
  return errors;
}

export default function AuthLanding({ onAuthenticated }) {
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState(baseForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const toggleMode = (nextMode) => {
    setMode(nextMode);
    setErrors({});
    setForm((prev) => ({ ...baseForm, email: prev.email }));
    setFormError(null);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = validate({ mode, form });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);

    const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      mode === "signup"
        ? { name: form.fullName.trim() || form.email.split("@")[0], email: form.email.trim(), password: form.password }
        : { email: form.email.trim(), password: form.password };

    fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = null;
          try {
            detail = await response.json();
          } catch (error) {
            detail = null;
          }
          const message = detail?.error || detail?.message || "Не удалось выполнить запрос";
          throw new Error(message);
        }
        return response.json();
      })
      .then((data) => {
        if (typeof onAuthenticated === "function") {
          onAuthenticated({ user: data.user, token: data.token, remember: form.remember });
        }
      })
      .catch((error) => {
        const known = {
          email_taken: "Этот e-mail уже зарегистрирован",
          invalid_credentials: "Неверный e-mail или пароль",
          missing_authorization: "Не удалось авторизоваться",
        };
        setFormError(known[error.message] || error.message || "Не удалось выполнить запрос");
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-black text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-12 lg:flex-row lg:items-center">
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="flex-1 space-y-10"
        >
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Готовы к осознанному прогрессу
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Создайте аккаунт и откройте доступ к личной стратегической панели
            </h1>
            <p className="max-w-xl text-base text-stone-400">
              Регистрация открывает персонализированные рекомендации, трекинг прогресса по всем сферам жизни и умные подсказки
              для стабильного роста. Войти можно с уже существующим аккаунтом в один клик.
            </p>
          </div>

          <dl className="grid gap-6 sm:grid-cols-3">
            {["Ежедневная адаптация", "Прозрачный прогресс", "Безопасность данных"].map((item) => (
              <div key={item} className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4 shadow-lg shadow-black/40">
                <dt className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {item}
                </dt>
                <dd className="mt-2 text-xs text-stone-400">
                  Мы используем сквозное шифрование, а алгоритмы адаптируются под уровень энергии и цели пользователя.
                </dd>
              </div>
            ))}
          </dl>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="rounded-3xl border border-stone-800/80 bg-stone-950/80 p-8 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400">{mode === "signup" ? "Регистрация" : "Вход"}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {mode === "signup" ? "Присоединяйтесь к Ковенанту" : "Рады видеть снова"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleMode(mode === "signup" ? "signin" : "signup")}
                className="inline-flex items-center gap-2 rounded-full border border-stone-700/70 px-3 py-1 text-xs font-medium text-stone-300 transition hover:border-amber-500/70 hover:text-amber-300"
              >
                {mode === "signup" ? (
                  <>
                    Уже есть аккаунт?
                    <LogIn className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Нет аккаунта?
                    <UserPlus className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>

            <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit}>
              {mode === "signup" && (
                <FormField id="fullName" label="Как к вам обращаться" error={errors.fullName} icon={User}>
                  <input
                    id="fullName"
                    name="fullName"
                    autoComplete="name"
                    placeholder="Имя и фамилия"
                    className="w-full rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40"
                    value={form.fullName}
                    onChange={handleChange}
                  />
                </FormField>
              )}

              <FormField id="email" label="Рабочий e-mail" error={errors.email} icon={Mail}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40"
                  value={form.email}
                  onChange={handleChange}
                />
              </FormField>

              <FormField
                id="password"
                label={mode === "signup" ? "Создайте пароль" : "Пароль"}
                error={errors.password}
                hint={mode === "signin" ? "Используйте пароль от аккаунта Covenant" : undefined}
                icon={Lock}
              >
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 pr-12 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-stone-500 transition hover:text-amber-300"
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              {mode === "signup" && (
                <FormField id="confirmPassword" label="Повторите пароль" error={errors.confirmPassword} icon={Lock}>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 pr-12 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40"
                      value={form.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-stone-500 transition hover:text-amber-300"
                      aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              )}

              {mode === "signup" && <PasswordStrengthMeter value={form.password} />}

              {mode === "signin" && (
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={form.remember}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-amber-500/50"
                    />
                    Запомнить меня
                  </label>
                  <button type="button" className="font-medium text-amber-300 transition hover:text-amber-200">
                    Забыли пароль?
                  </button>
                </div>
              )}

              {formError && (
                <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
                  {formError}
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Обработка...
                  </span>
                ) : (
                  <>
                    {mode === "signup" ? "Создать аккаунт" : "Войти"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              <p className="text-xs text-stone-500">
                Нажимая «{mode === "signup" ? "Создать аккаунт" : "Войти"}», вы соглашаетесь с
                <a href="#" className="mx-1 text-amber-300 transition hover:text-amber-200">
                  политикой конфиденциальности
                </a>
                и
                <a href="#" className="ml-1 text-amber-300 transition hover:text-amber-200">
                  условиями использования
                </a>
                .
              </p>
            </form>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
