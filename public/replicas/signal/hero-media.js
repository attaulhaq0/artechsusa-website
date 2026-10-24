/* Native Signal service-hero pointer motion, with a still frame while media is unavailable. */
(()=>{
 'use strict';
 const paused=()=>document.documentElement.classList.contains('replica-motion-paused');
 const media=[];
 document.querySelectorAll('.services-ban-img').forEach(figure=>{
  const video=figure.querySelector('video'),poster=figure.querySelector('.hero-video-poster');if(!video||!poster)return;
  let pending=null;
  const cancel=()=>{if(pending!==null&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(pending);pending=null;};
  const still=()=>{cancel();figure.dataset.heroMediaState='poster';};
  const playing=()=>{
   if(paused()||video.paused||video.readyState<2){still();return;}
   if(video.requestVideoFrameCallback){if(pending!==null)return;pending=video.requestVideoFrameCallback(()=>{pending=null;if(!paused()&&!video.paused&&video.readyState>=2)figure.dataset.heroMediaState='video';else still();});}
   else requestAnimationFrame(()=>{if(!paused()&&!video.paused&&video.readyState>=2)figure.dataset.heroMediaState='video';});
  };
  ['pause','waiting','stalled','error','emptied'].forEach(type=>video.addEventListener(type,still));
  ['playing','loadeddata','canplay'].forEach(type=>video.addEventListener(type,playing));
  media.push({video,still,playing});playing();
 });
 const host=document.querySelector('.siBanner'),ring=document.querySelector('.services-ban-img .industryHover');
 let frame=null,targetX=0,targetY=0,x=0,y=0;
 if(ring)ring.style.transform='translate(0px, 0px)';
 function move(){frame=null;if(paused()||!ring)return;x+=.1*(targetX-x);y+=.1*(targetY-y);ring.style.transform=`translate(${x}px, ${y}px)`;if(Math.abs(targetX-x)>.02||Math.abs(targetY-y)>.02)frame=requestAnimationFrame(move);}
 host?.addEventListener('mousemove',event=>{
  if(paused()||!ring)return;const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;
  targetX=420*((event.clientX-rect.left)/rect.width-.5);targetY=420*((event.clientY-rect.top)/rect.height-.5);
  if(frame===null)frame=requestAnimationFrame(move);
 },{passive:true});
 new MutationObserver(()=>{
  if(paused()){if(frame!==null)cancelAnimationFrame(frame);frame=null;media.forEach(m=>m.still());}
  else{media.forEach(m=>m.playing());if(ring&&frame===null&&(Math.abs(targetX-x)>.02||Math.abs(targetY-y)>.02))frame=requestAnimationFrame(move);}
 }).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 addEventListener('pagehide',()=>{if(frame!==null)cancelAnimationFrame(frame);media.forEach(m=>m.still());},{once:true});
})();
