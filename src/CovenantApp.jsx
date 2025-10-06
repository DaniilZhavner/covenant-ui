import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles, Rocket, Flame, Plus, Trash2, Maximize2, CheckCircle2, Target, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


/**
 * ============================================================
 *  КОВЕНАНТ — СТАРТОВЫЙ UI (v0) — JavaScript версия
 *  Примечание: без TypeScript. Все UI-примитивы локальные ниже.
 * ============================================================
 */

// ===================== LIGHT UI PRIMITIVES =====================
function Button({ className = "", children, ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition focus:outline-none " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ className = "", children, ...p }) {
  return (
    <div className={("rounded-2xl bg-stone-900 border border-stone-700 " + className).trim()} {...p}>{children}</div>
  );
}
function CardHeader({ className = "", children, ...p }) {
  return (
    <div className={("px-4 pt-4 pb-2 " + className).trim()} {...p}>{children}</div>
  );
}
function CardTitle({ className = "", children, ...p }) {
  return (
    <h3 className={("text-lg font-semibold " + className).trim()} {...p}>{children}</h3>
  );
}
function CardContent({ className = "", children, ...p }) {
  return (
    <div className={("px-4 pb-4 " + className).trim()} {...p}>{children}</div>
  );
}

function Switch({ checked, onCheckedChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`w-12 h-6 rounded-full border border-stone-700 relative transition ${checked ? "bg-amber-600" : "bg-stone-800"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black/70 border border-stone-700 transition ${checked ? "left-6" : "left-0.5"}`} />
    </button>
  );
}

// ===================== DATA =====================
const defaultBalance = [
  { title: "Финансы", short: "Ф", value: 50 },
  { title: "Самореализация", short: "СР", value: 65 },
  { title: "Здоровье/тело", short: "З", value: 70 },
  { title: "Социальная жизнь", short: "С", value: 55 },
  { title: "Довольство насыщенностью жизнью", short: "Д", value: 60 },
];

// ===================== TASKS / GOALS HELPERS =====================
function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Recurrence helpers (single definition)
const RECUR_OPTIONS = [
  { key: 'none', label: 'не повторять' },
  { key: 'daily', label: 'каждый день' },
  { key: 'weekdays', label: 'по будням' },
  { key: 'weekly', label: 'еженедельно' },
  { key: 'monthly', label: 'ежемесячно' },
];

function nextOccurrenceISO(iso, recur){
  if(!iso || !recur || recur==='none') return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const nd = new Date(d);
  if(recur==='daily') { nd.setDate(nd.getDate()+1); return nd.toISOString(); }
  if(recur==='weekdays'){
    nd.setDate(nd.getDate()+1);
    if (nd.getDay()===6) nd.setDate(nd.getDate()+2); // Sat -> Mon
    if (nd.getDay()===0) nd.setDate(nd.getDate()+1); // Sun -> Mon
    return nd.toISOString();
  }
  if(recur==='weekly'){ nd.setDate(nd.getDate()+7); return nd.toISOString(); }
  if(recur==='monthly'){ nd.setMonth(nd.getMonth()+1); return nd.toISOString(); }
  return undefined;
}

// ===================== WILLPOWER / SELECTION HELPERS =====================
function classifyWillpower(v) {
  if (v <= 2) return "rest";
  if (v <= 4) return "light";
  if (v <= 7) return "standard";
  return "boss";
}

function getAdvice(v) {
  if (v <= 2) return { title: "Режим восстановления", points: ["Сон 8–9 часов", "Лёгкая прогулка 20–30 мин", "Питание без дефицита"], note: "Фокус на перезарядке." };
  if (v <= 4) return { title: "Щадящий день", points: ["2–4 короткие задачи", "1 блок восстановления", "Лёгкая активность"], note: "Избегай перегруза." };
  if (v <= 7) return { title: "Стандартный режим", points: ["3–5 задач по плану", "Умеренная тренировка", "Режим питания по плану"], note: "Держи темп." };
  return { title: "Режим Босса", points: ["1–3 сложные задачи", "Глубокая работа 2×50–75 мин", "Интенсивная тренировка"], note: "Не забудь восстановиться." };
}

function getRecommendation(val) {
  if (val === null) return "Внеси значение, чтобы получить рекомендацию на день.";
  switch (classifyWillpower(val)) {
    case "rest": return "Полноценный отдых.";
    case "light": return "Лёгкие задачи + восстановление.";
    case "standard": return "Стандартные задачи ок.";
    case "boss": return "Можно брать 1–3 босс‑задачи.";
    default: return "";
  }
}

function targetCountByWillpower(v){
  if (v==null) return 5; // default
  const mode = classifyWillpower(v);
  return mode === 'rest' ? 2
       : mode === 'light' ? 3
       : mode === 'standard' ? 5
       : 7; // boss
}

function difficultyPreference(mode, diff){
  const map = {
    rest:     { easy: 3,   medium: 1.5, hard: 0.2 },
    light:    { easy: 2.2, medium: 1.7, hard: 0.6 },
    standard: { easy: 1.4, medium: 1.8, hard: 1.4 },
    boss:     { easy: 0.7, medium: 1.6, hard: 2.8 },
  };
  return (map[mode] ?? map.standard)[diff] ?? 1;
}

function selectTodayEntries(allEntries, willpower){
  const now = new Date();
  const mode = classifyWillpower(willpower ?? 6);
  const target = targetCountByWillpower(willpower);

  const withDue = allEntries.filter(e=> !!e.task.due);
  const isSameDayLocal = (d1,d2)=> d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();

  const todays = withDue
    .filter(e=> isSameDayLocal(new Date(e.task.due), now))
    .sort((a,b)=> new Date(a.task.due) - new Date(b.task.due));

  const others = withDue
    .filter(e=> !isSameDayLocal(new Date(e.task.due), now))
    .map(e=>{
      const due = new Date(e.task.due);
      const mins = Math.abs(due.getTime() - now.getTime()) / 60000;
      const closeness = 5000 - Math.min(5000, mins);
      const pref = difficultyPreference(mode, e.task.difficulty || 'medium');
      return { ...e, __score: closeness * pref };
    })
    .sort((a,b)=> b.__score - a.__score)
    .map(({__score, ...e})=> e);

  const remaining = Math.max(target - todays.length, 0);
  const picked = remaining>0 ? others.slice(0, remaining) : [];
  return [...todays, ...picked];
}

// ===================== WHEEL =====================
function InteractiveWheel({ data, onChange, locked=false, size=360 }) {
  const center = size/2; const padding = 36; const radius = center - padding;
  const points = data.map((d, i) => { const ang = (i/data.length)*Math.PI*2 - Math.PI/2; const r=(d.value/100)*radius; return {x:center+r*Math.cos(ang), y:center+r*Math.sin(ang), i}; });
  const polygon = points.map(p=>`${p.x},${p.y}`).join(' ');
  const handleDrag = (ev, idx) => {
    if (locked) return; const svg=ev.target.ownerSVGElement; if(!svg) return; const rect=svg.getBoundingClientRect();
    const dx = ev.clientX - rect.left - center; const dy = ev.clientY - rect.top - center; const dist = Math.sqrt(dx*dx+dy*dy);
    const newVal = Math.min(100, Math.max(0, (dist / radius) * 100)); onChange(idx, Math.round(newVal));
  };
  return (
    <svg width={size} height={size} className="mx-auto select-none">
      <defs>
        <radialGradient id="innerGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1c1917" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <circle cx={center} cy={center} r={radius} fill="url(#innerGlow)" stroke="#44403c" strokeWidth={3} />
      {points.map((p, i)=> (
        <g key={i}>
          <line x1={center} y1={center} x2={p.x} y2={p.y} stroke="#57534e" strokeDasharray="4 3" />
          <circle cx={p.x} cy={p.y} r={8} fill="#78350f" stroke="#f59e0b" strokeWidth={2}
            className={locked?"cursor-default":"cursor-pointer"}
            onMouseDown={()=>{ if(locked) return; const move=(ev)=>handleDrag(ev,i); const up=()=>{window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up);}; window.addEventListener('mousemove',move); window.addEventListener('mouseup',up); }} />
          <text x={p.x} y={p.y-12} textAnchor="middle" className="text-[10px] fill-amber-400">{data[i].short} {data[i].value}</text>
        </g>
      ))}
      <polygon points={polygon} fill="#78350f" opacity={0.4} stroke="#fbbf24" strokeWidth={2}/>
    </svg>
  );
}

// ===================== TODAY CIRCLE =====================
function CircularMeterButton({ value, onClick, size=220 }){
  const radius=(size-24)/2; const C=2*Math.PI*radius; const prog=value!==null? Math.max(0, Math.min(10,value))/10 : 0; const dash=C*prog;
  return (
    <button onClick={onClick} className="relative mx-auto focus:outline-none" style={{width:size, height:size}}>
      <svg width={size} height={size}>
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0c0a09" stopOpacity="0.9" />
          </radialGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius} fill="url(#ringGlow)" stroke="#44403c" strokeWidth={2} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1f1b16" strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f59e0b" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${dash} ${C-dash}`} transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {value===null? (
          <div className="text-sm font-semibold text-amber-400">Внести значение<br/>за сегодня</div>
        ):(
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400">Сегодня</div>
            <div className="text-4xl font-black text-amber-400 leading-tight">{value}</div>
            <div className="text-xs text-stone-500">из 10</div>
          </div>
        )}
      </div>
    </button>
  );
}

// ===================== SUB: TaskAdder =====================
function TaskAdder({ onAdd }){
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [difficulty, setDifficulty] = useState('medium');
  const [due, setDue] = useState("");
  const [recur, setRecur] = useState('none');
  const submit = ()=> { if(!val.trim()) return; onAdd({ text: val, difficulty, due: due||undefined, recur }); setVal(""); setDue(""); setDifficulty('medium'); setRecur('none'); setOpen(false); };
  if(!open) return (
    <div className="flex justify-between items-center py-2">
      <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700"><Plus className="h-4 w-4"/> Новая задача</button>
      <span className="text-xs text-stone-500">Добавь задачу для этой категории</span>
    </div>
  );
  return (
    <div className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4 mt-2">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Новая задача</div>
      <div className="flex flex-col gap-3">
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder="Что нужно сделать?" className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"/>
        <div>
          <span className="text-xs text-stone-400 block mb-1">Сложность</span>
          <div className="inline-flex rounded-full border border-stone-700 overflow-hidden">
            {[['easy','простая'],['medium','средняя'],['hard','тяжёлая']].map(([key,label], idx, arr)=> (
              <button key={key} onClick={()=>setDifficulty(key)} className={`px-3 py-1 text-sm transition border-r border-stone-700 ${idx===arr.length-1? 'border-r-0':''} ${
                difficulty===key? (key==='easy'? 'bg-emerald-900/40 text-emerald-300' : key==='medium'? 'bg-amber-900/30 text-amber-300' : 'bg-red-900/30 text-red-300') : 'text-stone-300 hover:bg-stone-800'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 w-24">Назначить на</label>
          <input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 focus:outline-none focus:border-amber-500"/>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 w-24">Повтор</label>
          <select value={recur} onChange={e=>setRecur(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200">
            {RECUR_OPTIONS.map(o=> <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={()=>setOpen(false)} className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800">Отмена</button>
          <Button onClick={submit} className="rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold px-4">Добавить</Button>
        </div>
      </div>
    </div>
  );
}

// ===================== SUB: TodayTaskAdder (compact inline form) =====================
function TodayTaskAdder({ categories, onAdd }){
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [difficulty, setDifficulty] = useState('medium');
  const [cat, setCat] = useState(categories[0] ?? "");
  const [due, setDue] = useState(() => {
    const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+1);
    const pad=(n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [recur, setRecur] = useState('none');

  const submit = ()=>{
    if(!val.trim() || !cat) return;
    onAdd(cat, { text: val, difficulty, due, recur });
    setVal(""); setDifficulty('medium'); setRecur('none'); setOpen(false);
  };

  if(!open) return (
    <div className="flex items-center justify-between gap-3">
      <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700"><Plus className="h-4 w-4"/> Новая задача на сегодня</button>
      <span className="text-xs text-stone-500">Быстрый ввод задачи на сегодня</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4 mb-3">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-3">Новая задача на сегодня</div>
      <div className="grid grid-cols-1 gap-4">
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder="Что нужно сделать?" className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"/>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 whitespace-nowrap">Категория</span>
          <select value={cat} onChange={e=>setCat(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200">
            {categories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <span className="text-xs text-stone-400 block mb-1">Сложность</span>
          <div className="inline-flex rounded-full border border-stone-700 overflow-hidden">
            {[['easy','простая'],['medium','средняя'],['hard','тяжёлая']].map(([key,label], idx, arr)=> {
              const selected = key==='easy'   ? 'bg-emerald-900/40 text-emerald-300'
                               : key==='medium' ? 'bg-amber-900/30 text-amber-300'
                               :                  'bg-red-900/30 text-red-300';
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={difficulty===key}
                  onClick={()=>setDifficulty(key)}
                  className={`px-3 py-1 text-sm transition border-r border-stone-700 ${idx===arr.length-1 ? 'border-r-0' : ''} ${
                    difficulty===key ? selected : 'text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 whitespace-nowrap">Время</span>
          <input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 focus:outline-none focus:border-amber-500"/>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 whitespace-nowrap">Повтор</span>
          <select value={recur} onChange={e=>setRecur(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200">
            {RECUR_OPTIONS.map(o=> <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={()=>setOpen(false)} className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800">Отмена</button>
          <Button onClick={submit} className="rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold px-4">Добавить</Button>
        </div>
      </div>
    </div>
  );
}

// ===================== GOALS =====================
function GoalAdder({ onAdd }){
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [inc, setInc] = useState(5);
  const [deadline, setDeadline] = useState("");
  const submit = ()=>{
    if(!title.trim()) return;
    onAdd({ id: makeId(), title: title.trim(), increment: Math.max(1, Math.min(20, Number(inc)||0)), done:false, deadline: deadline||undefined });
    setTitle(""); setInc(5); setDeadline(""); setOpen(false);
  };
  if(!open) return (
    <div className="flex justify-between items-center py-2">
      <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700"><Target className="h-4 w-4"/> Новая цель</button>
      <span className="text-xs text-stone-500">Добавь измеримую цель</span>
    </div>
  );
  return (
    <div className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Новая цель</div>
      <div className="grid gap-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Формулировка цели" className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"/>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 w-24">Рост колеса</label>
          <input type="number" min={1} max={20} value={inc} onChange={e=>setInc(e.target.value)} className="w-28 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200"/>
          <span className="text-xs text-stone-500">пунктов</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 w-24">Дедлайн</label>
          <input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200"/>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={()=>setOpen(false)} className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800">Отмена</button>
          <Button onClick={submit} className="rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold px-4">Добавить цель</Button>
        </div>
      </div>
    </div>
  );
}

// ===================== APP =====================
function isSameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function toLocalInput(dt){const d=new Date(dt||Date.now());const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}

export default function CovenantApp() {
  const [dark, setDark] = useState(true);
  const [balance, setBalance] = useState(defaultBalance);
  const [locked, setLocked] = useState(false);

  // Runtime checks (микро-тесты)
  useEffect(() => {
    console.assert(Array.isArray(defaultBalance) && defaultBalance.length === 5, 'Колесо должно иметь 5 категорий');
    console.assert(defaultBalance.every(x => typeof x.title === 'string' && typeof x.short === 'string'), 'Каждая категория имеет заголовок и букву');
    console.assert(typeof classifyWillpower === 'function', 'classifyWillpower должен быть функцией');
    console.assert(typeof getAdvice === 'function', 'getAdvice должен быть функцией');
  }, []);

  // Доп. тесты логики подбора задач ("тест-кейсы")
  useEffect(() => {
    // targetCountByWillpower tests
    console.assert(targetCountByWillpower(null) === 5, 'По умолчанию должно быть 5');
    console.assert(targetCountByWillpower(1) === 2, 'rest => 2');
    console.assert(targetCountByWillpower(3) === 3, 'light => 3');
    console.assert(targetCountByWillpower(6) === 5, 'standard => 5');
    console.assert(targetCountByWillpower(9) === 7, 'boss => 7');

    // selectTodayEntries keeps all "today" even if hard & over target
    const now = new Date();
    const iso = (d)=> d.toISOString();
    const mk = (cat, text, diff, d)=> ({ cat, task:{ id: makeId(), text, difficulty: diff, due: iso(d), done:false } });
    const todayA = mk('Финансы','Hard today','hard', new Date(now));
    const todayB = mk('Здоровье/тело','Easy today','easy', new Date(now));
    const future = mk('Самореализация','Future medium','medium', new Date(now.getTime()+3*24*3600*1000));
    const pickedLow = selectTodayEntries([todayA, todayB, future], 1);
    console.assert(pickedLow.find(e=>e.task.text==='Hard today'), 'Сегодняшняя тяжёлая должна остаться');
    console.assert(pickedLow.find(e=>e.task.text==='Easy today'), 'Сегодняшняя лёгкая должна остаться');

    // если сегодняшних задач больше таргета — список должен содержать все сегодняшние и не меньше их количества
    const t1 = mk('Финансы','T1','hard', new Date(now));
    const t2 = mk('Самореализация','T2','hard', new Date(now));
    const t3 = mk('Здоровье/тело','T3','hard', new Date(now));
    const manyTodays = selectTodayEntries([t1,t2,t3], 1); // target=2
    console.assert(manyTodays.length === 3, 'Все задачи на сегодня должны остаться, даже если больше таргета');

    // when no todays and target is 2, we get exactly 2 from others (if available)
    const f1 = mk('Финансы','F1','easy', new Date(now.getTime()+24*3600*1000));
    const f2 = mk('Самореализация','F2','medium', new Date(now.getTime()+48*3600*1000));
    const f3 = mk('Здоровье/тело','F3','hard', new Date(now.getTime()+72*3600*1000));
    const pickedTwo = selectTodayEntries([f1,f2,f3], 1);
    console.assert(pickedTwo.length === 2, 'Без сегодняшних задач при low target берём ровно 2');

    // tasks without due should be ignored by selector
    const nDue1 = { cat:'Финансы', task:{ id: makeId(), text:'No due', difficulty:'medium', done:false } };
    const resND = selectTodayEntries([nDue1], 5);
    console.assert(Array.isArray(resND) && resND.length === 0, 'Задачи без due не попадают в Today');

    // Recurrence next occurrence tests
    const base = new Date('2025-01-31T10:00:00Z');
    const d1 = new Date(nextOccurrenceISO(base.toISOString(),'daily'));
    console.assert((d1 - base) > 20*3600*1000, 'daily advances by about 1 day');
    const w1 = new Date(nextOccurrenceISO(base.toISOString(),'weekly'));
    console.assert((w1 - base) >= 6*24*3600*1000, 'weekly advances by ~7 days');
    const fri = new Date('2025-01-10T10:00:00Z'); // Friday
    const wk = new Date(nextOccurrenceISO(fri.toISOString(),'weekdays')).getDay();
    console.assert(wk>=1 && wk<=5, 'weekdays skips weekend');
    const m1 = new Date(nextOccurrenceISO(base.toISOString(),'monthly'));
    console.assert((m1 - base) > 25*24*3600*1000, 'monthly advances by ~1 month');

    // Goals tests: increment clamped to [0,100]
    const bal = [
      { title: 'Финансы', short:'Ф', value: 95 },
      { title: 'Самореализация', short:'СР', value: 10 },
      { title: 'Здоровье/тело', short:'З', value: 20 },
      { title: 'Социальная жизнь', short:'С', value: 30 },
      { title: 'Довольство насыщенностью жизнью', short:'Д', value: 40 },
    ];
    const inc = (arr, cat, by)=>{ const i = arr.findIndex(a=>a.title===cat); const next=[...arr]; next[i]={...next[i], value: Math.max(0, Math.min(100, next[i].value + by))}; return next; };
    const after = inc(bal,'Финансы',10);
    console.assert(after[0].value===100, 'Баланс не должен превышать 100 после инкремента цели');
  }, []);

  // Willpower + stats
  const [showWillpower, setShowWillpower] = useState(false);
  const [willpower, setWillpower] = useState(null);
  const [stats, setStats] = useState(null);

  // Test state
  const [showTest, setShowTest] = useState(false);
  const [testStep, setTestStep] = useState(0);
  const [answers, setAnswers] = useState([]);

  // Charts
  const [showWeekChart, setShowWeekChart] = useState(false);
  const [showMonthChart, setShowMonthChart] = useState(false);
  const [showYearChart, setShowYearChart] = useState(false);
  const [seriesWeek, setSeriesWeek] = useState([]);
  const [seriesMonth, setSeriesMonth] = useState([]);
  const [seriesYear, setSeriesYear] = useState([]);

  // tasks per category (seed with 5 random tasks each)
  const [tasks, setTasks] = useState(()=>{
    const now=new Date(); const inHours=(h)=> new Date(now.getTime()+h*3600_000).toISOString();
    const examples = [
      { text: "Сделать короткую запись в дневник", difficulty: 'easy' },
      { text: "Закрыть важный рабочий таск", difficulty: 'medium' },
      { text: "Тренировка с нагрузкой", difficulty: 'hard' },
      { text: "Позвонить другу", difficulty: 'easy' },
      { text: "Чтение 30 минут", difficulty: 'medium' },
      { text: "Разобрать почту", difficulty: 'easy' },
      { text: "Написать эссе/заметку", difficulty: 'hard' },
      { text: "Медитация 15 минут", difficulty: 'easy' },
      { text: "Подготовить презентацию", difficulty: 'hard' },
      { text: "Прогулка 40 минут", difficulty: 'medium' },
    ];
    const pickRandomTasks=()=>{ const shuffled=[...examples].sort(()=>0.5-Math.random()); return shuffled.slice(0,5).map((ex,i)=>({ id:makeId(), text:ex.text, done:false, difficulty:ex.difficulty, due: inHours((i+1)*Math.floor(Math.random()*12+1)) })); };
    const init={}; defaultBalance.forEach(b=>{ init[b.title]=pickRandomTasks(); }); return init; });

  // goals per category
  const [goals, setGoals] = useState(()=>{ const init={}; defaultBalance.forEach(b=>{ init[b.title]=[]; }); return init; });

  const addTask = (cat, payload) => {
    const t = payload.text.trim(); if(!t) return; const newTask={ id:makeId(), text:t, done:false, difficulty:payload.difficulty, due: payload.due, recur: payload.recur || 'none' };
    setTasks(prev=>({ ...prev, [cat]: [...(prev[cat]||[]), newTask] }));
  };

  const toggleTask = (cat, id) => {
    setTasks(prev=>({ ...prev, [cat]: (prev[cat]||[]).map(it=> {
      if(it.id!==id) return it;
      if(!it.done && it.recur && it.recur!=='none' && it.due){
        const next = nextOccurrenceISO(it.due, it.recur);
        return { ...it, done:false, due: next || it.due };
      }
      return { ...it, done: !it.done };
    }) }));
  };

  const removeTask = (cat, id) => {
    setTasks(prev=>({ ...prev, [cat]: (prev[cat]||[]).filter(it=> it.id!==id ) }));
  };

  const addGoal = (cat, payload)=>{ setGoals(prev=> ({...prev, [cat]: [...(prev[cat]||[]), payload] })); };

  const toggleGoal = (cat, id) => {
    setGoals(prev=> ({
      ...prev,
      [cat]: (prev[cat]||[]).map(g=>{
        if(g.id!==id) return g;
        if(!g.done){
          setBalance(bal=>{
            const idx = bal.findIndex(x=>x.title===cat); if(idx<0) return bal;
            const next=[...bal];
            next[idx] = { ...next[idx], value: Math.max(0, Math.min(100, next[idx].value + (g.increment||0))) };
            return next;
          });
        }
        return { ...g, done: !g.done };
      })
    }));
  };

  const removeGoal = (cat, id)=>{ setGoals(prev=> ({ ...prev, [cat]: (prev[cat]||[]).filter(g=>g.id!==id) })); };

  // Derived: tasks for today (willpower-driven)
  const [todayTaskEntries, setTodayTaskEntries] = useState([]);
  useEffect(()=>{
    const isValid = tasks && typeof tasks === 'object' && !Array.isArray(tasks);
    if(!isValid){ setTodayTaskEntries([]); return; }
    const entries=[]; Object.entries(tasks).forEach(([cat,arr])=> (arr||[]).forEach(task=> entries.push({cat, task})));
    setTodayTaskEntries(selectTodayEntries(entries, willpower));
  },[tasks, willpower]);

  // Remove from Today + from category too
  const removeTodayAt = (index)=>{
    setTodayTaskEntries(prev=>{
      const entry = prev[index]; if(!entry) return prev;
      setTasks(old=> ({...old, [entry.cat]: (old[entry.cat]||[]).filter(t=> t.id!==entry.task.id)}));
      const cp=[...prev]; cp.splice(index,1); return cp;
    });
  };

  // Willpower test
  const questions = [
    "Насколько хорошо ты выспался прошлой ночью?",
    "Есть ли у тебя чувство усталости прямо сейчас?",
    "Насколько у тебя есть энергия браться за сложные задачи?",
  ];

  // Start journey -> lock wheel and show willpower + seed charts
  const startJourney = () => {
    setLocked(true); setShowWillpower(true);
    const randomData = { yesterday: Math.floor(Math.random()*11), week: Math.floor(Math.random()*11), month: Math.floor(Math.random()*11), year: Math.floor(Math.random()*11) };
    setWillpower(null); setStats(randomData);
    const week = Array.from({length:7},(_,i)=>({name:`${i+1}`, value: Math.floor(Math.random()*11)}));
    const month = Array.from({length:30},(_,i)=>({name:`${i+1}`, value: Math.floor(Math.random()*11)}));
    const months = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
    const year = months.map(m=>({ name:m, value: Math.floor(Math.random()*11)}));
    setSeriesWeek(week); setSeriesMonth(month); setSeriesYear(year);
  };

  // "Not today" flow: open modal, set date, optionally drop from Today if not today
  const [todayDueEdit, setTodayDueEdit] = useState({ open:false, index:null, cat:null, id:null, value:"" });
  const openTodayDue = (index)=>{ const entry=todayTaskEntries[index]; if(!entry) return; setTodayDueEdit({ open:true, index, cat:entry.cat, id:entry.task.id, value: toLocalInput(entry.task.due) }); };
  const cancelTodayDue = ()=> setTodayDueEdit({ open:false, index:null, cat:null, id:null, value:"" });
  const commitTodayDue = ()=>{
    if(!todayDueEdit.open) return; const iso = todayDueEdit.value? new Date(todayDueEdit.value).toISOString() : undefined;
    setTasks(prev=> ({...prev, [todayDueEdit.cat]: (prev[todayDueEdit.cat]||[]).map(t=> t.id===todayDueEdit.id? { ...t, due: iso } : t)}));
    setTodayTaskEntries(prev=>{
      const cp=[...prev]; const e=cp[todayDueEdit.index]; if(!e) return prev; const updated={...e, task:{...e.task, due: iso}}; cp[todayDueEdit.index]=updated;
      const now=new Date(); if(iso && !isSameDay(new Date(iso), now)) { cp.splice(todayDueEdit.index,1); }
      return cp;
    });
    cancelTodayDue();
  };

  const postponeToday = ()=>{ if(!todayDueEdit.open) { cancelTodayDue(); return; } setTodayTaskEntries(prev=>{ const cp=[...prev]; if (todayDueEdit.index!==null && todayDueEdit.index>=0 && todayDueEdit.index<cp.length) cp.splice(todayDueEdit.index,1); return cp; }); cancelTodayDue(); };

  // DnD ordering for today
  const onDragEnd = (result) => {
    if(!result.destination) return;
    setTodayTaskEntries(prev=>{ const res=[...prev]; const [rem]=res.splice(result.source.index,1); res.splice(result.destination.index,0,rem); return res; });
  };

  // Expanded category state
  const [expanded, setExpanded] = useState(null); // area.title | null

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b from-stone-950 via-stone-900 to-black text-stone-200 font-serif ${dark? 'dark': ''}`}>
      <motion.header initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl grid place-items-center bg-stone-800 text-amber-400 border border-stone-600"><ShieldCheck className="h-5 w-5"/></div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-amber-400 drop-shadow">Ковенант</h1>
            <p className="text-xs text-stone-400 italic">v0 • внутренняя версия</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-400"><span>Тьма</span><Switch checked={dark} onCheckedChange={setDark}/></div>
          <Button className="rounded-2xl bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700" ><Sparkles className="h-4 w-4"/>Моментум</Button>
        </div>
      </motion.header>

      <main className="max-w-6xl mx-auto px-4 pb-12">
        {/* Приветствие + колесо */}
        <Card className="shadow-inner mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-amber-400 drop-shadow"><Rocket className="h-5 w-5"/> Добро пожаловать в ковенант</CardTitle>
          </CardHeader>
          <CardContent>
            <InteractiveWheel data={balance} onChange={(i,v)=>{ if(locked) return; const next=[...balance]; next[i]={...next[i], value:v}; setBalance(next); }} locked={locked} />
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {balance.map((area,i)=> (
                <div key={i} className="flex items-center gap-3 text-stone-300">
                  <span className="w-40 text-sm">{area.title}</span>
                  <input type="range" min={0} max={100} value={area.value} onChange={e=>{ if(locked) return; const next=[...balance]; next[i]={...next[i], value:Number(e.target.value)}; setBalance(next); }} className="flex-1 accent-amber-500" disabled={locked}/>
                  <span className="text-sm w-8 text-right text-amber-400">{area.value}</span>
                </div>
              ))}
            </div>
            {!locked && (
              <div className="mt-6 text-center">
                <Button onClick={startJourney} className="rounded-2xl bg-amber-600 hover:bg-amber-500 text-black font-semibold px-6 py-2">Начать путешествие</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Сила Воли */}
        {showWillpower && (
          <Card className="shadow-inner mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-amber-400 drop-shadow"><Flame className="h-5 w-5"/> Сила Воли</CardTitle>
            </CardHeader>
            <CardContent>
              {!showTest ? (
                <>
                  {stats && (
                    <div className="flex flex-wrap items-center justify-center gap-6 text-stone-300 mb-6">
                      <div className="text-sm">Вчера: <span className="text-amber-400 font-bold">{stats.yesterday}</span>/10</div>
                      <div className="text-sm">Неделя: <span className="text-amber-400 font-bold">{stats.week}</span>/10</div>
                      <div className="text-sm">Месяц: <span className="text-amber-400 font-bold">{stats.month}</span>/10</div>
                      <div className="text-sm">Год: <span className="text-amber-400 font-bold">{stats.year}</span>/10</div>
                    </div>
                  )}
                  <div className="relative w-full grid place-items-center">
                    <CircularMeterButton value={willpower} onClick={() => { setShowTest(true); setTestStep(0); setAnswers([]); }} />
                  </div>
                  {willpower!==null && (
                    <div className="mt-6 p-4 border border-stone-700 rounded-2xl bg-stone-900/60">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold"><Flame className="h-4 w-4"/> {getAdvice(willpower).title}</div>
                      <ul className="mt-3 space-y-2 list-disc pl-5 text-stone-200">
                        {getAdvice(willpower).points.map((p,i)=>(<li key={i}>{p}</li>))}
                      </ul>
                      <div className="mt-3 text-sm text-stone-400">{getRecommendation(willpower)}</div>
                    </div>
                  )}
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3 justify-center">
                      <span className="text-stone-300 text-sm">Показать графики</span>
                      <Button onClick={()=>setShowWeekChart(v=>!v)} className="rounded-full bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700">Неделя</Button>
                      <Button onClick={()=>setShowMonthChart(v=>!v)} className="rounded-full bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700">Месяц</Button>
                      <Button onClick={()=>setShowYearChart(v=>!v)} className="rounded-full bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700">Год</Button>
                    </div>
                    {showWeekChart && (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={seriesWeek}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#44403c"/>
                            <XAxis dataKey="name" stroke="#a8a29e"/>
                            <YAxis domain={[0,10]} stroke="#a8a29e"/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} dot={{r:3}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {showMonthChart && (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={seriesMonth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#44403c"/>
                            <XAxis dataKey="name" stroke="#a8a29e"/>
                            <YAxis domain={[0,10]} stroke="#a8a29e"/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} dot={{r:2}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {showYearChart && (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={seriesYear}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#44403c"/>
                            <XAxis dataKey="name" stroke="#a8a29e"/>
                            <YAxis domain={[0,10]} stroke="#a8a29e"/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} dot={{r:4}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <p className="text-stone-300 text-lg text-center">{questions[testStep]}</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {[0,1,2,3,4,5,6,7,8,9,10].map(val=> (
                      <Button key={val} onClick={()=>{
                        const na=[...answers, val]; setAnswers(na);
                        if(na.length < questions.length){ setTestStep(na.length); }
                        else { const final=Math.round(na.reduce((a,b)=>a+b,0)/na.length); setWillpower(final);
                          setStats(prev=> prev? { ...prev, yesterday: final, week: Math.round((prev.week+final)/2), month: Math.round((prev.month+final)/2), year: prev.year } : { yesterday: final, week: final, month: final, year: final });
                          setShowTest(false);
                        }
                      }} className="bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700 w-10 h-10 p-0">{val}</Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Задачи на сегодня */}
        {showWillpower && (
          <section className="max-w-6xl mx-auto mt-8">
            <h2 className="text-lg text-amber-400 mb-3">Задачи на сегодня</h2>
            <Card>
              <CardContent className="pt-4 space-y-4">
                {/* Упрощённая версия списка — без DnD, чтобы быстрее запустить */}
                {todayTaskEntries.length===0 && (
                  <div className="text-sm text-stone-500">На сегодня задач не найдено. Добавь их в категориях ниже.</div>
                )}
                <ul className="mt-1 space-y-2">
                  {todayTaskEntries.map(({cat, task}, index)=> (
                    <li key={task.id} className="flex flex-col gap-1 p-3 rounded-xl border border-stone-700 bg-stone-900/60">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={!!task.done} onChange={()=>toggleTask(cat, task.id)} className="accent-amber-500 h-4 w-4"/>
                        <span className={task.done? 'line-through text-stone-500':'text-stone-200'}>{task.text}</span>
                        <span className="ml-auto text-xs text-stone-400">{cat}</span>
                        <button onClick={()=>removeTodayAt(index)} className="ml-2 text-stone-400 hover:text-amber-400" title="Удалить из Сегодня и категории">✕</button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <span className={`px-2 py-0.5 rounded-full border ${task.difficulty==='easy'?'border-emerald-700 text-emerald-400': task.difficulty==='medium'?'border-amber-700 text-amber-400':'border-red-700 text-red-400'}`}>{task.difficulty==='easy'?'простая': task.difficulty==='medium'?'средняя':'тяжёлая'}</span>
                        {task.due && <span>{new Date(task.due).toLocaleString()}</span>}
                      </div>
                      <div className="pt-1">
                        <button onClick={()=>{ setTodayDueEdit({ open:true, index, cat, id:task.id, value: toLocalInput(task.due) }); }} className="text-xs text-stone-400 hover:text-amber-400 underline underline-offset-2">Не сегодня</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Цели по категориям (компактный список) */}
        {showWillpower && (
          <section className="max-w-6xl mx-auto mt-8">
            <h2 className="text-lg text-amber-400 mb-3">Цели по категориям</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {balance.map(area=> (
                <Card key={area.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-stone-200 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-xs">{area.short}</span>
                      {area.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GoalAdder onAdd={(payload)=>addGoal(area.title, payload)} />
                    <ul className="mt-3 space-y-2">
                      {(goals[area.title]||[]).map(goal=> (
                        <li key={goal.id} className="flex items-center gap-3 p-2 rounded-xl border border-stone-700 bg-stone-900/60">
                          <input type="checkbox" checked={!!goal.done} onChange={()=>toggleGoal(area.title, goal.id)} className="accent-amber-500 h-4 w-4"/>
                          <span className={goal.done? 'line-through text-stone-500':'text-stone-200'}>{goal.title}</span>
                          <span className="ml-auto flex items-center gap-2 text-xs text-stone-400">
                            <span className="px-2 py-0.5 rounded-full border border-amber-700 text-amber-400">+{goal.increment}</span>
                            {goal.deadline && <span title="Назначено на">{new Date(goal.deadline).toLocaleString()}</span>}
                          </span>
                          <button onClick={()=>removeGoal(area.title, goal.id)} className="text-stone-400 hover:text-amber-400">✕</button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center mt-10 text-sm text-stone-500"><p>© Ковенант • v0 MVP Shell • лицензия MIT</p></footer>

        {/* Modal: set date for Today task */}
        {todayDueEdit.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50">
            <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-4">
              <div className="text-sm text-stone-300 mb-3">Выбери дату и время для задачи</div>
              <input autoFocus type="datetime-local" value={todayDueEdit.value || ''} onChange={e=>setTodayDueEdit(v=>({...v, value:e.target.value}))} className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 focus:outline-none focus:border-amber-500"/>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={postponeToday} className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800">Установить позже</button>
                <Button onClick={commitTodayDue} className="rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold px-4">Установить дату</Button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
