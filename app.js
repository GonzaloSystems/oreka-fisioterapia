"use strict";

const calendar = document.querySelector(".calendar");
const mexicoTime = "America/Mexico_City";
const dateOptions = { timeZone: "UTC" };
const shortDate = new Intl.DateTimeFormat("es-MX", { ...dateOptions, day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("es-MX", { ...dateOptions, dateStyle: "full" });
const weekday = new Intl.DateTimeFormat("es-MX", { ...dateOptions, weekday: "short" });
const zapopanClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: mexicoTime, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", hourCycle: "h23"
});

function localClock() {
  const parts = Object.fromEntries(zapopanClock.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return {
    date: new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))),
    hour: Number(parts.hour)
  };
}

function plusDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function openingSlots(date, now) {
  if (date < now.date || date.getUTCDay() === 0) return [];
  const close = date.getUTCDay() === 6 ? 14 : 20;
  const first = +date === +now.date ? Math.max(8, now.hour + 1) : 8;
  return Array.from({ length: Math.max(0, close - first) }, (_, index) => first + index);
}

function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function makeChoice(name, value, visible, { checked = false, disabled = false, label = "" } = {}) {
  const choice = document.createElement("label");
  choice.className = "choice";
  const input = document.createElement("input");
  Object.assign(input, { type: "radio", name, value, checked, disabled });
  if (label) input.setAttribute("aria-label", label);
  const text = document.createElement("span");
  for (const part of visible) text.append(part);
  choice.append(input, text);
  return choice;
}

if (calendar) {
  const days = calendar.querySelector("#days");
  const slots = calendar.querySelector("#slots");
  const weekLabel = calendar.querySelector("#week-label");
  const slotsLabel = calendar.querySelector("#slots-label");
  const previous = calendar.querySelector("#prev-week");
  const next = calendar.querySelector("#next-week");
  const reserve = calendar.querySelector("#reserve");
  const confirmation = calendar.querySelector("#confirmation");

  const initialDate = localClock().date;
  const monday = plusDays(initialDate, -((initialDate.getUTCDay() + 6) % 7));
  let offset = 0;
  let selectedDate = null;
  let selectedHour = null;

  function resetSelection() {
    selectedHour = null;
    reserve.disabled = true;
    confirmation.hidden = true;
    confirmation.textContent = "";
  }

  function renderSlots() {
    resetSelection();
    const available = selectedDate ? openingSlots(selectedDate, localClock()) : [];
    slotsLabel.textContent = selectedDate ? `Turnos · ${shortDate.format(selectedDate)}` : "Elige un turno";
    slots.replaceChildren(...available.map(hour => makeChoice("hour", hour, [hourLabel(hour)])));
    if (!available.length) {
      const message = document.createElement("p");
      message.className = "empty-slots";
      message.textContent = "Esta semana ya no tiene turnos. Prueba la siguiente.";
      slots.append(message);
    }
  }

  function renderWeek() {
    const now = localClock();
    const start = plusDays(monday, offset * 7);
    const week = Array.from({ length: 7 }, (_, i) => plusDays(start, i));
    selectedDate = week.find(date => openingSlots(date, now).length) ?? null;
    weekLabel.textContent = `${shortDate.format(start)} – ${shortDate.format(week[6])}`;
    previous.disabled = offset === 0;
    next.disabled = offset === 7;

    days.replaceChildren(...week.map(date => {
      const day = document.createElement("small");
      day.textContent = weekday.format(date).replace(".", "");
      return makeChoice("day", +date, [day, String(date.getUTCDate())], {
        checked: selectedDate !== null && +date === +selectedDate,
        disabled: openingSlots(date, now).length === 0,
        label: longDate.format(date) + (date.getUTCDay() === 0 ? ", cerrado" : "")
      });
    }));
    renderSlots();
  }

  days.addEventListener("change", event => {
    selectedDate = new Date(Number(event.target.value));
    renderSlots();
  });
  slots.addEventListener("change", event => {
    selectedHour = Number(event.target.value);
    reserve.disabled = false;
    confirmation.hidden = true;
  });
  previous.addEventListener("click", () => {
    offset -= 1;
    renderWeek();
    if (previous.disabled) next.focus();
  });
  next.addEventListener("click", () => {
    offset += 1;
    renderWeek();
    if (next.disabled) previous.focus();
  });
  reserve.addEventListener("click", () => {
    if (selectedDate === null || selectedHour === null) return;
    if (!openingSlots(selectedDate, localClock()).includes(selectedHour)) {
      renderWeek();
      return;
    }
    confirmation.hidden = false;
    confirmation.textContent = `Cita simulada para el ${longDate.format(selectedDate)}, de ${hourLabel(selectedHour)} a ${hourLabel(selectedHour + 1)}. No se envió ninguna reserva.`;
  });
  renderWeek();
}

const revealPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

if ("IntersectionObserver" in window && "animate" in Element.prototype) {
  const activeReveals = new Set();
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = entry.target;
      reveal.unobserve(target);
      if (revealPreference.matches || target.contains(document.activeElement)) continue;

      const photo = target.dataset.reveal === "photo";
      const animation = target.animate(
        [{ opacity: 0, transform: `translateY(${photo ? 22 : 14}px)` },
         { opacity: 1, transform: "translateY(0)" }],
        { duration: photo ? 590 : 440, easing: "cubic-bezier(.22,.65,.25,1)" }
      );
      activeReveals.add(animation);
      const finish = () => activeReveals.delete(animation);
      animation.onfinish = finish;
      animation.oncancel = finish;
    }
  }, { rootMargin: "0px 0px -28px 0px" });

  for (const target of document.querySelectorAll("[data-reveal]")) {
    if (target.getBoundingClientRect().top >= window.innerHeight) reveal.observe(target);
  }

  revealPreference.addEventListener("change", event => {
    if (event.matches) for (const animation of activeReveals) animation.cancel();
  });
  document.addEventListener("focusin", event => {
    for (const animation of activeReveals) {
      if (animation.effect.target.contains(event.target)) animation.cancel();
    }
  });
}

const motion = document.querySelector(".motion");
const canvas = document.querySelector("#athlete");
const ctx = canvas?.getContext("2d");

if (ctx) {
  const reducedMotion = revealPreference;
  const sticky = motion.querySelector(".motion-sticky");
  const steps = Array.from(motion.querySelectorAll(".motion-steps li"));
  const title = motion.querySelector("#motion-title");
  const titleAccent = title.querySelector("em");
  const sceneTitles = steps.map(step => {
    const heading = step.querySelector("h3");
    return [heading.firstChild.textContent, heading.querySelector("span").textContent];
  });
  const track = motion.querySelector(".motion-track span");
  const clamp = (number, min = 0, max = 1) => Math.max(min, Math.min(max, number));
  const lerp = (start, end, fraction) => start + (end - start) * fraction;
  const smooth = fraction => {
    const value = clamp(fraction);
    return value * value * (3 - 2 * value);
  };
  const TAU = Math.PI * 2;
  const width = 1000;
  let height = 480;
  let request = 0;
  let start = 0;
  let distance = 1;
  let active = -1;

  function rect(x,y,w,h,color,r=0) {
    ctx.fillStyle = color;
    if (!r) { ctx.fillRect(x,y,w,h); return; }
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
  }
  function line(points, color, size=1) {
    ctx.beginPath(); ctx.moveTo(...points[0]);
    points.slice(1).forEach(point => ctx.lineTo(...point));
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = size;
    ctx.strokeStyle = color; ctx.stroke();
  }
  function polygon(points,color) {
    ctx.beginPath(); ctx.moveTo(...points[0]);
    points.slice(1).forEach(point => ctx.lineTo(...point));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function ellipse(x,y,rx,ry,color,rotation=0) {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rotation,0,TAU);
    ctx.fillStyle = color; ctx.fill();
  }
  function ring(x,y,r,color,size=1,start=0,end=TAU) {
    ctx.beginPath(); ctx.arc(x,y,r,start,end);
    ctx.lineWidth = size; ctx.strokeStyle = color; ctx.stroke();
  }
  function gradient(top,bottom) {
    const fill = ctx.createLinearGradient(0,0,0,height);
    fill.addColorStop(0,top); fill.addColorStop(1,bottom);
    rect(0,0,width,height,fill);
  }
  function floorY() { return height * .82; }
  function withFigure(x,y,scale,draw) {
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); draw(); ctx.restore();
  }
  function centerScale() { return Math.min(1.38, height / 440); }

  // Figures are drawn from readable silhouettes. The joints drive the pose.
  const clinicKit = { shirt:"#d9f594", shade:"#b8d675", shorts:"#304e44", far:"#375c4e", skin:"#cb8c67", dim:"#a76f53", shoe:"#f0f1df" };
  function athlete(pose, kit=clinicKit) {
    const { hip, shoulder, head, front, back, near, far } = pose;
    const [hipX,hipY] = hip;
    const [shoulderX,shoulderY] = shoulder;
    const [headX,headY] = head;
    for (const [leg, shadow] of [[back,true],[front,false]]) {
      const [knee, ankle, foot] = leg;
      line([hip,knee],shadow ? kit.far : kit.shorts,29);
      line([knee,ankle],shadow ? kit.dim : kit.skin,16);
      line([ankle,foot],shadow ? "#b0b9a0" : kit.shoe,12);
      line([[foot[0]-11,foot[1]+4],[foot[0]+2,foot[1]+4]],"#1b3027",3);
    }
    line([shoulder,far[0],far[1]],kit.dim,14);
    line([shoulder,far[0]],kit.shade,21);
    line([shoulder,[headX-2,headY+13]],kit.skin,15);
    polygon([[shoulderX-20,shoulderY-8],[shoulderX+15,shoulderY-9],[hipX+18,hipY-10],[hipX+9,hipY+7],[hipX-19,hipY]],kit.shirt);
    polygon([[shoulderX-20,shoulderY-8],[hipX-19,hipY],[hipX-6,hipY-3],[shoulderX-10,shoulderY+1]],kit.shade);
    line([shoulder,near[0]],kit.skin,15);
    line([shoulder,[lerp(shoulderX,near[0][0],.42),lerp(shoulderY,near[0][1],.42)]],kit.shirt,23);
    line([near[0],near[1]],kit.skin,13);
    ellipse(headX,headY,17,21,kit.skin,.12);
    ellipse(headX-4,headY-11,15,12,"#282c24",.12);
    ellipse(headX-13,headY-4,5,12,"#282c24");
    ellipse(headX+15,headY+2,4,5,kit.skin);
  }
  function walkPose(phase, stride=1) {
    const swing = Math.sin(phase);
    const liftA = Math.max(0,Math.cos(phase));
    const liftB = Math.max(0,-Math.cos(phase));
    const a = swing*47*stride;
    const b = -a;
    const hip = [0,-121 + 6*Math.abs(swing)];
    return {
      hip, shoulder:[8,-192], head:[16,-225],
      front:[[a*.52+10,-59-liftA*13],[a,-10-liftA*29],[a+14,-6-liftA*29]],
      back:[[b*.56+8,-59-liftB*13],[b,-10-liftB*29],[b+14,-6-liftB*29]],
      near:[[-a*.64,-151],[-a*.92+11,-114]], far:[[a*.52,-152],[a*.92+8,-118]]
    };
  }
  function weight(x,y,angle) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    rect(-24,-4,48,8,"#d4e2c7",3);
    rect(-26,-15,12,30,"#14221d",3); rect(14,-15,12,30,"#14221d",3);
    rect(-27,-12,3,24,"#d6e79b",2); rect(24,-12,3,24,"#d6e79b",2);
    ctx.restore();
  }
  function treatmentTable() {
    ellipse(0,5,290,20,"#15231e57");
    line([[-179,-108],[-181,0]],"#1b332d",12);
    line([[157,-108],[155,0]],"#1b332d",12);
    line([[-181,-29],[154,-29]],"#1b332d",8);
    rect(-223,-132,420,24,"#a6c6aa",10);
    rect(-211,-134,90,13,"#dcead2",7);
  }

  function assessment(t, kit, tint) {
    const knee = [88,-167-36*smooth(t)];
    const foot = [172-20*smooth(t),-145-16*smooth(t)];
    line([[14,-156],[99,-155],[172,-141]],"#436451",23);
    line([[18,-155],knee],kit.shorts,34);
    line([knee,foot],"#c98767",18);
    line([foot,[foot[0]+18,foot[1]+1]],"#e7efd1",13);
    line([[-116,-155],[-6,-154]],kit.shirt,36);
    ellipse(-145,-157,26,17,"#c98767");
    ellipse(-159,-160,15,15,"#282b23");
    line([[-95,-156],[-51,-148],[6,-149]],"#ce9370",14);
    const pose = walkPose(0,.35);
    pose.shoulder=[-8,-193]; pose.head=[2,-228];
    pose.near=[[20,-164],[60,-176-24*smooth(t)]];
    pose.far=[[11,-173],[43,-188-22*smooth(t)]];
    withFigure(52,0,.98,() => athlete(pose,{...kit,shirt:"#648a70",shade:"#4f7564"}));
    assessmentCircle(knee,tint,t);
  }

  function strengthPose(t) {
    const pose = walkPose(0,.15);
    pose.front = [[15,-61],[19,-9],[37,-6]];
    pose.back = [[-21,-63],[-29,-9],[-13,-6]];
    const lift = Math.sin(Math.PI*t)*.9;
    const angle = lerp(1.36,-.98,lift);
    const hand = [32+47*Math.cos(angle),-146+47*Math.sin(angle)];
    pose.near=[[32,-146],hand];
    pose.far=[[-26,-151],[-34,-112]];
    return [pose,hand,angle];
  }

  function blendPose(from,to,t) {
    const mix = (a,b) => a.map((value,i) => lerp(value,b[i],t));
    return {
      hip:mix(from.hip,to.hip), shoulder:mix(from.shoulder,to.shoulder), head:mix(from.head,to.head),
      front:from.front.map((point,i)=>mix(point,to.front[i])),
      back:from.back.map((point,i)=>mix(point,to.back[i])),
      near:from.near.map((point,i)=>mix(point,to.near[i])),
      far:from.far.map((point,i)=>mix(point,to.far[i]))
    };
  }

  function ball(x,y,r,spin) {
    ellipse(x,y,r,r,"#f0f4dd");
    const pentagon = Array.from({length:5},(_,i)=>[x+Math.cos(i*TAU/5+spin)*r*.51,y+Math.sin(i*TAU/5+spin)*r*.51]);
    polygon(pentagon,"#203a2c");
    pentagon.forEach(([px,py])=>line([[px,py],[x+(px-x)*1.86,y+(py-y)*1.86]],"#4e6957",1));
  }
  const set = {
    backdrop:["#4d6756","#bcb885"],
    ridge:"#4c6c55", ridgeNear:"#385b4a", glazing:"#eee3a919",
    disc:"#efe2a5", halo:"#f8e9a474", frame:"#1c4036", light:"#f3e5a238",
    floor:"#355449", lane:"#718258", rack:"#254438", ink:"#eaff9c",
    kit:{...clinicKit,shirt:"#e0ed9e",shade:"#b0c574",shorts:"#27473a"}
  };

  const bedX = 415;
  const weightsX = 1735;
  const cameraPositions = [495,1040,1750];
  const cameraZoom = [1.27,1.09,1.27];

  function windowRoom(set,y) {
    const baseline = y-height*.24;
    const discX = 1290;
    const discY = y-height*.52;
    const halo = ctx.createRadialGradient(discX,discY,52,discX,discY,215);
    halo.addColorStop(0,set.halo);
    halo.addColorStop(1,set.halo.slice(0,7)+"00");
    ellipse(discX,discY,215,215,halo);
    ellipse(discX,discY,95,95,set.disc);
    polygon([[0,baseline-32],[330,baseline-87],[540,baseline-53],[790,baseline-100],[1170,baseline-39],[1450,baseline-91],[1650,baseline-62],[1940,baseline-111],[2220,baseline-47],[2220,y],[0,y]],set.ridge);
    polygon([[0,baseline],[280,baseline-51],[535,baseline-12],[895,baseline-81],[1240,baseline-18],[1530,baseline-73],[1980,baseline-15],[2220,baseline-85],[2220,y],[0,y]],set.ridgeNear);
    rect(0,0,2220,y,set.glazing);
    for (let x=50;x<2220;x+=340) {
      polygon([[x+12,y],[x+127,y],[x+285,height],[x+154,height]],set.light);
      line([[x,0],[x,y]],set.frame,14);
      line([[x+9,0],[x+9,y]],set.disc+"48",1.3);
      line([[x,y-height*.59],[x+340,y-height*.59]],set.frame+"a0",3);
    }
    rect(1580,y-52,295,52,set.rack,4);
    for(let i=0;i<4;i++) withFigure(1620+i*66,y-62,.58+i*.06,()=>weight(0,0,0));
  }

  function assessmentCircle(knee, tint, time) {
    const [x,y]=knee;
    const pulse = 32+6*Math.sin(time*Math.PI);
    const glow=ctx.createRadialGradient(x,y,6,x,y,63);
    glow.addColorStop(0,tint+"44");
    glow.addColorStop(1,tint+"00");
    ellipse(x,y,63,63,glow);
    ring(x,y,pulse,tint,2);
    ring(x,y,pulse+11,tint+"70",1);
    ring(x,y,pulse+11,tint,2.5,-1.65,-.35+time*.55);
    line([[x+30,y-23],[x+75,y-63],[x+121,y-63]],tint+"dc",1.4);
    ellipse(x+121,y-63,3,3,tint);
    ellipse(x,y,3,3,tint);
  }

  function cones(floor) {
    for(let i=0;i<5;i++) {
      const x=827+i*143;
      const y=floor+(i%2 ? -14 : 19);
      ellipse(x,y+2,22,4,"#142c2560");
      polygon([[x-17,y],[x-5,y-36],[x+6,y-36],[x+17,y]],"#ec985b");
      polygon([[x-12,y-9],[x+12,y-9],[x+9,y-18],[x-9,y-18]],"#fff1cf");
    }
  }

  function drawRecovery(progress) {
    const segment = progress <= .5 ? 0 : 1;
    const cameraTime = smooth(progress*2-segment);
    const cameraTarget = lerp(cameraPositions[segment],cameraPositions[segment+1],cameraTime);
    const walk = clamp((progress-.30)/.41);
    const walkX = lerp(570,weightsX,smooth(walk));
    const target = progress > .30 ? Math.max(cameraTarget, walkX - 250) : cameraTarget;
    const zoom = lerp(cameraZoom[segment],cameraZoom[segment+1],cameraTime);
    const y=floorY();
    const scale=Math.min(centerScale(),1.28);
    gradient(...set.backdrop);
    ctx.save();
    ctx.translate(width/2-target*zoom,y*(1-zoom));
    ctx.scale(zoom,zoom);
    rect(-100,y,2420,height-y+80,set.floor);
    rect(670,y-9,895,19,set.lane,6);
    windowRoom(set,y);
    line([[-100,y],[2310,y]],"#d7e8ad74",1.5);
    line([[670,y+9],[1565,y+9]],"#d7e8ad73",1);
    cones(y);

    const exam = clamp(progress*3);
    withFigure(bedX,y,scale,() => {
      treatmentTable();
      const reveal=1-smooth((progress-.29)/.085);
      if(reveal>0) {
        ctx.globalAlpha=reveal;
        assessment(exam,set.kit,set.ink);
        ctx.globalAlpha=1;
      }
    });

    const dribble=smooth((progress-.32)/.055)*(1-smooth((progress-.66)/.055));
    const depth=Math.sin(walk*TAU*2)*17*dribble;
    const gait = walk * TAU * 7;
    const athleteAlpha=smooth((progress-.29)/.085);
    if(athleteAlpha>0) {
      ctx.globalAlpha=athleteAlpha;
      ellipse(walkX,y+depth+6,70*scale,10*scale,"#13282159");
      const lifting=smooth((progress-.68)/.09);
      const [standing, hand, angle]=strengthPose(clamp((progress-.72)/.28));
      const walking=walkPose(gait,1-.22*dribble);
      const pose=blendPose(walking,standing,lifting);
      withFigure(walkX,y+depth,scale,() => {
        athlete(pose,set.kit);
        if(lifting>0) {
          ctx.globalAlpha=athleteAlpha*lifting;
          weight(hand[0],hand[1],angle*.34);
        }
      });
      ctx.globalAlpha=1;
    }

    const pickUp=smooth((progress-.34)/.075);
    const park=smooth((progress-.62)/.085);
    const dribbleX=walkX+58+20*Math.abs(Math.sin(gait))*dribble;
    const ballX=lerp(lerp(705,dribbleX,pickUp),1842,park);
    ellipse(ballX,y+depth+3,17,4,"#182c237b");
    ball(ballX,y+depth-12,14,gait*.9*dribble);
    ctx.restore();
  }


  function renderMotion() {
    request = 0;
    const progress = reducedMotion.matches ? .16 : clamp((window.scrollY - start) / distance);
    const scene = Math.min(2, Math.floor(progress * 3));
    if (active !== scene) {
      const [lead, accent] = sceneTitles[scene];
      title.firstChild.textContent = lead;
      titleAccent.textContent = accent + ".";
      steps.forEach((step, index) => step.classList.toggle("is-current", index === scene));
      active = scene;
    }
    track.style.transform = `scaleX(${progress})`;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    drawRecovery(progress);
  }

  function scheduleMotion() {
    if (!request) request = requestAnimationFrame(renderMotion);
  }

  function measureMotion() {
    const frame = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(frame.width * ratio);
    const pixelHeight = Math.round(frame.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    height = Math.round(width * frame.height / frame.width);
    start = motion.getBoundingClientRect().top + window.scrollY;
    distance = Math.max(1, motion.offsetHeight - sticky.offsetHeight);
    scheduleMotion();
  }

  function configureMotion() {
    motion.classList.toggle("is-animated", !reducedMotion.matches);
    measureMotion();
  }

  const size = new ResizeObserver(measureMotion);
  size.observe(document.body);
  size.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      window.addEventListener("scroll", scheduleMotion, { passive: true });
      measureMotion();
    } else {
      window.removeEventListener("scroll", scheduleMotion);
    }
  });
  visibility.observe(motion);
  reducedMotion.addEventListener("change", configureMotion);
  configureMotion();
}
