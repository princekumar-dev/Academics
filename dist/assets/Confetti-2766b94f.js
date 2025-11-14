import{j as o,F as c,a as l}from"./index-05db249c.js";import{r}from"./react-vendor-07fa9950.js";function d({duration:a=3e3,onComplete:e}){const[n,s]=r.useState([]);return r.useEffect(()=>{const t=Array.from({length:50},(m,f)=>({id:f,left:Math.random()*100,delay:Math.random()*.5,duration:2+Math.random()*2,color:["#fbbf24","#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6"][Math.floor(Math.random()*6)],rotation:Math.random()*360}));s(t);const i=setTimeout(()=>{e==null||e()},a);return()=>clearTimeout(i)},[a,e]),l("div",{className:"fixed inset-0 pointer-events-none z-50 overflow-hidden",children:[n.map(t=>o("div",{className:"absolute w-3 h-3 confetti-piece",style:{left:`${t.left}%`,top:"-10px",backgroundColor:t.color,animationDelay:`${t.delay}s`,animationDuration:`${t.duration}s`,transform:`rotate(${t.rotation}deg)`}},t.id)),o("style",{jsx:!0,children:`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .confetti-piece {
          animation: confetti-fall linear forwards;
        }
      `})]})}function b(){const[a,e]=r.useState(!1);return{celebrate:()=>{e(!0)},ConfettiContainer:()=>o(c,{children:a&&o(d,{onComplete:()=>e(!1)})})}}export{b as u};
