import{c as n,j as e,a as r}from"./index-05db249c.js";import{r as i}from"./react-vendor-07fa9950.js";/**
 * @license lucide-react v0.553.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]],p=n("circle-question-mark",c);function u({content:l,children:o,position:t="top"}){const[s,a]=i.useState(!1);return r("div",{className:"relative inline-block",children:[e("div",{onMouseEnter:()=>a(!0),onMouseLeave:()=>a(!1),onFocus:()=>a(!0),onBlur:()=>a(!1),children:o}),s&&r("div",{className:`absolute ${{top:"bottom-full left-1/2 -translate-x-1/2 mb-2",bottom:"top-full left-1/2 -translate-x-1/2 mt-2",left:"right-full top-1/2 -translate-y-1/2 mr-2",right:"left-full top-1/2 -translate-y-1/2 ml-2"}[t]} z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg whitespace-nowrap shadow-lg animate-fade-in`,role:"tooltip",children:[l,e("div",{className:`absolute w-2 h-2 bg-gray-900 transform rotate-45 
            ${t==="top"?"bottom-[-4px] left-1/2 -translate-x-1/2":""}
            ${t==="bottom"?"top-[-4px] left-1/2 -translate-x-1/2":""}
            ${t==="left"?"right-[-4px] top-1/2 -translate-y-1/2":""}
            ${t==="right"?"left-[-4px] top-1/2 -translate-y-1/2":""}
          `})]})]})}function h({content:l,position:o="top"}){return e(u,{content:l,position:o,children:e("button",{className:"inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors",type:"button",children:e(p,{className:"w-4 h-4"})})})}export{h as H};
