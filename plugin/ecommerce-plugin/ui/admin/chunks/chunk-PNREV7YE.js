var a=/[",\r\n]|^\s|\s$/;function p(i){return`\uFEFF${i.map(o=>o.map(t=>a.test(t)?`"${t.replace(/"/g,'""')}"`:t).join(",")).join(`\r
`)}\r
`}function l(i){let r=i.replace(/^﻿/,""),o=[],t=[],e="",c=!1;for(let n=0;n<r.length;n++){let s=r[n];c?s==='"'?r[n+1]==='"'?(e+='"',n++):c=!1:e+=s:s==='"'&&e===""?c=!0:s===","?(t.push(e),e=""):s===`
`||s==="\r"?(s==="\r"&&r[n+1]===`
`&&n++,t.push(e),o.push(t),t=[],e=""):e+=s}return(e!==""||t.length>0)&&(t.push(e),o.push(t)),o.filter(n=>n.some(s=>s.trim()!==""))}function u(i){let[r=[],...o]=l(i),t=r.map(c=>c.trim()),e=o.map(c=>Object.fromEntries(t.map((n,s)=>[n,(c[s]??"").trim()])));return{headers:t,rows:e}}function d(i,r,o="text/csv;charset=utf-8"){let t=URL.createObjectURL(new Blob([r],{type:o})),e=document.createElement("a");e.href=t,e.download=i,document.body.appendChild(e),e.click(),e.remove(),window.setTimeout(()=>URL.revokeObjectURL(t),1e3)}export{p as a,u as b,d as c};
