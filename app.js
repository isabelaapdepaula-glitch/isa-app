
const STORE_KEY = "isa_app_data_v02";
const OLD_KEY = "isa_app_v01";

function todayKey(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(s){
  if(!s) return null;
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0);
}

function defaultState(){
  return {
    version: 2,
    habits: [],
    habitCompletions: {},
    prayers: [],
    prayerCompletions: {},
    tasks: [],
    taskCompletions: {},
    createdAt: new Date().toISOString()
  };
}

function migrateOld(){
  const oldRaw = localStorage.getItem(OLD_KEY);
  const fresh = defaultState();
  if(!oldRaw) return fresh;
  try{
    const old = JSON.parse(oldRaw);
    fresh.habits = (old.habits || []).map(h => ({
      id:h.id || crypto.randomUUID(),
      name:h.name,
      icon:"📖",
      category:"Pessoal",
      time:"",
      frequency:{type:"daily"},
      archived:false,
      createdAt:new Date().toISOString()
    }));
    fresh.prayers = (old.prayers || []).map(p => ({
      id:p.id || crypto.randomUUID(),
      name:p.name,
      text:p.text || "",
      archived:false
    }));
    fresh.tasks = (old.tasks || []).map(t => ({
      id:t.id || crypto.randomUUID(),
      name:t.name,
      archived:false
    }));
    const tk = todayKey();
    (old.habits || []).filter(h=>h.done).forEach(h=>{
      fresh.habitCompletions[`${h.id}|${tk}`] = true;
    });
    (old.prayers || []).filter(p=>p.done).forEach(p=>{
      fresh.prayerCompletions[`${p.id}|${tk}`] = true;
    });
    (old.tasks || []).filter(t=>t.done).forEach(t=>{
      fresh.taskCompletions[`${t.id}|${tk}`] = true;
    });
  }catch(e){}
  return fresh;
}

function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  if(raw){
    try{return JSON.parse(raw)}catch(e){}
  }
  const state = migrateOld();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  return state;
}

let state = loadState();
let habitView = "today";
let activeHabitId = null;

function save(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  renderAll();
}

function completionKey(id, dateKey){
  return `${id}|${dateKey}`;
}

function isHabitDone(id, dateKey = todayKey()){
  return !!state.habitCompletions[completionKey(id,dateKey)];
}

function isPrayerDone(id, dateKey = todayKey()){
  return !!state.prayerCompletions[completionKey(id,dateKey)];
}

function isTaskDone(id, dateKey = todayKey()){
  return !!state.taskCompletions[completionKey(id,dateKey)];
}

function toggleCompletion(type,id){
  const key = completionKey(id,todayKey());
  const map = type==="habit" ? state.habitCompletions : type==="prayer" ? state.prayerCompletions : state.taskCompletions;
  if(map[key]) delete map[key];
  else map[key] = true;
  save();
}

function isHabitScheduledOn(habit, date){
  if(habit.archived) return false;
  const f = habit.frequency || {type:"daily"};
  const dk = todayKey(date);
  switch(f.type){
    case "daily": return true;
    case "weekly": return (f.weekdays || []).includes(date.getDay());
    case "monthly": return date.getDate() === Number(f.day || 1);
    case "yearly": {
      if(!f.date) return false;
      const d = parseLocalDate(f.date);
      return d && d.getDate()===date.getDate() && d.getMonth()===date.getMonth();
    }
    case "date": return f.date === dk;
    case "range": return !!f.start && !!f.end && dk >= f.start && dk <= f.end;
    default: return true;
  }
}

function habitsForToday(){
  const now = new Date();
  return state.habits.filter(h => isHabitScheduledOn(h, now));
}

function formatDate(){
  return new Intl.DateTimeFormat("pt-BR", {
    weekday:"long", day:"2-digit", month:"long"
  }).format(new Date());
}
document.getElementById("todayText").textContent = formatDate();
document.getElementById("agendaDate").textContent = formatDate();

function frequencyLabel(h){
  const f = h.frequency || {type:"daily"};
  if(f.type==="daily") return "Todos os dias";
  if(f.type==="weekly"){
    const names=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    return (f.weekdays||[]).map(x=>names[x]).join(", ") || "Sem dias";
  }
  if(f.type==="monthly") return `Todo dia ${f.day}`;
  if(f.type==="yearly"){
    const d=parseLocalDate(f.date);
    return d ? `Todo ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}` : "Anual";
  }
  if(f.type==="date") return `Em ${formatShortDate(f.date)}`;
  if(f.type==="range") return `${formatShortDate(f.start)} a ${formatShortDate(f.end)}`;
  return "";
}

function formatShortDate(s){
  const d = parseLocalDate(s);
  return d ? new Intl.DateTimeFormat("pt-BR").format(d) : "";
}

function renderHabits(){
  const list = document.getElementById("habitList");
  const empty = document.getElementById("habitEmpty");
  const habits = habitView==="today" ? habitsForToday() : state.habits.filter(h=>!h.archived);
  list.innerHTML="";
  empty.classList.toggle("hidden", habits.length>0);

  habits.forEach(h=>{
    const done = isHabitDone(h.id);
    const el=document.createElement("article");
    el.className="item-card"+(done?" done":"");
    el.innerHTML=`
      <div class="item-top">
        <span class="item-icon">${h.icon || "⭐"}</span>
        ${h.time ? `<span class="item-time">${h.time}</span>` : ""}
      </div>
      <div>
        <button class="item-title" data-hdetail="${h.id}">${escapeHTML(h.name)}</button>
        <div class="item-category">${escapeHTML(h.category || "")}</div>
      </div>
      ${habitView==="today" ? `<button class="check ${done?"done":""}" data-habit="${h.id}">${done?"✓":""}</button>` : ""}
    `;
    list.appendChild(el);
  });

  list.querySelectorAll("[data-habit]").forEach(btn=>{
    btn.addEventListener("click",()=>toggleCompletion("habit",btn.dataset.habit));
  });
  list.querySelectorAll("[data-hdetail]").forEach(btn=>{
    btn.addEventListener("click",()=>openHabitDetail(btn.dataset.hdetail));
  });
}

function renderPrayers(){
  const root=document.getElementById("prayerList");
  root.innerHTML="";
  const prayers=state.prayers.filter(p=>!p.archived);
  if(!prayers.length){
    root.innerHTML='<p class="empty">Nenhuma oração cadastrada.</p>';
    return;
  }
  prayers.forEach(p=>{
    const done=isPrayerDone(p.id);
    const el=document.createElement("article");
    el.className="list-item"+(done?" done":"");
    el.innerHTML=`
      <div class="list-main">
        <strong>${escapeHTML(p.name)}</strong>
        <small>${done?"Finalizada hoje":"Pendente"}</small>
      </div>
      <button class="status" data-prayer="${p.id}">${done?"✓":"Abrir"}</button>
    `;
    root.appendChild(el);
  });
  root.querySelectorAll("[data-prayer]").forEach(btn=>{
    btn.addEventListener("click",()=>openPrayer(btn.dataset.prayer));
  });
}

function renderTasks(){
  const root=document.getElementById("taskList");
  root.innerHTML="";
  const tasks=state.tasks.filter(t=>!t.archived);
  if(!tasks.length){
    root.innerHTML='<p class="empty">Nenhuma tarefa cadastrada.</p>';
    return;
  }
  tasks.forEach(t=>{
    const done=isTaskDone(t.id);
    const el=document.createElement("article");
    el.className="list-item"+(done?" done":"");
    el.innerHTML=`
      <div class="list-main"><strong>${escapeHTML(t.name)}</strong><small>${done?"Concluída":"Pendente"}</small></div>
      <button class="status" data-task="${t.id}">${done?"✓":"Concluir"}</button>
    `;
    root.appendChild(el);
  });
  root.querySelectorAll("[data-task]").forEach(btn=>{
    btn.addEventListener("click",()=>toggleCompletion("task",btn.dataset.task));
  });
}

function renderStats(){
  const habits=habitsForToday();
  const prayers=state.prayers.filter(p=>!p.archived);
  const tasks=state.tasks.filter(t=>!t.archived);
  const hc=habits.filter(h=>isHabitDone(h.id)).length;
  const pc=prayers.filter(p=>isPrayerDone(p.id)).length;
  const tc=tasks.filter(t=>isTaskDone(t.id)).length;
  const total=habits.length+prayers.length+tasks.length;
  const done=hc+pc+tc;
  const pct=total?Math.round(done/total*100):0;

  document.getElementById("habitSummary").textContent=`${hc} de ${habits.length}`;
  document.getElementById("prayerSummary").textContent=`${pc} de ${prayers.length}`;
  document.getElementById("taskSummary").textContent=`${tasks.length-tc} pendentes`;
  document.getElementById("statHabits").textContent=`${hc}/${habits.length}`;
  document.getElementById("statPrayers").textContent=`${pc}/${prayers.length}`;
  document.getElementById("statTasks").textContent=`${tc}/${tasks.length}`;
  document.getElementById("overallPercent").textContent=`${pct}%`;
  document.getElementById("overallBar").style.width=`${pct}%`;

  const pending=[
    ...habits.filter(h=>!isHabitDone(h.id)).map(h=>`Hábito: ${h.name}`),
    ...prayers.filter(p=>!isPrayerDone(p.id)).map(p=>`Oração: ${p.name}`),
    ...tasks.filter(t=>!isTaskDone(t.id)).map(t=>`Tarefa: ${t.name}`)
  ];
  document.getElementById("pendingList").innerHTML=pending.length
    ? pending.slice(0,8).map(x=>`<li>${escapeHTML(x)}</li>`).join("")
    : "<li>Nenhuma pendência 🎉</li>";
}

function renderAll(){
  renderHabits();renderPrayers();renderTasks();renderStats();
}

function goTo(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.target===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>goTo(btn.dataset.target)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>goTo(btn.dataset.go)));

document.querySelectorAll("[data-habit-view]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    habitView=btn.dataset.habitView;
    document.querySelectorAll("[data-habit-view]").forEach(b=>b.classList.toggle("active",b===btn));
    renderHabits();
  });
});

const createDialog=document.getElementById("createDialog");
document.getElementById("createBtn").onclick=()=>createDialog.showModal();
document.querySelectorAll("[data-action]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(createDialog.open) createDialog.close();
    if(btn.dataset.action==="habit") openHabitForm();
    else openSimpleForm(btn.dataset.action);
  });
});

function updateFrequencyFields(){
  const t=document.getElementById("habitFrequency").value;
  ["weeklyFields","monthlyFields","yearlyFields","dateFields","rangeFields"].forEach(id=>document.getElementById(id).classList.add("hidden"));
  const map={weekly:"weeklyFields",monthly:"monthlyFields",yearly:"yearlyFields",date:"dateFields",range:"rangeFields"};
  if(map[t]) document.getElementById(map[t]).classList.remove("hidden");
}
document.getElementById("habitFrequency").addEventListener("change",updateFrequencyFields);

function openHabitForm(habit=null){
  document.getElementById("habitFormTitle").textContent=habit?"Editar hábito":"Novo hábito";
  document.getElementById("habitId").value=habit?.id || "";
  document.getElementById("habitName").value=habit?.name || "";
  document.getElementById("habitIcon").value=habit?.icon || "📖";
  document.getElementById("habitCategory").value=habit?.category || "Espiritual";
  document.getElementById("habitTime").value=habit?.time || "";
  const f=habit?.frequency || {type:"daily"};
  document.getElementById("habitFrequency").value=f.type || "daily";
  document.querySelectorAll('#weeklyFields input[type="checkbox"]').forEach(c=>c.checked=(f.weekdays||[]).includes(Number(c.value)));
  document.getElementById("habitMonthDay").value=f.day || 1;
  document.getElementById("habitYearDate").value=f.date || "";
  document.getElementById("habitDate").value=f.date || "";
  document.getElementById("habitStartDate").value=f.start || "";
  document.getElementById("habitEndDate").value=f.end || "";
  updateFrequencyFields();
  document.getElementById("habitDialog").showModal();
}
document.getElementById("cancelHabit").onclick=()=>document.getElementById("habitDialog").close();

document.getElementById("habitForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=document.getElementById("habitId").value;
  const type=document.getElementById("habitFrequency").value;
  let frequency={type};
  if(type==="weekly"){
    frequency.weekdays=[...document.querySelectorAll('#weeklyFields input[type="checkbox"]:checked')].map(x=>Number(x.value));
    if(!frequency.weekdays.length){ alert("Escolha pelo menos um dia da semana."); return; }
  }
  if(type==="monthly") frequency.day=Number(document.getElementById("habitMonthDay").value);
  if(type==="yearly") frequency.date=document.getElementById("habitYearDate").value;
  if(type==="date") frequency.date=document.getElementById("habitDate").value;
  if(type==="range"){
    frequency.start=document.getElementById("habitStartDate").value;
    frequency.end=document.getElementById("habitEndDate").value;
    if(!frequency.start || !frequency.end || frequency.end<frequency.start){ alert("Confira o intervalo de datas."); return; }
  }
  if((type==="yearly" || type==="date") && !frequency.date){ alert("Escolha a data."); return; }

  const data={
    id:id || crypto.randomUUID(),
    name:document.getElementById("habitName").value.trim(),
    icon:document.getElementById("habitIcon").value,
    category:document.getElementById("habitCategory").value,
    time:document.getElementById("habitTime").value,
    frequency,
    archived:false,
    createdAt:id ? (state.habits.find(h=>h.id===id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };
  if(id){
    const idx=state.habits.findIndex(h=>h.id===id);
    state.habits[idx]=data;
  }else state.habits.push(data);

  save();
  document.getElementById("habitDialog").close();
});

function monthHabitStats(habit){
  const now=new Date();
  const year=now.getFullYear(), month=now.getMonth();
  const days=new Date(year,month+1,0).getDate();
  let expected=0, done=0;
  for(let d=1;d<=Math.min(days,now.getDate());d++){
    const date=new Date(year,month,d,12);
    if(isHabitScheduledOn(habit,date)){
      expected++;
      if(isHabitDone(habit.id,todayKey(date))) done++;
    }
  }
  return {expected,done};
}

function openHabitDetail(id){
  activeHabitId=id;
  const h=state.habits.find(x=>x.id===id);
  if(!h) return;
  const st=monthHabitStats(h);
  document.getElementById("habitDetailIcon").textContent=h.icon || "⭐";
  document.getElementById("habitDetailName").textContent=h.name;
  document.getElementById("habitDetailMeta").textContent=[h.category,frequencyLabel(h),h.time].filter(Boolean).join(" • ");
  document.getElementById("habitMonthDone").textContent=st.done;
  document.getElementById("habitMonthExpected").textContent=st.expected;
  document.getElementById("habitDetailDialog").showModal();
}
document.getElementById("closeHabitDetail").onclick=()=>document.getElementById("habitDetailDialog").close();
document.getElementById("editHabit").onclick=()=>{
  const h=state.habits.find(x=>x.id===activeHabitId);
  document.getElementById("habitDetailDialog").close();
  openHabitForm(h);
};
document.getElementById("archiveHabit").onclick=()=>{
  const h=state.habits.find(x=>x.id===activeHabitId);
  if(h && confirm(`Arquivar "${h.name}"? O histórico será mantido.`)){
    h.archived=true;
    save();
    document.getElementById("habitDetailDialog").close();
  }
};

function openSimpleForm(type){
  document.getElementById("simpleType").value=type;
  document.getElementById("simpleFormTitle").textContent=type==="prayer"?"Nova oração":"Nova tarefa";
  document.getElementById("simpleName").value="";
  document.getElementById("simpleText").value="";
  document.getElementById("simpleTextWrap").classList.toggle("hidden",type!=="prayer");
  document.getElementById("simpleFormDialog").showModal();
}
document.getElementById("cancelSimple").onclick=()=>document.getElementById("simpleFormDialog").close();
document.getElementById("simpleForm").addEventListener("submit",e=>{
  e.preventDefault();
  const type=document.getElementById("simpleType").value;
  const name=document.getElementById("simpleName").value.trim();
  if(!name) return;
  if(type==="prayer") state.prayers.push({id:crypto.randomUUID(),name,text:document.getElementById("simpleText").value.trim(),archived:false});
  else state.tasks.push({id:crypto.randomUUID(),name,archived:false});
  save();
  document.getElementById("simpleFormDialog").close();
});

function openPrayer(id){
  const p=state.prayers.find(x=>x.id===id);
  document.getElementById("prayerTitle").textContent=p.name;
  document.getElementById("prayerText").textContent=p.text || "Sem texto cadastrado.";
  const finish=document.getElementById("finishPrayer");
  finish.textContent=isPrayerDone(id)?"Desmarcar finalização":"Marcar como finalizada";
  finish.onclick=()=>{toggleCompletion("prayer",id);document.getElementById("prayerDialog").close();};
  document.getElementById("prayerDialog").showModal();
}
document.getElementById("closePrayer").onclick=()=>document.getElementById("prayerDialog").close();

function escapeHTML(str=""){
  return String(str).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}
renderAll();
