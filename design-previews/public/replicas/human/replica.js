(() => {
  'use strict';
  const data=window.ArtechsReplicaData||{};
  const pageId=document.body.dataset.pageId;
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const $=(s,r=document)=>r.querySelector(s);
  const origin=location.origin==='null'?'*':location.origin;
  const embedded=parent!==window;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageForPath=href=>{
    let url;try{url=new URL(href,location.href);}catch{return null;}
    const file=url.pathname.split('/').pop();
    return (data.pages||[]).find(p=>p.file?.split('/').pop()===file);
  };
  const send=payload=>{if(embedded)parent.postMessage(payload,origin);};
  let motionEnabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionMedia=matchMedia('(prefers-reduced-motion: reduce)');
  let motionExplicit=false;
  let revealObserver=null;
  const revealTargets=$$('.main-wrapper > section > .container .column > h2,.main-wrapper > section > .container .column > p[data-w-id]');
  const splits=[],highlightTweens=[];
  const caseTimers=[];
  const allSwipers=[];
  let sourceIconsReady=false,sourceTimelineReady=false,sourceLifecycleReady=false;
  function initializeSourceLifecycle(){
    if(sourceLifecycleReady||!window.gsap||!window.ScrollTrigger)return;
    const items=$$('.lifecycle-content-wrap'),images=$$('[class^="box-img"]');
    const wrapper=$('.cycle-box-wrapper'),box=$('.cycle-box-wrap');
    if(!items.length||!wrapper)return;sourceLifecycleReady=true;
    const colors=['#ECF7EC','#F0FAFB','#F5F5F5'];let active=-1,triggers=[],observer=null;
    function setActive(index){
      if(!motionEnabled||index===active)return;active=index;
      items.forEach((item,i)=>item.classList.toggle('active',i===index));
      images.forEach((image,i)=>gsap.to(image,{opacity:i===index?1:0,duration:.35,ease:'power2.inOut',overwrite:true}));
      if(box)gsap.to(box,{backgroundColor:colors[index]||colors[0],duration:.35,ease:'power2.inOut',overwrite:true});
    }
    gsap.set(images,{opacity:0});if(images[0])gsap.set(images[0],{opacity:1});
    if(box)gsap.set(box,{backgroundColor:colors[0]});
    items.forEach((item,i)=>item.classList.toggle('active',i===0));
    function resizeLifecycle(){
      triggers.forEach(t=>t.kill());triggers=[];observer?.disconnect();active=-1;
      if(innerWidth<=991){
        items.forEach((item,i)=>triggers.push(ScrollTrigger.create({trigger:item,start:'top 50%',end:'top 15%',onEnter:()=>setActive(i),onEnterBack:()=>setActive(i)})));
        observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
          if(entry.isIntersecting&&motionEnabled){items.forEach(item=>item.classList.remove('is-active'));entry.target.classList.add('is-active');}
        }),{rootMargin:'-15% 0px -70% 0px',threshold:0});items.forEach(item=>observer.observe(item));
      }else{
        triggers.push(ScrollTrigger.create({trigger:wrapper,start:'top 80%',end:'bottom 20%',onUpdate:self=>setActive(self.progress<.42?0:self.progress<.7?1:2),onLeaveBack:()=>setActive(0)}));
      }
      setActive(0);ScrollTrigger.refresh();
      if(!motionEnabled)triggers.forEach(t=>t.disable(false));
    }
    resizeLifecycle();let timer;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(resizeLifecycle,200);});
    addEventListener('load',()=>ScrollTrigger.refresh());
    highlightTweens.push({scrollTrigger:{enable:()=>triggers.forEach(t=>t.enable()),disable:()=>triggers.forEach(t=>t.disable(false))}});
  }
  function initializeSourceIcons(){
    if(sourceIconsReady||!window.gsap||!window.ScrollTrigger)return;
    sourceIconsReady=true;
    const icons=$$('.learning-partnership-container .an-icon');
    const stableRand=(index,min,max,offset=0)=>{
      let seed=(index+1)*7919+offset*104729;seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;
      return min+(max-min)*(Math.abs(seed%10000)/10000);
    };
    icons.forEach((icon,index)=>{
      const number=index+1;let x,y;
      if(number===1){x=stableRand(index,-120,120,1);y=stableRand(index,-80,80,2);}
      else if(number===2||number===3){x=stableRand(index,-40,40,1);y=stableRand(index,-120,-80,2);}
      else if(number===4){x=stableRand(index,100,150,1);y=stableRand(index,-20,20,2);}
      else{x=stableRand(index,-40,40,1);y=stableRand(index,80,120,2);}
      icon.style.position='relative';
      const blur=document.createElement('div');blur.style.cssText='position:absolute;inset:0;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:none;';icon.append(blur);
      gsap.set(icon,{scale:1.3,x,y});
      highlightTweens.push(gsap.to(icon,{scale:1,x:0,y:0,ease:'none',scrollTrigger:{trigger:'.learning-partnership-container',start:'top bottom',end:'50% 50%',scrub:true}}));
      highlightTweens.push(gsap.to(blur,{opacity:0,ease:'none',scrollTrigger:{trigger:'.learning-partnership-container',start:'top bottom',end:'50% 50%',scrub:true}}));
    });
  }
  function initializeSourceTimeline(){
    if(sourceTimelineReady||!window.gsap||!window.ScrollTrigger)return;
    const timeline=$('.timeline-wrapper'),wrap=$('.timeline-line-wrap'),line=$('.timeline-line');
    if(!timeline||!wrap||!line)return;sourceTimelineReady=true;
    const items=$$('.timeline-content-wrapper',timeline).map(item=>({item,circle:$('.timeline-circle',item),year:$('.timeline-year',item),content:[$('.timeline-paragraph',item),$('img',item),$('.button-article',item)].filter(Boolean),animated:false}));
    items.forEach(data=>{if(data.year)gsap.set(data.year,{opacity:0,y:10});gsap.set(data.content,{opacity:0,y:15});});
    function update(){
      if(!motionEnabled)return;
      const target=innerHeight*.65,rect=wrap.getBoundingClientRect(),height=wrap.offsetHeight;
      const percent=Math.max(0,Math.min(100,(target-rect.top)/height*100));gsap.set(line,{height:percent+'%'});
      items.forEach(data=>{
        if(!data.circle)return;
        const position=(data.circle.getBoundingClientRect().top-rect.top)/height*100;
        const enter=percent>=position;if(enter===data.animated)return;data.animated=enter;
        if(data.year)gsap.killTweensOf(data.year);gsap.killTweensOf(data.content);
        const tl=gsap.timeline();
        if(enter){data.circle.classList.add('is-active');if(data.year)tl.to(data.year,{opacity:1,y:0,duration:.4,ease:'power2.out'},.1);tl.to(data.content,{opacity:1,y:0,duration:.5,stagger:.1,ease:'power2.out'},.2);}
        else{tl.to(data.content,{opacity:0,y:15,duration:.3,stagger:.05,ease:'power2.in'},0);if(data.year)tl.to(data.year,{opacity:0,y:10,duration:.25,ease:'power2.in'},.1);data.circle.classList.remove('is-active');}
      });
    }
    const trigger=ScrollTrigger.create({trigger:timeline,start:'top 70%',end:'bottom -200%',scrub:.3,onUpdate:update});
    highlightTweens.push({scrollTrigger:trigger});
    let timer;addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(update,50);},{passive:true});update();
  }
  function updateVideoButtons(video){
    const control=video.parentElement.querySelector('[data-video-control]');
    if(control){control.textContent=video.paused?'Play animation':'Pause animation';control.setAttribute('aria-label',control.textContent);control.setAttribute('aria-pressed',String(!video.paused));}
  }
  // Keep the source hero's animated portrait while making its mock profile and input unambiguous.
  function initializeHeroComposition(video){
    if(!video.closest('.home-hero_video-group'))return;
    const composition=video.parentElement;
    composition.classList.add('replica-hero-composition');
    const format=video.getAttribute('src')?.includes('5f02a341fe425884')?'desktop':video.getAttribute('src')?.includes('e6d8baf211d0e491')?'tablet':'mobile';
    composition.dataset.heroFormat=format;
    const artwork=document.createElement('div');artwork.className='replica-hero-artwork-overlay';composition.append(artwork);
    const profile=document.createElement('div');profile.className='replica-hero-profile';
    profile.innerHTML='<span>Technical expertise</span><span class="replica-hero-profile-status">AI &amp; Data</span><span class="replica-hero-profile-role">Machine Learning Engineering</span>';
    artwork.append(profile);
    if(format!=='mobile'){
      const hint=document.createElement('span');hint.className='replica-hero-input-hint';hint.textContent='Explore your data';artwork.append(hint);
    }
    function sizeComposition(){
      composition.style.setProperty('--hero-graphic-scale',String(video.getBoundingClientRect().width/(video.videoWidth||({desktop:2758,tablet:1514,mobile:750})[format])));
      artwork.style.height=video.offsetHeight+'px';
    }
    new ResizeObserver(sizeComposition).observe(video);video.addEventListener('loadedmetadata',sizeComposition);sizeComposition();
  }
  function animateSourceText(){
    if(!window.gsap||!window.ScrollTrigger)return;
    gsap.registerPlugin(ScrollTrigger);
    initializeSourceIcons();initializeSourceTimeline();initializeSourceLifecycle();
    if(window.SplitType&&!splits.length){
      $$('.scroll-highlight').forEach(el=>{
        const split=new SplitType(el,{types:'chars,words'});splits.push(split);
        gsap.set(split.chars,{color:'#A1A6A9'});
        const tween=gsap.to(split.chars,{
          color:'#10292C',ease:'none',stagger:innerWidth<=767?.03:.08,
          scrollTrigger:{trigger:el,start:'top 85%',end:innerWidth<=767?'+=100%':'top 20%',scrub:true,invalidateOnRefresh:true}
        });highlightTweens.push(tween);
      });
    }
    if(!revealObserver){
      revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        if(motionEnabled)gsap.fromTo(entry.target,{opacity:0,y:30},{opacity:1,y:0,duration:.75,ease:'power3.out',clearProps:'opacity,transform'});
        revealObserver.unobserve(entry.target);
      }),{threshold:.12});
      revealTargets.forEach(e=>revealObserver.observe(e));
    }
    ScrollTrigger.refresh();
  }
  function setMotion(enabled,explicit=false){
    motionEnabled=!!enabled;motionExplicit=motionExplicit||explicit;
    if(window.gsap&&window.ScrollTrigger){gsap.registerPlugin(ScrollTrigger);initializeSourceLifecycle();}
    document.body.classList.toggle('motion-paused',!motionEnabled);
    document.documentElement.classList.toggle('motion-explicitly-enabled',motionEnabled&&motionExplicit);
    $$('video').forEach(video=>{
      if(motionEnabled)video.play().catch(()=>updateVideoButtons(video));else video.pause();
      updateVideoButtons(video);
    });
    $$('img[data-motion-gif]').forEach(img=>{
      if(!img.dataset.motionOriginal)img.dataset.motionOriginal=img.getAttribute('src');
      if(!img.dataset.motionSrcset)img.dataset.motionSrcset=img.getAttribute('srcset')||'';
      img.src=motionEnabled?img.dataset.motionOriginal:img.dataset.motionStill;
      if(motionEnabled&&img.dataset.motionSrcset)img.setAttribute('srcset',img.dataset.motionSrcset);else img.removeAttribute('srcset');
    });
    if(window.gsap){
      if(motionEnabled){
        gsap.globalTimeline.resume();
        animateSourceText();
        highlightTweens.forEach(t=>t.scrollTrigger?.enable());
      }else{
        highlightTweens.forEach(t=>t.scrollTrigger?.disable(false));
        gsap.killTweensOf(revealTargets);
        gsap.set(revealTargets,{opacity:1,y:0,clearProps:'opacity,transform'});
        splits.forEach(s=>gsap.set(s.chars,{color:'#10292C'}));
        gsap.globalTimeline.pause();
      }
    }
    document.dispatchEvent(new CustomEvent('replica-motion-change',{detail:{enabled:motionEnabled}}));
  }
  $$('video').forEach(video=>{
    initializeHeroComposition(video);
    video.muted=true;
    video.addEventListener('loadeddata',()=>{
      if(!motionEnabled&&video.currentTime<.1)video.currentTime=Math.min(1,Number.isFinite(video.duration)?video.duration*.2:1);
      if(motionEnabled)video.play().catch(()=>{});
      updateVideoButtons(video);
    });
    ['play','pause','ended'].forEach(type=>video.addEventListener(type,()=>updateVideoButtons(video)));
    const control=video.parentElement.querySelector('[data-video-control]');
    control?.addEventListener('click',()=>{
      if(video.paused)video.play().catch(()=>{});else video.pause();
    });
  });
  addEventListener('message',event=>{
    if(event.source!==parent||!event.data)return;
    if(event.data.type==='replica:motion'&&typeof event.data.enabled==='boolean')setMotion(event.data.enabled,true);
  });
  motionMedia.addEventListener('change',event=>{if(!motionExplicit)setMotion(!event.matches);});

  // The reference mega menus and mobile drawer use their original Webflow CSS states.
  const nav=$('.navbar');
  const announcement=$('.navbar-banner');
  function positionNavbar(){
    if(nav)nav.style.top=Math.max(0,announcement?.getBoundingClientRect().bottom||0)+'px';
  }
  positionNavbar();addEventListener('scroll',positionNavbar,{passive:true});addEventListener('resize',positionNavbar);
  $$('.nav-button[data-button="true"]').forEach(button=>{
    const setHovered=value=>button.setAttribute('data-hovered',String(value&&innerWidth>=993));
    button.addEventListener('pointerenter',()=>setHovered(true));
    button.addEventListener('pointerleave',()=>setHovered(button.matches(':focus-visible')));
    button.addEventListener('focus',()=>setHovered(true));
    button.addEventListener('blur',()=>setHovered(button.matches(':hover')));
    addEventListener('resize',()=>setHovered(button.matches(':hover,:focus-visible')));
  });
  const menu=$('.nav-link-wrapper');
  const menuButton=$('.w-nav-button');
  if(menuButton){menuButton.role='button';menuButton.tabIndex=0;menuButton.setAttribute('aria-label','Toggle navigation menu');menuButton.setAttribute('aria-expanded','false');}
  const dropdowns=$$('.nav-dropdown');
  const overlay=$('.navbar-overlay');
  let mobileOpen=false;
  let activeDropdown=null,dropdownCloseTimer;
  function cancelDropdownClose(){clearTimeout(dropdownCloseTimer);dropdownCloseTimer=null;}
  function updateDropdownOverlay(){overlay?.classList.toggle('is-active',innerWidth>=992&&!!activeDropdown);}
  function scheduleDropdownClose(group){
    cancelDropdownClose();
    dropdownCloseTimer=setTimeout(()=>{
      if(activeDropdown!==group||group.matches(':hover')||group.contains(document.activeElement))return;
      closeDropdown(group);updateDropdownOverlay();
    },80);
  }
  function closeDropdown(group){
    const toggle=$('.w-dropdown-toggle',group),list=$('.w-dropdown-list',group);
    toggle?.classList.remove('w--open');list?.classList.remove('w--open');
    toggle?.setAttribute('aria-expanded','false');
    if(activeDropdown===group)activeDropdown=null;
  }
  function closeAllDropdowns(){cancelDropdownClose();dropdowns.forEach(closeDropdown);updateDropdownOverlay();}
  function openDropdown(group){
    cancelDropdownClose();
    dropdowns.forEach(g=>{if(g!==group)closeDropdown(g);});
    const toggle=$('.w-dropdown-toggle',group),list=$('.w-dropdown-list',group);
    toggle?.classList.add('w--open');list?.classList.add('w--open');
    toggle?.setAttribute('aria-expanded','true');
    activeDropdown=group;updateDropdownOverlay();
  }
  dropdowns.forEach(group=>{
    const toggle=$('.w-dropdown-toggle',group);if(!toggle)return;
    toggle.role='button';toggle.tabIndex=0;toggle.setAttribute('aria-expanded','false');
    group.addEventListener('mouseenter',()=>{if(innerWidth>=992)openDropdown(group);});
    group.addEventListener('mouseleave',()=>{
      if(innerWidth<992)return;
      scheduleDropdownClose(group);
    });
    group.addEventListener('focusin',cancelDropdownClose);
    group.addEventListener('focusout',event=>{if(innerWidth>=992&&!group.contains(event.relatedTarget))scheduleDropdownClose(group);});
    toggle.addEventListener('click',event=>{
      event.preventDefault();
      if(toggle.getAttribute('aria-expanded')==='true'){cancelDropdownClose();closeDropdown(group);updateDropdownOverlay();}
      else openDropdown(group);
    });
    toggle.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle.click();}
      if(event.key==='ArrowDown'){event.preventDefault();openDropdown(group);$('.w-dropdown-list a',group)?.focus();}
    });
  });
  function setMobileMenu(value){
    mobileOpen=!!value;menuButton?.classList.toggle('w--open',mobileOpen);
    menuButton?.setAttribute('aria-expanded',String(mobileOpen));
    if(mobileOpen)menu?.setAttribute('data-nav-menu-open','');else menu?.removeAttribute('data-nav-menu-open');
    if(mobileOpen)document.body.style.overflow='hidden';else document.body.style.removeProperty('overflow');
    if(!mobileOpen)closeAllDropdowns();
  }
  menuButton?.addEventListener('click',()=>setMobileMenu(!mobileOpen));
  menuButton?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setMobileMenu(!mobileOpen);}});
  overlay?.addEventListener('click',closeAllDropdowns);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const focusedDropdown=dropdowns.find(group=>group.contains(document.activeElement));
    closeAllDropdowns();
    if(mobileOpen){setMobileMenu(false);menuButton?.focus();}
    else if(focusedDropdown)$('.w-dropdown-toggle',focusedDropdown)?.focus();
  });
  addEventListener('resize',()=>{if(innerWidth>=992&&mobileOpen)setMobileMenu(false);updateDropdownOverlay();});

  // Source tabs, including the five candidate steps, retain their captured anatomy.
  $$('.w-tabs').forEach((tabs,tabsIndex)=>{
    const links=$$('.w-tab-menu > .w-tab-link',tabs);
    const content=$('.w-tab-content',tabs);
    const panes=content?Array.from(content.children).filter(p=>p.classList.contains('w-tab-pane')):[];
    if(!links.length||!panes.length)return;
    const setTab=index=>{
      links.forEach((link,i)=>{
        const active=i===index;link.classList.toggle('w--current',active);link.setAttribute('aria-selected',String(active));link.tabIndex=active?0:-1;
        const name=link.getAttribute('data-w-tab');
        panes.filter(p=>p.getAttribute('data-w-tab')===name).forEach(p=>p.classList.toggle('w--tab-active',active));
      });
      tabs.dataset.activeTab=String(index);
      window.ScrollTrigger?.refresh();
    };
    tabs.replicaSetTab=setTab;
    links.forEach((link,i)=>{
      link.role='tab';link.id='replica-tab-'+tabsIndex+'-'+i;
      const pane=panes.find(p=>p.getAttribute('data-w-tab')===link.getAttribute('data-w-tab'));
      if(pane){pane.id='replica-pane-'+tabsIndex+'-'+i;pane.role='tabpanel';pane.setAttribute('aria-labelledby',link.id);link.setAttribute('aria-controls',pane.id);}
      link.addEventListener('click',event=>{event.preventDefault();setTab(i);});
      link.addEventListener('keydown',event=>{
        if(event.key==='ArrowRight'||event.key==='ArrowDown'){event.preventDefault();const next=(i+1)%links.length;setTab(next);links[next].focus();}
        if(event.key==='ArrowLeft'||event.key==='ArrowUp'){event.preventDefault();const next=(i-1+links.length)%links.length;setTab(next);links[next].focus();}
      });
    });
    setTab(Math.max(0,links.findIndex(l=>l.classList.contains('w--current'))));
    if(tabs.classList.contains('case-study-tabs_tab-element')&&innerWidth>=480){
      let elapsed=0,last=performance.now(),hover=false,inView=false;
      new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;},{threshold:.45}).observe(tabs);
      tabs.addEventListener('mouseenter',()=>hover=true);tabs.addEventListener('mouseleave',()=>hover=false);
      links.forEach(link=>link.addEventListener('click',()=>{elapsed=0;}));
      const frame=now=>{
        const delta=Math.min(now-last,100);last=now;
        if(motionEnabled&&!hover&&inView){
          elapsed+=delta;
          const active=Number(tabs.dataset.activeTab||0);
          links.forEach((link,i)=>{const bar=$('.case-study-tabs_active-inner',link);if(bar)bar.style.width=i===active?Math.min(elapsed/8000*100,100)+'%':'0%';});
          if(elapsed>=8000){elapsed=0;setTab((active+1)%links.length);}
        }
        requestAnimationFrame(frame);
      };caseTimers.push(frame);requestAnimationFrame(frame);
    }
  });

  // The source solution accordions are local and keyboard accessible.
  $$('.solution-dropdown-main-wrapper').forEach((group,index)=>{
    const cards=$$('.solution-dropdown-wrapper',group);
    function select(card){
      const wasOpen=$('.solution-dropdown-title-wrap',card)?.getAttribute('aria-expanded')==='true';
      cards.forEach(c=>{
        const open=c===card&&!wasOpen,toggle=$('.solution-dropdown-title-wrap',c),content=$('.solution-dropdown-content-wrap',c);
        toggle?.setAttribute('aria-expanded',String(open));
        if(content){content.style.width='100%';content.style.height=open?content.scrollHeight+'px':'0px';content.style.opacity='1';}
        c.classList.toggle('replica-open',open);
      });
      setTimeout(()=>window.ScrollTrigger?.refresh(),330);
    }
    cards.forEach((card,i)=>{
      const toggle=$('.solution-dropdown-title-wrap',card),content=$('.solution-dropdown-content-wrap',card);
      if(!toggle||!content)return;
      toggle.role='button';toggle.tabIndex=0;toggle.setAttribute('aria-expanded','false');
      content.id='solution-content-'+index+'-'+i;toggle.setAttribute('aria-controls',content.id);
      toggle.addEventListener('click',()=>select(card));toggle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(card);}});
    });
    if(cards[0])select(cards[0]);
    addEventListener('resize',()=>cards.forEach(card=>{const content=$('.solution-dropdown-content-wrap',card);if(content&&card.classList.contains('replica-open'))content.style.height=content.scrollHeight+'px';}));
  });
  const accordionCards=$$('.faq-item');
  accordionCards.forEach((card,i)=>{
    const toggle=$('[data-accordion-toggle],.faq-item-toggle',card),content=$('.accordion-css__item-bottom',card);
    if(!toggle||!content)return;
    const setActive=value=>{
      card.dataset.accordionStatus=value?'active':'not-active';
      toggle.setAttribute('aria-expanded',String(value));content.setAttribute('aria-hidden',String(!value));
    };
    toggle.role='button';toggle.tabIndex=0;
    content.id='replica-faq-content-'+i;toggle.setAttribute('aria-controls',content.id);
    setActive(card.dataset.accordionStatus==='active');
    card.replicaOpen=()=>setActive(true);
    const activate=()=>{
      const next=card.dataset.accordionStatus!=='active';
      if(card.closest('[data-accordion-close-siblings="true"]')){
        $$('.faq-item',card.closest('[data-accordion-close-siblings="true"]')).forEach(other=>{
          other.dataset.accordionStatus='not-active';$('.faq-item-toggle',other)?.setAttribute('aria-expanded','false');
        });
      }
      setActive(next);setTimeout(()=>window.ScrollTrigger?.refresh(),330);
    };
    toggle.addEventListener('click',activate);toggle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
  });

  // Reuse the same locally saved Swiper version and source settings.
  if(window.Swiper){
    $$('.swiper.talent').forEach(el=>{
      let previous=$('.button-prev',el),next=$('.button-next',el);
      if(!previous){previous=document.createElement('div');previous.className='swiper-arrow button-prev';el.append(previous);}
      if(!next){next=document.createElement('div');next.className='swiper-arrow button-next';el.append(next);}
      [previous,next].forEach((e,i)=>{e.role='button';e.tabIndex=0;e.setAttribute('aria-label',i?'Next role':'Previous role');});
      const swiper=new Swiper(el,{init:false,direction:'horizontal',slidesPerView:'auto',spaceBetween:24,loop:true,centeredSlides:true,mousewheel:{forceToAxis:true},speed:300,navigation:{prevEl:previous,nextEl:next},keyboard:{enabled:true,onlyInViewport:true}});
      const jump=()=>{swiper.update();requestAnimationFrame(()=>{if(!swiper.destroyed)swiper.slideToLoop(4,0,false);});};
      swiper.init();jump();setTimeout(jump,150);document.fonts.ready.then(jump);
      allSwipers.push(swiper);
      previous.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')swiper.slidePrev();});next.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')swiper.slideNext();});
    });
    function resizeReferenceSliders(){
      $$('.solution-partner-swiper').forEach(el=>{
        if(innerWidth<=991&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:'auto',spaceBetween:25,grabCursor:true,keyboard:{enabled:true,onlyInViewport:true},pagination:{el:$('.solution-partner-pagination',el.closest('section')),clickable:true}}));
        else if(innerWidth>991&&el.swiper)el.swiper.destroy(true,true);
      });
      $$('.case-study-swiper').forEach(el=>{
        if(innerWidth<=479&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:1,spaceBetween:12,loop:false,pagination:{el:$('.case-study-pagination',el.parentElement),clickable:true}}));
        else if(innerWidth>479&&el.swiper)el.swiper.destroy(true,true);
      });
      $$('.cohorts-swiper').forEach(el=>{
        if(innerWidth<=479&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:1,spaceBetween:20,loop:false,pagination:{el:$('.cohord-swiper-pagination',el.closest('section')),clickable:true}}));
        else if(innerWidth>479&&el.swiper)el.swiper.destroy(true,true);
      });
      $$('.blended-hero-image-holder').forEach(el=>{
        if(innerWidth<=479&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:1,loop:true,effect:'fade',fadeEffect:{crossFade:true},speed:600,pagination:{el:$('.blended-hero-pagination',el.closest('section')),clickable:true}}));
        else if(innerWidth>479&&el.swiper)el.swiper.destroy(true,true);
      });
    }
    resizeReferenceSliders();addEventListener('resize',resizeReferenceSliders);
    $$('.recent-blog-swiper').forEach(el=>{
      const root=el.closest('section'),arrows=$$('.swiper-arrow-button',root);
      arrows.forEach((a,i)=>{a.role='button';a.tabIndex=0;a.setAttribute('aria-label',i?'Next draft article':'Previous draft article');});
      allSwipers.push(new Swiper(el,{slidesPerView:'auto',spaceBetween:20,speed:300,keyboard:{enabled:true,onlyInViewport:true},navigation:{prevEl:arrows[0],nextEl:arrows[1]},pagination:{el:$('.recent-blog-pagination',root),clickable:true}}));
    });
    function resizeCategorySliders(){
      $$('.category-blog-list-wrapper.swiper').forEach(el=>{
        const root=el.closest('section');
        if(innerWidth<=991&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:'auto',spaceBetween:16,speed:300,keyboard:{enabled:true,onlyInViewport:true},pagination:{el:$('.blog-pagination',root),clickable:true},breakpoints:{768:{spaceBetween:24}}}));
        else if(innerWidth>991&&el.swiper)el.swiper.destroy(true,true);
      });
    }
    resizeCategorySliders();addEventListener('resize',resizeCategorySliders);
    function resizworkforceSliders(){
      $$('.team-list-wrapper').forEach(el=>{
        if(innerWidth<=991&&!el.swiper){
          allSwipers.push(new Swiper(el,{slidesPerView:'auto',spaceBetween:16,grabCursor:true,pagination:{el:$('.about-team-pagination',el.closest('section')),clickable:true},keyboard:{enabled:true,onlyInViewport:true}}));
        }else if(innerWidth>991&&el.swiper){el.swiper.destroy(true,true);}
      });
    }
    resizworkforceSliders();addEventListener('resize',resizworkforceSliders);
    function resizeOfferSliders(){
      $$('.max-swiper-container').forEach(el=>{
        if(innerWidth<=991&&!el.swiper)allSwipers.push(new Swiper(el,{slidesPerView:'auto',spaceBetween:20,grabCursor:true,pagination:{el:$('.offer-pagination',el.closest('section')),clickable:true},keyboard:{enabled:true,onlyInViewport:true}}));
        else if(innerWidth>991&&el.swiper)el.swiper.destroy(true,true);
      });
    }
    resizeOfferSliders();addEventListener('resize',resizeOfferSliders);
  }

  // The publication's captured video/filter surface plays local illustrative assets.
  const sampleCards=$$('[data-preview-video]');
  const sampleSeries=sampleCards[0]?.closest('section');
  let sampleCategory='all',showMoreSamples=false;
  function filterSamples(){
    $$('[data-local-filter] input[type="radio"]').forEach(control=>{
      const selected=control.value===sampleCategory;
      const label=control.closest('.filter-radio-wrapper');
      label?.classList.toggle('is-list-active',selected);
      label?.querySelector('.w-radio-input')?.classList.toggle('w--redirected-checked',selected);
    });
    let visible=0;
    sampleCards.forEach(card=>{
      const row=card.closest('.w-dyn-item')||card;
      const match=sampleCategory==='all'||card.dataset.videoCategory===sampleCategory;
      const show=match&&(showMoreSamples||!row.dataset.moreSample);
      row.hidden=!show;row.style.display=show?'':'none';if(show)visible++;
    });
    if(sampleSeries){
      let empty=$('.replica-video-empty',sampleSeries);
      if(!empty){empty=document.createElement('p');empty.className='replica-video-empty text-l';$('.webinar-videos-list',sampleSeries)?.after(empty);}
      empty.hidden=visible>0;empty.textContent='Explore another category.';
      const more=$('[data-show-more]',sampleSeries);if(more)more.style.display=showMoreSamples?'none':'';
    }
  }
  $$('[data-local-filter] input[type="radio"]').forEach(control=>control.addEventListener('change',()=>{
    sampleCategory=control.value;
    filterSamples();
  }));
  $$('[data-local-filter]').forEach(form=>form.addEventListener('submit',e=>e.preventDefault()));
  $$('[data-show-more]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();showMoreSamples=true;filterSamples();}));
  const videoPopup=$('.video-popup'),videoFrame=videoPopup?$('.popup-video-frame',videoPopup):null;
  let popupReturn=null;
  function closeVideo(){
    if(!videoPopup)return;
    $('video',videoPopup)?.pause();videoPopup.style.display='none';videoPopup.style.pointerEvents='none';videoPopup.setAttribute('aria-hidden','true');document.documentElement.classList.remove('popup-locked');popupReturn?.focus?.();
  }
  sampleCards.forEach(card=>{
    card.tabIndex=0;card.role='button';card.setAttribute('aria-label','Play animation: '+($('.webinar-video-title',card)?.textContent||'technology story'));
    const open=()=>{
      if(!videoPopup||!videoFrame)return;
      popupReturn=card;videoFrame.replaceChildren();
      const video=document.createElement('video');video.src=card.dataset.previewVideo;video.controls=true;video.muted=true;video.loop=true;video.playsInline=true;video.className='replica-popup-video';video.preload='auto';
      videoFrame.append(video);videoPopup.style.display='flex';videoPopup.style.opacity='1';videoPopup.style.pointerEvents='auto';videoPopup.style.visibility='visible';videoPopup.setAttribute('aria-hidden','false');videoPopup.role='dialog';videoPopup.setAttribute('aria-modal','true');videoPopup.setAttribute('aria-label','Technology and talent animation');document.documentElement.classList.add('popup-locked');
      const caption=document.createElement('p');caption.className='replica-popup-caption';caption.textContent='Technology and talent';videoFrame.append(caption);
      video.addEventListener('loadeddata',()=>{if(motionEnabled)video.play().catch(()=>{});else video.currentTime=Math.min(1,video.duration*.2);});
      $('.exit-svg',videoPopup)?.focus();
    };
    card.addEventListener('click',open);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
  const popupClose=videoPopup?$('.exit-svg',videoPopup):null;
  if(popupClose){popupClose.role='button';popupClose.tabIndex=0;popupClose.setAttribute('aria-label','Close animation player');popupClose.addEventListener('click',closeVideo);popupClose.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();closeVideo();}});}
  videoPopup?.addEventListener('click',event=>{if(event.target===videoPopup)closeVideo();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&videoPopup?.style.display==='flex')closeVideo();});
  filterSamples();

  // Sample content opens locally and never invokes source-company accounts or services.
  const dialog=$('#replica-dialog');
  $('.replica-dialog-close button',dialog)?.addEventListener('click',()=>dialog.close());
  let returnFocus=null;
  function showDialog(id,trigger){
    let title='Technology resources',body='';
    if(id.startsWith('scenario-')){
      const item=(data.scenarios||[])[Number(id.split('-').pop())]||{};
      title=item.title||'Technology in practice';
      body='<p>'+escape(item.body)+'</p>'+
        [['The requirement',item.challenge],['Scope and responsibilities',item.proposed_scope],['Connection with the team',item.talent_connection],['Inputs to discuss',item.client_inputs]].map(([h,p])=>'<h3>'+escape(h)+'</h3><p>'+escape(p)+'</p>').join('')+
        '<a class="button" href="/replicas/human/07-contact.html">Discuss a requirement</a>';
    }else if(id==='leadership'){
      title='People and responsibilities';
      body='<p>Define the expertise, team structure and responsibilities your work needs. Start a conversation around the systems, specialist skills and delivery scope.</p>';
    }else if(id==='social-profile'){
      title='Connect with Artechs USA';
      body='<p>Explore technology services and specialist staffing, then introduce your requirements.</p>';
    }else if(id==='preferences'){
      title='Motion preferences';
      body='<p>Motion follows your device preference. Use Play or Pause to control the animation.</p>';
    }else{
      title='Explore Artechs USA';
      body='<p>Explore technology services, staffing models and career paths.</p><p><a class="button-link" href="/replicas/human/02-services.html">Technology services</a></p><p><a class="button-link" href="/replicas/human/06-careers.html">Candidate journey</a></p>';
    }
    $('.replica-dialog-content',dialog).innerHTML='<h2>'+escape(title)+'</h2>'+body;
    returnFocus=trigger;dialog.showModal();$('.replica-dialog-close button',dialog)?.focus();
  }
  dialog?.addEventListener('close',()=>returnFocus?.focus?.());
  dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  $$('[data-modal]').forEach(e=>{
    if(e.tagName!=='A'){e.tabIndex=0;e.role='button';}
    e.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showDialog(e.dataset.modal,e);}});
  });
  document.addEventListener('click',event=>{
    const modalTrigger=event.target.closest('[data-modal]');
    if(modalTrigger){event.preventDefault();showDialog(modalTrigger.dataset.modal,modalTrigger);return;}
    const anchor=event.target.closest('a');if(!anchor||event.defaultPrevented||anchor.classList.contains('w-tab-link')||anchor.closest('.w-dropdown-toggle'))return;
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const href=anchor.getAttribute('href')||'';
    if(href.startsWith('#')){
      const target=document.getElementById(href.slice(1));
      if(target){event.preventDefault();target.closest('.faq-item')?.replicaOpen?.();if(anchor.classList.contains('toc-link')){ $$('.toc-link',anchor.parentElement).forEach(a=>a.classList.toggle('is-active',a===anchor)); }target.scrollIntoView({behavior:motionEnabled?'smooth':'auto',block:'start'});}
      return;
    }
    const target=pageForPath(href);
    if(target&&embedded){event.preventDefault();send({type:'replica:navigate',pageId:target.id});}
  });

  // Six/seven-field native forms validate in memory and then show the precise local completion.
  $$('[data-preview-form]').forEach(form=>{
    const fields=Array.from(form.elements).filter(e=>e.matches('input,select,textarea'));
    const summary=$('.replica-form-errors',form);
    fields.forEach(control=>{
      const error=document.getElementById(control.id+'-error');
      const clear=()=>{control.removeAttribute('aria-invalid');if(error)error.hidden=true;};
      control.addEventListener(control.type==='checkbox'||control.tagName==='SELECT'?'change':'input',clear);
      if(control.type==='file')control.addEventListener('change',()=>{
        clear();const state=$('.replica-file-state',control.parentElement);
        if(state)state.textContent=control.files?.[0]?'Selected file: '+control.files[0].name:'Select your résumé.';
      });
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const invalid=[];
      fields.forEach(control=>{
        const missing=control.required&&(control.type==='checkbox'?!control.checked:control.type==='file'?!control.files?.length:!control.value.trim());
        const badEmail=control.type==='email'&&control.value.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value.trim());
        const error=document.getElementById(control.id+'-error');
        if(missing||badEmail){
          control.setAttribute('aria-invalid','true');if(error){error.hidden=false;error.textContent=error.dataset.message||'Complete this required field.';}invalid.push(control);
        }else{control.removeAttribute('aria-invalid');if(error)error.hidden=true;}
      });
      if(invalid.length){summary.hidden=false;summary.textContent='Check the required fields to continue.';invalid[0].focus();return;}
      summary.hidden=false;summary.textContent='Continue exploring technology services, staffing and career paths.';
      fields.forEach(control=>{if(control.type==='checkbox')control.checked=false;else control.value='';});
      if(embedded)send({type:'replica:navigate',pageId:'14-thank-you'});else location.href='/replicas/human/14-thank-you.html';
    });
  });
  setMotion(motionEnabled);
  requestAnimationFrame(()=>requestAnimationFrame(()=>send({type:'replica:ready',pageId})));
})();
