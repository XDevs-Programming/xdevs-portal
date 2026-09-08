(() => {
  "use strict";
  const path=(location.pathname.replace(/\/+$/,"")||"/").toLowerCase();
  const cleanHref=a=>{try{return new URL(a.href,location.href).pathname.replace(/\/+$/,"").toLowerCase()||"/"}catch{return""}};
  const main=document.querySelector("main");
  if(main && !main.id) main.id="main-content";
  if(main && !document.querySelector(".ux-skip-link")){
    const skip=document.createElement("a");skip.className="ux-skip-link";skip.href="#"+main.id;skip.textContent="Skip to content";document.body.prepend(skip);
  }
  document.querySelectorAll(".nav-links").forEach(nav=>{
    [...nav.querySelectorAll("a")].forEach(a=>{
      if(cleanHref(a)===path && path!=="/") a.setAttribute("aria-current","page");
    });
    if(nav.querySelector(".nav-more")) return;
    const links=[...nav.children].filter(el=>el.tagName==="A");
    const secondary=links.filter(a=>["/help","/status","/changelog"].includes(cleanHref(a)));
    if(!secondary.length) return;
    const wrap=document.createElement("div");wrap.className="nav-more";
    const btn=document.createElement("button");btn.type="button";btn.className="nav-more-toggle";btn.textContent="More";btn.setAttribute("aria-expanded","false");
    const menu=document.createElement("div");menu.className="nav-more-menu";
    secondary.forEach(a=>menu.appendChild(a));
    wrap.append(btn,menu);
    const portal=links.find(a=>/login|client portal/i.test(a.textContent));
    nav.insertBefore(wrap,portal||null);
    btn.addEventListener("click",()=>{const open=wrap.classList.toggle("open");btn.setAttribute("aria-expanded",String(open))});
    document.addEventListener("click",e=>{if(!wrap.contains(e.target)){wrap.classList.remove("open");btn.setAttribute("aria-expanded","false")}});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){wrap.classList.remove("open");btn.setAttribute("aria-expanded","false");btn.focus()}});
  });
})();