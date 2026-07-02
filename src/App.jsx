import { useState, useEffect, useRef } from "react";

// ━━━ CARE LABO v5 — Full Demo with AI ━━━━━━━━━━━━━━

const DARK = {
  bg:"#0D0D12",card:"#14141F",card2:"#1C1C2C",border:"#252538",
  accent:"#C8A84A",accentFg:"#000",text:"#F0EDE8",muted:"#585875",
  green:"#06C755",bb:"#1C1C2C",ub:"#C8A84A",bt:"#F0EDE8",ut:"#0D0D12",
  hdr1:"#1A2030",hdr2:"#0D1218",
};
const LIGHT = {
  bg:"#FEF6F8",card:"#FFFFFF",card2:"#FFF0F5",border:"#F0DEE8",
  accent:"#E06090",accentFg:"#fff",text:"#281828",muted:"#C0A0B8",
  green:"#06C755",bb:"#FFFFFF",ub:"#E06090",bt:"#281828",ut:"#FFFFFF",
  hdr1:"#3A1A38",hdr2:"#1A0818",
};

// ─── AI呼び出し ──────────────────────────────────────
async function callAI(apiKey, system, messages, maxTokens=600) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "";
}

// ─── 共通部品 ─────────────────────────────────────────
function Bubble({ from, text, p, av = "✦", loading }) {
  const isB = from === "bot";
  return (
    <div style={{ display:"flex", justifyContent:isB?"flex-start":"flex-end", gap:6, marginBottom:10 }}>
      {isB && (
        <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,alignSelf:"flex-end",
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

// ─── AIチャット汎用フック ─────────────────────────────
function useChat(system, apiKey, initMsg) {
  const [msgs, setMsgs] = useState([{ from:"bot", text:initMsg }]);
  const [loading, setLoading] = useState(false);
  const send = async (text) => {
    if (!text.trim() || !apiKey) return;
    const next = [...msgs, { from:"user", text }];
    setMsgs(next);
    setLoading(true);
    try {
      const history = next.filter(m=>m.text).map(m=>({
        role: m.from==="user"?"user":"assistant", content: m.text
      }));
      const reply = await callAI(apiKey, system, history);
      setMsgs(v=>[...v, { from:"bot", text:reply }]);
    } catch(e) {
      setMsgs(v=>[...v, { from:"bot", text:"エラーが発生しました。APIキーを確認してください。" }]);
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
      <input value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}}
        placeholder={placeholder}
        style={{ flex:1,background:p.bg,border:`1px solid ${p.border}`,borderRadius:18,
          padding:"6px 14px",fontSize:12,color:p.text,outline:"none" }}/>
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
      background:isDark?"#18182A":"#FFF0FA", flexShrink:0 }}>
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
        return <path key={i} d={path} fill={d.color} stroke="#0D0D12" strokeWidth={1.5}/>;
      })}
      <circle cx={cx} cy={cy} r={r*0.52} fill="#14141F"/>
    </svg>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 各画面コンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ① ホーム
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

function HomeScreen({ p, isDark, apiKey, onNav }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(HOME_MENU);
  const [drag, setDrag] = useState(null);
  const sys = `あなたはケアラボのAI秘書です。医療・ケア職をサポートします。シフト表が来たらカレンダー登録用に整理。短く・絵文字を適度に使って親しみやすく。`;
  const { msgs, loading, send } = useChat(sys, apiKey,
    `こんにちは！ケアラボのAI秘書です 🤍\n\nシフト表・レシート・冷蔵庫の写真など\nなんでも送ってください。`);
  const swap = (a,b) => { const m=[...menu]; [m[a],m[b]]=[m[b],m[a]]; setMenu(m); };
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      <Trend p={p} isDark={isDark}/>
      {/* 天気 */}
      <div style={{ background:isDark?"#181828":"#FFF0F8", padding:"9px 14px",
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
      {/* チャット */}
      <div style={{ padding:"10px 10px 4px" }}>
        {msgs.map((m,i) => <Bubble key={i} from={m.from} text={m.text} p={p}/>)}
        {loading && <Bubble from="bot" p={p} loading/>}
        <div ref={endRef}/>
        {!loading && msgs[msgs.length-1]?.from==="bot" && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", margin:"4px 0 6px" }}>
            {["シフト表を確認して","今日のレシピ提案して","運勢教えて"].map(q=>(
              <Chip key={q} label={q} p={p} onClick={()=>send(q)}/>
            ))}
          </div>
        )}
      </div>
      {/* グリッドメニュー */}
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
                background:isDark?"#1C1C2C":"#FFF0F8", border:`1px solid ${editing?p.accent:p.border}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:m.txt?11:22, fontWeight:m.txt?900:400, color:m.txt?p.accent:undefined }}>
                {m.icon}
              </div>
              <div style={{ fontSize:9.5, color:p.text, fontWeight:600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      <ChatInput p={p} onSend={send} placeholder="AIに話しかける…"/>
    </div>
  );
}

// ② カレンダー（予定手動追加付き）
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

        {/* 予定追加フォーム */}
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

// ③ ボディメイク（AIあり）
function BodyScreen({ p, isDark, apiKey, bodyPlan, setBodyPlan }) {
  const [view, setView] = useState("top");
  const sys = `あなたはケアラボのボディメイクAIです。医療・ケア職向けの食事・運動・睡眠アドバイスをします。
シフト（日勤/夜勤/夜勤明け/公休）を聞いたら、コンビニ版と手作り版の2択で今日の食事プランを提案。
運動は自重メイン・在宅OK。短く・具体的に・絵文字を適度に使って。`;
  const { msgs, loading, send } = useChat(sys, apiKey,
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
      {/* 説明＋ON/OFF */}
      <div style={{ background:isDark?"#1A1230":"#F8F0FF", borderRadius:14, padding:12,
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
      <div style={{ background:isDark?"linear-gradient(135deg,#1A1230,#0D0D18)":"linear-gradient(135deg,#F8F0FF,#FFF0F8)",
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
                background:i<3?p.accent:isDark?"#1C1C2C":"#F0E8FF",
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
        style={{ width:"100%", background:isDark?"#1C1C2C":"#FFF0F8",
          border:`1px solid ${p.border}`, borderRadius:14, padding:"10px 14px",
          display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <span style={{ fontSize:12.5, color:p.text, fontWeight:600 }}>📊 週間記録・体重グラフ</span>
        <span style={{ color:p.muted, fontSize:18 }}>›</span>
      </button>
    </div>
  );
}

// ④ ムーンログ（手動入力付き）
function MoonScreen({ p }) {
  const [lastPeriod, setLastPeriod] = useState("2026-06-14");
  const [cycleLen, setCycleLen] = useState(28);
  const [showInput, setShowInput] = useState(false);
  const [tempDate, setTempDate] = useState(lastPeriod);

  // 計算
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
      {/* 説明 */}
      <div style={{ fontSize:11, color:p.muted, marginBottom:10, lineHeight:1.6 }}>
        生理周期を記録して、体調・シフトに合ったアドバイスを受け取りましょう。
      </div>

      {/* サイクルビジュアル */}
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

        {/* 手動入力ボタン */}
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

      {/* 予測 */}
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

      {/* アドバイス */}
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

// ⑤ Skill+（AIあり）
function SkillScreen({ p, apiKey }) {
  const [view, setView] = useState("top");
  const [drugQ, setDrugQ] = useState("");
  const [drugRes, setDrugRes] = useState("");
  const [drugLoading, setDrugLoading] = useState(false);
  const sys = `あなたはケアラボのSkill+ AIです。医療・ケア職向けの症例問題・急変対応・薬知識・介護技術を教えます。
「問題出して」と言われたら症例を1問出題。解答には詳しい解説と現場のポイントも。短く具体的に。`;
  const { msgs, loading, send } = useChat(sys, apiKey,
    `Skill+ AIです 📚\n\n「問題出して」と送ってみてください！\n症例・急変・薬・介護技術から出題します。`);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);

  const lookupDrug = async () => {
    if (!drugQ.trim() || !apiKey) return;
    setDrugLoading(true);
    try {
      const reply = await callAI(apiKey,
        "薬剤師・看護師向けの薬辞典AIです。薬名を聞かれたら薬効・適応・副作用・看護のポイント・転倒リスクを簡潔に答えてください。",
        [{role:"user",content:`${drugQ}について教えてください`}]);
      setDrugRes(reply);
    } catch(e) { setDrugRes("エラーが発生しました。"); }
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

// ⑥ 占い（AIあり）
function FortuneScreen({ p, isDark, apiKey }) {
  const [name, setName] = useState("");
  const [bday, setBday] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const gen = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const reply = await callAI(apiKey,
        `あなたはケアラボの占いAIです。星占い・数秘術・四柱推命の3つを統合して、今日の運勢を読みやすい1つのメッセージにまとめます。
全体運・仕事運・健康運・対人運を★5段階で評価。ラッキーカラー・ラッキーアイテム・ラッキーフード・今日のアドバイスを含めてください。
医療・ケア職向けに「患者・利用者との関係」にも触れて。明るく前向きなトーンで。`,
        [{role:"user",content:`名前：${name||"名無し"}、誕生日：${bday||"不明"}\n今日（2026年7月2日水曜日）の運勢を教えてください。`}],
        600);
      setResult(reply);
    } catch(e) { setResult("エラーが発生しました。"); }
    setLoading(false);
  };
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
      <div style={{ background:isDark?"linear-gradient(135deg,#14102A,#0A0A1A)":"linear-gradient(135deg,#F0E8FF,#F8F0FF)",
        borderRadius:18, padding:14, marginBottom:12, textAlign:"center",
        border:`1px solid ${isDark?"#302050":"#D0B0F0"}` }}>
        <div style={{ fontSize:22, marginBottom:4 }}>🔮</div>
        <div style={{ fontSize:11, color:isDark?"#9070B0":"#8050A0", marginBottom:8 }}>
          星占い × 数秘術 × 四柱推命 — AIが統合鑑定
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="名前（任意）"
            style={{ flex:1, background:isDark?"#1C1C2C":"#fff", border:`1px solid ${p.border}`,
              borderRadius:10, padding:"7px 12px", fontSize:12, color:p.text, outline:"none" }}/>
          <input value={bday} onChange={e=>setBday(e.target.value)} placeholder="誕生日 例:1990/5/3"
            style={{ flex:1, background:isDark?"#1C1C2C":"#fff", border:`1px solid ${p.border}`,
              borderRadius:10, padding:"7px 12px", fontSize:12, color:p.text, outline:"none" }}/>
        </div>
        <button onClick={gen} disabled={loading}
          style={{ background:isDark?"#9B6ED4":"#8050A0", color:"#fff", border:"none",
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

// ⑦ 匿名相談（AIあり）
function MentalScreen({ p, apiKey }) {
  const sys = `あなたはケアラボの匿名相談AIです。精神科ナース監修。医療・ケア職の悩みに寄り添います。
まず相手の気持ちを受け止め、傾聴を大切に。すぐにアドバイスしない。温かく・押しつけがましくなく。
必要なら専門機関への相談も提案。完全匿名・個人情報は記録しない。`;
  const { msgs, loading, send } = useChat(sys, apiKey,
    `匿名相談室へようこそ 🫧\n\nここでは何でも話せます。\n精神科ナース監修のAIが寄り添います。\n\n🔒 完全匿名 — 個人情報は記録されません`);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#F4F2F8" }}>
      <div style={{ textAlign:"center", background:"#E8E0F8", padding:"5px 12px",
        fontSize:10, color:"#7060A0", flexShrink:0 }}>
        🔒 完全匿名 · 個人情報は記録されません
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 4px" }}>
        {msgs.map((m,i)=><Bubble key={i} from={m.from} text={m.text}
          p={{...p,bb:"#FFFFFF",ub:"#9080C0",bt:"#281828",ut:"#FFFFFF",accent:"#9080C0",border:"#E8E0F0"}} av="🫧"/>)}
        {loading && <Bubble from="bot" p={p} av="🫧" loading/>}
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

// ⑧ 今日のレシピ（AIあり）
function RecipeScreen({ p, isDark, apiKey, bodyPlan }) {
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
    if (!apiKey) return;
    setLoading(true);
    try {
      const reply = await callAI(apiKey,
        `あなたはケアラボのレシピAIです。医療・ケア職向けに時短・栄養バランスの良いレシピを提案します。
3つのレシピをJSON配列で返してください。各要素に：name,icon(絵文字),time,kcal,note,ing(材料配列),steps(手順配列)。
JSONのみ返答。前置き不要。`,
        [{role:"user",content:`大人${adults}人・子供${kids}人。冷蔵庫の食材：${fridge||"なんでもOK"}。夜勤明けでも作れる時短レシピを提案してください。${bodyNote}`}],
        800);
      const clean = reply.replace(/```json|```/g,"").trim();
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
            <div style={{ background:bodyPlan==="muscle"?"#1A1A2E":"#1A2A1A",
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

// ⑨ TODO
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

// ⑩ 家計簿（円グラフ＋手動入力）
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
      {/* 説明 */}
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
          <div style={{ background:isDark?"#0A2A18":"#F0FFF8", borderRadius:12,
            padding:"10px 12px", border:`1px solid ${isDark?"#1A4A28":"#C0E8D0"}`,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインアプリ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NAV = [
  {id:"home",     icon:"✦",    label:"ホーム",   g1D:"#1A2030",g2D:"#0D1218",g1L:"#3A1A38",g2L:"#1A0818"},
  {id:"calendar", icon:"📅",   label:"カレンダー",g1D:"#142A1E",g2D:"#0D1814",g1L:"#1A3A28",g2L:"#0A1E14"},
  {id:"body",     icon:"💪",   label:"ボディ",   g1D:"#201428",g2D:"#120818",g1L:"#3A1A38",g2L:"#1A0818"},
  {id:"moon",     icon:"🌙",   label:"ムーン",   g1D:"#2A0A28",g2D:"#1A0818",g1L:"#3A0A28",g2L:"#200818"},
  {id:"skill",    icon:"S+",   label:"Skill+",  g1D:"#142A1E",g2D:"#0D1814",g1L:"#1A3A28",g2L:"#0A1E14"},
  {id:"fortune",  icon:"🔮",   label:"占い",    g1D:"#18102A",g2D:"#0E0818",g1L:"#280A38",g2L:"#140818"},
  {id:"mental",   icon:"🫧",   label:"相談",    g1D:"#14182A",g2D:"#0D1018",g1L:"#1A2038",g2L:"#0A1018"},
  {id:"recipe",   icon:"🍳",   label:"レシピ",   g1D:"#2A1810",g2D:"#180E08",g1L:"#3A2010",g2L:"#200E08"},
  {id:"todo",     icon:"✅",   label:"TODO",    g1D:"#141E14",g2D:"#0D1410",g1L:"#1A2A1A",g2L:"#0A1808"},
  {id:"kakeibo",  icon:"💰",   label:"家計簿",   g1D:"#2A1A10",g2D:"#180E08",g1L:"#3A2A10",g2L:"#1A1408"},
];

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [tab, setTab] = useState("home");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [bodyPlan, setBodyPlan] = useState(null); // null | 'muscle' | 'reset'
  const isDark = theme === "dark";
  const p = isDark ? DARK : LIGHT;
  const cur = NAV.find(n => n.id === tab);

  const renderScreen = () => {
    const shared = { p, isDark, apiKey };
    if (tab==="home")     return <HomeScreen {...shared} onNav={setTab}/>;
    if (tab==="calendar") return <CalendarScreen {...shared}/>;
    if (tab==="body")     return <BodyScreen {...shared} bodyPlan={bodyPlan} setBodyPlan={setBodyPlan}/>;
    if (tab==="moon")     return <MoonScreen {...shared}/>;
    if (tab==="skill")    return <SkillScreen {...shared}/>;
    if (tab==="fortune")  return <FortuneScreen {...shared}/>;
    if (tab==="mental")   return <MentalScreen {...shared}/>;
    if (tab==="recipe")   return <RecipeScreen {...shared} bodyPlan={bodyPlan}/>;
    if (tab==="todo")     return <TodoScreen {...shared}/>;
    if (tab==="kakeibo")  return <KakeiboScreen {...shared}/>;
  };

  return (
    <div style={{ background:p.bg, minHeight:"100vh",
      fontFamily:"'Noto Sans JP',sans-serif",
      display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto" }}>
      <style>{`
        @keyframes dl{0%,80%,100%{opacity:.25}40%{opacity:1}}
        *{box-sizing:border-box;}
        body{margin:0;background:${p.bg};}
      `}</style>

      {/* LINEスタイルヘッダー */}
      <div style={{ background:`linear-gradient(155deg,${isDark?cur.g1D:cur.g1L},${isDark?cur.g2D:cur.g2L})`,
        padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0,
        position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:38,height:38,borderRadius:"50%",
          background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:cur.id==="skill"?13:20,fontWeight:cur.id==="skill"?900:400,flexShrink:0,
          color:cur.id==="skill"?p.accent:"inherit" }}>
          {cur.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:"#fff",fontWeight:700,fontSize:15 }}>ケアラボ</div>
          <div style={{ color:"rgba(255,255,255,0.65)",fontSize:11,marginTop:1 }}>{cur.label}</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <button onClick={()=>setShowKey(v=>!v)}
            style={{ fontSize:10, padding:"4px 10px", borderRadius:14,
              border:`1px solid rgba(255,255,255,0.3)`, cursor:"pointer",
              background:apiKey?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.1)",
              color:"#fff", fontWeight:apiKey?700:400 }}>
            {apiKey?"✓ API":"API設定"}
          </button>
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

      {/* APIキー入力 */}
      {showKey && (
        <div style={{ background:p.card, padding:14, borderBottom:`1px solid ${p.border}` }}>
          <div style={{ fontSize:11, color:p.muted, marginBottom:8 }}>
            AnthropicのAPIキーを入力するとAIが動きます（sk-ant-…）
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ flex:1, background:p.card2, border:`1px solid ${p.border}`,
                borderRadius:10, padding:"8px 12px", fontSize:12, color:p.text, outline:"none" }}/>
            <button onClick={()=>setShowKey(false)}
              style={{ background:p.accent, color:p.accentFg, border:"none",
                borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              設定
            </button>
          </div>
        </div>
      )}

      {/* コンテンツ（全画面） */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {renderScreen()}
      </div>

      {/* ホームへ戻るバー */}
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
