import { useState, useEffect, useRef } from "react";
import { callAI, AIProxyLimitError } from "./aiClient.js";

// ━━━ CARE LABO × MIKATA — 統合版 ━━━━━━━━━━━━━━━━━━

const DARK = {
  bg:"#161018",card:"#211A24",card2:"#2A222E",border:"#332A38",
  accent:"#E0A05C",accentFg:"#1E1408",text:"#F5EFE8",muted:"#8A7A88",
  green:"#06C755",bb:"#2A222E",ub:"#E0A05C",bt:"#F5EFE8",ut:"#1E1408",
  hdr1:"#2A2030",hdr2:"#161018",
};
const LIGHT = {
  bg:"#FBF5EF",card:"#FFFFFF",card2:"#FDF3E7",border:"#F0E0CC",
  accent:"#D4874A",accentFg:"#fff",text:"#3A2E28",muted:"#B8A090",
  green:"#06C755",bb:"#FFFFFF",ub:"#D4874A",bt:"#3A2E28",ut:"#fff",
  hdr1:"#4A3428",hdr2:"#2A1C14",
};

// ── MIKATA プロフィール／アバター ──
const K_PROFILE = "carelabo_mikata_profile";
const K_AVATAR = "carelabo_mikata_avatar";
const K_ONBOARDED = "carelabo_mikata_onboarded";
const AVATAR_ICONS = ["🧑","👩","👨","🧑‍🦱","👩‍🦱","👨‍🦱","🧑‍🦰","👩‍🦰"];
const RELATIONSHIPS = ["友達","先輩","後輩","お兄さん","お姉さん"];
const TONES = ["優しい","フレンドリー","クール","明るい"];
const AGE_FEELS = ["年上","同い年","年下"];
const GENDERS = ["男性","女性","どちらでもない"];

function loadProfile() { try { return JSON.parse(localStorage.getItem(K_PROFILE) || "{}"); } catch (e) { return {}; } }
function loadAvatar() { try { return JSON.parse(localStorage.getItem(K_AVATAR) || "null") || { icon:"🧑", relationship:"先輩", tone:"優しい", ageFeel:"年上", gender:"女性" }; } catch (e) { return { icon:"🧑", relationship:"先輩", tone:"優しい", ageFeel:"年上", gender:"女性" }; } }

function personaPrompt(profile, avatar) {
  return `あなたは${profile.name || "利用者"}さんの${avatar.relationship}で、${avatar.ageFeel}の${avatar.gender}です。口調は${avatar.tone}な感じで話してください。基本的に「${profile.name || "あなた"}」と呼んでください。
「愛してる」「君がいないとダメ」等の恋愛的・過度に依存的な愛情表現は絶対に使わないこと。あくまで${avatar.relationship}としての温かさ・親しみに留めること。恋人・パートナーのような振る舞いは一切しないこと。`;
}

// ── 安全フィルタ ──
const CRISIS_WORDS = ["死にたい","消えたい","自殺","自傷","リストカット","死にたくなる","生きるのがつらい","死んだ方がまし"];
const SEXUAL_WORDS = ["セックス","エッチ","AV","裸","エロ"];
const CRIME_WORDS = ["殺す","殺したい","爆破","違法薬物","覚醒剤"];
function detectCrisis(t) { return CRISIS_WORDS.some(w => t.includes(w)); }
function detectSexual(t) { return SEXUAL_WORDS.some(w => t.includes(w)); }
function detectCrime(t) { return CRIME_WORDS.some(w => t.includes(w)); }

function SafetyNotice({ p }) {
  return (
    <div style={{ margin:"6px 0", borderRadius:14, padding:12, background:"#FBEAEA", border:"1px solid #E8B8B8" }}>
      <div style={{ fontSize:11.5, fontWeight:700, marginBottom:4, color:"#A0453F" }}>一人で抱えないでください</div>
      <div style={{ fontSize:10.5, lineHeight:1.6, color:"#7A3530" }}>
        📞 いのちの電話：0570-783-556（毎日16時〜21時、毎月10日は8時〜翌8時）<br/>
        💬 よりそいホットライン：0120-279-338（24時間対応）
      </div>
    </div>
  );
}

// ─── 共通部品 ─────────────────────────────────────────
function Bubble({ from, text, p, av = "✦", loading }) {
  const isB = from === "bot";
  return (
    <div style={{ display:"flex", justifyContent:isB?"flex-start":"flex-end", gap:6, marginBottom:10 }}>
      {isB && (
        <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,alignSelf:"flex-end",overflow:"hidden",
          background:`linear-gradient(135deg,${p.accent},${p.accent}55)`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>{av}</div>
      )}
      <div style={{ maxWidth:"78%", background:isB?p.bb:p.ub, color:isB?p.bt:p.ut,
        padding:"9px 13px", borderRadius:isB?"2px 14px 14px 14px":"14px 2px 14px 14px",
        fontSize:12, lineHeight:1.7, whiteSpace:"pre-wrap",
        boxShadow:isB?"0 2px 10px rgba(0,0,0,0.1)":`0 2px 10px ${p.accent}33`,
        border:isB?`1px solid ${p.border}`:"none" }}>
        {loading ? (
          <div style={{ display:"flex", gap:4, padding:"3px 0" }}>
            {[0,1,2].map(i=>(
              <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:p.muted,
                animation:`dl 1.2s ease-in-out ${i*0.2}s infinite` }}/>
            ))}
          </div>
        ) : text}
      </div>
    </div>
  );
}

function Chip({ label, p, on, onClick }) {
  return (
    <button onClick={onClick} style={{ display:"inline-block", margin:"2px 4px 2px 0",
      border:`1.5px solid ${on?p.accent:p.border}`, color:on?p.accent:p.muted,
      borderRadius:18, padding:"5px 13px", fontSize:11, fontWeight:on?700:400,
      background:on?`${p.accent}14`:"transparent", cursor:"pointer" }}>{label}</button>
  );
}

// ─── AIチャット汎用フック（共通プロキシ経由） ─────────
function useChat(system, initMsg) {
  const [msgs, setMsgs] = useState([{ from:"bot", text:initMsg }]);
  const [loading, setLoading] = useState(false);
  const send = async (text) => {
    if (!text.trim()) return;
    const next = [...msgs, { from:"user", text }];
    setMsgs(next);
    setLoading(true);
    try {
      const history = next.filter(m=>m.text).map(m=>({
        role: m.from==="user"?"user":"assistant", content: m.text
      }));
      const response = await callAI({ system, messages: history, max_tokens: 600 });
      if (response.status === 429) throw new AIProxyLimitError("上限に達しました");
      if (!response.ok) throw new Error(`APIエラー (${response.status})`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.find(b => b.type === "text")?.text || "";
      setMsgs(v=>[...v, { from:"bot", text:reply }]);
    } catch(e) {
      if (!e?.isLimitError) {
        setMsgs(v=>[...v, { from:"bot", text:"エラーが発生しました。もう一度お試しください。" }]);
      }
    }
    setLoading(false);
  };
  return { msgs, loading, send, setMsgs };
}

// ─── チャット入力バー ─────────────────────────────────
function ChatInput({ p, onSend, placeholder = "メッセージを入力…" }) {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onSend(val.trim()); setVal(""); } };
  return (
    <div style={{ background:p.card, padding:"8px 10px", display:"flex", gap:7,
      borderTop:`1px solid ${p.border}`, flexShrink:0 }}>
      <div style={{ width:28,height:28,borderRadius:"50%",background:p.card2,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:p.muted }}>＋</div>
      <textarea value={val} onChange={e=>setVal(e.target.value)}
        rows={1}
        placeholder={placeholder}
        style={{ flex:1,background:p.bg,border:`1px solid ${p.border}`,borderRadius:18,
          padding:"6px 14px",fontSize:12,color:p.text,outline:"none",resize:"none" }}/>
      <button onClick={submit} style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,
        background:val.trim()?p.green:p.border,border:"none",cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16 }}>→</button>
    </div>
  );
}

// ─── トレンドバナー ──────────────────────────────────
function Trend({ p, isDark }) {
  const [x, setX] = useState(0);
  const items = [
    {src:"X",txt:"夜勤明け快眠術がバズ中 — 看護師TLで話題"},
    {src:"NHK",txt:"介護士処遇改善、新制度が来月スタート"},
    {src:"X",txt:"AI看護記録ツールが急速に普及 — 医療DX特集"},
    {src:"朝日",txt:"訪問看護師不足が深刻化 — 2030年3万人不足"},
    {src:"厚労省",txt:"介護報酬改定の詳細が公表"},
    {src:"X",txt:"精神科看護師の離職率が10年ぶりに低下"},
    {src:"日経",txt:"医療DXで電子カルテ統合が加速"},
  ];
  useEffect(() => {
    const id = setInterval(() => setX(v => (v + 0.5) % 900), 20);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ overflow:"hidden", padding:"5px 0", borderBottom:`1px solid ${p.border}`,
      background:isDark?"#241A28":"#FFF3E6", flexShrink:0 }}>
      <div style={{ display:"flex", whiteSpace:"nowrap", transform:`translateX(-${x}px)`,
        willChange:"transform" }}>
        {[...items,...items,...items].map((it,i) => (
          <span key={i} style={{ marginRight:32, fontSize:10.5, color:p.muted, flexShrink:0 }}>
            <span style={{ background:`${p.accent}25`, color:p.accent, fontSize:9,
              fontWeight:700, borderRadius:4, padding:"1px 5px", marginRight:5 }}>{it.src}</span>
            {it.txt}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 円グラフ ────────────────────────────────────────
function Pie({ data, size=110 }) {
  const total = data.reduce((s,d)=>s+d.v,0);
  let off = 0;
  const r = size/2-6, cx=size/2, cy=size/2;
  const arc = (s,e) => {
    const a = (deg) => ({ x: cx+r*Math.cos((deg-90)*Math.PI/180), y: cy+r*Math.sin((deg-90)*Math.PI/180) });
    const p1=a(s), p2=a(e);
    return `M${cx} ${cy} L${p1.x} ${p1.y} A${r} ${r} 0 ${e-s>180?1:0} 1 ${p2.x} ${p2.y}Z`;
  };
  return (
    <svg width={size} height={size}>
      {data.map((d,i) => {
        const angle = d.v/total*360;
        const path = arc(off, off+angle);
        off += angle;
        return <path key={i} d={path} fill={d.color} stroke="#161018" strokeWidth={1.5}/>;
      })}
      <circle cx={cx} cy={cy} r={r*0.52} fill="#211A24"/>
    </svg>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// オンボーディング（MIKATA人格設定）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OnboardWelcome({ onNext }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:"100vh", padding:"0 24px", background:"#FBF5EF", textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>🌿</div>
      <div style={{ fontSize:22, fontWeight:800, marginBottom:8, color:"#3A2E28" }}>ケアラボ</div>
      <div style={{ fontSize:13, lineHeight:1.8, color:"#7A6A5E", marginBottom:24 }}>
        心も、体も、生活も。<br/>医療・ケア職のあなたに寄り添う相棒。
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginBottom:28, maxWidth:320 }}>
        {["💬 いつでも話せるAI秘書","📋 シフトも家計も一括管理","🔒 データは端末内のみ"].map(t=>(
          <span key={t} style={{ fontSize:11, fontWeight:700, padding:"6px 14px", borderRadius:100,
            background:"#fff", color:"#D4874A", border:"1px solid #F0DFC8" }}>{t}</span>
        ))}
      </div>
      <button onClick={onNext} style={{ width:"100%", maxWidth:280, padding:"14px 0", borderRadius:16,
        fontSize:14, fontWeight:700, background:"#D4874A", color:"#fff", border:"none" }}>
        はじめる
      </button>
    </div>
  );
}

function OnboardProfile({ onComplete }) {
  const QUESTIONS = [
    { key:"name", q:"はじめまして。よかったら、呼んでほしい名前を教えてください（ニックネームでもOKです）", required:true },
    { key:"job", q:"お仕事は何をされていますか？（看護師、介護士など）", required:false },
    { key:"concern", q:"最近、気になっていること・大変だなと感じていることがあれば、少しだけ教えてください", required:false },
  ];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState("");
  const submit = (skip) => {
    const val = skip ? "" : input.trim();
    const updated = { ...answers, [QUESTIONS[step].key]: val };
    setAnswers(updated);
    setInput("");
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else onComplete(updated);
  };
  const q = QUESTIONS[step];
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", padding:"32px 20px", background:"#FBF5EF", overflow:"hidden" }}>
      <div style={{ fontSize:11, marginBottom:20, color:"#B8A090" }}>{step+1} / {QUESTIONS.length}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:20 }}>
          <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,background:"#D4874A",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"#fff" }}>🌿</div>
          <div style={{ borderRadius:"4px 16px 16px 16px", padding:"12px 16px", fontSize:13, lineHeight:1.7,
            background:"#fff", color:"#3A2E28", maxWidth:"82%" }}>{q.q}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="ここに入力" rows={2}
          style={{ flex:1, borderRadius:16, padding:"10px 14px", fontSize:13, outline:"none", resize:"none",
            background:"#fff", color:"#3A2E28", border:"1px solid #F0E0CC" }}/>
        <button onClick={()=>submit(false)} style={{ padding:"12px 18px", borderRadius:16, fontSize:13,
          fontWeight:700, background:"#D4874A", color:"#fff", border:"none", flexShrink:0 }}>送る</button>
      </div>
      {!q.required && <button onClick={()=>submit(true)} style={{ fontSize:11, marginTop:10, alignSelf:"center",
        background:"none", border:"none", color:"#B8A090" }}>スキップする</button>}
    </div>
  );
}

function OnboardAvatar({ onComplete }) {
  const [gender, setGender] = useState("女性");
  const [ageFeel, setAgeFeel] = useState("年上");
  const [tone, setTone] = useState("優しい");
  const [relationship, setRelationship] = useState("先輩");
  const [icon, setIcon] = useState(AVATAR_ICONS[0]);
  const [photoData, setPhotoData] = useState("");
  const fileRef = useRef(null);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("写真のサイズが大きすぎます（3MB以下）"); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result);
    reader.readAsDataURL(file);
  };

  const Picker = ({ label, options, value, setValue }) => (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:11, fontWeight:700, marginBottom:8, color:"#7A6A5E" }}>{label}</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {options.map(o=>(
          <button key={o} onClick={()=>setValue(o)} style={{ fontSize:12, fontWeight:700, padding:"8px 14px",
            borderRadius:100, border:`1px solid ${value===o?"#D4874A":"#F0E0CC"}`,
            background:value===o?"#D4874A":"#fff", color:value===o?"#fff":"#7A6A5E" }}>{o}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", padding:"28px 20px 40px", background:"#FBF5EF" }}>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:4, color:"#3A2E28" }}>相棒のすがたを決めましょう</div>
      <div style={{ fontSize:11, marginBottom:20, color:"#B8A090" }}>あとから設定でいつでも変更できます</div>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, marginBottom:8, color:"#7A6A5E" }}>写真を選ぶ（任意）</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>fileRef.current?.click()} style={{ width:60, height:60, borderRadius:"50%", flexShrink:0,
            overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center",
            background:"#fff", border:photoData?"2px solid #D4874A":"1px dashed #D8C4A8" }}>
            {photoData ? <img src={photoData} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:22, color:"#D8C4A8" }}>＋</span>}
          </button>
          <div style={{ fontSize:10.5, lineHeight:1.6, color:"#B8A090" }}>
            端末だけに保存され、外部には送信されません。
            {photoData && <button onClick={()=>setPhotoData("")} style={{ display:"block", marginTop:4, fontWeight:700, background:"none", border:"none", color:"#A0453F" }}>写真を外す</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }}/>
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, marginBottom:8, color:"#7A6A5E" }}>{photoData?"または、アイコンを選ぶ":"アイコン"}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {AVATAR_ICONS.map(ic=>(
            <button key={ic} onClick={()=>{setIcon(ic);setPhotoData("");}} style={{ width:44, height:44, borderRadius:"50%",
              fontSize:19, background:"#fff", border:!photoData&&icon===ic?"2px solid #D4874A":"1px solid #F0E0CC" }}>{ic}</button>
          ))}
        </div>
      </div>

      <Picker label="性別" options={GENDERS} value={gender} setValue={setGender}/>
      <Picker label="年齢の感じ" options={AGE_FEELS} value={ageFeel} setValue={setAgeFeel}/>
      <Picker label="口調" options={TONES} value={tone} setValue={setTone}/>
      <Picker label="関係性" options={RELATIONSHIPS} value={relationship} setValue={setRelationship}/>

      <button onClick={()=>onComplete({ gender, ageFeel, tone, relationship, icon, photo: photoData })}
        style={{ width:"100%", padding:"14px 0", borderRadius:16, fontSize:14, fontWeight:700,
          background:"#D4874A", color:"#fff", border:"none", marginTop:6 }}>
        この内容ではじめる
      </button>
    </div>
  );
}

function AvatarBadge({ avatar, size=28 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.55, background:"#fff" }}>
      {avatar?.photo ? <img src={avatar.photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (avatar?.icon || "🌿")}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 各画面コンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HOME_MENU = [
  {icon:"📅",label:"カレンダー",id:"calendar"},
  {icon:"💪",label:"ボディメイク",id:"body"},
  {icon:"🌙",label:"ムーンログ",id:"moon"},
  {icon:"S+",label:"Skill+",id:"skill",txt:true},
  {icon:"🔮",label:"占い",id:"fortune"},
  {icon:"🫧",label:"匿名相談",id:"mental"},
  {icon:"🍳",label:"今日のレシピ",id:"recipe"},
  {icon:"✅",label:"TODO",id:"todo"},
  {icon:"💰",label:"家計簿",id:"kakeibo"},
];

function HomeScreen({ p, isDark, profile, avatar, onNav }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(HOME_MENU);
  const [drag, setDrag] = useState(null);
  const sys = `${personaPrompt(profile, avatar)}
あなたはケアラボのAI秘書として、医療・ケア職の生活をサポートします。シフト表が来たらカレンダー登録用に整理。短く・絵文字を適度に使って親しみやすく。`;
  const { msgs, loading, send } = useChat(sys,
    `こんにちは、${profile.name || ""}さん！ケアラボの相棒です 🤍\n\nシフト表・レシート・冷蔵庫の写真など\nなんでも送ってください。`);
  const swap = (a,b) => { const m=[...menu]; [m[a],m[b]]=[m[b],m[a]]; setMenu(m); };
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      <Trend p={p} isDark={isDark}/>
      <div style={{ background:isDark?"#241A28":"#FFF3E6", padding:"9px 14px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        borderBottom:`1px solid ${p.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:20 }}>🌤️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:p.text }}>29°C　晴れ時々曇り</div>
            <div style={{ fontSize:9.5, color:p.muted }}>2026.07.02 WED</div>
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:p.accent }}>12</div>
          <div style={{ fontSize:8.5, color:p.muted }}>日連続 🔥</div>
        </div>
      </div>
      <div style={{ padding:"10px 10px 4px" }}>
        {msgs.map((m,i) => <Bubble key={i} from={m.from} text={m.text} p={p} av={<AvatarBadge avatar={avatar} size={20}/>}/>)}
        {loading && <Bubble from="bot" p={p} av={<AvatarBadge avatar={avatar} size={20}/>} loading/>}
        <div ref={endRef}/>
        {!loading && msgs[msgs.length-1]?.from==="bot" && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", margin:"4px 0 6px" }}>
            {["シフト表を確認して","今日のレシピ提案して","運勢教えて"].map(q=>(
              <Chip key={q} label={q} p={p} onClick={()=>send(q)}/>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding:"0 12px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:9.5, color:p.muted, letterSpacing:0.5 }}>MENU</div>
          <button onClick={()=>setEditing(v=>!v)}
            style={{ fontSize:9.5, color:p.accent, background:"none", border:"none",
              cursor:"pointer", fontWeight:700 }}>
            {editing?"完了":"並び替え ✎"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {menu.map((m,i) => (
            <div key={i}
              draggable={editing}
              onDragStart={()=>setDrag(i)}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>{if(drag!==null&&drag!==i){swap(drag,i);setDrag(null);}}}
              onClick={()=>!editing && onNav && onNav(m.id)}
              style={{ textAlign:"center", cursor:editing?"grab":"pointer",
                opacity:drag===i?0.4:1, transform:editing?"scale(0.94)":"scale(1)",
                transition:"transform 0.1s" }}>
              <div style={{ width:52, height:52, borderRadius:16, margin:"0 auto 5px",
                background:isDark?"#2A222E":"#FDF3E7", border:`1px solid ${editing?p.accent:p.border}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:m.txt?11:22, fontWeight:m.txt?900:400, color:m.txt?p.accent:undefined }}>
                {m.icon}
              </div>
              <div style={{ fontSize:9.5, color:p.text, fontWeight:600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      <ChatInput p={p} onSend={send} placeholder="相棒に話しかける…"/>
    </div>
  );
}

// カレンダー
function CalendarScreen({ p }) {
  const days=["日","月","火","水","木","金","土"];
  const [shifts, setShifts] = useState({3:"日",4:"夜",5:"明",7:"日",8:"日",9:"夜",14:"日",15:"夜",16:"明",21:"日"});
  const sc={日:"#4A8A6A",夜:"#4A5A9A",明:"#8A6A3A"};
  const [view,setView]=useState("month");
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({date:"",title:"",shift:""});
  const [events, setEvents] = useState([
    {date:2, title:"体質改善メニュー（昼食）", c:p.accent},
    {date:5, title:"歯科検診 14:00", c:"#E06090"},
  ]);
  const addEvent = () => {
    if (!newEvent.date || !newEvent.title) return;
    const d = parseInt(newEvent.date);
    if (isNaN(d)) return;
    if (newEvent.shift) setShifts(v=>({...v,[d]:newEvent.shift}));
    setEvents(v=>[...v,{date:d,title:newEvent.title,c:"#5B8FD4"}]);
    setNewEvent({date:"",title:"",shift:""});
    setShowAdd(false);
  };
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ fontSize:11, color:p.muted, marginBottom:10, lineHeight:1.6 }}>
        シフト表の写真を送ると自動登録。手動でも予定を追加できます。
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[["month","月表示"],["3day","前後3日"],["week","週表示"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{ flex:1, padding:"6px 0", borderRadius:20,
              border:`1px solid ${p.border}`, cursor:"pointer", fontSize:11,
              background:view===v?p.accent:p.card,
              color:view===v?p.accentFg:p.muted, fontWeight:view===v?700:400 }}>{l}</button>
        ))}
      </div>
      <div style={{ background:p.card, borderRadius:16, padding:12, border:`1px solid ${p.border}`, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:p.text }}>2026年 7月</div>
          <button onClick={()=>setShowAdd(v=>!v)}
            style={{ background:p.accent, color:p.accentFg, border:"none",
              borderRadius:16, padding:"4px 12px", fontSize:11, fontWeight:700,
              cursor:"pointer" }}>＋ 予定を追加</button>
        </div>
        {showAdd && (
          <div style={{ background:p.card2, borderRadius:12, padding:10, marginBottom:10,
            border:`1px solid ${p.accent}44` }}>
            <div style={{ display:"flex", gap:6, marginBottom:6 }}>
              <input value={newEvent.date} onChange={e=>setNewEvent(v=>({...v,date:e.target.value}))}
                placeholder="日（例: 10）" inputMode="numeric"
                style={{ width:60, background:p.bg, border:`1px solid ${p.border}`,
                  borderRadius:8, padding:"6px 8px", fontSize:11, color:p.text, outline:"none" }}/>
              <input value={newEvent.title} onChange={e=>setNewEvent(v=>({...v,title:e.target.value}))}
                placeholder="予定の内容"
                style={{ flex:1, background:p.bg, border:`1px solid ${p.border}`,
                  borderRadius:8, padding:"6px 8px", fontSize:11, color:p.text, outline:"none" }}/>
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:6 }}>
              <span style={{ fontSize:11, color:p.muted, alignSelf:"center" }}>シフト:</span>
              {["日","夜","明","休"].map(s=>(
                <button key={s} onClick={()=>setNewEvent(v=>({...v,shift:v.shift===s?"":s}))}
                  style={{ padding:"3px 10px", borderRadius:12, border:"none", cursor:"pointer",
                    fontSize:10, fontWeight:newEvent.shift===s?700:400,
                    background:newEvent.shift===s?sc[s]||p.accent:p.card,
                    color:newEvent.shift===s?"#fff":p.muted }}>{s}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={addEvent}
                style={{ flex:1, background:p.accent, color:p.accentFg, border:"none",
                  borderRadius:12, padding:"6px 0", fontSize:11, fontWeight:700, cursor:"pointer" }}>追加</button>
              <button onClick={()=>setShowAdd(false)}
                style={{ flex:1, background:p.card, color:p.muted, border:`1px solid ${p.border}`,
                  borderRadius:12, padding:"6px 0", fontSize:11, cursor:"pointer" }}>キャンセル</button>
            </div>
          </div>
        )}
        {view === "month" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
              {days.map((d,i)=>(
                <div key={i} style={{ textAlign:"center", fontSize:9.5,
                  color:i===0?"#E06060":i===6?"#4080C0":p.muted, fontWeight:600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
              {["","","",1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31].map((d,i)=>(
                <div key={i} style={{ textAlign:"center", padding:"2px 0" }}>
                  {d && (
                    <div style={{ width:28, height:28, borderRadius:8, margin:"0 auto",
                      background:d===2?p.accent:"transparent",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ fontSize:10, fontWeight:d===2?700:400,
                        color:d===2?p.accentFg:p.text }}>{d}</div>
                      {shifts[d]&&<div style={{ fontSize:7, color:sc[shifts[d]], fontWeight:700 }}>{shifts[d]}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(view === "3day" || view === "week") && (() => {
          const today = 2;
          const dow = ["日","月","火","水","木","金","土"];
          const startDow = 3; // 7/1が水曜(index3)という前提
          let dayList;
          if (view === "3day") {
            dayList = [today-3, today-2, today-1, today, today+1, today+2, today+3].filter(d => d >= 1 && d <= 31);
          } else {
            // 週表示：今日を含む週（日〜土）
            const todayDow = (startDow + (today - 1)) % 7;
            const weekStart = today - todayDow;
            dayList = Array.from({length:7}, (_, i) => weekStart + i).filter(d => d >= 1 && d <= 31);
          }
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {dayList.map(d => {
                const dowIdx = (startDow + (d - 1)) % 7;
                const dayEvents = events.filter(e => e.date === d);
                return (
                  <div key={d} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                    borderRadius:10, background: d===today ? `${p.accent}18` : p.card2,
                    border: d===today ? `1px solid ${p.accent}55` : `1px solid ${p.border}` }}>
                    <div style={{ width:36, textAlign:"center", flexShrink:0 }}>
                      <div style={{ fontSize:9, color: dowIdx===0?"#E06060":dowIdx===6?"#4080C0":p.muted }}>{dow[dowIdx]}</div>
                      <div style={{ fontSize:14, fontWeight:d===today?800:600, color: d===today?p.accent:p.text }}>{d}</div>
                    </div>
                    {shifts[d] && (
                      <div style={{ fontSize:10, fontWeight:700, color:sc[shifts[d]], background:`${sc[shifts[d]]}20`,
                        borderRadius:8, padding:"2px 8px", flexShrink:0 }}>{shifts[d]}勤</div>
                    )}
                    <div style={{ flex:1, fontSize:10.5, color:p.muted }}>
                      {dayEvents.length > 0 ? dayEvents.map(e=>e.title).join("・") : (shifts[d] ? "" : "予定なし")}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{ display:"flex", gap:10, marginTop:8, justifyContent:"center" }}>
          {Object.entries(sc).map(([k,v])=>(
            <div key={k} style={{ display:"flex", alignItems:"center", gap:3 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:v }}/>
              <span style={{ fontSize:9.5, color:p.muted }}>{k==="日"?"日勤":k==="夜"?"夜勤":"夜明"}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:p.card, borderRadius:14, padding:12, border:`1px solid ${p.border}` }}>
        <div style={{ fontSize:11, fontWeight:700, color:p.accent, marginBottom:8 }}>今日の予定</div>
        {[
          {t:"08:30",l:"日勤開始",c:"#4A8A6A"},
          ...events.filter(e=>e.date===2).map(e=>({t:"",l:e.title,c:e.c})),
          {t:"17:15",l:"日勤終了",c:"#4A8A6A"},
          {t:"21:00",l:"明日のプランが届きます",c:p.muted},
        ].map((e,i)=>(
          <div key={i} style={{ display:"flex", gap:10, padding:"5px 0",
            borderBottom:i<2?`1px solid ${p.border}`:"none", alignItems:"center" }}>
            <div style={{ fontSize:10.5, color:p.muted, width:36, flexShrink:0 }}>{e.t}</div>
            <div style={{ width:3, height:3, borderRadius:"50%", background:e.c, flexShrink:0 }}/>
            <div style={{ fontSize:11.5, color:p.text }}>{e.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ボディメイク（AIあり）
function BodyScreen({ p, isDark, bodyPlan, setBodyPlan }) {
  const [view, setView] = useState("top");
  const sys = `あなたはケアラボのボディメイクAIです。医療・ケア職向けの食事・運動・睡眠アドバイスをします。
シフト（日勤/夜勤/夜勤明け/公休）を聞いたら、コンビニ版と手作り版の2択で今日の食事プランを提案。
運動は自重メイン・在宅OK。短く・具体的に・絵文字を適度に使って。`;
  const { msgs, loading, send } = useChat(sys,
    `ボディメイクAIです 💪\n\n今日のシフトを教えてください。\nシフトに合わせた食事・運動プランをお届けします！`);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);
  const weekData=[65.2,65.0,64.8,64.5,64.3,64.1,63.8];

  if (view==="week") return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <button onClick={()=>setView("top")} style={{ fontSize:11,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:10,fontWeight:700 }}>← 戻る</button>
      <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}`, marginBottom:12 }}>
        <div style={{ fontSize:11, color:p.muted, marginBottom:10 }}>体重推移（kg）</div>
        <div style={{ height:80, display:"flex", alignItems:"flex-end", gap:5 }}>
          {weekData.map((v,i)=>{
            const h=((v-63)/(65.5-63))*68+4;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ fontSize:8.5, color:p.accent, fontWeight:700 }}>{v}</div>
                <div style={{ width:"100%", height:h, background:i===6?p.accent:`${p.accent}44`, borderRadius:"3px 3px 0 0" }}/>
                <div style={{ fontSize:9, color:p.muted }}>{"月火水木金土日"[i]}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:p.card, borderRadius:14, padding:12, border:`1px solid ${p.border}` }}>
        <div style={{ fontSize:11, fontWeight:700, color:p.accent, marginBottom:8 }}>今週の達成率</div>
        {[{l:"食事管理",r:85,c:"#50B0A0"},{l:"運動",r:71,c:p.accent},{l:"就寝時間",r:57,c:"#E06090"}].map((r,i)=>(
          <div key={i} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontSize:11.5, color:p.text }}>{r.l}</span>
              <span style={{ fontSize:11.5, fontWeight:700, color:r.c }}>{r.r}%</span>
            </div>
            <div style={{ background:p.border, borderRadius:3, height:6, overflow:"hidden" }}>
              <div style={{ width:`${r.r}%`, height:"100%", background:r.c, borderRadius:3 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (view==="chat") return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 4px" }}>
        <button onClick={()=>setView("top")} style={{ fontSize:11,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:8,fontWeight:700 }}>← 戻る</button>
        {msgs.map((m,i)=><Bubble key={i} from={m.from} text={m.text} p={p} av="💪"/>)}
        {loading && <Bubble from="bot" p={p} av="💪" loading/>}
        <div ref={endRef}/>
        {!loading && msgs[msgs.length-1]?.from==="bot" && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {["夜勤です","日勤です","夜勤明けです","公休です"].map(q=>(
              <Chip key={q} label={q} p={p} onClick={()=>send(q)}/>
            ))}
          </div>
        )}
      </div>
      <ChatInput p={p} onSend={send} placeholder="シフトを教えてください…"/>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ background:isDark?"#241A30":"#FDF0F5", borderRadius:14, padding:12,
        border:`1px solid ${p.border}`, marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:p.accent, marginBottom:6 }}>
          ボディメイクとは？
        </div>
        <div style={{ fontSize:11.5, color:p.text, lineHeight:1.7, marginBottom:10 }}>
          食事・睡眠・運動をサポートし、体質改善のお手伝いをします。
          ONにすると今日のレシピも自動でプランに合わせた内容になります。
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[
            {key:"muscle",label:"💪 筋トレ",desc:"あなたに合ったトレーニングメニューを提案",c:"#4A5A9A"},
            {key:"reset",label:"🌿 体質改善",desc:"食事×運動×睡眠を整えて体質から変える",c:p.accent},
          ].map(pr=>(
            <button key={pr.key} onClick={()=>setBodyPlan&&setBodyPlan(bodyPlan===pr.key?null:pr.key)}
              style={{ flex:1, padding:"8px 6px", borderRadius:12,
                border:`1.5px solid ${bodyPlan===pr.key?pr.c:p.border}`,
                cursor:"pointer", background:bodyPlan===pr.key?`${pr.c}20`:p.card, textAlign:"center" }}>
              <div style={{ fontSize:11.5,fontWeight:700,color:bodyPlan===pr.key?pr.c:p.text,marginBottom:2 }}>{pr.label}</div>
              <div style={{ fontSize:9.5,color:p.muted,marginBottom:6 }}>{pr.desc}</div>
              <div style={{ fontSize:10,fontWeight:700,color:bodyPlan===pr.key?"#fff":p.muted,
                background:bodyPlan===pr.key?pr.c:p.card2,borderRadius:10,padding:"2px 0" }}>
                {bodyPlan===pr.key?"ON ✓":"OFF"}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:isDark?"linear-gradient(135deg,#241A30,#161018)":"linear-gradient(135deg,#FDF0F5,#FFF3E6)",
        borderRadius:16, padding:14, marginBottom:12, border:`1px solid ${p.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:9.5, color:p.muted }}>BODY RESET</div>
            <div style={{ fontSize:16, fontWeight:900, color:p.text }}>Day 12 <span style={{ fontSize:11,fontWeight:400,color:p.muted }}>/90</span></div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9.5, color:p.muted }}>開始から</div>
            <div style={{ fontSize:18, fontWeight:900, color:p.accent }}>-1.4<span style={{ fontSize:11 }}>kg</span></div>
          </div>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {["月","火","水","木","金","土","日"].map((d,i)=>(
            <div key={i} style={{ flex:1, textAlign:"center" }}>
              <div style={{ aspectRatio:"1", borderRadius:8,
                background:i<3?p.accent:isDark?"#2A222E":"#FDF0F5",
                border:`1.5px solid ${i<3?p.accent:p.border}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, color:i<3?p.accentFg:p.muted }}>
                {i<3?"✓":""}
              </div>
              <div style={{ fontSize:8.5, color:p.muted, marginTop:2 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
        {[
          {icon:"💪",title:"筋トレプログラム",sub:"自重メイン・在宅OK",key:"chat",planKey:"muscle",c:"#4A5A9A"},
          {icon:"🌿",title:"体質改善プログラム",sub:"食事×運動×睡眠を90日で",key:"chat",planKey:"reset",c:p.accent},
        ].map((pr,i)=>(
          <div key={i} onClick={()=>{ setBodyPlan && setBodyPlan(pr.planKey); setView(pr.key); }}
            style={{ background:p.card, border:`1.5px solid ${bodyPlan===pr.planKey?pr.c:p.border}`,
              borderRadius:14, padding:"10px 14px", display:"flex", gap:10,
              alignItems:"center", cursor:"pointer" }}>
            <span style={{ fontSize:24 }}>{pr.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:p.text }}>{pr.title}</div>
              <div style={{ fontSize:10.5, color:p.muted, marginTop:2 }}>{pr.sub}</div>
            </div>
            {bodyPlan===pr.planKey && (
              <div style={{ fontSize:9.5, color:pr.c, background:`${pr.c}20`,
                borderRadius:10, padding:"2px 8px", fontWeight:700 }}>実施中</div>
            )}
            <div style={{ color:p.muted, fontSize:18 }}>›</div>
          </div>
        ))}
      </div>
      <button onClick={()=>setView("week")}
        style={{ width:"100%", background:isDark?"#2A222E":"#FFF3E6",
          border:`1px solid ${p.border}`, borderRadius:14, padding:"10px 14px",
          display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <span style={{ fontSize:12.5, color:p.text, fontWeight:600 }}>📊 週間記録・体重グラフ</span>
        <span style={{ color:p.muted, fontSize:18 }}>›</span>
      </button>
    </div>
  );
}

// ムーンログ
function MoonScreen({ p }) {
  const [lastPeriod, setLastPeriod] = useState("2026-06-14");
  const [cycleLen, setCycleLen] = useState(28);
  const [showInput, setShowInput] = useState(false);
  const [tempDate, setTempDate] = useState(lastPeriod);
  const last = new Date(lastPeriod);
  const today = new Date("2026-07-02");
  const daysSince = Math.floor((today - last) / 86400000);
  const phase = daysSince <= 5 ? "生理期" : daysSince <= 13 ? "卵胞期" : daysSince <= 16 ? "排卵期" : "黄体期";
  const nextPeriod = new Date(last.getTime() + cycleLen * 86400000);
  const ovulation = new Date(last.getTime() + (cycleLen - 14) * 86400000);
  const fmt = (d) => `${d.getMonth()+1}月${d.getDate()}日`;
  const phases=[{n:"生理期",c:"#E05060"},{n:"卵胞期",c:"#E08030"},{n:"排卵期",c:"#30A060"},{n:"黄体期",c:"#8050B0"}];
  const advice = {
    "生理期":[{i:"🌡️",t:"体を温めて、無理せず休む"},{i:"💊",t:"鉄分を意識して（ほうれん草・納豆）"},{i:"🚫",t:"激しい運動は控える"},{i:"🛁",t:"ゆっくり入浴で体を温めて"}],
    "卵胞期":[{i:"💪",t:"体調が整う時期。積極的に動こう"},{i:"🥗",t:"タンパク質・ビタミンを意識して"},{i:"🏃",t:"運動の効果が出やすい時期"},{i:"✨",t:"肌の調子も良くなりやすい"}],
    "排卵期":[{i:"⚡",t:"エネルギーが高まる時期"},{i:"💧",t:"水分をこまめに摂る"},{i:"🍳",t:"亜鉛・葉酸が豊富な食事を"},{i:"😊",t:"気分が明るくなりやすい"}],
    "黄体期":[{i:"🍌",t:"マグネシウム多め（バナナ・アーモンド）"},{i:"💧",t:"水分 2L を意識して"},{i:"🧘",t:"激しい運動より軽いストレッチ"},{i:"😴",t:"いつもより30分早く就寝"}],
  };
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ fontSize:11, color:p.muted, marginBottom:10, lineHeight:1.6 }}>
        生理周期を記録して、体調・シフトに合ったアドバイスを受け取りましょう。
      </div>
      <div style={{ background:"linear-gradient(160deg,#2A0A28,#1A0818)", borderRadius:20,
        padding:16, marginBottom:12, textAlign:"center", border:"1px solid #4A1A48" }}>
        <div style={{ fontSize:10, color:"#D080B0", marginBottom:8, letterSpacing:1.5 }}>MOON LOG — Day {daysSince}</div>
        <div style={{ position:"relative", width:96, height:96, margin:"0 auto 10px",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:96, height:96, borderRadius:"50%",
            background:"conic-gradient(#E05060 0% 18%,#E08030 18% 46%,#30A060 46% 50%,#8050B0 50% 100%)",
            position:"absolute" }}/>
          <div style={{ width:68, height:68, borderRadius:"50%", background:"#1A0818",
            position:"absolute", display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontSize:15, fontWeight:900, color:"#F0D0E8" }}>D{daysSince}</div>
            <div style={{ fontSize:8.5, color:"#C090B0" }}>{phase}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
          {phases.map((ph,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:3 }}>
              <div style={{ width:7, height:7, borderRadius:2, background:ph.c }}/>
              <span style={{ fontSize:9.5, color:ph.n===phase?"#F0D0E8":"#C090B0",
                fontWeight:ph.n===phase?700:400 }}>{ph.n}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>setShowInput(v=>!v)}
          style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:16, padding:"5px 16px", fontSize:11, color:"#F0D0E8",
            cursor:"pointer", fontWeight:600 }}>
          ✏️ 生理開始日を入力
        </button>
        {showInput && (
          <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:11, color:"#D080B0" }}>最終生理開始日</span>
              <input type="date" value={tempDate} onChange={e=>setTempDate(e.target.value)}
                style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
                  borderRadius:8, padding:"4px 10px", fontSize:11, color:"#F0D0E8",
                  outline:"none" }}/>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:11, color:"#D080B0" }}>周期</span>
              <div style={{ display:"flex", gap:4 }}>
                {[25,26,27,28,29,30,32,35].map(n=>(
                  <button key={n} onClick={()=>setCycleLen(n)}
                    style={{ width:30,height:26,borderRadius:6,border:"none",cursor:"pointer",
                      background:cycleLen===n?"#D060A0":"rgba(255,255,255,0.1)",
                      color:cycleLen===n?"#fff":"#D080B0",fontSize:10,fontWeight:700 }}>{n}</button>
                ))}
              </div>
            </div>
            <button onClick={()=>{setLastPeriod(tempDate);setShowInput(false);}}
              style={{ background:"#D060A0",color:"#fff",border:"none",borderRadius:16,
                padding:"6px 20px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
              保存
            </button>
          </div>
        )}
      </div>
      <div style={{ background:"#1E0A1C", borderRadius:14, padding:12, marginBottom:10,
        border:"1px solid #4A1A48", display:"flex", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:10, color:"#A080A0", marginBottom:2 }}>次回生理予測</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#F0D0E8" }}>{fmt(nextPeriod)}</div>
        </div>
        <div>
          <div style={{ fontSize:10, color:"#A080A0", marginBottom:2 }}>排卵日予測</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#D060A0" }}>{fmt(ovulation)}</div>
        </div>
      </div>
      <div style={{ background:"#1E0A1C", borderRadius:14, padding:12, border:"1px solid #4A1A48" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#D060A0", marginBottom:8 }}>
          {phase}のからだアドバイス
        </div>
        {(advice[phase]||[]).map((a,i)=>(
          <div key={i} style={{ display:"flex", gap:8, padding:"4px 0",
            borderBottom:i<3?"1px solid #2A1228":"none", fontSize:11.5, color:"#E0B0D0" }}>
            <span>{a.i}</span><span>{a.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skill+（AIあり）
function SkillScreen({ p }) {
  const [view, setView] = useState("top");
  const [drugQ, setDrugQ] = useState("");
  const [drugRes, setDrugRes] = useState("");
  const [drugLoading, setDrugLoading] = useState(false);
  const sys = `あなたはケアラボのSkill+ AIです。医療・ケア職向けの症例問題・急変対応・薬知識・介護技術を教えます。
「問題出して」と言われたら症例を1問出題。解答には詳しい解説と現場のポイントも。短く具体的に。`;
  const { msgs, loading, send } = useChat(sys,
    `Skill+ AIです 📚\n\n「問題出して」と送ってみてください！\n症例・急変・薬・介護技術から出題します。`);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);

  const lookupDrug = async () => {
    if (!drugQ.trim()) return;
    setDrugLoading(true);
    try {
      const response = await callAI({
        system: "薬剤師・看護師向けの薬辞典AIです。薬名を聞かれたら薬効・適応・副作用・看護のポイント・転倒リスクを簡潔に答えてください。",
        messages: [{role:"user",content:`${drugQ}について教えてください`}],
        max_tokens: 500,
      });
      if (response.status === 429) throw new AIProxyLimitError("上限に達しました");
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      setDrugRes(data.content?.find(b=>b.type==="text")?.text || "");
    } catch(e) { if (!e?.isLimitError) setDrugRes("エラーが発生しました。"); }
    setDrugLoading(false);
  };

  if (view==="drug") return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <button onClick={()=>setView("top")} style={{ fontSize:11,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:10,fontWeight:700 }}>← 戻る</button>
      <div style={{ fontSize:13, fontWeight:700, color:p.text, marginBottom:12 }}>💊 薬辞典</div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <input value={drugQ} onChange={e=>setDrugQ(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&lookupDrug()}
          placeholder="薬剤名を入力 例: アムロジピン"
          style={{ flex:1, background:p.card2, border:`1px solid ${p.border}`, borderRadius:10,
            padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
        <button onClick={lookupDrug}
          style={{ background:p.accent, color:p.accentFg, border:"none", borderRadius:10,
            padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>検索</button>
      </div>
      {drugLoading && <Bubble from="bot" p={p} av="💊" loading/>}
      {drugRes && <Bubble from="bot" text={drugRes} p={p} av="💊"/>}
    </div>
  );

  if (view==="chat") return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 4px" }}>
        <button onClick={()=>setView("top")} style={{ fontSize:11,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:8,fontWeight:700 }}>← 戻る</button>
        {msgs.map((m,i)=><Bubble key={i} from={m.from} text={m.text} p={p} av="🧠"/>)}
        {loading && <Bubble from="bot" p={p} av="🧠" loading/>}
        <div ref={endRef}/>
        {!loading && msgs[msgs.length-1]?.from==="bot" && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {["問題出して","精神科の問題","急変対応を教えて","介護技術クイズ"].map(q=>(
              <Chip key={q} label={q} p={p} onClick={()=>send(q)}/>
            ))}
          </div>
        )}
      </div>
      <ChatInput p={p} onSend={send} placeholder="「問題出して」と送る…"/>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[
          {icon:"🧠",title:"AIと症例トレーニング",sub:"精神科・一般・介護 難易度選択可",key:"chat",badge:"人気",c:"#50B0A0"},
          {icon:"💊",title:"薬辞典 × 処方箋解析",sub:"薬を検索するとAIが解説",key:"drug",badge:null,c:"#5B8FD4"},
          {icon:"🚨",title:"急変シミュレーション",sub:"BLS・SBAR・ABCDE",key:"chat",badge:null,c:"#E05060"},
          {icon:"🎧",title:"聴診トレーニング",sub:"肺雑音・心音・腸蠕動音",key:"chat",badge:null,c:"#E08040"},
          {icon:"📷",title:"これなに？写真解析",sub:"器具・薬・創傷をAIが解説",key:"chat",badge:"NEW",c:"#9B6ED4"},
          {icon:"💧",title:"点滴計算ツール",sub:"滴下数を自動計算",key:"chat",badge:null,c:"#2BB5A0"},
        ].map((item,i)=>(
          <div key={i} onClick={()=>setView(item.key)}
            style={{ background:p.card, border:`1px solid ${p.border}`, borderRadius:14,
              padding:"10px 14px", display:"flex", gap:10, alignItems:"center", cursor:"pointer" }}>
            <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,
              background:`${item.c}20`,border:`1px solid ${item.c}40`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{item.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={{ fontSize:12.5, fontWeight:700, color:p.text }}>{item.title}</span>
                {item.badge && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:10,
                  background:`${item.c}30`, color:item.c, fontWeight:700 }}>{item.badge}</span>}
              </div>
              <div style={{ fontSize:10.5, color:p.muted }}>{item.sub}</div>
            </div>
            <div style={{ color:p.muted, fontSize:18 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 占い（AIあり）
function FortuneScreen({ p, isDark }) {
  const [name, setName] = useState("");
  const [bday, setBday] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const gen = async () => {
    setLoading(true);
    try {
      const response = await callAI({
        system: `あなたはケアラボの占いAIです。星占い・数秘術・四柱推命の3つを統合して、今日の運勢を読みやすい1つのメッセージにまとめます。
全体運・仕事運・健康運・対人運を★5段階で評価。ラッキーカラー・ラッキーアイテム・ラッキーフード・今日のアドバイスを含めてください。
医療・ケア職向けに「患者・利用者との関係」にも触れて。明るく前向きなトーンで。`,
        messages: [{role:"user",content:`名前：${name||"名無し"}、誕生日：${bday||"不明"}\n今日（2026年7月2日水曜日）の運勢を教えてください。`}],
        max_tokens: 600,
      });
      if (response.status === 429) throw new AIProxyLimitError("上限に達しました");
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      setResult(data.content?.find(b=>b.type==="text")?.text || "");
    } catch(e) { if (!e?.isLimitError) setResult("エラーが発生しました。"); }
    setLoading(false);
  };
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ background:isDark?"linear-gradient(135deg,#241A30,#161018)":"linear-gradient(135deg,#F8EEFF,#FDF3E7)",
        borderRadius:18, padding:14, marginBottom:12, textAlign:"center",
        border:`1px solid ${isDark?"#3A2848":"#E8D0F0"}` }}>
        <div style={{ fontSize:22, marginBottom:4 }}>🔮</div>
        <div style={{ fontSize:11, color:isDark?"#B090C0":"#9060A0", marginBottom:8 }}>
          星占い × 数秘術 × 四柱推命 — AIが統合鑑定
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="名前（任意）"
            style={{ flex:1, background:isDark?"#2A222E":"#fff", border:`1px solid ${p.border}`,
              borderRadius:10, padding:"7px 12px", fontSize:12, color:p.text, outline:"none" }}/>
          <input value={bday} onChange={e=>setBday(e.target.value)} placeholder="誕生日 例:1990/5/3"
            style={{ flex:1, background:isDark?"#2A222E":"#fff", border:`1px solid ${p.border}`,
              borderRadius:10, padding:"7px 12px", fontSize:12, color:p.text, outline:"none" }}/>
        </div>
        <button onClick={gen} disabled={loading}
          style={{ background:isDark?"#9B6ED4":"#9060A0", color:"#fff", border:"none",
            borderRadius:20, padding:"8px 24px", fontSize:12, fontWeight:700,
            cursor:"pointer", opacity:loading?0.6:1 }}>
          {loading?"鑑定中…":"今日の運勢を見る 🔮"}
        </button>
      </div>
      {loading && <Bubble from="bot" p={p} av="🔮" loading/>}
      {result && <Bubble from="bot" text={result} p={p} av="🔮"/>}
      {!result && !loading && (
        <div style={{ background:p.card, borderRadius:12, padding:12, border:`1px solid ${p.border}` }}>
          <div style={{ fontSize:10.5, color:p.muted, lineHeight:1.6 }}>
            名前と誕生日を入力してボタンを押すと、AIが3種類の占いを統合して今日の運勢をお伝えします。
          </div>
        </div>
      )}
    </div>
  );
}

// 匿名相談（AIあり・MIKATA人格＋安全フィルタ）
function MentalScreen({ p, profile, avatar }) {
  const [msgs, setMsgs] = useState([
    { from:"bot", text:`匿名相談室へようこそ 🫧\n\nここでは何でも話せます。\n${profile.name ? profile.name + "さんの" : ""}${avatar.relationship}として、寄り添います。\n\n🔒 完全匿名 — 個人情報は記録されません` }
  ]);
  const [loading, setLoading] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);

  const sys = `${personaPrompt(profile, avatar)}
あなたはケアラボの匿名相談AIです。精神科ナース監修。医療・ケア職の悩みに寄り添います。
まず相手の気持ちを受け止め、傾聴を大切に。すぐにアドバイスしない。温かく・押しつけがましくなく。
必要なら専門機関への相談も提案。完全匿名・個人情報は記録しない。`;

  const send = async (text) => {
    if (!text.trim() || loading) return;

    if (detectCrime(text)) {
      setMsgs(v => [...v, { from:"user", text }, { from:"bot", text:"それは私には答えられないよ。別の話しよ？" }]);
      return;
    }
    if (detectSexual(text)) {
      setMsgs(v => [...v, { from:"user", text }, { from:"bot", text:"それはちょっと答えられないな〜、他の話しよ？" }]);
      return;
    }

    const next = [...msgs, { from:"user", text }];
    setMsgs(next);
    setLoading(true);
    if (detectCrisis(text)) setShowCrisis(true);

    try {
      const history = next.filter(m=>m.text).map(m=>({ role: m.from==="user"?"user":"assistant", content: m.text }));
      const response = await callAI({ system: sys, messages: history, max_tokens: 500 });
      if (response.status === 429) throw new AIProxyLimitError("上限に達しました");
      if (!response.ok) throw new Error(`APIエラー (${response.status})`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.find(b=>b.type==="text")?.text || "";
      setMsgs(v=>[...v, { from:"bot", text:reply }]);
    } catch(e) {
      if (!e?.isLimitError) setMsgs(v=>[...v, { from:"bot", text:"（ごめんね、ちょっとうまく繋がらなかったみたい。もう一度送ってみて）" }]);
    }
    setLoading(false);
  };

  const pastel = {...p, bb:"#FFFFFF", ub:"#9080C0", bt:"#281828", ut:"#FFFFFF", accent:"#9080C0", border:"#E8E0F0"};

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#F4F2F8" }}>
      <div style={{ textAlign:"center", background:"#E8E0F8", padding:"5px 12px",
        fontSize:10, color:"#7060A0", flexShrink:0 }}>
        🔒 完全匿名 · 個人情報は記録されません
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 4px" }}>
        {msgs.map((m,i)=><Bubble key={i} from={m.from} text={m.text} p={pastel} av={<AvatarBadge avatar={avatar} size={20}/>}/>)}
        {loading && <Bubble from="bot" p={pastel} av={<AvatarBadge avatar={avatar} size={20}/>} loading/>}
        {showCrisis && <SafetyNotice p={p}/>}
        <div ref={endRef}/>
        {!loading && msgs[msgs.length-1]?.from==="bot" && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {["仕事がつらい","眠れない","人間関係で悩んでいる","バーンアウトかも"].map(q=>(
              <Chip key={q} label={q} p={{...p,accent:"#9080C0",border:"#D0C8F0"}} onClick={()=>send(q)}/>
            ))}
          </div>
        )}
      </div>
      <ChatInput p={{...p,accent:"#9080C0"}} onSend={send} placeholder="なんでも話してください…"/>
    </div>
  );
}

// 今日のレシピ（AIあり）
function RecipeScreen({ p, isDark, bodyPlan }) {
  const [sel, setSel] = useState(null);
  const [step, setStep] = useState(0);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [fridge, setFridge] = useState("");
  const [aiRecipes, setAiRecipes] = useState(null);
  const [loading, setLoading] = useState(false);

  const fallback = [
    {icon:"🥚",name:"卵とトマトの中華炒め",time:"8分",kcal:"280kcal",note:"夜勤明けの定番・血糖値UP抑制",
      ing:["卵 2個","トマト 1個","ごま油 小さじ1","塩・砂糖 少々"],
      steps:["卵を溶いて塩を混ぜる","フライパンにごま油→卵を半熟に炒め取り出す","トマトを30秒炒める","卵を戻し砂糖を加えてサッと混ぜる"]},
    {icon:"🍗",name:"鶏むね塩麹焼き",time:"15分",kcal:"320kcal",note:"高タンパク低脂質・ボディメイクに最適",
      ing:["鶏むね肉 150g","塩麹 大さじ1","レモン 1/4個","オリーブオイル 少々"],
      steps:["鶏肉を塩麹に漬ける（前夜でもOK）","フライパンにオイル→弱火〜中火で両面5分","レモンを絞って完成"]},
    {icon:"🥦",name:"ブロッコリー豆腐の味噌炒め",time:"10分",kcal:"210kcal",note:"免疫力UP・夜勤疲れ回復",
      ing:["ブロッコリー 100g","豆腐 半丁","味噌 小さじ2","ごま油・にんにく"],
      steps:["豆腐を水切り5分","ごま油でにんにくを炒め香りを出す","豆腐を両面焼く","ブロッコリーと味噌を加えてさっと炒める"]},
  ];

  const bodyNote = bodyPlan === "muscle"
    ? "※ 筋トレプログラム実施中。高タンパク（鶏胸肉・卵・豆腐など）・低脂質を優先したメニューを提案してください。"
    : bodyPlan === "reset"
    ? "※ 体質改善プログラム実施中。腸内環境・血糖値コントロールを意識した食事（発酵食品・低GI）を優先してください。"
    : "";

  const getAiSuggestion = async () => {
    setLoading(true);
    try {
      const response = await callAI({
        system: `あなたはケアラボのレシピAIです。医療・ケア職向けに時短・栄養バランスの良いレシピを提案します。
3つのレシピをJSON配列で返してください。各要素に：name,icon(絵文字),time,kcal,note,ing(材料配列),steps(手順配列)。
JSONのみ返答。前置き不要。`,
        messages: [{role:"user",content:`大人${adults}人・子供${kids}人。冷蔵庫の食材：${fridge||"なんでもOK"}。夜勤明けでも作れる時短レシピを提案してください。${bodyNote}`}],
        max_tokens: 800,
      });
      if (response.status === 429) throw new AIProxyLimitError("上限に達しました");
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.find(b=>b.type==="text")?.text || "";
      const clean = text.replace(/```json|```/g,"").trim();
      setAiRecipes(JSON.parse(clean));
    } catch(e) { setAiRecipes(null); }
    setLoading(false);
  };

  const recipes = aiRecipes || fallback;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      {sel===null ? (
        <>
          {bodyPlan && (
            <div style={{ background:bodyPlan==="muscle"?"#241A30":"#1A2A1A",
              borderRadius:12, padding:"8px 12px", marginBottom:10,
              border:`1px solid ${bodyPlan==="muscle"?"#4A5A9A":"#3A7A4A"}`,
              display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>{bodyPlan==="muscle"?"💪":"🌿"}</span>
              <div style={{ fontSize:11, color:p.text, lineHeight:1.5 }}>
                <span style={{ fontWeight:700, color:bodyPlan==="muscle"?"#5B8FD4":p.accent }}>
                  {bodyPlan==="muscle"?"筋トレプログラム":"体質改善プログラム"}実施中
                </span>
                <br/>
                {bodyPlan==="muscle"?"高タンパク・低脂質メニューを優先提案します":"低GI・腸内環境メニューを優先提案します"}
              </div>
            </div>
          )}
          <div style={{ background:p.card, borderRadius:14, padding:12,
            border:`1px solid ${p.border}`, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:p.accent, marginBottom:8 }}>設定</div>
            <div style={{ display:"flex", gap:10, marginBottom:8, alignItems:"center" }}>
              <span style={{ fontSize:11.5, color:p.text, width:36 }}>大人</span>
              <div style={{ display:"flex", gap:4 }}>
                {[1,2,3,4].map(n=>(
                  <button key={n} onClick={()=>setAdults(n)}
                    style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",
                      background:adults===n?p.accent:p.card2,
                      color:adults===n?p.accentFg:p.muted,fontSize:12,fontWeight:700 }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
              <span style={{ fontSize:11.5, color:p.text, width:36 }}>子供</span>
              <div style={{ display:"flex", gap:4 }}>
                {[0,1,2,3].map(n=>(
                  <button key={n} onClick={()=>setKids(n)}
                    style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",
                      background:kids===n?p.accent:p.card2,
                      color:kids===n?p.accentFg:p.muted,fontSize:12,fontWeight:700 }}>{n}</button>
                ))}
              </div>
            </div>
            <input value={fridge} onChange={e=>setFridge(e.target.value)}
              placeholder="冷蔵庫の食材（例: 卵・豆腐・鶏肉）"
              style={{ width:"100%", background:p.card2, border:`1px solid ${p.border}`,
                borderRadius:10, padding:"7px 12px", fontSize:12, color:p.text,
                outline:"none", marginBottom:8 }}/>
            <button onClick={getAiSuggestion} disabled={loading}
              style={{ width:"100%", background:p.accent, color:p.accentFg, border:"none",
                borderRadius:20, padding:"8px 0", fontSize:12, fontWeight:700,
                cursor:"pointer", opacity:loading?0.6:1 }}>
              {loading?"提案中…":"AIにレシピを提案してもらう 🍳"}
            </button>
          </div>
          {loading && <Bubble from="bot" p={p} av="🍳" loading/>}
          {recipes.map((r,i)=>(
            <div key={i} onClick={()=>{setSel(i);setStep(0);}}
              style={{ background:p.card, border:`1px solid ${p.border}`, borderRadius:14,
                padding:"10px 12px", marginBottom:8, cursor:"pointer" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:26 }}>{r.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:p.text }}>{r.name}</div>
                  <div style={{ display:"flex", gap:10, marginTop:3 }}>
                    <span style={{ fontSize:10, color:p.muted }}>⏱ {r.time}</span>
                    <span style={{ fontSize:10, color:p.muted }}>🔥 {r.kcal}</span>
                  </div>
                  <div style={{ fontSize:10, color:p.accent, marginTop:2 }}>{r.note}</div>
                </div>
                <div style={{ color:p.muted }}>›</div>
              </div>
            </div>
          ))}
        </>
      ):(
        <>
          <button onClick={()=>setSel(null)} style={{ fontSize:11,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:10,fontWeight:700 }}>← レシピ一覧</button>
          <div style={{ fontSize:13, fontWeight:700, color:p.text, marginBottom:4 }}>
            {recipes[sel].icon} {recipes[sel].name}
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <Chip label="必要な食材" p={p} on={step===0} onClick={()=>setStep(0)}/>
            <Chip label="作り方" p={p} on={step===1} onClick={()=>setStep(1)}/>
          </div>
          {step===0 ? (
            <div style={{ background:p.card, borderRadius:14, padding:12, border:`1px solid ${p.border}`, marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:p.accent, marginBottom:8 }}>🛒 買い物リスト</div>
              {(recipes[sel].ing||[]).map((ing,i)=>(
                <div key={i} style={{ fontSize:12, color:p.text, padding:"5px 0",
                  borderBottom:i<recipes[sel].ing.length-1?`1px solid ${p.border}`:"none" }}>・{ing}</div>
              ))}
              <div style={{ display:"flex", gap:6, marginTop:10 }}>
                <span onClick={()=>setStep(1)} style={{ background:p.accent,color:p.accentFg,
                  borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                  作り方を見る →
                </span>
                <span style={{ border:`1px solid ${p.border}`,color:p.muted,
                  borderRadius:20,padding:"6px 14px",fontSize:11,cursor:"pointer" }}>
                  TODOに追加 ✅
                </span>
              </div>
            </div>
          ):(
            <div style={{ background:p.card, borderRadius:14, padding:12, border:`1px solid ${p.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:p.accent, marginBottom:8 }}>👨‍🍳 作り方</div>
              {(recipes[sel].steps||[]).map((s,i)=>(
                <div key={i} style={{ display:"flex", gap:10, padding:"5px 0",
                  borderBottom:i<recipes[sel].steps.length-1?`1px solid ${p.border}`:"none" }}>
                  <div style={{ width:20,height:20,borderRadius:"50%",flexShrink:0,
                    background:`${p.accent}22`,border:`1px solid ${p.accent}44`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:10,fontWeight:700,color:p.accent }}>{i+1}</div>
                  <div style={{ fontSize:11.5, color:p.text, lineHeight:1.5 }}>{s}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// TODO
function TodoScreen({ p }) {
  const [todos, setTodos] = useState([
    {done:true,text:"バイタル測定 × 3名",tag:"仕事",tc:"#4A8A6A"},
    {done:true,text:"申し送り記録",tag:"仕事",tc:"#4A8A6A"},
    {done:false,text:"卵・豆乳・バナナを買う",tag:"食材",tc:"#C09040"},
    {done:false,text:"体幹トレーニング 15分",tag:"運動",tc:"#4A5A9A"},
    {done:false,text:"23時就寝",tag:"睡眠",tc:"#7A4A9A"},
  ]);
  const [input,setInput]=useState("");
  const done = todos.filter(t=>t.done).length;
  const toggle = (i) => {const n=[...todos];n[i]={...n[i],done:!n[i].done};setTodos(n);};
  const add = () => {
    if(!input.trim())return;
    setTodos(v=>[...v,{done:false,text:input.trim(),tag:"その他",tc:p.muted}]);
    setInput("");
  };
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:p.text }}>今日のTODO</div>
        <div style={{ fontSize:11, color:p.muted }}>{done}/{todos.length} 完了</div>
      </div>
      <div style={{ background:p.border, borderRadius:4, height:6, marginBottom:12, overflow:"hidden" }}>
        <div style={{ width:`${done/todos.length*100}%`, height:"100%",
          background:p.accent, borderRadius:4, transition:"width 0.3s" }}/>
      </div>
      {todos.map((t,i)=>(
        <div key={i} onClick={()=>toggle(i)}
          style={{ background:p.card, borderRadius:12, padding:"10px 12px", marginBottom:6,
            border:`1px solid ${t.done?p.accent:p.border}`,
            display:"flex", alignItems:"center", gap:10, cursor:"pointer",
            opacity:t.done?0.55:1 }}>
          <div style={{ width:20,height:20,borderRadius:6,flexShrink:0,
            background:t.done?p.accent:"transparent",border:`2px solid ${t.done?p.accent:p.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            color:p.accentFg,fontSize:12 }}>{t.done?"✓":""}</div>
          <div style={{ flex:1,fontSize:12,color:p.text,textDecoration:t.done?"line-through":"none" }}>{t.text}</div>
          <div style={{ fontSize:9.5,padding:"2px 8px",borderRadius:10,
            background:`${t.tc}22`,color:t.tc,fontWeight:600 }}>{t.tag}</div>
        </div>
      ))}
      <div style={{ display:"flex", gap:6, marginTop:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()}
          placeholder="新しいTODOを追加…"
          style={{ flex:1, background:p.card, border:`1px solid ${p.border}`, borderRadius:12,
            padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
        <button onClick={add}
          style={{ background:p.accent, color:p.accentFg, border:"none", borderRadius:12,
            padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>追加</button>
      </div>
    </div>
  );
}

// 家計簿
function KakeiboScreen({ p, isDark }) {
  const [view, setView] = useState("graph");
  const [records, setRecords] = useState([
    {l:"食費",v:28400,b:30000,c:"#E08040"},
    {l:"家賃",v:65000,b:65000,c:"#4080C0"},
    {l:"光熱費",v:12000,b:12000,c:"#50A080"},
    {l:"通信費",v:8000,b:8000,c:"#9060C0"},
    {l:"外食",v:12600,b:15000,c:"#C05060"},
    {l:"医療",v:6100,b:5000,c:"#E05060"},
  ]);
  const [newItem, setNewItem] = useState({label:"",amount:"",category:"食費"});
  const [history, setHistory] = useState([
    {date:"07/02",label:"スーパー",cat:"食費",amount:3240,c:"#E08040"},
    {date:"07/01",label:"薬局",cat:"医療",amount:1080,c:"#E05060"},
    {date:"07/01",label:"コンビニ",cat:"外食",amount:680,c:"#C05060"},
    {date:"06/30",label:"電気代",cat:"光熱費",amount:7200,c:"#50A080"},
  ]);
  const total = records.reduce((s,c)=>s+c.v,0);
  const CATS = ["食費","家賃","光熱費","通信費","外食","医療","交通","その他"];
  const CAT_COLOR = {"食費":"#E08040","家賃":"#4080C0","光熱費":"#50A080","通信費":"#9060C0","外食":"#C05060","医療":"#E05060","交通":"#A09040","その他":"#606080"};

  const addRecord = () => {
    if(!newItem.label||!newItem.amount) return;
    const amt = parseInt(newItem.amount.replace(/,/g,""));
    if(isNaN(amt)) return;
    const c = CAT_COLOR[newItem.category]||"#606080";
    setHistory(v=>[{date:`${new Date().getMonth()+1}/${new Date().getDate()}`,
      label:newItem.label,cat:newItem.category,amount:amt,c},...v]);
    setRecords(v=>v.map(r=>r.l===newItem.category?{...r,v:r.v+amt}:r));
    setNewItem({label:"",amount:"",category:newItem.category});
  };

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ fontSize:11, color:p.muted, marginBottom:10, lineHeight:1.6 }}>
        支出を記録して家計を見える化。レシート写真 or 手動で入力できます。
      </div>
      <div style={{ display:"flex", gap:5, marginBottom:12, overflowX:"auto" }}>
        {[["graph","📊 グラフ"],["input","✏️ 入力"],["history","📋 履歴"],["setting","⚙️ 設定"],["todo","🔔 支払いTODO"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{ flexShrink:0, padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer",
              background:view===v?p.accent:p.card2, color:view===v?p.accentFg:p.muted,
              fontSize:10, fontWeight:view===v?700:400 }}>{l}</button>
        ))}
      </div>
      {view==="graph" && (
        <>
          <div style={{ background:p.card, borderRadius:14, padding:14,
            border:`1px solid ${p.border}`, marginBottom:10 }}>
            <div style={{ fontSize:11, color:p.muted, marginBottom:10 }}>7月の支出内訳</div>
            <div style={{ display:"flex", gap:14, alignItems:"center" }}>
              <Pie data={records.map(c=>({v:c.v,color:c.c}))}/>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
                {records.map((c,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:c.c }}/>
                      <span style={{ fontSize:10.5, color:p.muted }}>{c.l}</span>
                    </div>
                    <span style={{ fontSize:10.5, color:p.text, fontWeight:600 }}>
                      {Math.round(c.v/total*100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${p.border}`,
              display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:p.muted }}>7月 合計支出</span>
              <span style={{ fontSize:14, fontWeight:900, color:p.accent }}>¥{total.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ background:isDark?"#1A2A18":"#F0FFF8", borderRadius:12,
            padding:"10px 12px", border:`1px solid ${isDark?"#2A4A28":"#C0E8D0"}`,
            fontSize:11.5, color:p.text, lineHeight:1.7 }}>
            💡 医療費が予算を¥1,100超過。外食を週1回減らすと来月¥3,000節約できます。
          </div>
        </>
      )}
      {view==="input" && (
        <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:p.accent, marginBottom:12 }}>✏️ 支出を手動入力</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:p.muted, marginBottom:4 }}>カテゴリ</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {CATS.map(cat=>(
                <button key={cat} onClick={()=>setNewItem(v=>({...v,category:cat}))}
                  style={{ padding:"5px 12px", borderRadius:16, border:"none", cursor:"pointer",
                    fontSize:11, fontWeight:newItem.category===cat?700:400,
                    background:newItem.category===cat?p.accent:p.card2,
                    color:newItem.category===cat?p.accentFg:p.muted }}>{cat}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:p.muted, marginBottom:4 }}>内容</div>
            <input value={newItem.label} onChange={e=>setNewItem(v=>({...v,label:e.target.value}))}
              placeholder="例: スーパー、コンビニ、電気代"
              style={{ width:"100%", background:p.card2, border:`1px solid ${p.border}`,
                borderRadius:10, padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:p.muted, marginBottom:4 }}>金額（円）</div>
            <input value={newItem.amount} onChange={e=>setNewItem(v=>({...v,amount:e.target.value}))}
              placeholder="例: 1500" inputMode="numeric"
              style={{ width:"100%", background:p.card2, border:`1px solid ${p.border}`,
                borderRadius:10, padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
          </div>
          <button onClick={addRecord}
            style={{ width:"100%", background:p.accent, color:p.accentFg, border:"none",
              borderRadius:20, padding:"10px 0", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            ＋ 記録する
          </button>
          <div style={{ marginTop:10, textAlign:"center", fontSize:11, color:p.muted }}>
            📷 レシート写真での自動入力はLINE版で対応予定
          </div>
        </div>
      )}
      {view==="history" && (
        <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:p.accent, marginBottom:10 }}>📋 支出履歴</div>
          {history.length===0 ? (
            <div style={{ textAlign:"center", color:p.muted, fontSize:12, padding:20 }}>
              まだ記録がありません。「✏️ 入力」から追加してください。
            </div>
          ) : history.map((h,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0",
              borderBottom:i<history.length-1?`1px solid ${p.border}`:"none" }}>
              <div style={{ fontSize:10, color:p.muted, width:28, flexShrink:0 }}>{h.date}</div>
              <div style={{ width:8, height:8, borderRadius:2, background:h.c, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:p.text }}>{h.label}</div>
                <div style={{ fontSize:9.5, color:h.c }}>{h.cat}</div>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:p.text }}>¥{h.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      {view==="setting" && (
        <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:p.accent, marginBottom:10 }}>⚙️ 固定費・予算の設定</div>
          {[
            {l:"月収入",v:"¥280,000",note:null},
            {l:"家賃",v:"¥65,000",note:"毎月1日"},
            {l:"光熱費",v:"¥12,000",note:"毎月27日 通知"},
            {l:"通信費",v:"¥8,000",note:"毎月5日"},
            {l:"目標貯蓄",v:"¥30,000",note:null},
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0",
              borderBottom:i<4?`1px solid ${p.border}`:"none", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, color:p.text }}>{s.l}</div>
                {s.note && <div style={{ fontSize:9.5, color:"#2BB5A0" }}>🔔 {s.note}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:12, color:p.accent, fontWeight:700 }}>{s.v}</span>
                <span style={{ fontSize:10, color:p.muted, border:`1px solid ${p.border}`,
                  borderRadius:6, padding:"2px 8px" }}>編集</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {view==="todo" && (
        <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:p.accent, marginBottom:10 }}>🔔 固定費 支払いTODO</div>
          {[
            {l:"家賃 ¥65,000",date:"8/1（月）",done:false,c:"#4080C0"},
            {l:"電気代 ¥7,200",date:"7/27（月）",done:false,c:"#50A080"},
            {l:"スマホ代 ¥8,000",date:"8/5（月）",done:false,c:"#9060C0"},
            {l:"水道代 ¥4,800",date:"7/25（土）",done:true,c:"#50A080"},
          ].map((t,i)=>(
            <div key={i} style={{ display:"flex", gap:10, padding:"7px 0",
              borderBottom:i<3?`1px solid ${p.border}`:"none", alignItems:"center",
              opacity:t.done?0.5:1 }}>
              <div style={{ width:18,height:18,borderRadius:5,flexShrink:0,
                background:t.done?"#2BB5A0":"transparent",
                border:`2px solid ${t.done?"#2BB5A0":p.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,color:"#fff" }}>{t.done?"✓":""}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,color:p.text,textDecoration:t.done?"line-through":"none" }}>{t.l}</div>
                <div style={{ fontSize:10,color:t.c }}>支払日：{t.date}</div>
              </div>
              <div style={{ fontSize:9.5,color:"#2BB5A0",border:`1px solid #2BB5A060`,
                borderRadius:10,padding:"2px 8px" }}>通知ON</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 設定画面（新規：パスコード・APIキー・データ削除）
function SettingsScreen({ p, avatar, onBack }) {
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [premiumSaved, setPremiumSaved] = useState(() => { try { return !!localStorage.getItem("premium_tier_code"); } catch(e) { return false; } });
  const [apiUnlocked, setApiUnlocked] = useState(() => { try { return Number(localStorage.getItem("api_key_unlocked_until")||0) > Date.now(); } catch(e) { return false; } });
  const [keyInput, setKeyInput] = useState(() => { try { return localStorage.getItem("custom_api_key")||""; } catch(e) { return ""; } });
  const [keySaved, setKeySaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const verify = async () => {
    setPasscodeError(false);
    const trimmed = passcodeInput.trim();
    try {
      const res = await fetch("/api/verify_passcode", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ passcode: trimmed }),
      });
      const data = await res.json();
      if (data.valid && data.tier === "basic") {
        try { localStorage.setItem("premium_tier_code", trimmed.toUpperCase()); } catch(e) {}
        setPremiumSaved(true);
      } else if (data.valid) {
        try {
          localStorage.setItem("api_key_unlocked", "yes");
          localStorage.setItem("api_key_unlocked_until", String(Date.now() + 35*24*60*60*1000));
        } catch(e) {}
        setApiUnlocked(true);
      } else {
        setPasscodeError(true);
      }
    } catch(e) { setPasscodeError(true); }
  };

  const saveKey = () => {
    try {
      if (keyInput.trim()) localStorage.setItem("custom_api_key", keyInput.trim());
      else localStorage.removeItem("custom_api_key");
      setKeySaved(true);
      setTimeout(()=>setKeySaved(false), 2000);
    } catch(e) {}
  };

  const resetAll = () => { try { localStorage.clear(); } catch(e) {} window.location.reload(); };

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
      <button onClick={onBack} style={{ fontSize:12,color:p.accent,background:"none",border:"none",cursor:"pointer",marginBottom:14,fontWeight:700 }}>← 戻る</button>

      <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}`, marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
        <AvatarBadge avatar={avatar} size={44}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:p.text }}>相棒設定</div>
          <div style={{ fontSize:11, color:p.muted }}>関係性：{avatar.relationship} / 口調：{avatar.tone}</div>
        </div>
      </div>

      <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}`, marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:p.text, marginBottom:8 }}>パスコード入力</div>
        <div style={{ fontSize:10.5, color:p.muted, marginBottom:8, lineHeight:1.6 }}>
          決済後にお送りするパスコードを入力すると、プランが有効になります。
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input type="password" value={passcodeInput} onChange={e=>{setPasscodeInput(e.target.value);setPasscodeError(false);}}
            placeholder="パスコード"
            style={{ flex:1, background:p.card2, border:`1px solid ${passcodeError?"#C03040":p.border}`, borderRadius:10,
              padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
          <button onClick={verify} style={{ background:p.accent, color:p.accentFg, border:"none", borderRadius:10,
            padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>確認</button>
        </div>
        {passcodeError && <div style={{ fontSize:10.5, color:"#C03040", marginTop:6 }}>パスコードが違います</div>}
        {premiumSaved && <div style={{ fontSize:10.5, color:p.accent, marginTop:6 }}>✓ プチ課金プラン有効（1日15回）</div>}
      </div>

      <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}`, marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:p.text, marginBottom:8 }}>APIキー設定（本契約プラン）</div>
        {!apiUnlocked ? (
          <div style={{ fontSize:10.5, color:p.muted, lineHeight:1.6 }}>上のパスコード欄に、本契約用のコードを入力すると、ここが解除されます。</div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="sk-ant-..."
              style={{ flex:1, background:p.card2, border:`1px solid ${p.border}`, borderRadius:10,
                padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
            <button onClick={saveKey} style={{ background:p.accent, color:p.accentFg, border:"none", borderRadius:10,
              padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>{keySaved?"保存済み":"保存"}</button>
          </div>
        )}
      </div>

      <div style={{ background:p.card, borderRadius:14, padding:14, border:`1px solid ${p.border}` }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#C03040", marginBottom:8 }}>データの削除</div>
        <div style={{ fontSize:10.5, color:p.muted, marginBottom:10, lineHeight:1.6 }}>この端末に保存された全データを削除します。この操作は取り消せません。</div>
        {!confirmReset ? (
          <button onClick={()=>setConfirmReset(true)} style={{ width:"100%", padding:"10px 0", borderRadius:10, fontSize:12, fontWeight:700,
            background:"#FBEAEA", color:"#A0453F", border:"none" }}>🗑 全データを削除する</button>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setConfirmReset(false)} style={{ flex:1, padding:"10px 0", borderRadius:10, fontSize:11, fontWeight:700,
              background:p.card2, color:p.muted, border:"none" }}>キャンセル</button>
            <button onClick={resetAll} style={{ flex:1, padding:"10px 0", borderRadius:10, fontSize:11, fontWeight:700,
              background:"#A0453F", color:"#fff", border:"none" }}>削除する</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインアプリ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NAV = [
  {id:"home",     icon:"✦",    label:"ホーム",   g1D:"#2A2030",g2D:"#161018",g1L:"#4A3428",g2L:"#2A1C14"},
  {id:"calendar", icon:"📅",   label:"カレンダー",g1D:"#1A2A20",g2D:"#101810",g1L:"#2A3A20",g2L:"#141E10"},
  {id:"body",     icon:"💪",   label:"ボディ",   g1D:"#241A30",g2D:"#141018",g1L:"#4A2038",g2L:"#241018"},
  {id:"moon",     icon:"🌙",   label:"ムーン",   g1D:"#2A0A28",g2D:"#1A0818",g1L:"#3A0A28",g2L:"#200818"},
  {id:"skill",    icon:"S+",   label:"Skill+",  g1D:"#1A2A20",g2D:"#101810",g1L:"#2A3A20",g2L:"#141E10"},
  {id:"fortune",  icon:"🔮",   label:"占い",    g1D:"#241830",g2D:"#141018",g1L:"#3A2048",g2L:"#1E1028"},
  {id:"mental",   icon:"🫧",   label:"相談",    g1D:"#1E1A30",g2D:"#121018",g1L:"#2A2438",g2L:"#161418"},
  {id:"recipe",   icon:"🍳",   label:"レシピ",   g1D:"#301E14",g2D:"#181008",g1L:"#4A2818",g2L:"#241408"},
  {id:"todo",     icon:"✅",   label:"TODO",    g1D:"#182418",g2D:"#0E1410",g1L:"#243A24",g2L:"#101E10"},
  {id:"kakeibo",  icon:"💰",   label:"家計簿",   g1D:"#302014",g2D:"#181008",g1L:"#4A3018",g2L:"#241608"},
  {id:"settings", icon:"⚙️",   label:"設定",    g1D:"#20202A",g2D:"#121218",g1L:"#383848",g2L:"#1C1C28"},
];

export default function App() {
  const [onboarded, setOnboarded] = useState(() => { try { return localStorage.getItem(K_ONBOARDED) === "yes"; } catch(e) { return false; } });
  const [onboardStep, setOnboardStep] = useState(0);
  const [profile, setProfile] = useState(loadProfile);
  const [avatar, setAvatar] = useState(loadAvatar);
  const [theme, setTheme] = useState("light");
  const [tab, setTab] = useState("home");
  const [bodyPlan, setBodyPlan] = useState(null);
  const isDark = theme === "dark";
  const p = isDark ? DARK : LIGHT;
  const cur = NAV.find(n => n.id === tab);

  useEffect(() => {
    const onLimit = (e) => { import("./aiClient.js").then(({ showGlobalUpgradeModal }) => showGlobalUpgradeModal(e.detail?.message)); };
    window.addEventListener("ai-limit-reached", onLimit);
    return () => window.removeEventListener("ai-limit-reached", onLimit);
  }, []);

  if (!onboarded) {
    if (onboardStep === 0) return <OnboardWelcome onNext={()=>setOnboardStep(1)}/>;
    if (onboardStep === 1) return <OnboardProfile onComplete={(pr)=>{ setProfile(pr); try{localStorage.setItem(K_PROFILE, JSON.stringify(pr));}catch(e){} setOnboardStep(2); }}/>;
    if (onboardStep === 2) return <OnboardAvatar onComplete={(av)=>{
      setAvatar(av);
      try { localStorage.setItem(K_AVATAR, JSON.stringify(av)); localStorage.setItem(K_ONBOARDED, "yes"); } catch(e) {}
      setOnboarded(true);
    }}/>;
  }

  const renderScreen = () => {
    const shared = { p, isDark };
    if (tab==="home")     return <HomeScreen {...shared} profile={profile} avatar={avatar} onNav={setTab}/>;
    if (tab==="calendar") return <CalendarScreen {...shared}/>;
    if (tab==="body")     return <BodyScreen {...shared} bodyPlan={bodyPlan} setBodyPlan={setBodyPlan}/>;
    if (tab==="moon")     return <MoonScreen {...shared}/>;
    if (tab==="skill")    return <SkillScreen {...shared}/>;
    if (tab==="fortune")  return <FortuneScreen {...shared}/>;
    if (tab==="mental")   return <MentalScreen {...shared} profile={profile} avatar={avatar}/>;
    if (tab==="recipe")   return <RecipeScreen {...shared} bodyPlan={bodyPlan}/>;
    if (tab==="todo")     return <TodoScreen {...shared}/>;
    if (tab==="kakeibo")  return <KakeiboScreen {...shared}/>;
    if (tab==="settings") return <SettingsScreen {...shared} avatar={avatar} onBack={()=>setTab("home")}/>;
  };

  return (
    <div style={{ background:p.bg, height:"100dvh",
      fontFamily:"'Noto Sans JP',sans-serif",
      display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto", overflow:"hidden" }}>
      <style>{`
        @keyframes dl{0%,80%,100%{opacity:.25}40%{opacity:1}}
        *{box-sizing:border-box;}
        body{margin:0;background:${p.bg};}
      `}</style>

      <div style={{ background:`linear-gradient(155deg,${isDark?cur.g1D:cur.g1L},${isDark?cur.g2D:cur.g2L})`,
        padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0,
        position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:38,height:38,borderRadius:"50%",overflow:"hidden",
          background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:cur.id==="skill"?13:20,fontWeight:cur.id==="skill"?900:400,flexShrink:0,
          color:cur.id==="skill"?p.accent:"inherit" }}>
          {cur.id==="home" ? <AvatarBadge avatar={avatar} size={38}/> : cur.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:"#fff",fontWeight:700,fontSize:15 }}>ケアラボ</div>
          <div style={{ color:"rgba(255,255,255,0.65)",fontSize:11,marginTop:1 }}>{cur.label}</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <button onClick={()=>setTab("settings")}
            style={{ fontSize:16, padding:"4px 8px", borderRadius:14,
              border:"1px solid rgba(255,255,255,0.2)", cursor:"pointer",
              background:"rgba(255,255,255,0.1)", color:"#fff" }}>⚙️</button>
          {["dark","light"].map(t=>(
            <button key={t} onClick={()=>setTheme(t)}
              style={{ padding:"4px 8px", borderRadius:12,
                border:"1px solid rgba(255,255,255,0.2)", cursor:"pointer",
                fontSize:10, fontWeight:theme===t?700:400,
                background:theme===t?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.05)",
                color:"#fff" }}>
              {t==="dark"?"🌙":"🌸"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {renderScreen()}
      </div>

      {tab !== "home" && (
        <div style={{ background:p.card, borderTop:`1px solid ${p.border}`,
          padding:"10px 16px", display:"flex", alignItems:"center",
          justifyContent:"space-between", flexShrink:0,
          position:"sticky", bottom:0, zIndex:100 }}>
          <button onClick={()=>setTab("home")}
            style={{ display:"flex", alignItems:"center", gap:6,
              background:"none", border:"none", cursor:"pointer",
              color:p.accent, fontSize:13, fontWeight:700 }}>
            ← ホームに戻る
          </button>
          <div style={{ fontSize:10, color:p.muted }}>{cur.label}</div>
        </div>
      )}
    </div>
  );
}
