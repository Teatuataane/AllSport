#!/usr/bin/env node
// Can head-to-head games grade and DISCOVER per-sport skill at AllSport's size?
//
// SYNTHETIC players only — no production data, no names. Volumes are sized to
// the real club: 4 regulars (~300 games/yr), 6 mid, 14 occasional (~24/yr),
// ~14 sessions a month, two game events per session, 3–4 players per game.
//
// Reports: (1) discovery — is a player's true best sport in their estimated
// top three; (2) grading — how closely a sport rating tracks true skill, by
// games played IN that sport; (3) how many top-20% colours land correctly.
// Compares one separate rating per sport against a pooled rating plus a
// per-sport offset. Run under two assumptions about how much sport-specific
// talent differs from general athleticism, because that is unknown.
//
//   node scripts/sim-skill-rating.mjs

let seed=1;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
const gauss=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const L=x=>1/(1+Math.exp(-x));const E=12,SPM=14;
const GROUPS=[['regular',4,.45],['mid',6,.12],['occasional',14,.035]];
function run(sd,months,s){seed=s;const P=[];
 for(const [grp,n,p] of GROUPS)for(let i=0;i<n;i++)P.push({grp,p,g:gauss(),o:Array.from({length:E},()=>gauss()*sd),
  rE:Array(E).fill(0),rG:0,d:Array(E).fill(0),n:Array(E).fill(0)});
 for(let t=0;t<months*SPM;t++){const h=P.filter(x=>rnd()<x.p);if(h.length<2)continue;
  for(const e of [Math.floor(rnd()*E),Math.floor(rnd()*E)])for(const a of h)for(let k=0;k<2;k++){
   const b=h[Math.floor(rnd()*h.length)];if(b===a)continue;
   const w=rnd()<L((a.g+a.o[e])-(b.g+b.o[e]))?1:0;
   const ea=L(a.rE[e]-b.rE[e]);a.rE[e]+=.3*(w-ea);b.rE[e]-=.3*(w-ea);
   const r=w-L((a.rG+a.d[e])-(b.rG+b.d[e]));a.rG+=.2*r;b.rG-=.2*r;a.d[e]+=.15*r;b.d[e]-=.15*r;
   a.n[e]++;b.n[e]++;}}
 return P;}
const corr=(xs,ys)=>{const n=xs.length;if(n<3)return null;const mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
 let c=0,vx=0,vy=0;for(let i=0;i<n;i++){c+=(xs[i]-mx)*(ys[i]-my);vx+=(xs[i]-mx)**2;vy+=(ys[i]-my)**2;}return c/Math.sqrt(vx*vy);};
const pct=x=>x==null?'   —':String(Math.round(x*100)).padStart(3)+'%';
const f2=x=>x==null?'  —':x.toFixed(2);
for(const sd of [.5,1]){
 console.log(`\n══ offset SD ${sd} ${sd===.5?'(general athleticism dominates)':'(sport-specific talent matters as much)'} ══`);
 console.log('\nDISCOVERY at 12 months — is your true best sport in your top 3?');
 console.log('group        players who have played   hit    by chance   lift');
 console.log('             4+ sports (can be ranked)');
 const S=40;const dis={};const buckets={};const prec={A:[0,0],B:[0,0]};
 for(let s=1;s<=S;s++){const P=run(sd,12,s*7919);
  for(const [grp] of GROUPS){const d=(dis[grp]??={q:0,t:0,hit:0,base:0});
   for(const x of P.filter(p=>p.grp===grp)){d.t++;const pl=[...Array(E).keys()].filter(e=>x.n[e]>0);if(pl.length<4)continue;d.q++;
    const best=pl.reduce((m,e)=>x.o[e]>x.o[m]?e:m,pl[0]);
    if([...pl].sort((i,j)=>x.d[j]-x.d[i]).slice(0,3).includes(best))d.hit++;d.base+=3/pl.length;}}
  // GRADING accuracy: per (player,event) estimate vs truth, bucketed by games played IN THAT SPORT
  const cells=[];for(const x of P)for(let e=0;e<E;e++)if(x.n[e]>0)cells.push({n:x.n[e],t:x.g+x.o[e],A:x.rE[e],B:x.rG+x.d[e]});
  for(const [lab,lo,hi] of [['1–4',1,4],['5–9',5,9],['10–19',10,19],['20+',20,1e9]]){
   const c=cells.filter(z=>z.n>=lo&&z.n<=hi);const b=(buckets[lab]??={A:[],B:[],k:0});
   const ca=corr(c.map(z=>z.A),c.map(z=>z.t)),cb=corr(c.map(z=>z.B),c.map(z=>z.t));
   if(ca!=null){b.A.push(ca);b.B.push(cb);b.k+=c.length;}}
  // Would a "top 20% in this sport" colour go to the right people? (cells with 10+ games)
  const c10=cells.filter(z=>z.n>=10);if(c10.length>=5){const q=Math.max(1,Math.round(c10.length*.2));
   const trueTop=new Set([...c10].sort((a,b)=>b.t-a.t).slice(0,q));
   for(const k of ['A','B']){const est=[...c10].sort((a,b)=>b[k]-a[k]).slice(0,q);prec[k][0]+=est.filter(z=>trueTop.has(z)).length;prec[k][1]+=q;}}
 }
 for(const [grp] of GROUPS){const d=dis[grp];const h=d.q?d.hit/d.q:null,bs=d.q?d.base/d.q:null;
  console.log(`${grp.padEnd(13)}${pct(d.q/d.t).padStart(10)}              ${pct(h)}   ${pct(bs)}      ${h==null?'—':'+'+Math.round((h-bs)*100)+' pts'}`);}
 console.log('\nGRADING accuracy — how well a sport rating tracks true skill in that sport');
 console.log('(correlation, 1.00 = perfect) by games played IN THAT SPORT');
 console.log('games in sport   separate per sport   pooled + offset   cells/run');
 const avg=a=>a.length?a.reduce((x,y)=>x+y)/a.length:null;
 for(const lab of ['1–4','5–9','10–19','20+']){const b=buckets[lab];
  console.log(`  ${lab.padEnd(14)}${f2(avg(b.A)).padStart(12)}        ${f2(avg(b.B)).padStart(12)}    ${Math.round(b.k/S)}`);}
 console.log(`\nIf the top 20% in a sport (10+ games) earned a colour, share that go to the RIGHT people:`);
 console.log(`  separate per sport ${pct(prec.A[0]/prec.A[1])}      pooled + offset ${pct(prec.B[0]/prec.B[1])}`);
}
