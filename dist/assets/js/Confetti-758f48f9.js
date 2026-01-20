import{j as s,F as y,a as w}from"./index-7ed2ca0c.js";import{r as a}from"./react-vendor-9a2eb766.js";function b({duration:r=3e3,onComplete:e,count:o=80,colors:n=["#fbbf24","#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6"],size:i=6,zIndex:d=50}){const[f,l]=a.useState([]);a.useEffect(()=>{const t=typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,m=Array.from({length:o},(M,h)=>({id:h,left:Math.random()*100,delay:Math.random()*.5,duration:t?.01:2+Math.random()*2,color:n[Math.floor(Math.random()*n.length)],rotation:Math.random()*360,radius:Math.random()<.5?0:50,drift:(Math.random()-.5)*50}));l(m);const u=setTimeout(()=>{e==null||e()},r);return()=>clearTimeout(u)},[r,o]);const c=a.useMemo(()=>`
    @keyframes confetti-fall {
      0% {
        transform: translate3d(0, 0, 0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--drift), 100vh, 0) rotate(720deg);
        opacity: 0;
      }
    }

    .confetti-piece {
      animation: confetti-fall linear forwards;
      will-change: transform, opacity;
    }
  `,[]);return w("div",{className:"fixed inset-0 pointer-events-none overflow-hidden",style:{zIndex:d},children:[s("style",{children:c}),f.map(t=>s("div",{className:"absolute confetti-piece",style:{left:`${t.left}%`,top:"-10px",backgroundColor:t.color,animationDelay:`${t.delay}s`,animationDuration:`${t.duration}s`,transform:`rotate(${t.rotation}deg)`,width:i,height:i,borderRadius:`${t.radius}%`,"--drift":`${t.drift}px`}},t.id))]})}function x(){const[r,e]=a.useState(!1),o=a.useCallback(()=>{e(!0)},[]),n=a.useCallback(()=>s(y,{children:r&&s(b,{onComplete:()=>e(!1)})}),[r]);return{celebrate:o,ConfettiContainer:n}}export{x as u};
