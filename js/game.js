
const T=4,H=3.2,N=10,S=2*N+1,PAL=['#d58a93','#d6a08f','#d4b088','#8cbfa9','#98a2cc','#7caed3','#bf94cf'];
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cv=$('g'),ren=new THREE.WebGLRenderer({canvas:cv,antialias:true});ren.autoClear=false;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x6a5690);scene.fog=new THREE.Fog(0x6a5690,6,32);
const cam=new THREE.PerspectiveCamera(75,1,.1,320);cam.rotation.order='YXZ';
const gunScene=new THREE.Scene(),gunCam=new THREE.PerspectiveCamera(62,1,.03,10),gHemi=new THREE.HemisphereLight(0xffffff,0x556070,.9),gDir=new THREE.DirectionalLight(0xffffff,.9);gDir.position.set(1,2,1.5);gunScene.add(gHemi,gDir);
scene.add(new THREE.HemisphereLight(0xd0c8f0,0x9a7f90,.7));
const sun=new THREE.DirectionalLight(0xfff0dd,.35);sun.position.set(5,10,3);scene.add(sun);
const lamp=new THREE.PointLight(0xffe2b0,.9,15);scene.add(lamp);
function resize(){ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.fov=cam.aspect>1.2?62:75;cam.updateProjectionMatrix();gunCam.aspect=cam.aspect;gunCam.fov=cam.fov;gunCam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

let maze,group,gems,exit,explored,exitTile,P={x:0,z:0},vel={x:0,z:0},yaw=0,pitch=0,bob=0;
let mon=null,abyssMon=null,openT=[],bolts=[],charge=6,chargeT=0,fireCd=0,fakeT=30,shake=0,hb=0,gunKick=0,gemTotal=0,speedBonus=0,speedStageT=0;
const CFG={
  free:{n:'白给',none:1,fk:[28,50],d:'无追击怪物；收集宝石并找到出口。'},
  easy:{n:'简单',grace:8,dmin:10,dmax:99,hp:3,rt:12,sp:2.8,cap:3.9,near:1.15,fk:[45,80],d:'1 只怪物，8 秒后出现；命中 3 发击退，12 秒后重生。子弹自动恢复。'},
  normal:{n:'普通',grace:3,dmin:6,dmax:10,hp:4,rt:5,sp:3.5,cap:4.6,near:1.1,cm:6,cr:2.4,fk:[35,60],d:'1 只怪物，3 秒后出现；命中 2 发眩晕，4 发击退，5 秒后重生。弹药上限 6 发，自动恢复。'},
  hard:{n:'困难',grace:3,dmin:3,dmax:5,hp:6,rt:3,sp:4.4,cap:5,near:1.1,rg:.05,rd:1.15,pi:.18,cm:5,cr:2.8,fn:4,ff:26,fk:[28,50],d:'同时出现 2 只怪物，会逐渐狂暴；每只命中 3 发眩晕 2 秒，6 发击退，3 秒后重生。弹药上限 5 发，视野较短。'},
  hell:{n:'地狱',hell:1,grace:.5,dmin:3,dmax:4,hp:99,rt:0,sp:5.4,cap:6.2,near:1,rg:.1,rd:1.25,pi:.1,fn:3,ff:20,fk:[22,40],cm:4,cr:3.2,d:'离开出生点后，怪物在原出生点出现；无法击杀或击退，每命中 3 发眩晕 4 秒。弹药上限 4 发，恢复较慢，视野较短。'},
  inferno:{n:'炼狱',hell:1,inferno:1,grace:.5,dmin:3,dmax:4,hp:99,rt:0,sp:5.4,cap:6.2,near:1,rg:.1,rd:1.25,pi:.1,fn:3,ff:20,fk:[22,40],cm:4,cr:3.2,d:'离开出生点后，怪物在原出生点出现；无法击杀或击退，每命中 3 发眩晕 3 秒。小地图仅显示附近区域，弹药上限 4 发。'},
  abyss:{n:'深渊',hell:1,inferno:1,abyss:1,grace:.5,dmin:3,dmax:4,hp:99,rt:0,sp:5.4,cap:6.2,near:1,rg:.1,rd:1.25,pi:.1,fn:3,ff:20,fk:[22,40],cm:4,cr:3.2,d:'2 只怪物：1 只在原出生点出现，另 1 只随机刷新；均无法击杀或击退，每命中 5 发眩晕 3 秒。步枪可长按连发，无限弹药；无小地图，金色终点光柱指向天空。'}
};
let diff='normal';try{const s0=localStorage.getItem('mz_diff');if(CFG[s0])diff=s0}catch(e){}
let mode='escape',pdiff='easy',edif=diff,WP=PAL,FC=['#c9b896','#bba786'];
try{if(localStorage.getItem('mz_mode')==='puzzle')mode='puzzle';else if(localStorage.getItem('mz_mode')==='roguelike')mode='roguelike';const pp=localStorage.getItem('mz_pd');if(pp==='easy'||pp==='normal'||pp==='hard')pdiff=pp}catch(e){}
let gameMode=mode==='roguelike'?'roguelike':'classic';
const PC={
 easy:{n:'简单',th:'garden',t0:0,night:0,batt:0,extra:22,rooms:4,closed:0,stages:[['door:r','gate']],lev:1,traps:4,per:3.2,d:'晴朗白天 · 阳光花园（开放式）：找红钥匙开门、拉动拉杆，躲开少量尖刺。'},
 normal:{n:'普通',th:'temple',t0:.24,cycle:3000,night:1,batt:200,extra:6,rooms:2,closed:0,stages:[['door:r','gate','door:b']],lev:3,traps:8,per:2.6,d:'黄昏 · 古老神殿遗迹（开放式）：2 把钥匙，3 根拉杆按线索顺序拉；天色会慢慢变暗，记得找手电筒。'},
 hard:{n:'困难',th:'lab',t0:.5,night:2,batt:100,extra:3,rooms:3,closed:1,stages:[['door:r','gate'],['code','door:b'],['gate','door:y']],lev:3,traps:6,per:2,d:'永夜 · 废弃地下实验室（封闭 3 层）：先摸黑找手电筒（电量有限），逐层破解密码、按序拉杆、躲避快速尖刺。'}
};
scene.add(cam);
const gun=new THREE.Group();
function setGunModel(){
  while(gun.children.length)gun.remove(gun.children[0]);const u=gun.userData;u.beam=null;u.slide=null;u.muz=null;u.ej=null;
  // 逃脱/解谜模式：优先使用 GLB 武器模型（老旧手枪 / 猎魂步枪），未加载完时回退程序化模型
  // 注意：脚本首次执行本函数时武器加载系统（后文 const）尚在 TDZ，try 捕获后走程序化占位；
  // build() 与 GLB 加载完成后的再次调用则走正常 GLB 路径。
  if(mode!=='puzzle'){try{
    const glbId=CFG[diff].abyss?'g4':'g1';
    rlLoadWeaponModel(glbId);
    const gm=rlWeaponCache[glbId]&&rlMakeWeaponGlb(glbId,{k:'gun'});
    if(gm){
      gun.add(gm);rlSetupGunEnv();
      if(glbId==='g1'){gm.scale.multiplyScalar(.62);gun.position.set(.3,-.28,-.42);gun.rotation.set(0,-.06,0);u.base=[.3,-.28,-.42];u.rx=0;u.muz=[0,.03,-.62];u.ej=[.06,.05,-.2]}
      else{gm.scale.multiplyScalar(.9);gun.position.set(.29,-.26,-.4);gun.rotation.set(-.01,-.05,0);u.base=[.29,-.26,-.4];u.rx=-.01;u.muz=[0,.05,-1.15];u.ej=[.1,.08,-.3]}
      return;
    }
  }catch(_){}}
  let tg=gun;
  const mat=(c,m,gl)=>gl?new THREE.MeshBasicMaterial({color:c}):new THREE.MeshStandardMaterial({color:c,metalness:(m||0)*.5,roughness:m?.42:.72});
  const add=(geo,mt,x,y,z,rx)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.rotation.x=rx||0;tg.add(o);return o};
  const part=(w,h,l,c,x,y,z,m,gl,rx)=>add(new THREE.BoxGeometry(w,h,l),mat(c,m,gl),x,y,z,rx);
  const tube=(r1,r2,len,c,x,y,z,m,gl)=>add(new THREE.CylinderGeometry(r1,r2,len,12),mat(c,m,gl),x,y,z,Math.PI/2);
  const vt=(r1,r2,h,c,x,y,z,m)=>add(new THREE.CylinderGeometry(r1,r2,h,12),mat(c,m),x,y,z,0);
  if(mode==='puzzle'){
    mkTorch(gun,1);gun.position.set(.34,-.3,-.5);gun.rotation.set(-.05,-.1,0);gun.scale.set(1,1,1);u.base=[.34,-.3,-.5];u.rx=-.05;
  }else if(CFG[diff].abyss){
    // 突击步枪：折叠枪托+缓冲垫+贴腮板、机匣防尘盖、M-LOK 护木槽、导轨锯齿、全息瞄具、消焰器、倾斜弹匣、前握把、战术手电、激光模块
    part(.15,.19,.34,0x2b333c,0,-.02,.42,.2);part(.17,.24,.05,0x12161b,0,-.02,.6,.1);part(.1,.05,.2,0x3a444e,0,.1,.38,.3);part(.02,.16,.3,0x15191e,.08,-.02,.42);part(.02,.16,.3,0x15191e,-.08,-.02,.42);
    part(.2,.1,.56,0x363f49,0,.06,0,.5);part(.2,.12,.5,0x262d36,0,-.04,.02,.5);part(.202,.018,.3,0x2ec4b6,0,.114,.08,0,1);part(.04,.05,.14,0x0b0f13,.102,.07,.06);
    part(.17,.15,.62,0x3d4854,0,.03,-.55,.4);part(.172,.03,.62,0x2a323b,0,.1,-.55,.4);
    for(let i=0;i<5;i++){part(.012,.05,.07,0x0b0f13,.088,.03,-.36-i*.11);part(.012,.05,.07,0x0b0f13,-.088,.03,-.36-i*.11)}
    for(let i=0;i<4;i++)part(.17,.012,.05,0x0b0f13,0,-.05,-.4-i*.13);
    tube(.04,.045,.7,0x1c232b,0,.045,-1.15,.7);tube(.07,.07,.07,0x303a44,0,.045,-.86,.6);tube(.058,.058,.16,0x0d1116,0,.045,-1.55,.7);
    part(.02,.09,.02,0x9aa7ad,0,.1,-1.3,.6);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;part(.02,.02,.1,0x303a44,Math.cos(a)*.062,.045+Math.sin(a)*.062,-1.6,.5)}
    for(let i=0;i<9;i++)part(.07,.022,.03,0x10151a,0,.135,-.14-i*.07);
    part(.13,.09,.17,0x20262d,0,.2,-.2,.5);part(.105,.085,.012,0x6ad0ff,0,.215,-.29,0,1);part(.014,.014,.014,0xff3b3b,0,.218,-.285,0,1);
    part(.095,.26,.13,0x1a1f25,0,-.26,.2,.1,0,-.35);part(.13,.34,.2,0x1c252d,0,-.3,-.2,.3,0,.14);
    for(let i=0;i<4;i++)part(.135,.016,.025,0x4b5661,0,-.2-i*.055,-.24,.3,0,.14);
    vt(.035,.04,.2,0x2a323b,0,-.2,-.62,.3);part(.012,.045,.18,0x1a1f25,0,-.12,.05,.3);part(.02,.06,.02,0x9aa7ad,0,-.11,.08,.6);
    part(.045,.04,.1,0x9aa7ad,.11,.07,.02,.6);part(.035,.035,.12,0x111820,-.105,.04,-.2,.4);
    add(new THREE.TorusGeometry(.035,.008,5,10),mat(0x222a31),-.1,-.02,.3,0);
    tube(.03,.035,.12,0x20262d,-.09,-.07,-.78,.5);tube(.03,.03,.01,0xfff2c0,-.09,-.07,-.845,0,1);part(.035,.035,.1,0x20262d,.09,-.02,-.78,.5);part(.007,.007,1.1,0xff2a2a,.09,-.02,-1.4,0,1);
    gun.position.set(.34,-.3,-.52);gun.rotation.set(-.015,-.065,0);gun.scale.set(.92,.92,.92);u.base=[.34,-.3,-.52];u.rx=-.015;u.muz=[0,.045,-1.68];u.ej=[.1,.07,0];
  }else{
    // 手枪：可后坐滑套（前后防滑纹、斜面枪口、准星）+ 可见枪管、抛壳窗、下挂导轨、握把防滑点阵、扳机护圈、弹匣底板、击锤、保险、握把螺丝、挂绳环
    const slide=new THREE.Group();gun.add(slide);u.slide=slide;tg=slide;
    part(.085,.09,.46,0x7b8794,0,.04,-.2,.75);part(.087,.05,.06,0x7b8794,0,.02,-.45,.75,0,-.5);
    for(let i=0;i<5;i++)part(.09,.078,.012,0x2b323a,0,.044,-.02-i*.024,.3);
    for(let i=0;i<3;i++)part(.09,.07,.01,0x2b323a,0,.044,-.38+i*.022,.3);
    part(.02,.025,.03,0xffffff,0,.093,-.0,0,1);part(.016,.03,.03,0xffffff,0,.1,-.4,0,1);
    part(.006,.02,.26,0x7dffea,.044,.04,-.24,0,1);part(.006,.02,.26,0x7dffea,-.044,.04,-.24,0,1);
    tg=gun;
    tube(.032,.034,.06,0x0d1116,0,.02,-.44,.7);tube(.022,.022,.02,0x000000,0,.02,-.47);tube(.016,.016,.2,0x3a444e,.0,.058,-.14,.8);
    part(.07,.02,.14,0x10151a,.043,.05,-.14);
    part(.075,.06,.4,0x2b323a,0,-.03,-.16,.2);
    for(let i=0;i<3;i++)part(.07,.012,.02,0x10151a,0,-.062,-.28+i*.04);
    part(.075,.26,.11,0x1f252c,0,-.17,.06,0,0,.22);
    for(let i=0;i<4;i++)for(let k=0;k<3;k++)part(.078,.01,.012,0x0b0f13,0,-.1-i*.045,.03+k*.025+i*.01,0,0,.22);
    for(let i=0;i<4;i++)part(.078,.012,.09,0xff9f1c,0,-.1-i*.045,.075,0,0,.22);
    part(.08,.025,.12,0x2ec4b6,0,-.31,.115,0,0,.22);part(.09,.03,.13,0x1f252c,0,-.29,.11,0,0,.22);
    part(.04,.012,.13,0x1f252c,0,-.1,-.05);part(.012,.05,.012,0x1f252c,0,-.075,-.12);part(.012,.03,.12,0x1f252c,0,-.085,-.07);part(.014,.045,.02,0x9aa7ad,0,-.065,-.035,.5);
    part(.02,.04,.03,0x3a444e,0,.08,.05,.4);part(.012,.022,.05,0x9aa7ad,.046,-.0,-.02,.6);
    vt(.012,.012,.01,0xcfd6df,.04,-.17,.08);vt(.012,.012,.01,0xcfd6df,-.04,-.17,.08);add(new THREE.TorusGeometry(.02,.005,4,8),mat(0x9aa7ad),0,-.3,.17,0);
    gun.position.set(.3,-.27,-.5);gun.rotation.set(0,-.12,0);gun.scale.set(1.3,1.3,1.3);u.base=[.3,-.27,-.5];u.rx=0;u.muz=[0,.02,-.5];u.ej=[.05,.05,-.12];
  }
}
function mkTorch(g,mx){
  const M=(c,m,gl)=>gl?new THREE.MeshBasicMaterial({color:c}):new THREE.MeshStandardMaterial({color:c,metalness:(m||0)*.5,roughness:m?.42:.72});
  const A=(geo,mt,x,y,z,rx,rz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x*mx,y,z);o.rotation.set(rx||0,0,(rz||0)*mx);g.add(o);return o};
  const Tb=(r1,r2,l,c,x,y,z,m,gl)=>A(new THREE.CylinderGeometry(r1,r2,l,12),M(c,m,gl),x,y,z,Math.PI/2),Bx=(w,h,l,c,x,y,z,rx,rz)=>A(new THREE.BoxGeometry(w,h,l),M(c),x,y,z,rx,rz);
  Tb(.042,.048,.34,0x2a343e,0,0,0,.6);
  for(let i=0;i<6;i++)Tb(.05,.05,.014,0x161c22,0,0,.08+i*.03);
  for(let i=0;i<5;i++)Tb(.078,.078,.012,0x7a8794,0,0,-.2-i*.022,.7);
  Tb(.085,.07,.07,0x9aa7ad,0,0,-.3,.7);Tb(.065,.04,.06,0xfff2c0,0,0,-.32,0,1);Tb(.06,.06,.01,0xfff8dd,0,0,-.35,0,1);
  Tb(.05,.05,.04,0x1c232b,0,0,.2);A(new THREE.BoxGeometry(.026,.02,.04),M(0xff5a3a,0,1),0,.052,.16);
  // 手：掌心、四指环抱、拇指、袖口与前臂
  Bx(.11,.06,.1,0x2f3b33,0,-.05,.13);
  for(let i=0;i<4;i++){Bx(.1,.028,.03,0x2f3b33,0,-.07,.04+i*.034);Bx(.03,.05,.028,0x2f3b33,.055,-.035,.045+i*.034);Bx(.03,.05,.028,0x2f3b33,-.055,-.035,.045+i*.034)}
  Bx(.03,.03,.1,0x2f3b33,.045,.04,.09,0,.4);
  A(new THREE.CylinderGeometry(.07,.07,.05,10),M(0x1f2830),0,-.1,.28,1.2);
  A(new THREE.CylinderGeometry(.05,.065,.6,10),M(0x37424c),0,-.15,.55,1.2);
  g.userData.beam=A(new THREE.ConeGeometry(.5,1.6,16,1,true),new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),0,0,-1.18,Math.PI/2);
  return g;
}
setGunModel();gunScene.add(gun);
let running=false,state='start',elapsed=0,got=0,lockSeen=false,drag=false,fireHeld=false,rlready=false;

function gen(){
  const m=Array.from({length:S},()=>Array(S).fill(1)),st=[[1,1]];m[1][1]=0;
  while(st.length){
    const [x,y]=st[st.length-1];
    const d=[[2,0],[-2,0],[0,2],[0,-2]].filter(([a,b])=>{const nx=x+a,ny=y+b;return nx>0&&ny>0&&nx<S-1&&ny<S-1&&m[ny][nx]});
    if(!d.length){st.pop();continue}
    const [a,b]=d[Math.random()*d.length|0];m[y+b/2][x+a/2]=0;m[y+b][x+a]=0;st.push([x+a,y+b]);
  }
  for(let i=0;i<14;i++){const x=1+(Math.random()*(S-2)|0),y=1+(Math.random()*(S-2)|0);if((x+y)%2===1)m[y][x]=0}
  return m;
}
function farthest(){
  const dist={},q=[[1,1]];dist['1,1']=0;let best=[1,1];
  while(q.length){const [x,y]=q.shift();
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+a,ny=y+b,k=nx+','+ny;
      if(maze[ny][nx]===0&&!(k in dist)){dist[k]=dist[x+','+y]+1;q.push([nx,ny]);if(dist[k]>dist[best[0]+','+best[1]])best=[nx,ny]}}}
  return best;
}
function build(){
  diff=mode==='puzzle'?'free':edif;fireHeld=false;setGunModel();preEnv();
  skyG.visible=true;if(rlGroup)rlGroup.visible=false;if(rlGun)rlGun.visible=false;gun.visible=true;RL.active=false;speedBonus=0;
  if(group)scene.remove(group);
  group=new THREE.Group();scene.add(group);maze=mode==='puzzle'?(mazes=genP())[0]:gen();
  const walls=[],floors=[];
  for(let j=0;j<S;j++)for(let i=0;i<S;i++)(maze[j][i]?walls:floors).push([i,j]);
  if(mode!=='puzzle'){
  const dummy=new THREE.Object3D(),col=new THREE.Color();
  const wmat=pbrMat(diff==='abyss'?'abyssWall':'wall',1,1,{emissive:(diff==='abyss'?0x1a110c:0x000000)});
  const wm=new THREE.InstancedMesh(new THREE.BoxGeometry(T,H,T),wmat,walls.length);
  walls.forEach(([i,j],k)=>{dummy.position.set((i+.5)*T,H/2,(j+.5)*T);dummy.updateMatrix();wm.setMatrixAt(k,dummy.matrix);
    col.set(WP[(i*7+j*3+(i^j))%WP.length]).offsetHSL(0,0,(Math.random()-.5)*.08);wm.setColorAt(k,col)});
  group.add(wm);
  const fmat=pbrMat(diff==='abyss'?'abyssFloor':'floor',1,1,{emissive:(diff==='abyss'?0x241a14:0x000000)});
  for(const gx of [10,20])for(let gz=5;gz<=7;gz++)floors.push([gx,gz]);
  const fm=new THREE.InstancedMesh(new THREE.BoxGeometry(T,.2,T),fmat,floors.length);
  floors.forEach(([i,j],k)=>{dummy.position.set((i+.5)*T,-.1,(j+.5)*T);dummy.updateMatrix();fm.setMatrixAt(k,dummy.matrix);
    fm.setColorAt(k,col.set(FC[(i+j)%2]))});
  group.add(fm);if(diff==='abyss')lant=[];else decorate(walls,floors);escDecor(walls,floors);glbPropGen++;escThemeDecor(walls,floors);
  }
  exitTile=farthest();
  exit=new THREE.Group();exit.position.set((exitTile[0]+.5)*T,0,(exitTile[1]+.5)*T);
  const abyssMode=!!CFG[diff].abyss;const beamHeight=abyssMode?180:7;
  // 仅深渊难度的光柱无视视距（fog:false，极高柱体越过墙顶也能看见）；其余难度受雾衰减，只在视野内可见。
  // 深度测试始终开启，墙体会正确遮挡光柱，避免穿墙。
  const beamMat=new THREE.MeshBasicMaterial({color:0xffc928,transparent:true,opacity:abyssMode?.9:.3,side:THREE.DoubleSide,depthWrite:false,depthTest:true,fog:!abyssMode});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(abyssMode?1.7:.55,abyssMode?1.7:.55,beamHeight,6,1,true),beamMat);
  beam.position.y=beamHeight/2;exit.add(beam);exit.userData.beam=beam;
  if(abyssMode){
    const glow=new THREE.Mesh(new THREE.CylinderGeometry(6,6,beamHeight,8,1,true),new THREE.MeshBasicMaterial({color:0xffb43a,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false,depthTest:true,fog:false,blending:THREE.AdditiveBlending}));
    glow.position.y=beamHeight/2;exit.add(glow);
  }
  const star=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),new THREE.MeshPhongMaterial({color:0xffc83d,emissive:0xff9b00,emissiveIntensity:.9,flatShading:true,shininess:70,specular:0xffe9a0}));
  star.position.y=1.5;exit.add(star);exit.userData.star=star;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.14,8,28),new THREE.MeshBasicMaterial({color:0xffd34a}));ring.position.y=1.7;exit.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.4,24),new THREE.MeshBasicMaterial({color:0xffe9a0,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));disc.position.y=1.7;exit.add(disc);exit.userData.disc=disc;
  const bs=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.7,.25,14),new THREE.MeshPhongMaterial({color:0x6d5aa0,flatShading:true,shininess:26,specular:0x2a2440}));bs.position.y=.12;exit.add(bs);
  group.add(exit);
  gems=[];
  openT=floors;
  const open=floors.filter(([i,j])=>!(i===1&&j===1)&&!(i===exitTile[0]&&j===exitTile[1]));
  for(let n=0;n<(mode==='puzzle'?0:12)&&open.length;n++){
    const [i,j]=open.splice(Math.random()*open.length|0,1)[0];
    const c=PAL[n%PAL.length];
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshLambertMaterial({color:c,emissive:c,emissiveIntensity:.2}));
    const hl=new THREE.Mesh(new THREE.OctahedronGeometry(.62),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));m.add(hl);
    const rg=new THREE.Mesh(new THREE.TorusGeometry(.55,.025,4,14),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6}));rg.rotation.x=1.2;m.add(rg);
    m.position.set((i+.5)*T,1,(j+.5)*T);group.add(m);gems.push({m,i,j,ph:Math.random()*6});
  }
  explored=new Uint8Array(S*S);got=0;elapsed=0;vel.x=vel.z=0;pitch=0;
  P.x=1.5*T;P.z=1.5*T;yaw=maze[1][2]===0?-Math.PI/2:Math.PI;
  gemTotal=gems.length;$('gt').textContent=gemTotal;$('gc').textContent=0;
  bolts=[];charge=CFG[diff].abyss?Infinity:(CFG[diff].cm||6);chargeT=0;fireCd=0;speedBonus=0;speedStageT=0;scene.fog.near=(CFG[diff].fn||6)+(mode==='puzzle'?0:EDL[diff]*4);scene.fog.far=(CFG[diff].ff||32)+(mode==='puzzle'?0:EDL[diff]*45);fakeT=(CFG[diff].fk[0]+Math.random()*(CFG[diff].fk[1]-CFG[diff].fk[0]))*.2;shake=0;ghost=null;mon=CFG[diff].none?null:{dead:true,first:true,rt:CFG[diff].grace,g:{visible:false},hp:0};abyssMon=null;if(CFG[diff].abyss||diff==='hard')spawnAbyssMon();$('mapw').style.display=CFG[diff].abyss?'none':'';$('vig').style.opacity=0;if(mode==='puzzle')setupPuzzle();
}

function resolve(){
  const r=.55;
  for(let it=0;it<2;it++){
    const i0=Math.floor((P.x-r)/T),i1=Math.floor((P.x+r)/T),j0=Math.floor((P.z-r)/T),j1=Math.floor((P.z+r)/T);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      if(maze[j]&&maze[j][i]===0)continue;
      const cx=clamp(P.x,i*T,(i+1)*T),cz=clamp(P.z,j*T,(j+1)*T),dx=P.x-cx,dz=P.z-cz,d=Math.hypot(dx,dz);
      if(d<r&&d>1e-4){P.x+=dx/d*(r-d);P.z+=dz/d*(r-d)}
    }
  }
}

let ac;function beep(f,d=.14){try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f;
  g.gain.setValueAtTime(.12,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
function rifleSound(){try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();const t=ac.currentTime,n=ac.createBufferSource(),buf=ac.createBuffer(1,Math.floor(ac.sampleRate*.075),ac.sampleRate),data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.8);n.buffer=buf;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;const g=ac.createGain();g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.075);n.connect(f);f.connect(g);g.connect(ac.destination);n.start(t);const o=ac.createOscillator(),og=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(48,t+.055);og.gain.setValueAtTime(.12,t);og.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(og);og.connect(ac.destination);o.start(t);o.stop(t+.065)}catch(e){}}

const keys=new Set();
addEventListener('keydown',e=>{keys.add(e.code);if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();if(mode==='puzzle'){if(!e.repeat&&e.code==='KeyE')interact();if(!e.repeat&&e.code==='KeyF')toggleFl()}else if((e.code==='Space'||e.code==='KeyF')&&!e.repeat){if(gameMode==='roguelike'||CFG[diff].abyss)fireHeld=true;shoot()}if(e.code==='KeyP'&&!e.repeat)pauseGame('pause')});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'||e.code==='KeyF')fireHeld=false});
cv.addEventListener('mousedown',e=>{drag=true;if(running&&e.button===0){if(gameMode==='roguelike'||CFG[diff].abyss)fireHeld=true;shoot()}});addEventListener('mouseup',()=>{drag=false;fireHeld=false});
addEventListener('mousemove',e=>{
  if(!running)return;
  if(document.pointerLockElement===cv||drag){yaw-=e.movementX*.00345;pitch=clamp(pitch-e.movementY*.00345,-1.2,1.2)}
});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===cv)lockSeen=true;
  else if(lockSeen&&running){running=false;show('pause')}
});
cv.addEventListener('click',()=>{if(running&&document.pointerLockElement!==cv)lock()});
function lock(){try{const r=cv.requestPointerLock();if(r&&r.catch)r.catch(()=>{})}catch(e){}}

const TXT={
  start:['🧩 低多边形迷宫','在彩色走廊里收集宝石，找到发光的金色出口！<br>电脑：WASD 移动，鼠标转视角<br>手机：横屏体验更佳；左半屏拖动移动，右半屏滑动转视角<br>左键 / 空格 / 🔫 发射光球，命中 3 次可击退怪物，能量会慢慢恢复<br>⚠️ 怪物会追你！含惊吓画面和突然的音效<br>小地图会随探索逐步亮起。','开始探险'],
  pause:['⏸ 已暂停','休息一下，准备好了就继续。','继续'],
};
function fmt(t){const m=Math.floor(t/60),s=t-m*60;return String(m).padStart(2,'0')+':'+s.toFixed(1).padStart(4,'0')}
function show(s){
  state=s;if(gameMode==='roguelike'){rlShow(s);return}let t;
  if(mode==='puzzle'&&s==='win')t=['🎉 解开了所有谜题！','用时 <b>'+fmt(elapsed)+'</b><br>剩余体力 <b>'+hearts+'</b> / 3','再来一局'];else if(mode==='puzzle'&&s==='dead')t=['💀 体力耗尽','用时 <b>'+fmt(elapsed)+'</b>','再试一次'];else if(s==='win')t=['🎉 找到出口啦！','用时 <b>'+fmt(elapsed)+'</b><br>收集宝石 <b>'+got+' / '+gemTotal+'</b>'+(got===gemTotal?'<br>全部收集，太棒了！✨':''),'再来一局'];
  else if(s==='dead')t=['💀 被怪物抓到了','存活 <b>'+fmt(elapsed)+'</b><br>收集宝石 <b>'+got+' / '+gemTotal+'</b>','再试一次'];else if(s==='quit')t=['退出本局？','当前进度不会保存。','继续游戏'];else t=TXT[s];
  $('ot').innerHTML=t[0];$('dif').classList.toggle('hide',s==='pause'||s==='quit');$('modes').classList.toggle('hide',s==='pause'||s==='quit');$('rlobby').classList.add('hide');$('dd').classList.toggle('hide',s==='pause'||s==='quit');$('btn2').classList.toggle('hide',!(s==='pause'||s==='quit'));$('ox').innerHTML=t[1];$('btn').textContent=t[2];$('ov').classList.remove('hide');
}
$('btn').onclick=()=>{
  if(gameMode==='roguelike'){
    if(state==='pause'||state==='quit'){$('ov').classList.add('hide');running=true;lock();beep(520,.1);return}
    rlStart();return;
  }
  if(state!=='pause'&&state!=='quit')build();
  $('ov').classList.add('hide');running=true;lock();beep(520,.1);musicStart();
  try{if(matchMedia('(pointer:coarse)').matches&&!document.fullscreenElement&&document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{})}catch(e){}
};

const mc=$('map').getContext('2d'),C=168/S;
function drawMap(){
  mc.clearRect(0,0,168,168);if(CFG[diff].abyss)return;
  const local=!!CFG[diff].inferno,scale=local?168/11:C,px0=P.x/T,pz0=P.z/T;
  const drawTile=(i,j,color)=>{let x,y,w;if(local){x=(i-px0+5.5)*scale;y=(j-pz0+5.5)*scale;w=scale}else{x=i*C;y=j*C;w=C}if(x+w<0||y+w<0||x>168||y>168)return;mc.fillStyle=color;mc.fillRect(x,y,w+.5,w+.5)};
  for(let j=0;j<S;j++)for(let i=0;i<S;i++)if(explored[j*S+i]&&(!local||(Math.abs(i-px0)<=5.5&&Math.abs(j-pz0)<=5.5)))drawTile(i,j,maze[j][i]?'#8f7fc4':'#fff3d6');
  for(const g of gems)if(explored[g.j*S+g.i]&&(!local||(Math.abs(g.i-px0)<=5.5&&Math.abs(g.j-pz0)<=5.5))){let x=local?(g.i-px0+5.5)*scale:(g.i+.5)*C,y=local?(g.j-pz0+5.5)*scale:(g.j+.5)*C;mc.fillStyle='#ff5c8a';mc.beginPath();mc.arc(x,y,(local?scale:C)*.28,0,7);mc.fill()}
  for(const mm of [mon,abyssMon]){if(mm&&!mm.dead&&(!local||Math.abs(mm.x/T-px0)<=5.5&&Math.abs(mm.z/T-pz0)<=5.5)){let x=local?(mm.x/T-px0+5.5)*scale:mm.x/T*C,y=local?(mm.z/T-pz0+5.5)*scale:mm.z/T*C;mc.fillStyle='#e02020';mc.beginPath();mc.arc(x,y,(local?scale:C)*.4,0,7);mc.fill()}}
  if(!local&&(mode!=='puzzle'||layer===topL)&&explored[exitTile[1]*S+exitTile[0]]){mc.fillStyle='#ffb300';mc.fillRect((exitTile[0]+.2)*C,(exitTile[1]+.2)*C,C*.6,C*.6)}
  const px=local?84:px0*C,pz=local?84:pz0*C,a=Math.atan2(-Math.cos(yaw),-Math.sin(yaw));mc.save();mc.translate(px,pz);mc.rotate(a);mc.fillStyle='#ff6b3d';mc.strokeStyle='#fff';mc.lineWidth=1.2;mc.beginPath();mc.moveTo((local?scale:C)*.9,0);mc.lineTo(-(local?scale:C)*.6,(local?scale:C)*.55);mc.lineTo(-(local?scale:C)*.6,-(local?scale:C)*.55);mc.closePath();mc.fill();mc.stroke();mc.restore();
}

const joy={id:null,x0:0,y0:0,dx:0,dy:0},look={id:null,x:0,y:0},jb=$('jb'),jk=$('jk');
function joyEnd(){joy.id=null;joy.dx=joy.dy=0;jb.classList.add('hide')}
const dOpt={passive:false};
document.addEventListener('touchstart',e=>{
  if(!running||e.target.closest('#fs,#fire,#pq,#act,#flb,#code'))return;e.preventDefault();
  for(const t of e.changedTouches){
    if(t.clientX<innerWidth*.5){if(joy.id===null){joy.id=t.identifier;joy.x0=t.clientX;joy.y0=t.clientY;jb.style.left=t.clientX+'px';jb.style.top=t.clientY+'px';jk.style.transform='none';jb.classList.remove('hide')}}
    else if(look.id===null){look.id=t.identifier;look.x=t.clientX;look.y=t.clientY}
  }},dOpt);
document.addEventListener('touchmove',e=>{
  if(!running||e.target.closest('#fs,#fire,#pq,#act,#flb,#code'))return;e.preventDefault();
  for(const t of e.changedTouches){
    if(t.identifier===joy.id){joy.dx=clamp((t.clientX-joy.x0)/45,-1,1);joy.dy=clamp((t.clientY-joy.y0)/45,-1,1);jk.style.transform='translate('+joy.dx*38+'px,'+joy.dy*38+'px)'}
    else if(t.identifier===look.id){yaw-=(t.clientX-look.x)*.009;pitch=clamp(pitch-(t.clientY-look.y)*.0075,-1.2,1.2);look.x=t.clientX;look.y=t.clientY}
  }},dOpt);
function tEnd(e){for(const t of e.changedTouches){if(t.identifier===joy.id)joyEnd();if(t.identifier===look.id)look.id=null}}
document.addEventListener('touchend',tEnd);document.addEventListener('touchcancel',tEnd);
let toastT;function toast(s){const t=$('toast');t.textContent=s;t.classList.remove('hide');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.add('hide'),4500)}
const de=document.documentElement,reqFs=de.requestFullscreen||de.webkitRequestFullscreen;
if(!reqFs)$('fs').classList.add('hide');
$('fs').onclick=()=>{try{
  if(document.fullscreenElement||document.webkitFullscreenElement)(document.exitFullscreen||document.webkitExitFullscreen).call(document);
  else{
    const fail=()=>toast('此浏览器不支持网页全屏。可在浏览器菜单里找「全屏」或「隐藏工具栏」，或改用 Chrome 打开');
    const p=reqFs.call(de);
    if(p&&p.then)p.then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}).catch(fail);
    else setTimeout(()=>{if(!document.fullscreenElement&&!document.webkitFullscreenElement)fail()},500)}
}catch(e){}};
function spawnMon(){
  if(mon)group.remove(mon.g);
  const cf=CFG[diff];if(cf.none){mon=null;$('vig').style.opacity=0;return}
  const first=mon&&mon.first,rs=mon&&mon.dead&&!first,px=rs?P.x/T:1.5,pz=rs?P.z/T:1.5,lo=rs?Math.max(cf.dmin,10):cf.dmin,hi=rs?99:cf.dmax;
  const md=([i,j])=>Math.abs(i-px)+Math.abs(j-pz),fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  const away=p=>{const dx=(p[0]+.5)*T-P.x,dz=(p[1]+.5)*T-P.z,l=Math.hypot(dx,dz);return l>=10&&(dx*fx+dz*fz)/l<.3};
  let c;
  if(first&&cf.hell)c=[[1,1]];
  else{c=openT.filter(p=>md(p)>=lo&&md(p)<=hi&&away(p));if(!c.length)c=openT.filter(p=>md(p)>=lo&&away(p));if(!c.length)c=openT.filter(p=>md(p)>=lo);if(!c.length)c=openT}
  const [i,j]=c[Math.random()*c.length|0],o=mkMon(),gr=first?.4:Math.min(1.5,cf.grace),tt=first&&cf.hell&&toast('身后传来动静……');group.add(o.g);
  mon=Object.assign(o,{x:(i+.5)*T,z:(j+.5)*T,hp:cf.hp,stun:0,hitF:0,grace:gr,pt:0,next:null,dead:false,rt:0});
  o.g.position.set(mon.x,0,mon.z);
}
function spawnAbyssMon(){
  if((!CFG[diff].abyss&&diff!=='hard')||!openT.length)return;
  const px=P.x/T,pz=P.z/T;let choices=openT.filter(([i,j])=>Math.abs(i-px)+Math.abs(j-pz)>=5&&!(i===exitTile[0]&&j===exitTile[1]));if(!choices.length)choices=openT;
  const [i,j]=choices[Math.random()*choices.length|0],o=mkMon();group.add(o.g);
  abyssMon=Object.assign(o,{x:(i+.5)*T,z:(j+.5)*T,hp:CFG[diff].abyss?99:CFG[diff].hp,stun:0,hitF:0,grace:CFG[diff].abyss?1.5:CFG[diff].grace,pt:0,next:null,dead:false,rt:0,hits:0,rage:0});o.g.position.set(abyssMon.x,0,abyssMon.z);if(CFG[diff].abyss)toast('深渊怪物已在地图某处刷新！');
}
function nextStepFor(target){
  const sx0=target.x/T|0,sz0=target.z/T|0,gx=P.x/T|0,gz=P.z/T|0;
  if(sx0===gx&&sz0===gz)return null;
  const prev=new Map(),q=[[sx0,sz0]];prev.set(sx0+','+sz0,null);
  while(q.length){const [x,y]=q.shift();if(x===gx&&y===gz)break;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+a,ny=y+b,k=nx+','+ny;if(maze[ny]&&maze[ny][nx]===0&&!prev.has(k)){prev.set(k,[x,y]);q.push([nx,ny])}}}
  let c=[gx,gz];if(!prev.has(gx+','+gz))return null;for(;;){const p=prev.get(c[0]+','+c[1]);if(!p)return null;if(p[0]===sx0&&p[1]===sz0)return c;c=p}
}
function tickAbyssMon(dt){
  const m=abyssMon;if(!m)return;if(m.dead){m.rt-=dt;if(m.rt<=0&&diff==='hard')spawnAbyssMon();return}m.grace-=dt;m.stun-=dt;m.hitF-=dt;m.rage=m.stun>0?0:(m.rage||0)+dt;
  const dx=P.x-m.x,dz=P.z-m.z,d=Math.hypot(dx,dz);
  if(m.grace<=0&&m.stun<=0){m.pt-=dt;if(m.pt<=0){m.pt=CFG[diff].pi||.25;m.next=nextStepFor(m)}const tx=m.next?(m.next[0]+.5)*T:P.x,tz=m.next?(m.next[1]+.5)*T:P.z,ax=tx-m.x,az=tz-m.z,al=Math.hypot(ax,az)||1;const sp=(Math.min(CFG[diff].sp+.15*got,CFG[diff].cap)+Math.min(m.rage,12)*(CFG[diff].rg||0))*(d<12?CFG[diff].near:1)+speedBonus;m.x+=ax/al*sp*dt;m.z+=az/al*sp*dt;}
  const now=performance.now();m.g.position.set(m.x,Math.sin(now/180)*.08,m.z);if(d>.01)m.g.rotation.y=Math.atan2(dx,dz);m.g.rotation.z=m.stun>0?Math.sin(now/60)*.2:0;m.body.rotation.z=Math.sin(now/220)*.1;m.mat.emissive.setHex(0);m.eye.color.setHex(m.stun>0?0x555555:0xff3b3b);
  if(d<(CFG[diff].rd||1.05)&&m.stun<=0&&m.grace<=0){running=false;joyEnd();document.exitPointerLock&&document.exitPointerLock();$('vig').style.opacity=0;scare(true)}
}
function nextStep(){
  const sx0=mon.x/T|0,sz0=mon.z/T|0,gx=P.x/T|0,gz=P.z/T|0;
  if(sx0===gx&&sz0===gz)return null;
  const prev=new Map(),q=[[sx0,sz0]];prev.set(sx0+','+sz0,null);
  while(q.length){const [x,y]=q.shift();if(x===gx&&y===gz)break;
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+a,ny=y+b,k=nx+','+ny;if(maze[ny]&&maze[ny][nx]===0&&!prev.has(k)){prev.set(k,[x,y]);q.push([nx,ny])}}}
  let c=[gx,gz];if(!prev.has(gx+','+gz))return null;
  for(;;){const p=prev.get(c[0]+','+c[1]);if(!p)return null;if(p[0]===sx0&&p[1]===sz0)return c;c=p}
}
function shoot(){
  if(gameMode==='roguelike'){rlAttack();return}
  const cf=CFG[diff];if(mode==='puzzle'||!running||fireCd>0||(!cf.abyss&&charge<1))return;
  if(!cf.abyss)charge--;fireCd=cf.abyss?.065:.35;gunKick=1;muzzleFx();
  const b=new THREE.Mesh(new THREE.SphereGeometry(.16,6,5),new THREE.MeshBasicMaterial({color:0x7dffea}));
  const d=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  b.position.set(P.x,1.5,P.z).addScaledVector(d,.6);group.add(b);bolts.push({m:b,d,life:1.6});if(cf.abyss)rifleSound();else beep(640,.09);
}
function hitMon(target=mon){
  if(!target||target.dead)return;const cf=CFG[diff];if(cf.hell){target.hits=(target.hits||0)+1;target.hitF=.15;beep(380,.1);const stunHits=cf.abyss?5:3;if(target.hits>=stunHits){target.hits=0;target.stun=cf.inferno?3:4;shake=.3;toast('怪物被震晕了 '+target.stun+' 秒！');beep(300,.2)}return}
  target.hits=(target.hits||0)+1;target.hp--;target.hitF=.2;shake=.25;beep(300,.15);target.stun=(diff==='normal'&&target.hits%2===0)||(diff==='hard'&&target.hits%3===0)||!['normal','hard'].includes(diff)?2:0;
  const mon=target;
  const dx=mon.x-P.x,dz=mon.z-P.z,l=Math.hypot(dx,dz)||1;
  for(let s=0;s<6;s++){const nx=mon.x+dx/l*.25,nz=mon.z+dz/l*.25,i=nx/T|0,j=nz/T|0;if(maze[j]&&maze[j][i]===0){mon.x=nx;mon.z=nz}else break}
  if(mon.hp<=0){charge=Math.min(CFG[diff].cm||6,charge+2);mon.dead=true;mon.rt=CFG[diff].rt;mon.g.visible=false;if(mon===abyssMon)mon.rt=CFG[diff].rt;toast('怪物被击退了，回复 2 点能量！它会从远处重新出发');beep(880,.3)}
}
function tick(dt){
  fireCd-=dt;
  const cf=CFG[diff];if(cf.abyss&&fireHeld&&running)shoot();
  const speedInterval=cf.abyss?8:cf.inferno?12:cf.hell?20:30;speedStageT+=dt;if(speedStageT>=speedInterval){speedStageT-=speedInterval;speedBonus+=.25;toast('速度提升！玩家与怪物速度 +0.25');}
  const cm=cf.cm||6;if(cf.abyss){charge=Infinity;chargeT=0;$('ch').textContent='∞ / ∞'}else{if(charge<cm){chargeT+=dt;if(chargeT>(cf.cr||2.2)){charge++;chargeT=0}}else chargeT=0;$('ch').textContent=charge+' / '+cm;}
  ghostTick(dt);fakeT-=dt;if(fakeT<=0){fakeT=(CFG[diff].fk[0]+Math.random()*(CFG[diff].fk[1]-CFG[diff].fk[0]))*.3;spawnGhost()}
  for(let n=bolts.length-1;n>=0;n--){
    const b=bolts[n],p=b.m.position;b.life-=dt;p.addScaledVector(b.d,(cf.abyss?42:24)*dt);
    const i=Math.floor(p.x/T),j=Math.floor(p.z/T);
    let gone=b.life<=0||p.y<0||p.y>H||!maze[j]||maze[j][i]!==0;
    if(!gone&&mon&&!mon.dead&&Math.hypot(p.x-mon.x,p.y-1.1,p.z-mon.z)<1.05){hitMon(mon);gone=true}
    if(!gone&&abyssMon&&!abyssMon.dead&&Math.hypot(p.x-abyssMon.x,p.y-1.1,p.z-abyssMon.z)<1.05){hitMon(abyssMon);gone=true}
    if(gone){group.remove(b.m);bolts.splice(n,1)}
  }
  tickAbyssMon(dt);
  if(!mon)return;
  if(mon.dead){mon.rt-=dt;$('vig').style.opacity=0;if(mon.rt<=0&&(!mon.first||!CFG[diff].hell||Math.hypot(P.x-6,P.z-6)>=12))spawnMon();return}
  mon.grace-=dt;mon.stun-=dt;mon.hitF-=dt;mon.rage=mon.stun>0?0:(mon.rage||0)+dt;
  const dx=P.x-mon.x,dz=P.z-mon.z,d=Math.hypot(dx,dz);
  if(mon.grace<=0&&mon.stun<=0){
    mon.pt-=dt;if(mon.pt<=0){mon.pt=CFG[diff].pi||.25;mon.next=nextStep()}
    const tx=mon.next?(mon.next[0]+.5)*T:P.x,tz=mon.next?(mon.next[1]+.5)*T:P.z,ax=tx-mon.x,az=tz-mon.z,al=Math.hypot(ax,az)||1,sp=(Math.min(CFG[diff].sp+.15*got,CFG[diff].cap)+Math.min(mon.rage,12)*(CFG[diff].rg||0))*(d<12?CFG[diff].near:1)+speedBonus;
    mon.x+=ax/al*sp*dt;mon.z+=az/al*sp*dt;
  }
  const now=performance.now();
  mon.g.position.set(mon.x,Math.sin(now/180)*.08,mon.z);
  if(d>.01)mon.g.rotation.y=Math.atan2(dx,dz);
  mon.g.rotation.z=mon.stun>0?Math.sin(now/60)*.2:0;
  mon.body.rotation.z=Math.sin(now/220)*.1;
  mon.mat.emissive.setHex(0);
  mon.eye.color.setHex(mon.stun>0?0x555555:0xff3b3b);
  const cl=mon.grace>0?0:clamp(1-d/18,0,1);
  $('vig').style.opacity=cl*.9;hb=0;
  if(d<(CFG[diff].rd||1.05)&&mon.stun<=0&&mon.grace<=0){running=false;joyEnd();document.exitPointerLock&&document.exitPointerLock();$('vig').style.opacity=0;scare(true)}
}
// 突脸音效：女鬼尖叫（0ms 满音量爆发 + 不谐和双音 + 噪声爆裂 + 压缩器）
function scream(v){try{
  ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
  const t=ac.currentTime,vv=v||1;
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=4;comp.ratio.value=16;comp.attack.value=.002;comp.release.value=.2;comp.connect(ac.destination);
  const out=ac.createGain();out.gain.setValueAtTime(vv,t);out.gain.setValueAtTime(vv,t+.5);out.gain.exponentialRampToValueAtTime(.0008,t+1.5);out.connect(comp);
  // 起手低频冲击：先让身体被砸一下
  const sub=ac.createOscillator(),sg=ac.createGain();sub.type='sine';sub.frequency.setValueAtTime(130,t);sub.frequency.exponentialRampToValueAtTime(36,t+.32);
  sg.gain.setValueAtTime(.9*vv,t);sg.gain.exponentialRampToValueAtTime(.001,t+.4);sub.connect(sg);sg.connect(out);
  // 尖叫主体：锯齿波 0ms 直冲高频后断崖下落
  const o1=ac.createOscillator(),g1=ac.createGain();o1.type='sawtooth';
  o1.frequency.setValueAtTime(1150,t);o1.frequency.exponentialRampToValueAtTime(2480,t+.045);o1.frequency.exponentialRampToValueAtTime(1750,t+.45);o1.frequency.exponentialRampToValueAtTime(620,t+1.4);
  const vib=ac.createOscillator(),vg=ac.createGain();vib.type='sine';vib.frequency.setValueAtTime(15,t);vib.frequency.linearRampToValueAtTime(24,t+1.2);vg.gain.setValueAtTime(70,t);vg.gain.linearRampToValueAtTime(115,t+.6);
  vib.connect(vg);vg.connect(o1.frequency);g1.gain.value=.6;
  // 不谐和第二层：制造刺耳拍频
  const o2=ac.createOscillator(),g2=ac.createGain();o2.type='sawtooth';
  o2.frequency.setValueAtTime(1220,t);o2.frequency.exponentialRampToValueAtTime(2640,t+.045);o2.frequency.exponentialRampToValueAtTime(1660,t+.5);o2.frequency.exponentialRampToValueAtTime(700,t+1.3);
  vib.connect(vg);g2.gain.value=.38;
  const o3=ac.createOscillator(),g3=ac.createGain();o3.type='square';
  o3.frequency.setValueAtTime(2400,t);o3.frequency.exponentialRampToValueAtTime(3300,t+.12);o3.frequency.exponentialRampToValueAtTime(1600,t+1.2);
  g3.gain.value=.14;
  const mix=ac.createGain();o1.connect(g1);o2.connect(g2);o3.connect(g3);g1.connect(mix);g2.connect(mix);g3.connect(mix);
  // 人声共振峰
  [[950,6],[2300,9],[4200,11]].forEach(([f,q])=>{const b=ac.createBiquadFilter();b.type='bandpass';b.frequency.value=f;b.Q.value=q;mix.connect(b);b.connect(out)});
  // 起手噪声爆裂：真正把人吓一跳的部分
  const n=ac.createBufferSource(),nb=ac.createBuffer(1,Math.floor(ac.sampleRate*.5),ac.sampleRate),nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*Math.pow(1-i/nd.length,.7);
  n.buffer=nb;
  const nh=ac.createBiquadFilter();nh.type='highpass';nh.frequency.value=1400;
  const ng=ac.createGain();ng.gain.setValueAtTime(vv,t);ng.gain.exponentialRampToValueAtTime(.001,t+.42);
  n.connect(nh);nh.connect(ng);ng.connect(out);
  [o1,o2,o3,vib,sub].forEach(o=>{o.start(t);o.stop(t+1.6)});n.start(t);
}catch(e){}}
// 被怪物抓住时的结算音效：怪物咆哮（0ms 爆发 + 失真低频 + 撕裂噪声）
function monsterRoar(v){try{
  ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
  const t=ac.currentTime,vv=v||1;
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=4;comp.ratio.value=16;comp.attack.value=.002;comp.release.value=.25;comp.connect(ac.destination);
  const out=ac.createGain();out.gain.setValueAtTime(vv,t);out.gain.setValueAtTime(.9*vv,t+1.2);out.gain.exponentialRampToValueAtTime(.0008,t+2.4);out.connect(comp);
  // 胸腔低频冲击
  const sub=ac.createOscillator(),sg=ac.createGain();sub.type='sine';sub.frequency.setValueAtTime(88,t);sub.frequency.exponentialRampToValueAtTime(32,t+1.7);
  sg.gain.setValueAtTime(1.1*vv,t);sg.gain.exponentialRampToValueAtTime(.001,t+2.1);sub.connect(sg);sg.connect(out);
  const o1=ac.createOscillator(),o2=ac.createOscillator(),o3=ac.createOscillator();
  o1.type='sawtooth';o2.type='square';o3.type='sawtooth';
  o1.frequency.setValueAtTime(118,t);o1.frequency.exponentialRampToValueAtTime(172,t+.12);o1.frequency.exponentialRampToValueAtTime(58,t+1.9);
  o2.frequency.setValueAtTime(44,t);o2.frequency.exponentialRampToValueAtTime(31,t+1.9);
  o3.frequency.setValueAtTime(235,t);o3.frequency.exponentialRampToValueAtTime(96,t+1.5);
  const am=ac.createOscillator(),ag=ac.createGain();am.type='square';am.frequency.setValueAtTime(31,t);am.frequency.linearRampToValueAtTime(13,t+1.7);ag.gain.value=.55;
  const tr=ac.createGain();tr.gain.value=.5;am.connect(ag);ag.connect(tr.gain);
  const ws=ac.createWaveShaper(),curve=new Float32Array(1024);
  for(let i=0;i<1024;i++){const x=i/512-1;curve[i]=Math.tanh(x*6.5)}
  ws.curve=curve;ws.oversample='2x';
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(2600,t);lp.frequency.exponentialRampToValueAtTime(420,t+2);
  const g1=ac.createGain(),g2=ac.createGain(),g3=ac.createGain();g1.gain.value=.55;g2.gain.value=.34;g3.gain.value=.2;
  o1.connect(g1);o2.connect(g2);o3.connect(g3);g1.connect(tr);g2.connect(tr);g3.connect(tr);tr.connect(ws);ws.connect(lp);lp.connect(out);
  // 起手撕裂噪声
  const n=ac.createBufferSource(),nb=ac.createBuffer(1,Math.floor(ac.sampleRate*1.2),ac.sampleRate),nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*Math.pow(1-i/nd.length,1.1);
  n.buffer=nb;const nf=ac.createBiquadFilter();nf.type='bandpass';nf.frequency.setValueAtTime(240,t);nf.frequency.exponentialRampToValueAtTime(1300,t+.9);nf.Q.value=1.2;
  const ng=ac.createGain();ng.gain.setValueAtTime(vv,t);ng.gain.exponentialRampToValueAtTime(.001,t+1.1);n.connect(nf);nf.connect(ng);ng.connect(out);
  [o1,o2,o3,am,sub].forEach(o=>{o.start(t);o.stop(t+2.45)});n.start(t);
}catch(e){}}
const sc=$('sc'),sx=sc.getContext('2d');
function drawFaceOld(){
  const w=sc.width=innerWidth,h=sc.height=innerHeight,cx=w/2,cy=h*.52,R=Math.min(w*.55,h*.6);
  const gr=sx.createRadialGradient(cx,cy,R*.2,cx,cy,R*1.5);gr.addColorStop(0,'#8a0020');gr.addColorStop(1,'#12000a');sx.fillStyle=gr;sx.fillRect(0,0,w,h);
  const poly=(pts,c)=>{sx.fillStyle=c;sx.beginPath();pts.forEach(([x,y],i)=>i?sx.lineTo(x,y):sx.moveTo(x,y));sx.closePath();sx.fill()};
  for(let k=-2;k<=2;k++)poly([[cx+k*R*.26-R*.1,cy-R*.8],[cx+k*R*.26+R*.1,cy-R*.8],[cx+k*R*.26,cy-R*(1.25-Math.abs(k)*.1)]],'#3d2266');
  const head=[];for(let i=0;i<9;i++){const a=i/9*6.283-1.57,r=R*(.9+((i*53)%5)/30);head.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r*1.05])}
  poly(head,'#6b3fa0');
  for(const s of[-1,1]){const ex=cx+s*R*.34,ey=cy-R*.18;
    poly([[ex-R*.2,ey],[ex,ey-R*.2],[ex+R*.2,ey],[ex,ey+R*.2]],'#ff2020');
    poly([[ex-R*.11,ey],[ex,ey-R*.11],[ex+R*.11,ey],[ex,ey+R*.11]],'#ffe14a');
    poly([[ex-R*.02,ey-R*.1],[ex+R*.02,ey-R*.1],[ex+R*.02,ey+R*.1],[ex-R*.02,ey+R*.1]],'#000');
    poly([[ex+s*R*.3,ey-R*.36],[ex+s*R*.3,ey-R*.26],[ex-s*R*.3,ey-R*.04],[ex-s*R*.3,ey-R*.16]],'#1a0830')}
  const my=cy+R*.45;poly([[cx-R*.6,my-R*.25],[cx+R*.6,my-R*.25],[cx+R*.5,my+R*.3],[cx-R*.5,my+R*.3]],'#0b0006');
  for(let k=0;k<8;k++){const x=cx-R*.56+k*R*.14;poly([[x,my-R*.25],[x+R*.14,my-R*.25],[x+R*.07,my-R*.25+R*.15*(1+k%2*.5)]],'#f4f0e0')}
  for(let k=0;k<7;k++){const x=cx-R*.49+k*R*.14;poly([[x,my+R*.3],[x+R*.14,my+R*.3],[x+R*.07,my+R*.3-R*.13*(1+(k+1)%2*.5)]],'#f4f0e0')}
}
function scareOld(real){
  drawFace();sc.classList.remove('hide');sc.style.animation='none';void sc.offsetWidth;
  sc.style.animation=real?'boo 1.4s ease-out forwards':'boo2 .45s ease-out forwards';
  scream(real?1:.6);if(!real)shake=.5;
  setTimeout(()=>{sc.classList.add('hide');if(real)show('dead')},real?1400:450);
}
function drawFace(k){
  const w=sc.width=innerWidth,h=sc.height=innerHeight,cx=w/2,cy=h*.5,R=Math.min(w*.55,h*.58),fl=.75+Math.random()*.25,jd=Math.min(k*4,1);
  const gr=sx.createRadialGradient(cx,cy,R*.1,cx,cy,R*1.6);gr.addColorStop(0,'#30030c');gr.addColorStop(.55,'#0e0006');gr.addColorStop(1,'#000');sx.fillStyle=gr;sx.fillRect(0,0,w,h);
  const poly=(p,c)=>{sx.fillStyle=c;sx.beginPath();p.forEach(([x,y],i)=>i?sx.lineTo(x,y):sx.moveTo(x,y));sx.closePath();sx.fill()};
  const head=[];for(let i=0;i<12;i++){const a=i/12*6.283-1.57,r=R*(.8+((i*41)%5)/30);head.push([cx+Math.cos(a)*r*.94,cy+Math.sin(a)*r*(1.06+jd*.1)])}
  poly(head,'#8f977f');
  sx.strokeStyle='rgba(20,24,16,.6)';sx.lineWidth=R*.012;sx.beginPath();[[-.4,-.85,-.3,-.6,-.36,-.4],[.35,-.8,.28,-.55,.34,-.3],[.05,-.9,0,-.7,.06,-.5]].forEach(c=>{sx.moveTo(cx+c[0]*R,cy+c[1]*R);sx.lineTo(cx+c[2]*R,cy+c[3]*R);sx.lineTo(cx+c[4]*R,cy+c[5]*R)});sx.stroke();
  sx.fillStyle='rgba(70,90,60,.25)';[[-.45,.1],[.5,-.05],[.1,-.55]].forEach(([ox,oy])=>{sx.beginPath();sx.arc(cx+ox*R,cy+oy*R,R*.09,0,6.283);sx.fill()});
  for(const s of[-1,1]){const ex=cx+s*R*.34,ey=cy-R*.16;
    poly([[ex-R*.27,ey+R*.04],[ex-s*R*.05,ey-R*.28],[ex+R*.27,ey+R*.04],[ex,ey+R*.26]],'#030005');
    sx.fillStyle='rgba(255,25,25,'+fl+')';sx.shadowColor='#f00';sx.shadowBlur=R*.3*fl;sx.beginPath();sx.arc(ex,ey,R*.09,0,6.283);sx.fill();sx.shadowBlur=0;
    sx.fillStyle='#ffd23a';sx.beginPath();sx.arc(ex,ey,R*.028,0,6.283);sx.fill();
    sx.fillStyle='rgba(120,0,12,.8)';sx.fillRect(ex-R*.02,ey+R*.1,R*.04,R*(.3+.3*k));
    poly([[ex+s*R*.36,ey-R*.52],[ex+s*R*.36,ey-R*.38],[ex-s*R*.36,ey-R*.12],[ex-s*R*.36,ey-R*.28]],'#2a3038')}
  poly([[cx-R*.05,cy+R*.1],[cx-R*.01,cy+R*.02],[cx-R*.01,cy+R*.12]],'#050205');
  poly([[cx+R*.05,cy+R*.1],[cx+R*.01,cy+R*.02],[cx+R*.01,cy+R*.12]],'#050205');
  const my=cy+R*.34,mh=R*(.28+.5*jd);
  poly([[cx-R*.68,my-R*.14],[cx+R*.68,my-R*.14],[cx+R*.55,my+mh],[cx,my+mh+R*.1],[cx-R*.55,my+mh]],'#030004');
  const tg=sx.createRadialGradient(cx,my+mh*.5,0,cx,my+mh*.5,mh*.7);tg.addColorStop(0,'rgba(150,0,20,.85)');tg.addColorStop(1,'rgba(60,0,8,0)');sx.fillStyle=tg;sx.beginPath();sx.arc(cx,my+mh*.5,mh*.7,0,6.283);sx.fill();
  for(let t=0;t<11;t++){const x=cx-R*.64+t*R*.116,L=R*(.15+((t*37)%5)*.05);poly([[x,my-R*.14],[x+R*.116,my-R*.14],[x+R*.058,my-R*.14+L]],'#ddd5ba')}
  for(let t=0;t<9;t++){const x=cx-R*.5+t*R*.112,y0=my+mh+R*.02,L=R*(.13+((t*53)%4)*.055);poly([[x,y0],[x+R*.112,y0],[x+R*.056,y0-L]],'#ddd5ba')}
  sx.fillStyle='rgba(110,0,12,.85)';sx.fillRect(cx-R*.66,my-R*.1,R*.045,R*(.25+.3*k));sx.fillRect(cx+R*.615,my-R*.1,R*.045,R*(.2+.25*k));
  if(jd>.35){sx.globalAlpha=Math.min(1,(jd-.35)*1.6);
    for(const s of[-1,1])for(let f=0;f<3;f++){const bx=cx+s*w*.5,by=cy-R*.25+f*R*.45,ln=R*(.5+f*.12);
      poly([[bx,by-R*.1],[bx-s*ln,by-R*.02],[bx,by+R*.1],[bx-s*ln*.5,by+R*.02]],'#7e8670');
      poly([[bx-s*ln,by-R*.07],[bx-s*(ln+R*.17),by-.02*R],[bx-s*ln,by+R*.05]],'#d6cfb6')}
    sx.globalAlpha=1}
  sx.fillStyle='rgba(0,0,0,.2)';for(let y=0;y<h;y+=4)sx.fillRect(0,y,w,1.5);
  if(Math.random()<.7)for(let n=0;n<4;n++){const y=Math.random()*h,hh=h*(.02+Math.random()*.06);sx.drawImage(sc,0,y,w,hh,(Math.random()-.5)*R*.25,y,w,hh)}
}
function scare(real){
  const dur=real?1400:450,t0=performance.now();
  sc.classList.remove('hide');sc.style.animation='none';void sc.offsetWidth;
  sc.style.animation=real?'boo 1.4s ease-out forwards':'boo2 .45s ease-out forwards';
  if(real)monsterRoar(1);else scream(.7);if(!real)shake=.5;
  (function f(){const k=(performance.now()-t0)/dur;if(k>=1){sc.classList.add('hide');if(real)show('dead');return}drawFace(k);requestAnimationFrame(f)})();
}
$('fire').addEventListener('pointerdown',e=>{e.preventDefault();if(gameMode==='roguelike'){fireHeld=true;rlAttack();return}if(CFG[diff].abyss){fireHeld=true;shoot()}else shoot()});
for(const ev of ['pointerup','pointercancel','pointerleave'])$('fire').addEventListener(ev,()=>{fireHeld=false});
const dif=$('dif');
function markDiff(){
  dif.innerHTML='';const rl=gameMode==='roguelike';
  dif.classList.toggle('hide',rl);$('dd').classList.toggle('hide',rl);
  $('rlobby').classList.toggle('hide',!rl||state==='pause'||state==='quit'||state==='rldead'||state==='rlwin');
  if(!rl){
    const cfgs=mode==='puzzle'?PC:CFG,cur=mode==='puzzle'?pdiff:edif;
    Object.keys(cfgs).forEach(k=>{const b=document.createElement('button');b.textContent=cfgs[k].n;if(k===cur)b.classList.add('on');
      b.onclick=()=>{if(mode==='puzzle'){pdiff=k;try{localStorage.setItem('mz_pd',k)}catch(e){}}else{edif=k;try{localStorage.setItem('mz_diff',k)}catch(e){}}markDiff()};dif.appendChild(b)});
    $('dd').textContent=cfgs[cur].d;
  }else if(rlready)rlRenderLobby();
  [...$('modes').children].forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
}
[...$('modes').children].forEach(b=>b.onclick=()=>{mode=b.dataset.m;gameMode=mode==='roguelike'?'roguelike':'classic';try{localStorage.setItem('mz_mode',mode)}catch(e){}markDiff();if(state==='start')show('start');if(gameMode==='roguelike')rlLoadModels()});
markDiff();
function pauseGame(s){if(!running)return;running=false;fireHeld=false;keys.clear();joyEnd();document.exitPointerLock&&document.exitPointerLock();$('vig').style.opacity=0;show(s)}
$('pz').onclick=()=>pauseGame('pause');$('qt').onclick=()=>pauseGame('quit');
$('btn2').textContent='退出到主菜单';$('btn2').onclick=()=>show('start');
// 高分辨率程序化材质：256×256，包含砖缝、崩角、裂纹、水渍、苔藓与颗粒
function mkTex(brick){
  const SZ=256,c=document.createElement('canvas');c.width=c.height=SZ;const x=c.getContext('2d');
  const R=Math.random,rr=(a,b)=>a+R()*(b-a),col=(r,g,b,v)=>'rgb('+Math.min(255,r*v|0)+','+Math.min(255,g*v|0)+','+Math.min(255,b*v|0)+')';
  if(brick){
    x.fillStyle='#4a443a';x.fillRect(0,0,SZ,SZ);            // 深色灰浆
    const bh=32,bw=64;
    for(let r=0;r<SZ/bh;r++){
      const o=r%2?bw/2:0;
      for(let b=-1;b*bw<SZ+bw;b++){
        const v=rr(.76,1.02),bx=o+b*bw,by=r*bh;
        const g=x.createLinearGradient(0,by,0,by+bh);       // 砖面自上而下的受光渐变
        g.addColorStop(0,col(216,206,186,v));g.addColorStop(.55,col(196,185,166,v));g.addColorStop(1,col(166,156,139,v));
        x.fillStyle=g;x.fillRect(bx+3,by+3,bw-6,bh-6);
        x.fillStyle='rgba(255,255,255,'+rr(.1,.22)+')';x.fillRect(bx+3,by+3,bw-6,3);      // 上棱高光
        x.fillStyle='rgba(0,0,0,'+rr(.26,.42)+')';x.fillRect(bx+3,by+bh-6,bw-6,3);        // 下棱阴影
        x.fillStyle='rgba(0,0,0,.16)';x.fillRect(bx+bw-6,by+3,3,bh-6);                    // 侧棱阴影
        if(R()<.55){x.fillStyle='rgba(64,58,50,.55)';x.fillRect(bx+3+R()*(bw-14),by+3+R()*(bh-12),rr(3,9),rr(3,7))}  // 崩角
        if(R()<.3){x.strokeStyle='rgba(56,50,42,.55)';x.lineWidth=1;x.beginPath();let px=bx+rr(8,bw-8),py=by+5;x.moveTo(px,py);for(let k=0;k<4;k++){px+=rr(-6,6);py+=rr(4,7);x.lineTo(px,py)}x.stroke()}  // 细裂纹
        for(let k=0;k<10;k++){x.fillStyle='rgba(0,0,0,'+rr(.03,.1)+')';x.fillRect(bx+rr(4,bw-6),by+rr(4,bh-6),rr(1,3),rr(1,3))}
      }
    }
    for(let i=0;i<26;i++){                                    // 苔藓 / 霉斑
      const px=R()*SZ,py=R()*SZ,rad=rr(8,26),g=x.createRadialGradient(px,py,0,px,py,rad);
      g.addColorStop(0,'rgba(52,64,40,'+rr(.14,.3)+')');g.addColorStop(1,'rgba(52,64,40,0)');
      x.fillStyle=g;x.beginPath();x.arc(px,py,rad,0,6.283);x.fill();
    }
  }else{
    x.fillStyle='#48423a';x.fillRect(0,0,SZ,SZ);              // 石板缝
    const n=4,sz=SZ/n;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const v=rr(.76,1.04),px0=i*sz+4,py0=j*sz+4;
      const g=x.createLinearGradient(0,py0,0,py0+sz);        // 石板受光渐变
      g.addColorStop(0,col(200,190,170,v));g.addColorStop(.6,col(182,171,150,v));g.addColorStop(1,col(156,147,129,v));
      x.fillStyle=g;x.fillRect(px0,py0,sz-8,sz-8);
      x.fillStyle='rgba(255,255,255,.14)';x.fillRect(px0,py0,sz-8,3);
      x.fillStyle='rgba(0,0,0,.32)';x.fillRect(px0,py0+sz-10,sz-8,3);
      for(let k=0;k<30;k++){x.fillStyle='rgba(0,0,0,'+rr(.03,.14)+')';x.fillRect(px0+rr(-4,sz-12),py0+rr(-4,sz-12),rr(1,4),rr(1,3))}
      if(R()<.45){x.strokeStyle='rgba(44,40,34,.5)';x.lineWidth=1;x.beginPath();let px=i*sz+rr(10,sz-10),py=j*sz+8;x.moveTo(px,py);for(let k=0;k<5;k++){px+=rr(-8,8);py+=rr(5,11);x.lineTo(px,py)}x.stroke()}
      if(R()<.25){const gx=i*sz+rr(10,sz-30),gy=j*sz+rr(10,sz-30),g=x.createRadialGradient(gx,gy,0,gx,gy,rr(14,30));g.addColorStop(0,'rgba(24,20,15,.26)');g.addColorStop(1,'rgba(24,20,15,0)');x.fillStyle=g;x.fillRect(i*sz,j*sz,sz,sz)}
    }
  }
  for(let i=0;i<320;i++){x.fillStyle='rgba(0,0,0,'+rr(.02,.09)+')';x.fillRect(R()*SZ,R()*SZ,rr(1,3),rr(1,3))}   // 颗粒
  const vg=x.createRadialGradient(SZ/2,SZ/2,SZ*.22,SZ/2,SZ/2,SZ*.72);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.18)');
  x.fillStyle=vg;x.fillRect(0,0,SZ,SZ);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipMapLinearFilter;
  try{t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy())}catch(e){}
  return t;
}
// 由高度图生成法线贴图：砖缝、石棱在光照下有真实的立体起伏
const normCache=new Map();
function normalOf(tex,strength){
  const src=tex&&tex.image;if(!src)return null;if(normCache.has(src))return normCache.get(src);
  const w=src.width,h=src.height,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.drawImage(src,0,0);
  const im=x.getImageData(0,0,w,h),a=im.data,hh=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)hh[i]=(a[i*4]*.3+a[i*4+1]*.59+a[i*4+2]*.11)/255;
  const s=strength||3,out=x.createImageData(w,h),o=out.data;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const l=hh[j*w+(i-1+w)%w],r=hh[j*w+(i+1)%w],u=hh[((j-1+h)%h)*w+i],d=hh[((j+1)%h)*w+i];
    const nx=(l-r)*s,ny=(u-d)*s,il=1/Math.sqrt(nx*nx+ny*ny+1),k=(j*w+i)*4;
    o[k]=(nx*il*.5+.5)*255;o[k+1]=(ny*il*.5+.5)*255;o[k+2]=(il*.5+.5)*255;o[k+3]=255;
  }
  x.putImageData(out,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipMapLinearFilter;
  try{t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy())}catch(e){}
  normCache.set(src,t);return t;
}
// ===== 联网写实贴图（Poly Haven CC0 1K，CORS 开放）：加载成功后替换程序化贴图，失败则保留兜底 =====
const PHB='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/';
// 资源路径：纯相对路径（GitHub Pages 原生托管），稳定可靠
const AST='';
const pTexLoad=new THREE.TextureLoader();pTexLoad.setCrossOrigin('anonymous');
const pcache={};
function photo(url,rx,ry){
  const k=url+'|'+rx+'x'+ry;if(pcache[k])return pcache[k];
  const t=pTexLoad.load(url,tex=>{
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(rx,ry);
    try{tex.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy())}catch(e){}
    t.ready=true;const cb=t.cbs||[];t.cbs=[];cb.forEach(f=>f(tex));
  },undefined,()=>{});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.cbs=[];t.ready=false;
  return pcache[k]=t;
}
function usePBR(mat,dUrl,nUrl,rUrl,rx,ry){
  const bind=(slot,url,extra)=>{const t=photo(url,rx,ry),f=x=>{mat[slot]=x;if(extra)extra();mat.needsUpdate=true};if(t.ready)f(t);else t.cbs.push(f)};
  // 只在贴图就绪后才替换，未就绪时保留 pbrMat 传入的兜底贴图（wallTex/floorTex）
  const fmap=x=>{mat.map=x;mat.needsUpdate=true};
  const tmap=photo(dUrl,rx,ry);if(tmap.ready)fmap(tmap);else tmap.cbs.push(fmap);
  bind('normalMap',nUrl,()=>{mat.normalScale=new THREE.Vector2(1,1)});bind('roughnessMap',rUrl);
}
// Poly Haven PBR 贴图集：albedo + normal + roughness
const PSET={
  wall:'stone_brick_wall_001',floor:'cobblestone_floor_08',
  abyssWall:'dark_brick_wall',abyssFloor:'cobblestone_floor_08',
  door:'wood_planks',gate:'metal_plate_02',
  mossWall:'mossy_stone_wall',mossFloor:'mossy_cobblestone',
  sandWall:'sandstone_brick_wall_01',sandFloor:'sandstone_blocks_05',
  metalWall:'metal_plate_02',concFloor:'concrete_floor_worn_001'
};
function pset(k){const s=PSET[k]||PSET.wall,p=PHB+s+'/'+s+'_';return {d:p+'diff_1k.jpg',n:p+'nor_gl_1k.jpg',r:p+'rough_1k.jpg'}}
// 统一 PBR 材质工厂：MeshStandardMaterial + 法线/粗糙度贴图，加载期间用程序化贴图兜底
function pbrMat(k,rx,ry,o){
  const s=pset(k),fb=/floor/i.test(k)?floorTex:wallTex;
  const m=new THREE.MeshStandardMaterial(Object.assign({color:0xffffff,map:fb,normalMap:normalOf(fb,3),normalScale:new THREE.Vector2(1,1),roughness:1,metalness:0},o||{}));
  usePBR(m,s.d,s.n,s.r,rx,ry);return m;
}
const wallTex=mkTex(1),floorTex=mkTex(0);
var lant=[];
function decorate(walls,floors){
  const bm=c=>new THREE.MeshStandardMaterial({color:c,roughness:.9,metalness:0}),cx=i=>(i+.5)*T;
  const inst=(geo,mat,list,fn)=>{const m=new THREE.InstancedMesh(geo,mat,list.length),d=new THREE.Object3D(),c=new THREE.Color();
    list.forEach((it,k)=>{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.set(1,1,1);const hc=fn(it,d,c);d.updateMatrix();m.setMatrixAt(k,d.matrix);if(hc)m.setColorAt(k,c)});group.add(m)};
  inst(new THREE.BoxGeometry(T+.12,.55,T+.12),pbrMat('wall',2,.28,{color:0xc8c0b2}),walls,([i,j],d)=>{d.position.set(cx(i),.275,cx(j))});
  inst(new THREE.BoxGeometry(T+.3,.3,T+.3),pbrMat('wall',2,.15,{color:0xe0d8c8}),walls,([i,j],d)=>{d.position.set(cx(i),H+.1,cx(j))});
  const pl=walls.filter(([i,j])=>i%2===0&&j%2===0);
  inst(new THREE.CylinderGeometry(2.25,2.25,H+.1,20),pbrMat('wall',3,1),pl,([i,j],d)=>{d.position.set(cx(i),(H+.1)/2,cx(j))});
  inst(new THREE.ConeGeometry(2.4,.9,18),bm(0x443e35),pl,([i,j],d)=>{d.position.set(cx(i),H+.55,cx(j))});
  const cand=[];if(mode!=='puzzle')walls.forEach(([i,j])=>{if(i%2===0&&j%2===0)return;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{if(maze[j+b]&&maze[j+b][i+a]===0&&Math.random()<.1)cand.push([i,j,a,b])})});
  lant=cand.map(([i,j,a,b])=>({x:cx(i)+a*(T/2+.3),z:cx(j)+b*(T/2+.3)}));
  inst(new THREE.BoxGeometry(.4,.55,.4),new THREE.MeshBasicMaterial({color:0xffc766}),lant,(l,d)=>{d.position.set(l.x,2.1,l.z)});
  inst(new THREE.ConeGeometry(.38,.3,4),bm(0x2a2038),lant,(l,d)=>{d.position.set(l.x,2.55,l.z);d.rotation.y=.785});
  const op=floors.filter(([i,j])=>!(i===1&&j===1)),ms=[];
  for(let n=0;n<(mode==='puzzle'?0:40);n++){const [i,j]=op[Math.random()*op.length|0];ms.push({x:cx(i)+(Math.random()<.5?-1:1)*1.4,z:cx(j)+(Math.random()<.5?-1:1)*1.4,s:.8+Math.random()*.9,c:['#ff7ab8','#7af0ff','#b57aff','#ffd27a'][n%4]})}
  inst(new THREE.CylinderGeometry(.07,.1,.35,8),bm(0xe8dcc8),ms,(m,d)=>{d.position.set(m.x,.175*m.s,m.z);d.scale.set(m.s,m.s,m.s)});
  inst(new THREE.SphereGeometry(.28,12,8,0,6.283,0,1.57),new THREE.MeshBasicMaterial({color:0xffffff}),ms,(m,d,c)=>{d.position.set(m.x,.35*m.s,m.z);d.scale.set(m.s,m.s,m.s);c.set(m.c);return 1});
}
const skyG=new THREE.Group();scene.add(skyG);
(function(){
  const g=new THREE.SphereGeometry(90,16,12),cs=[],pos=g.attributes.position,tp=new THREE.Color('#12123a'),hor=new THREE.Color('#7a5a9a'),bt=new THREE.Color('#06071a'),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const y=clamp(pos.getY(i)/90,-1,1);if(y>=0)c.copy(hor).lerp(tp,Math.pow(y,.6));else c.copy(hor).lerp(bt,Math.pow(-y,.45));cs.push(c.r,c.g,c.b)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));
  const sky=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-2;skyG.add(sky);
  const sp=[];for(let i=0;i<220;i++){const a=Math.random()*6.283,e=.34+Math.random()*1.1,r=85;sp.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r)}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  skyG.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,fog:false})));
  const moon=new THREE.Mesh(new THREE.IcosahedronGeometry(6,1),new THREE.MeshBasicMaterial({color:0xfff1c7,fog:false}));moon.position.set(-40,50,-55);skyG.add(moon);
})();
const LL=[0,1,2].map(()=>{const l=new THREE.PointLight(0xffb55c,1.1,13);scene.add(l);return l});
function envUpdate(t,dt){
  audioTick(dt);envTick(dt,t);skyG.position.copy(cam.position);
  const near=lant.map(l=>[Math.hypot(l.x-P.x,l.z-P.z)+Math.abs((l.y||0)-(P.y||0))*10,l]).sort((p,q)=>p[0]-q[0]);
  LL.forEach((l,k)=>{const n=near[k],ab=mode!=='puzzle'&&CFG[diff].abyss;
    if(n){l.position.set(n[1].x,(n[1].y||0)+2.1,n[1].z);
      l.intensity=ab?(.42+Math.sin(t*13+k*3)*.2+Math.random()*.12):(1.05+Math.sin(t*9+k*2)*.15+Math.random()*.06)}
    else l.intensity=0});
  if(exit&&exit.userData.disc){exit.rotation.y=Math.atan2(P.x-exit.position.x,P.z-exit.position.z);exit.userData.disc.rotation.z=t}
  if(exit&&exit.userData.beam&&mode!=='puzzle'&&CFG[diff].abyss)exit.userData.beam.material.opacity=.8+Math.sin(t*1.6)*.14;
}
// 白骨红眼骷髅：头骨、獠牙、肋骨、脊椎、骨盆、骨臂骨腿与利爪
function mkMon(){
  const g=new THREE.Group(),skin=new THREE.MeshLambertMaterial({color:0x9ba48f,flatShading:true}),dark=new THREE.MeshLambertMaterial({color:0x14100e,flatShading:true}),blood=new THREE.MeshLambertMaterial({color:0x51060d,flatShading:true}),bone=new THREE.MeshLambertMaterial({color:0xd6cfb6,flatShading:true}),eye=new THREE.MeshBasicMaterial({color:0xff2a2a});
  const add=(geo,m,x,y,z,rx,ry,rz,s)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);if(s)o.scale.set(s[0],s[1],s[2]);g.add(o);return o};
  const body=add(new THREE.IcosahedronGeometry(.62,0),skin,0,1.2,-.05,.45,0,0,[.8,1.35,.65]);
  add(new THREE.IcosahedronGeometry(.4,0),skin,0,.62,-.12,0,0,0,[.9,.8,.7]);
  for(let i=0;i<4;i++)add(new THREE.BoxGeometry(.46-i*.06,.045,.05),dark,0,1.52-i*.15,.34+i*.02,.35,0,0);
  add(new THREE.IcosahedronGeometry(.34,0),bone,0,2.02,.3,.35,0,0,[.85,1,.95]);
  [-.15,.15].forEach(ex=>{add(new THREE.OctahedronGeometry(.1),dark,ex,2.08,.58,0,0,0,[1.2,1.5,.7]);add(new THREE.OctahedronGeometry(.045),eye,ex,2.06,.63,0,0,0,[1,1.6,.6]);add(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xff1a2a,transparent:true,opacity:Math.min(.9,.15+(1-EDL[diff])*.6),blending:THREE.AdditiveBlending,depthWrite:false,fog:false}),ex,2.06,.66)});
  add(new THREE.BoxGeometry(.3,.16,.1),new THREE.MeshBasicMaterial({color:0x0a0005}),0,1.86,.52,.15,0,0);
  add(new THREE.BoxGeometry(.26,.06,.14),bone,0,1.74,.5,.55,0,0);
  for(let i=0;i<5;i++)add(new THREE.ConeGeometry(.028,.11,4),bone,-.12+i*.06,1.9,.58,Math.PI,0,0);
  for(let i=0;i<4;i++)add(new THREE.ConeGeometry(.024,.09,4),bone,-.09+i*.06,1.79,.56);
  add(new THREE.BoxGeometry(.05,.22,.04),blood,-.1,1.66,.5);
  for(let i=0;i<5;i++)add(new THREE.ConeGeometry(.07,.34-i*.03,4),dark,0,2.05-i*.33,-.18-i*.14,-1.9,0,0);
  [-1,1].forEach(s2=>{
    const arm=new THREE.Group();arm.position.set(s2*.42,1.74,.05);arm.rotation.set(.85,0,s2*.16);g.add(arm);
    const up=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.7,5),skin);up.position.y=-.3;arm.add(up);
    const fo=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,.65,5),skin);fo.position.set(0,-.82,.22);fo.rotation.x=.65;arm.add(fo);
    for(let k=-1;k<=1;k++){const cl=new THREE.Mesh(new THREE.ConeGeometry(.035,.42,4),k?bone:blood);cl.position.set(k*.1,-1.14,.5);cl.rotation.x=2.4;arm.add(cl)}
  });
  [-1,1].forEach(s2=>add(new THREE.CylinderGeometry(.08,.13,.7,5),dark,s2*.22,.35,-.05,.15,0,0));
  const L=new THREE.PointLight(0xff1a2a,1,9);L.position.y=1.6;g.add(L);
  return {g,mat:skin,eye,body};
}
const mus={on:false,mute:false,chordT:0,noteT:2,pulseT:0,k:0,ci:0,gT:0};
function musicStart(){
  try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();if(mus.on)return;
    const m=ac.createGain();m.gain.value=0;m.connect(ac.destination);
    const dl=ac.createDelay(1),fb=ac.createGain(),wet=ac.createGain();dl.delayTime.value=.42;fb.gain.value=.38;wet.gain.value=.5;dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(m);
    const bus=ac.createGain();bus.connect(m);bus.connect(dl);
    const fl=ac.createBiquadFilter();fl.type='lowpass';fl.frequency.value=320;fl.connect(bus);
    [55,55.4,82.4].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=i<2?'sawtooth':'triangle';o.frequency.value=f;g.gain.value=i<2?.07:.05;o.connect(g);g.connect(fl);o.start()});
    const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.08;lg.gain.value=120;lfo.connect(lg);lg.connect(fl.frequency);lfo.start();
    Object.assign(mus,{on:true,m,bus,fl});
  }catch(e){}
}
function mnote(f,d,type,v,att){const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(mus.bus);o.start(t);o.stop(t+d+.05)}
function musicUpdate(dt,inten){
  if(!mus.on||!ac)return;
  mus.m.gain.setTargetAtTime(mus.mute?0:(running?.55:.22),ac.currentTime,.4);
  mus.fl.frequency.setTargetAtTime(300+inten*900,ac.currentTime,.3);
  if(!running||mus.mute)return;
  mus.chordT-=dt;if(mus.chordT<=0){const L=8-inten*3;mus.chordT=L;[[220,261.6,329.6],[174.6,220,261.6],[146.8,174.6,220],[164.8,207.7,246.9]][mus.ci++%4].forEach(f=>mnote(f,L+1.5,'sine',.05,2))}
  mus.noteT-=dt;if(mus.noteT<=0){mus.noteT=(2.5+Math.random()*2.5)*(1-inten*.7);const sc=[440,523.3,587.3,659.3,784,880];mnote(sc[Math.random()*6|0]*(Math.random()<.3?.5:1),2.4,'triangle',.06,.02)}
  if(inten>.08){
    mus.pulseT-=dt;if(mus.pulseT<=0){mus.pulseT=60/(70+inten*110);mus.k++;
      const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(40,t+.15);g.gain.setValueAtTime(.35*Math.min(1,inten*1.6),t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(mus.m);o.start(t);o.stop(t+.2);
      if(mus.k%2&&inten>.25)mnote(mus.k%4===1?233.1:220,.18,'square',.03+inten*.04,.005)}
  }
}
function growl(v,pan){try{ac=ac||new AudioContext();const t=ac.currentTime,o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter(),tr=ac.createGain(),lf=ac.createOscillator(),lg=ac.createGain(),p=ac.createStereoPanner?ac.createStereoPanner():null;
  o.type='sawtooth';o2.type='square';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(48,t+1.1);o2.frequency.setValueAtTime(47,t);o2.frequency.exponentialRampToValueAtTime(24,t+1.1);
  lf.frequency.value=28;lg.gain.value=.5;lf.connect(lg);lg.connect(tr.gain);tr.gain.value=.6;
  f.type='bandpass';f.Q.value=2.5;f.frequency.setValueAtTime(350,t);f.frequency.linearRampToValueAtTime(900,t+.35);f.frequency.exponentialRampToValueAtTime(250,t+1.1);
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.35*v,t+.12);g.gain.exponentialRampToValueAtTime(.001,t+1.2);
  o.connect(tr);o2.connect(tr);tr.connect(f);f.connect(g);if(p){p.pan.value=pan||0;g.connect(p);p.connect(ac.destination)}else g.connect(ac.destination);
  [o,o2,lf].forEach(n=>{n.start(t);n.stop(t+1.25)})}catch(e){}}
function whisper(v){try{ac=ac||new AudioContext();const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(140,t+.7);f.type='bandpass';f.frequency.value=900;f.Q.value=3;
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.12*v,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.8);o.connect(f);f.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.85)}catch(e){}}
function audioTick(dt){
  let inten=0,d=99;
  if(running&&mon&&!mon.dead&&mon.grace<=0){d=Math.hypot(P.x-mon.x,P.z-mon.z);inten=clamp(1-d/20,0,1)}
  musicUpdate(dt,inten);
  mus.gT-=dt;
  if(mus.on&&running&&d<16&&mon.stun<=0&&mus.gT<=0){mus.gT=3.2-inten*1.6+Math.random()*1.2;growl(.35+inten*.65,clamp(((mon.x-P.x)*Math.cos(yaw)-(mon.z-P.z)*Math.sin(yaw))/Math.max(d,1),-1,1))}
}
$('mt').onclick=()=>{mus.mute=!mus.mute;$('mt').style.opacity=mus.mute?.4:1;if(rlBgm.gain)rlBgm.gain.gain.setTargetAtTime(mus.mute?0:.32,ac.currentTime,.4)};
const gTex=(()=>{const c=document.createElement('canvas');c.width=128;c.height=192;const x=c.getContext('2d');
  const gr=x.createLinearGradient(0,0,0,192);gr.addColorStop(0,'rgba(216,222,240,.95)');gr.addColorStop(.55,'rgba(175,184,210,.8)');gr.addColorStop(1,'rgba(150,160,200,0)');
  x.fillStyle=gr;x.beginPath();x.moveTo(20,192);x.lineTo(13,78);x.quadraticCurveTo(8,10,64,6);x.quadraticCurveTo(120,10,115,78);x.lineTo(108,192);x.closePath();x.fill();
  x.fillStyle='rgba(70,76,100,.32)';x.beginPath();x.ellipse(40,86,12,17,.35,0,6.283);x.fill();x.beginPath();x.ellipse(88,86,12,17,-.35,0,6.283);x.fill();
  x.fillStyle='rgba(80,86,110,.28)';x.beginPath();x.moveTo(60,64);x.lineTo(68,64);x.lineTo(66,90);x.lineTo(62,90);x.closePath();x.fill();
  x.shadowColor='rgba(0,0,0,.9)';x.shadowBlur=7;x.fillStyle='#000';
  x.beginPath();x.ellipse(46,54,13,17,.15,0,6.283);x.fill();x.beginPath();x.ellipse(83,52,12,18,-.12,0,6.283);x.fill();x.shadowBlur=0;
  [[47,57],[82,55]].forEach(([ex,ey])=>{const rg=x.createRadialGradient(ex,ey,0,ex,ey,5.5);rg.addColorStop(0,'rgba(255,30,30,.95)');rg.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=rg;x.beginPath();x.arc(ex,ey,5.5,0,6.283);x.fill()});
  x.strokeStyle='rgba(110,0,12,.85)';x.lineWidth=2.5;x.lineCap='round';
  x.beginPath();x.moveTo(45,69);x.bezierCurveTo(42,88,47,102,41,126);x.stroke();
  x.beginPath();x.moveTo(84,68);x.bezierCurveTo(88,86,81,100,87,122);x.stroke();
  x.strokeStyle='rgba(90,0,10,.55)';x.lineWidth=1.2;
  x.beginPath();x.moveTo(52,71);x.bezierCurveTo(54,90,50,104,53,118);x.stroke();
  x.fillStyle='rgba(5,2,8,.85)';x.beginPath();x.ellipse(60,90,2.6,4,.25,0,6.283);x.fill();x.beginPath();x.ellipse(68,90,2.6,4,-.25,0,6.283);x.fill();
  x.save();x.translate(64,120);x.rotate(.06);
  x.shadowColor='rgba(0,0,0,.9)';x.shadowBlur=8;x.fillStyle='#020003';
  x.beginPath();x.moveTo(-15,-18);x.quadraticCurveTo(0,-24,15,-16);x.quadraticCurveTo(20,4,10,22);x.quadraticCurveTo(0,28,-10,22);x.quadraticCurveTo(-20,2,-15,-18);x.closePath();x.fill();x.shadowBlur=0;
  const mg=x.createRadialGradient(0,-6,0,0,-6,16);mg.addColorStop(0,'rgba(140,0,16,.7)');mg.addColorStop(1,'rgba(140,0,16,0)');x.fillStyle=mg;x.beginPath();x.ellipse(0,-2,12,17,0,0,6.283);x.fill();
  x.restore();
  x.strokeStyle='rgba(45,50,70,.55)';x.lineWidth=1;
  [[30,32,38,46,34,60],[98,34,90,48,96,62],[56,22,60,34,55,44],[70,152,66,166,70,182]].forEach(([a,b,c2,d,e,f])=>{x.beginPath();x.moveTo(a,b);x.quadraticCurveTo(c2,d,e,f);x.stroke()});
  x.fillStyle='rgba(6,4,12,.95)';x.beginPath();x.moveTo(18,62);x.quadraticCurveTo(12,6,64,4);x.quadraticCurveTo(116,6,110,62);x.quadraticCurveTo(104,34,92,28);x.quadraticCurveTo(96,46,86,40);x.quadraticCurveTo(76,22,62,25);x.quadraticCurveTo(48,27,44,44);x.quadraticCurveTo(34,38,30,54);x.quadraticCurveTo(23,52,18,62);x.closePath();x.fill();
  x.strokeStyle='rgba(6,4,12,.92)';x.lineCap='round';
  for(let i=0;i<7;i++){const sx0=16+i*3.2;x.lineWidth=2.5+(i%3);x.beginPath();x.moveTo(sx0,42);x.quadraticCurveTo(sx0-6,110,sx0+2,186);x.stroke()}
  for(let i=0;i<7;i++){const sx0=112-i*3.2;x.lineWidth=2.5+((i+1)%3);x.beginPath();x.moveTo(sx0,42);x.quadraticCurveTo(sx0+6,110,sx0-2,186);x.stroke()}
  x.lineWidth=2;x.beginPath();x.moveTo(48,20);x.quadraticCurveTo(42,58,46,94);x.stroke();
  x.beginPath();x.moveTo(84,22);x.quadraticCurveTo(90,60,85,98);x.stroke();
  return new THREE.CanvasTexture(c)})();
let ghost=null;
function clearAhead(a,maxd){const dx=-Math.sin(a),dz=-Math.cos(a);let d=0;for(;d<maxd;d+=.5){const i=Math.floor((P.x+dx*d)/T),j=Math.floor((P.z+dz*d)/T);if(!maze[j]||maze[j][i]!==0)break}return d}
function spawnGhost(){
  if(ghost||!running)return;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:gTex,transparent:true,opacity:0,depthWrite:false,fog:false}));s.scale.set(2,3,1);
  if(Math.random()<.45){
    let best=null;for(let n=0;n<8;n++){const a=yaw+(Math.random()-.5)*.7,d=clearAhead(a,18);if(d>=7&&(!best||d>best.d))best={a,d}}
    if(!best){fakeT=2;return}
    const d=best.d-1,dx=-Math.sin(best.a),dz=-Math.cos(best.a);
    s.position.set(P.x+dx*d,1.5,P.z+dz*d);growl(.8,0);
    group.add(s);ghost={s,t:0,rush:1,v:null,life:0,d0:d,ph:0,ft:0};
  }else{
    const sg=Math.random()<.5?-1:1,fx=-Math.sin(yaw),fz=-Math.cos(yaw),nx=-fz*sg,nz=fx*sg,off=1.6+Math.random()*1.2;
    s.position.set(P.x+fx*off-nx*3.2,1.3+Math.random()*.5,P.z+fz*off-nz*3.2);whisper(1);
    group.add(s);ghost={s,t:0,rush:0,v:new THREE.Vector3(nx*7.5,0,nz*7.5),life:.85+Math.random()*.2,d0:1,ph:0,ft:0};
  }
}
function ghostTick(dt){
  if(!ghost)return;const g=ghost,s=g.s;g.t+=dt;
  if(g.rush){
    if(!g.ph){
      const dx=P.x-s.position.x,dz=P.z-s.position.z,l=Math.hypot(dx,dz)||1,k=1-clamp(l/g.d0,0,1);
      const sp=20+34*k*k;
      s.position.x+=dx/l*sp*dt;s.position.z+=dz/l*sp*dt;
      const m=1+k*k*4;s.scale.set(2*m,3*m,1);
      s.material.opacity=Math.min(1,g.t/.08)*.95*(.9+Math.random()*.1);
      if(l<1.5){g.ph=1;g.ft=0;shake=1;scream(.9)}
    }else{
      g.ft+=dt;
      const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
      s.position.set(P.x+fx*.7,1.5,P.z+fz*.7);s.scale.set(5.5,8,1);
      s.material.opacity=g.ft<.14?.97:Math.max(0,.97*(1-(g.ft-.14)/.2));
      if(g.ft>=.34){group.remove(s);s.material.dispose();ghost=null}
    }
  }else{
    s.position.addScaledVector(g.v,dt);
    s.material.opacity=Math.min(1,g.t/.12)*Math.max(0,Math.min(1,(g.life-g.t)/.25))*.85*(.85+Math.random()*.15);
    if(g.t>=g.life){group.remove(s);s.material.dispose();ghost=null}
  }
}
const sunM=new THREE.Mesh(new THREE.IcosahedronGeometry(5,1),new THREE.MeshBasicMaterial({color:0xfff2b0,fog:false}));sunM.position.set(45,38,-62);skyG.add(sunM);
skyG.children.forEach((o,i)=>{o.renderOrder=-12+i;if(o.material){o.material.depthTest=false;o.material.depthWrite=false}});
const EDL={free:1,easy:.78,normal:.55,hard:.38,hell:.22,inferno:.1,abyss:0};
const SK=[[0,'#05060e'],[.12,'#1c1740'],[.3,'#6a4a8a'],[.5,'#e08a7a'],[.75,'#f2c48a'],[1,'#8fd0ff']];
function skyCol(d){let i=0;while(i<SK.length-2&&d>SK[i+1][0])i++;const a=SK[i],b=SK[i+1];return new THREE.Color(a[1]).lerp(new THREE.Color(b[1]),clamp((d-a[0])/(b[0]-a[0]),0,1))}
const PTH={
 garden:{sky:'#8fd0ff',fog:'#cfe9d0',tx:'hedge',fx:'grass',tr:0x5a4a32,cc:0x9a7a52,sc:0x9a7a52},
 temple:{sky:'#f0c88c',fog:'#c9a36a',tx:'sand',fx:'tile',tr:0x8a6a3c,cc:0xa88f68,sc:0xc9ad7a},
 lab:{sky:'#9fb4c8',fog:'#8aa0b0',tx:'metal',fx:'grate',tr:0x2b323a,cc:0x4a5460,sc:0x6a7686}
};
const KC={r:{n:'红',c:0xe5484d},b:{n:'蓝',c:0x3e8bff},y:{n:'黄',c:0xf5c542}};
const LH=3.8,TXC={};
const hemi=scene.children.find(o=>o.isHemisphereLight),spot=new THREE.SpotLight(0xfff2cc,0,28,.52,.5,1);
spot.position.set(0,0,0);spot.target.position.set(0,0,-1);cam.add(spot);cam.add(spot.target);
let pu={items:[],inter:[],spikes:[],bars:[],stairs:[]},mazes=[],layer=0,topL=0,exploredL=[],stairArm=true,hearts=3,hasFl=false,bat=0,flOn=false,keysHeld={},notes=[],codeOpen=null,cdig=[0,0,0],lastSafe={x:6,z:6},safeT=0,hintT=0,hurtT=0;
const N4=[[1,0],[-1,0],[0,1],[0,-1]],cxp=i=>(i+.5)*T,lmat=(c,o)=>new THREE.MeshPhongMaterial(Object.assign({color:c,shininess:20,specular:0x222222},o||{}));
function mkTexP(k){
  if(TXC[k])return TXC[k];
  const c=document.createElement('canvas');c.width=c.height=192;const x=c.getContext('2d'),R=Math.random,F=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};
  x.scale(3,3);  // 以 64×64 的坐标绘制，输出 192×192 高清贴图
  if(k==='hedge'){F('#4f8a3f',0,0,64,64);for(let i=0;i<90;i++){x.fillStyle=['#3f7a34','#63a44d','#2f6a2c','#78b85a'][i%4];x.beginPath();x.arc(R()*64,R()*64,3+R()*5,0,6.283);x.fill()}for(let i=0;i<9;i++)F(['#ff8fb8','#fff3a0','#ffffff'][i%3],R()*62,R()*62,3,3)}
  else if(k==='grass'){F('#6fae52',0,0,64,64);for(let i=0;i<70;i++)F(['#5e9a45','#80bd62'][i%2],R()*62,R()*62,3,2);F('#d8c9a0',8,8,48,48);F('#b5a67e',8,8,48,2);F('#b5a67e',8,32,48,2);F('#b5a67e',8,8,2,48);F('#b5a67e',32,8,2,48)}
  else if(k==='sand'){F('#d9bf8c',0,0,64,64);for(let r=0;r<4;r++){F('#b99a68',0,r*16,64,2);for(let b=0;b<2;b++)F('#b99a68',(r%2?16:0)+b*32,r*16,2,16)}for(let i=0;i<6;i++){F('#8a6a3c',6+i*9,20,3,8);F('#8a6a3c',8+i*9,30,5,2)}}
  else if(k==='tile'){F('#c7ae80',0,0,64,64);F('#8d7550',0,0,64,2);F('#8d7550',0,32,64,2);F('#8d7550',0,0,2,64);F('#8d7550',32,0,2,64);for(let i=0;i<40;i++)F('rgba(90,70,40,.15)',R()*62,R()*62,3,2)}
  else if(k==='metal'){F('#8d9bad',0,0,64,64);F('#5d6a7a',0,0,64,2);F('#5d6a7a',0,31,64,2);F('#5d6a7a',31,0,2,64);F('#37b8d9',0,42,64,4);for(let i=0;i<4;i++)F('#cdd6e0',4+(i%2)*52,4+(i>>1)*52,3,3)}
  else if(k==='bone'){F('#41382d',0,0,64,64);for(let i=0;i<34;i++){x.fillStyle=['#332b22','#4d4234','#2b241d'][i%3];x.beginPath();x.arc(R()*64,R()*64,2+R()*7,0,6.283);x.fill()}for(let i=0;i<3;i++){x.strokeStyle='#241e17';x.lineWidth=1.4;x.beginPath();let qx=R()*64,qy=0;x.moveTo(qx,qy);for(let k2=0;k2<6;k2++){qx+=(R()-.5)*14;qy+=11;x.lineTo(qx,qy)}x.stroke()}for(let i=0;i<16;i++)F('rgba(56,8,6,.55)',R()*58,R()*58,2,4+R()*8);for(let i=0;i<40;i++)F('rgba(0,0,0,.38)',R()*62,R()*62,2,2)}
  else{F('#2f353e',0,0,64,64);for(let i=0;i<8;i++){F('#161a20',i*8,0,2,64);F('#161a20',0,i*8,64,2)}F('#4a525e',0,0,64,1)}
  for(let i=0;i<50;i++)F('rgba(0,0,0,'+(R()*.07)+')',R()*62,R()*62,2,2);
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipMapLinearFilter;
  try{t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy())}catch(e){}
  return TXC[k]=t;
}
function genP(){
  const pc=PC[pdiff],out=[];
  for(let l=0;l<pc.stages.length;l++){const m=gen();
    for(let i=0;i<pc.extra;i++){const x=1+(Math.random()*(S-2)|0),y=1+(Math.random()*(S-2)|0);if((x+y)%2===1)m[y][x]=0}
    for(let r=0;r<pc.rooms;r++){const x=3+2*(Math.random()*((S-7)/2|0)|0),y=3+2*(Math.random()*((S-7)/2|0)|0);for(let j=0;j<3;j++)for(let i=0;i<3;i++)m[y+j][x+i]=0}
    out.push(m)}
  return out;
}
function bfs(src,blocked){
  const pv=new Map(),q=[src];pv.set(src[0]+','+src[1],null);
  while(q.length){const [x,y]=q.shift();for(const [a,b] of N4){const nx=x+a,ny=y+b,k=nx+','+ny;if(maze[ny]&&maze[ny][nx]===0&&!pv.has(k)&&!blocked.has(k)){pv.set(k,[x,y]);q.push([nx,ny])}}}
  return pv;
}
function preEnv(){
  const p=mode==='puzzle',dl=p?1:EDL[diff],dk=new THREE.Color('#2a1020');
  // 低难度墙壁走森林苔绿色系（石绿/苔藓/树皮棕混搭，非单一绿），高难度回归阴寒石色
  const forest=diff==='free'||diff==='easy'||diff==='normal';
  if(forest){
    WP=['#6a8a4a','#5a7a3e','#7a9a55','#4d6b35','#8a7a45','#5f7a48'].map(c=>new THREE.Color(c).lerp(dk,(1-dl)*.18).getStyle());
    FC=['#7ab85a','#6aa84a','#5a9a3a','#8ec96a'].map(c=>new THREE.Color(c).lerp(dk,(1-dl)*.15).getStyle());
  }else{
    WP=['#ffffff','#f3efe6','#e8e2d6','#dcd5c8'].map(c=>new THREE.Color(c).lerp(dk,(1-dl)*.3).getStyle());FC=['#f2eee6','#e4dfd5'].map(c=>new THREE.Color(c).lerp(dk,(1-dl)*.25).getStyle());
  }
  if(!p&&diff==='abyss'){WP=['#d8c4ae','#c4ae96','#e2ceb8','#b49e86'];FC=['#9c8e7c','#8a7d6c']}
  spot.intensity=0;flOn=false;gun.visible=!p;P.y=0;layer=0;topL=0;
  $('info').style.display=p?'none':'';$('fire').style.display=p?'none':'';
  ['pinfo','pn','act'].forEach(i=>$(i).classList.toggle('hide',!p));$('flb').classList.toggle('hide',!p);
  skyG.children.forEach(c=>{c.visible=true});skyG.visible=!(p&&PC[pdiff].closed);
  if(!p){
    const col=skyCol(dl);scene.background.copy(col);scene.fog.color.copy(col);
    hemi.intensity=.22+.55*dl;sun.intensity=.1+.55*dl;lamp.intensity=.9-.5*dl;gHemi.intensity=.35+.6*dl;gDir.intensity=.4+.5*dl;
    skyG.children[1].visible=skyG.children[2].visible=dl<.45;skyG.children[3].visible=dl>.4;skyG.children[2].material.color.set(dl<.15?0xff5a4a:0xfff1c7);
    LL.forEach(l=>l.color.set(CFG[diff].abyss?0xff2a12:(dl>.5?0xffc27a:0xff7a4a)));
  }
}
function glowM(m,c,r){m.add(new THREE.Mesh(new THREE.OctahedronGeometry(r),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false})));return m}
function mkItem(type,arg){
  const B=c=>new THREE.MeshPhongMaterial({color:c,emissive:c,emissiveIntensity:.5,shininess:60,specular:0x9a9a9a}),g=new THREE.Group();
  if(type==='key'){const c=KC[arg].c,r=new THREE.Mesh(new THREE.TorusGeometry(.2,.06,6,20),B(c)),sh=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.07),B(c)),t1=new THREE.Mesh(new THREE.BoxGeometry(.2,.07,.07),B(c));r.position.y=.32;t1.position.set(.1,-.18,0);g.add(r,sh,t1);glowM(g,c,.6)}
  else if(type==='note'){g.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.65,.04),new THREE.MeshPhongMaterial({color:0xfff4c8,emissive:0x6a6034,shininess:12})));glowM(g,0xfff0a0,.55)}
  else if(type==='fl'){const b=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.55,12),B(0xf5c542)),h=new THREE.Mesh(new THREE.CylinderGeometry(.16,.1,.18,12),B(0xcfd6df));h.position.y=.34;g.add(b,h);glowM(g,0xffe9a0,.7)}
  else if(type==='bat'){g.add(new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.4,12),B(0x58ff9a)));glowM(g,0x58ff9a,.5)}
  else{g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.26,1),B(0xff4a6e)));glowM(g,0xff4a6e,.5)}
  return g;
}
function mkBar(b,Y){
  const [i,j]=b.t,g=new THREE.Group();
  if(b.k==='gate'){const mt=pbrMat('gate',1,1,{color:0xcdd4dc,metalness:.65,roughness:.42});for(let a=0;a<4;a++)for(let c=0;c<4;c++){const p=new THREE.Mesh(new THREE.BoxGeometry(.22,H,.22),mt);p.position.set((a-1.5)*.95,H/2,(c-1.5)*.95);g.add(p)}
    const tb=new THREE.Mesh(new THREE.BoxGeometry(T-.2,.2,T-.2),mt);tb.position.y=H-.1;g.add(tb)}
  else{
    const col=b.k==='code'?0x59616e:KC[b.k[5]].c,
      mt=b.k==='code'?pbrMat('metalWall',1,1,{color:0x9aa4ae,metalness:.4,roughness:.55}):pbrMat('door',1,1,{color:col}),
      box=new THREE.Mesh(new THREE.BoxGeometry(T-.2,H,T-.2),mt);box.position.y=H/2;g.add(box);
    if(b.k==='code'){const pm=new THREE.MeshBasicMaterial({color:0x58ff9a});[[0,1],[0,-1],[1,0],[-1,0]].forEach(([a,c])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(a?.06:.9,.7,c?.06:.9),pm);p.position.set(a*(T/2-.08),1.6,c*(T/2-.08));g.add(p)})}
  }
  g.position.set(cxp(i),Y,cxp(j));group.add(g);b.m=g;
}
function mkLever(c){
  const g=new THREE.Group(),b=new THREE.Mesh(new THREE.BoxGeometry(.7,.35,.7),lmat(0x4a4f5a)),pv=new THREE.Group(),
  st=new THREE.Mesh(new THREE.BoxGeometry(.09,.9,.09),lmat(0xb8c0cc)),kn=new THREE.Mesh(new THREE.SphereGeometry(.17,12,9),new THREE.MeshPhongMaterial({color:c,emissive:c,emissiveIntensity:.55,shininess:50,specular:0xaaaaaa}));
  b.position.y=.17;pv.position.y=.35;st.position.y=.45;kn.position.y=.95;pv.add(st,kn);pv.rotation.z=-.7;g.add(b,pv);g.userData.pv=pv;return g;
}
function mkSpike(){
  const g=new THREE.Group(),pl=new THREE.Mesh(new THREE.BoxGeometry(T-.8,.12,T-.8),lmat(0x444a55)),sp=new THREE.Group(),mt=lmat(0xcfd6df);
  pl.position.y=.06;g.add(pl);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=new THREE.Mesh(new THREE.ConeGeometry(.16,.8,8),mt);c.position.set(i*.9,.4,j*.9);sp.add(c)}
  g.add(sp);g.userData.sp=sp;return g;
}
function mkStair(col){
  const g=new THREE.Group(),mt=lmat(col),n=12,c=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,LH-.2,16),lmat(0x555b66));c.position.y=(LH-.2)/2;g.add(c);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,s=new THREE.Mesh(new THREE.BoxGeometry(1.1,.12,.5),mt);s.position.set(Math.cos(a)*.8,.2+i*(LH-.7)/n,Math.sin(a)*.8);s.rotation.y=-a;g.add(s)}
  const gl=new THREE.MeshBasicMaterial({color:0x58d6ff,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}),dsc=new THREE.Mesh(new THREE.CircleGeometry(1.3,24),gl);dsc.rotation.x=-Math.PI/2;dsc.position.y=LH-.2;g.add(dsc);
  const rg=new THREE.Mesh(new THREE.TorusGeometry(1.2,.07,8,28),new THREE.MeshBasicMaterial({color:0x58d6ff}));rg.rotation.x=Math.PI/2;rg.position.y=.08;g.add(rg);return g;
}
function mkHatch(col){
  const g=new THREE.Group(),f=new THREE.Mesh(new THREE.BoxGeometry(2.2,.08,2.2),lmat(0x3a3f48)),r=new THREE.Mesh(new THREE.TorusGeometry(.8,.06,8,24),new THREE.MeshBasicMaterial({color:col}));
  f.position.y=.04;r.rotation.x=Math.PI/2;r.position.y=.1;g.add(f,r);
  for(const sx of[-.4,.4]){const b=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,1.6),lmat(0x9aa7ad));b.position.set(sx,.12,0);g.add(b)}
  for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.8,.04,.06),lmat(0x9aa7ad));b.position.set(0,.12,-.6+i*.3);g.add(b)}
  return g;
}
function pLayer(l){
  const mz=maze,pc=PC[pdiff],th=PTH[pc.th],lg=new THREE.Group();lg.position.y=l*LH;group.add(lg);
  const I=(geo,mt,list,fn)=>{const m=new THREE.InstancedMesh(geo,mt,Math.max(list.length,1)),d=new THREE.Object3D(),c=new THREE.Color();
    list.forEach((it,n)=>{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.set(1,1,1);c.set(0xffffff);fn(it,d,c);d.updateMatrix();m.setMatrixAt(n,d.matrix);m.setColorAt(n,c)});m.count=list.length;lg.add(m);return m};
  const W=[],F=[],A=[];for(let j=0;j<S;j++)for(let i=0;i<S;i++){A.push([i,j]);(mz[j][i]?W:F).push([i,j])}
  const v=()=>.82+Math.random()*.18,pick=(arr,p)=>arr.filter(()=>Math.random()<p),Bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d),Cy=(a,b,h,n)=>new THREE.CylinderGeometry(a,b,h,n||12),Co=(r,h,n)=>new THREE.ConeGeometry(r,h,n||10);
  const wk={garden:'mossWall',temple:'sandWall',lab:'metalWall'}[pc.th]||'wall',
    fk={garden:'mossFloor',temple:'sandFloor',lab:'concFloor'}[pc.th]||'floor',
    pwm=pbrMat(wk,1,1),pfm=pbrMat(fk,1,1);
  I(Bx(T,H,T),pwm,W,([i,j],d,c)=>{d.position.set(cxp(i),H/2,cxp(j));c.setScalar(v())});
  I(Bx(T,.2,T),pfm,F,([i,j],d,c)=>{d.position.set(cxp(i),-.1,cxp(j));c.setScalar(v())});
  I(Bx(T+.1,.45,T+.1),pbrMat(wk,2,.22,{color:0xc4bbab}),W,([i,j],d)=>{d.position.set(cxp(i),.225,cxp(j))});
  const glass=pc.closed&&pc.th==='garden'&&l===topL;
  if(glass){
    I(Bx(T,.06,T),lmat(0xbfe8ff,{transparent:true,opacity:.22,depthWrite:false}),A,([i,j],d)=>{d.position.set(cxp(i),H+.1,cxp(j))});
    I(Bx(T,.14,.14),lmat(0xe8efe0),A,([i,j],d)=>{d.position.set(cxp(i),H+.12,j*T)});I(Bx(.14,.14,T),lmat(0xe8efe0),A,([i,j],d)=>{d.position.set(i*T,H+.12,cxp(j))});
  }else if(pc.closed)I(Bx(T,.3,T),lmat(th.cc),A,([i,j],d)=>{d.position.set(cxp(i),H+.15,cxp(j))});
  const faces=[];W.forEach(([i,j])=>{if(i%2===0&&j%2===0)return;N4.forEach(([a,b])=>{if(mz[j+b]&&mz[j+b][i+a]===0)faces.push({x:cxp(i)+a*(T/2+.05),z:cxp(j)+b*(T/2+.05),a,b})})});
  if(pc.th==='garden'){
    const fl=pick(F,.5).map(([i,j])=>({x:cxp(i)+(Math.random()-.5)*2.4,z:cxp(j)+(Math.random()-.5)*2.4,c:['#ff7ab8','#ffd84a','#ffffff','#b57aff'][Math.random()*4|0]}));
    I(Co(.17,.34,5),lmat(0xffffff),fl,(f,d,c)=>{d.position.set(f.x,.3,f.z);c.set(f.c)});I(Cy(.02,.02,.26,4),lmat(0x3f8a3a),fl,(f,d)=>{d.position.set(f.x,.13,f.z)});
    const tr=pick(F,.09).map(([i,j])=>({x:cxp(i)+(Math.random()<.5?-1:1)*1.2,z:cxp(j)+(Math.random()<.5?-1:1)*1.2}));
    I(Cy(.12,.16,1.2,6),lmat(0x7a5a3a),tr,(f,d)=>{d.position.set(f.x,.6,f.z)});I(Co(.75,1.3,7),lmat(0x3f9a4a),tr,(f,d)=>{d.position.set(f.x,1.7,f.z)});I(Co(.5,1,7),lmat(0x58b85a),tr,(f,d)=>{d.position.set(f.x,2.4,f.z)});
  }else if(pc.th==='temple'){
    const pl=W.filter(([i,j])=>i%2===0&&j%2===0);
    I(Cy(1.7,1.8,H,10),lmat(0xd8c08e),pl,([i,j],d)=>{d.position.set(cxp(i),H/2,cxp(j))});I(Bx(T-.3,.3,T-.3),lmat(0xb08f5c),pl,([i,j],d)=>{d.position.set(cxp(i),H-.15,cxp(j))});I(Bx(T-.3,.3,T-.3),lmat(0xb08f5c),pl,([i,j],d)=>{d.position.set(cxp(i),.15,cxp(j))});
    const tt=pick(faces,.1).map(f=>({x:f.x+f.a*.25,z:f.z+f.b*.25}));
    I(Co(.16,.45,5),new THREE.MeshBasicMaterial({color:0xffa13a}),tt,(f,d)=>{d.position.set(f.x,2.35,f.z)});I(Bx(.3,.14,.3),lmat(0x4a3a28),tt,(f,d)=>{d.position.set(f.x,2,f.z)});
    tt.forEach(t=>lant.push({x:t.x,z:t.z,y:l*LH}));
    I(Bx(1.6,.5,.05),lmat(0x6a4a24),pick(faces,.12),(f,d)=>{d.position.set(f.x,2.2,f.z);d.rotation.y=f.a?Math.PI/2:0});
    const ur=pick(F,.1).map(([i,j])=>({x:cxp(i)+1.2,z:cxp(j)+1.2}));
    I(Cy(.3,.2,.7),lmat(0xe0b84a),ur,(f,d)=>{d.position.set(f.x,.35,f.z)});I(new THREE.SphereGeometry(.22,6,5),lmat(0xe0b84a),ur,(f,d)=>{d.position.set(f.x,.8,f.z)});
  }else{
    const rk=pick(faces,.1).map(f=>({x:f.x+f.a*.3,z:f.z+f.b*.3,r:f.a?Math.PI/2:0,a:f.a,b:f.b}));
    I(Bx(1.4,2.2,.5),lmat(0x1b2129),rk,(f,d)=>{d.position.set(f.x,1.1,f.z);d.rotation.y=f.r});
    I(Bx(1.1,.08,.02),new THREE.MeshBasicMaterial({color:0x37e8ff}),rk,(f,d)=>{d.position.set(f.x+f.a*.27,1.6,f.z+f.b*.27);d.rotation.y=f.r});
    I(Bx(1.1,.08,.02),new THREE.MeshBasicMaterial({color:0xffa13a}),rk,(f,d)=>{d.position.set(f.x+f.a*.27,1.2,f.z+f.b*.27);d.rotation.y=f.r});
    I(Cy(.12,.12,T,8),lmat(0x6a7686),pick(F,.4),([i,j],d)=>{d.position.set(cxp(i),H-.3,cxp(j));if((i+j)%2)d.rotation.x=Math.PI/2;else d.rotation.z=Math.PI/2});
    I(Bx(1.6,.06,.5),new THREE.MeshBasicMaterial({color:0x2e6f86}),pick(F,.25),([i,j],d)=>{d.position.set(cxp(i),H-.04,cxp(j))});
  }
  extraP(l,pc.th,I,F,faces,pick,Bx,Cy,Co);
}
function setupPuzzle(){
  const pc=PC[pdiff],th=PTH[pc.th],kc=['r','b','y'],names=['红','蓝','黄'];
  pu={items:[],inter:[],spikes:[],bars:[],stairs:[],ride:null,bg:new THREE.Color(),fg:new THREE.Color(),nc:new THREE.Color('#05060e')};
  hearts=3;hasFl=false;bat=0;flOn=false;keysHeld={};notes=[];codeOpen=null;lant=[];stairArm=true;P.y=0;layer=0;topL=pc.stages.length-1;exploredL=[];updNotes();
  const ups=[];
  for(let l=0;l<=topL;l++){
    maze=mazes[l];exploredL.push(new Uint8Array(S*S));pLayer(l);
    const Y=l*LH,start=[1,1],pv0=bfs(start,new Set()),ks=[...pv0.keys()],up=ks[ks.length-1].split(',').map(Number),ek=up.join(','),path=[];
    for(let c=up;c;c=pv0.get(c[0]+','+c[1]))path.unshift(c);
    ups.push(up);
    const used=new Set(['1,1',ek]),bars=[],isCut=t=>!bfs(start,new Set([t.join(',')])).has(ek),seq=pc.stages[l];
    seq.forEach((k,n)=>{const idx=Math.floor(path.length*(n+1)/(seq.length+1));let t=null;
      for(let d=0;d<path.length&&!t;d++)for(const q of[idx+d,idx-d]){const c=path[q];if(!t&&c&&q>2&&q<path.length-1&&!used.has(c.join(','))&&isCut(c))t=c}
      t=t||path[idx];used.add(t.join(','));bars.push({k,t,l,open:false,pulls:[],order:[]})});
    const regionKeys=n=>[...bfs(start,new Set(bars.slice(n).map(b=>b.t.join(',')))).keys()];
    const pickT=n=>{const R=regionKeys(n).filter(k=>!used.has(k)).map(k=>k.split(',').map(Number)),
      de=R.filter(([x,y])=>Math.abs(x-1)+Math.abs(y-1)>4&&N4.filter(([a,b])=>maze[y+b]&&maze[y+b][x+a]===0).length===1),L=de.length?de:R,t=L[Math.random()*L.length|0]||[3,1];used.add(t.join(','));return t};
    const put=(type,arg,t,extra)=>{const m=mkItem(type,arg);m.position.set(cxp(t[0]),Y+.9,cxp(t[1]));group.add(m);pu.items.push(Object.assign({type,arg,m,l,x:m.position.x,z:m.position.z},extra||{}))};
    bars.forEach((b,n)=>{
      mkBar(b,Y);
      if(b.k.startsWith('door'))put('key',b.k[5],pickT(n));
      else if(b.k==='gate'){
        const L=pc.lev;b.order=[...Array(L).keys()].sort(()=>Math.random()-.5);
        for(let i=0;i<L;i++){const t=pickT(n),m=mkLever(KC[kc[i]].c);m.position.set(cxp(t[0]),Y,cxp(t[1]));group.add(m);pu.inter.push({kind:'lever',idx:i,l,x:m.position.x,z:m.position.z,m,pulled:0,bar:b})}
        if(L>1)put('note',0,pickT(n),{text:'第 '+(l+1)+' 层拉杆顺序：'+b.order.map(i=>names[i]).join(' → ')});
      }else{
        b.code='';for(let i=0;i<3;i++){const d=2+(Math.random()*8|0),a=1+(Math.random()*(d-1)|0);b.code+=d;put('note',0,pickT(n),{text:'第 '+(l+1)+' 层密码第 '+(i+1)+' 位 = '+a+' + '+(d-a)})}
        pu.inter.push({kind:'code',l,x:cxp(b.t[0]),z:cxp(b.t[1]),bar:b});
      }
    });
    if(l===0&&pc.night)put('fl',0,pickT(0));
    if(pc.night)for(let i=0;i<(pc.night===2?2:1);i++)put('bat',0,pickT(Math.min(i,bars.length-1)));
    if(l>0)put('heart',0,pickT(0));
    const op=[];for(let j=0;j<S;j++)for(let i=0;i<S;i++)if(maze[j][i]===0&&!used.has(i+','+j)&&Math.abs(i-1)+Math.abs(j-1)>3)op.push([i,j]);
    for(let n=0;n<pc.traps&&op.length;n++){const [i,j]=op.splice(Math.random()*op.length|0,1)[0],sg=mkSpike();sg.position.set(cxp(i),Y,cxp(j));group.add(sg);pu.spikes.push({l,i,j,sp:sg.userData.sp,ph:Math.random()*pc.per,per:pc.per*(.85+Math.random()*.3)})}
    bars.forEach(b=>{maze[b.t[1]][b.t[0]]=2;pu.bars.push(b)});
    if(l<topL){const sg=mkStair(th.sc);sg.position.set(cxp(up[0]),Y,cxp(up[1]));group.add(sg);pu.stairs.push({l,x:cxp(up[0]),z:cxp(up[1]),tl:l+1,tx:cxp(1),tz:cxp(1)})}
    if(l>0){const hg=mkHatch(0xffb347);hg.position.set(cxp(1),Y,cxp(1));group.add(hg);const q=ups[l-1];pu.stairs.push({l,x:cxp(1),z:cxp(1),tl:l-1,tx:cxp(q[0]),tz:cxp(q[1])})}
  }
  exitTile=ups[topL];exit.position.set(cxp(exitTile[0]),topL*LH,cxp(exitTile[1]));maze=mazes[0];explored=exploredL[0];
  toast(topL>0?'目标：逐层收集线索、解开机关，找到楼梯上楼，最终抵达出口。E / 🖐 互动，F / 🔦 手电筒':'目标：收集线索、解开机关，找到出口。E / 🖐 互动，F / 🔦 手电筒');
}
function updNotes(){$('pn').innerHTML=notes.map(t=>'📝 '+t).join('<br>');$('pn').style.display=notes.length?'':'none'}
function hurt(){
  if(hurtT>0)return;hurtT=1.2;hearts--;shake=.7;beep(110,.35);$('vig').style.opacity=.9;setTimeout(()=>{if(running)$('vig').style.opacity=0},350);
  P.x=lastSafe.x;P.z=lastSafe.z;vel.x=vel.z=0;
  if(hearts<=0){running=false;joyEnd();document.exitPointerLock&&document.exitPointerLock();setTimeout(()=>{$('vig').style.opacity=0;show('dead')},500)}
  else toast('被尖刺扎到了！剩余体力 '+hearts);
}
function openBar(b,msg){b.open=true;maze[b.t[1]][b.t[0]]=0;group.remove(b.m);beep(880,.3);toast(msg||'机关开启了！')}
function pullLever(o){
  const b=o.bar;if(o.pulled)return;o.pulled=1;o.m.userData.pv.rotation.z=.7;beep(520,.1);b.pulls.push(o.idx);
  const k=b.pulls.length-1;
  if(b.pulls[k]!==b.order[k]){b.pulls=[];pu.inter.forEach(q=>{if(q.bar===b&&q.kind==='lever'){q.pulled=0;q.m.userData.pv.rotation.z=-.7}});toast('拉杆弹了回来……顺序不对');beep(150,.3)}
  else if(b.pulls.length===b.order.length){pu.inter.forEach(q=>{if(q.bar===b&&q.kind==='lever')q.pulled=1});openBar(b,'远处传来铁闸升起的声音！')}
}
function renderCode(){const c=$('cd');c.innerHTML='';cdig.forEach((d,i)=>{const b=document.createElement('button');b.textContent=d;b.onclick=()=>{cdig[i]=(cdig[i]+1)%10;renderCode()};c.appendChild(b)})}
function openCode(b){if(b.open)return;codeOpen=b;running=false;fireHeld=false;keys.clear();joyEnd();document.exitPointerLock&&document.exitPointerLock();cdig=[0,0,0];renderCode();$('code').classList.remove('hide')}
function closeCode(ok){
  const b=codeOpen;if(!b)return;
  if(ok&&cdig.join('')!==b.code){toast('密码错误');beep(150,.2);return}
  $('code').classList.add('hide');codeOpen=null;if(ok)openBar(b,'密码正确，门开了！');running=true;lock();
}
$('cok').onclick=()=>closeCode(true);$('cx').onclick=()=>closeCode(false);
function interact(){
  if(!running)return;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bd=3.2;
  for(const o of pu.inter){if(o.l!==layer)continue;const dx=o.x-P.x,dz=o.z-P.z,d=Math.hypot(dx,dz);if(d<bd&&(dx*fx+dz*fz)/(d||1)>.1&&!(o.kind==='code'&&o.bar.open)){bd=d;best=o}}
  if(best){if(best.kind==='lever')pullLever(best);else openCode(best.bar)}
}
function toggleFl(){if(mode!=='puzzle')return;if(!hasFl)return toast('你还没有手电筒');gun.userData.dip=1;if(bat<=0)return toast('没电了，找找电池');flOn=!flOn;beep(flOn?700:400,.05)}
$('act').addEventListener('pointerdown',e=>{e.preventDefault();interact()});
$('flb').addEventListener('pointerdown',e=>{e.preventDefault();toggleFl()});
function collect(it){
  if(it.type==='key'){keysHeld[it.arg]=(keysHeld[it.arg]||0)+1;toast('获得'+KC[it.arg].n+'色钥匙');beep(900,.12)}
  else if(it.type==='note'){notes.push(it.text);updNotes();toast('📝 '+it.text);beep(660,.1)}
  else if(it.type==='fl'){hasFl=true;bat=100;flOn=true;gun.visible=true;toast('获得手电筒！F / 🔦 开关');beep(1000,.15)}
  else if(it.type==='bat'){bat=Math.min(100,bat+50);toast('电池 +50%');beep(800,.1)}
  else{hearts=Math.min(3,hearts+1);toast('体力 +1');beep(700,.1)}
}
function ptick(dt){
  const pc=PC[pdiff],th=PTH[pc.th],t=elapsed;hurtT-=dt;hintT-=dt;
  const tod=pc.night===1?pc.t0+elapsed/pc.cycle:pc.t0,dl=pc.night===2?0:clamp((.5+.5*Math.cos(tod*6.2832))*1.3-.15,0,1);
  if(pc.closed){scene.background.copy(pu.bg.set(th.sky).lerp(pu.nc,1-dl));scene.fog.color.copy(pu.fg.set(th.fog).lerp(pu.nc,1-dl));
    scene.fog.near=8-6.5*(1-dl);scene.fog.far=46-28*(1-dl);
    hemi.intensity=.12+.78*dl;sun.intensity=.03+.5*dl;lamp.intensity=.5*dl*dl;gHemi.intensity=.25+.65*dl;gDir.intensity=.3+.6*dl}
  else skyApply(dl,10-8*(1-dl),70-40*(1-dl));
  if(flOn){bat=Math.max(0,bat-dt*100/pc.batt);if(bat<=0){flOn=false;toast('手电筒没电了！')}}
  spot.intensity=flOn?(bat<20?1.9*(.35+.65*(Math.sin(t*37)*Math.sin(t*23)>-.2?1:0)):1.9):0;if(gun.userData.beam)gun.userData.beam.visible=flOn&&spot.intensity>.8;
  const r=pu.ride;
  if(r){
    r.t+=dt;vel.x=vel.z=0;P.x=r.px;P.z=r.pz;$('fade').style.opacity=Math.sin(Math.min(1,r.t)*Math.PI);
    if(!r.sw&&r.t>=.5){r.sw=true;const s=r.s;layer=s.tl;maze=mazes[layer];explored=exploredL[layer];P.x=s.tx;P.z=s.tz;P.y=layer*LH;r.px=P.x;r.pz=P.z;lastSafe={x:P.x,z:P.z};
      const ti=Math.floor(P.x/T),tj=Math.floor(P.z/T);yaw=maze[tj][ti+1]===0?-Math.PI/2:maze[tj][ti-1]===0?Math.PI/2:maze[tj+1]&&maze[tj+1][ti]===0?Math.PI:0;pitch=0;toast('第 '+(layer+1)+' 层')}
    if(r.t>=1){pu.ride=null;$('fade').style.opacity=0}
    return;
  }
  for(let n=pu.items.length-1;n>=0;n--){const it=pu.items[n];if(it.l!==layer)continue;it.m.rotation.y+=dt*2;it.m.position.y=layer*LH+.9+Math.sin(t*2+n)*.1;
    if(Math.hypot(it.x-P.x,it.z-P.z)<1.15){collect(it);group.remove(it.m);pu.items.splice(n,1)}}
  for(const b of pu.bars){if(b.open||b.l!==layer)continue;const d=Math.hypot(cxp(b.t[0])-P.x,cxp(b.t[1])-P.z);if(d>2.9)continue;
    if(b.k.startsWith('door')){const c=b.k[5];if(keysHeld[c]>0){keysHeld[c]--;openBar(b,'用'+KC[c].n+'色钥匙打开了门')}else if(hintT<=0){hintT=2.5;toast('门锁着，需要'+KC[c].n+'色钥匙')}}
    else if(hintT<=0){hintT=3;toast(b.k==='gate'?'铁闸被锁住了，附近应该有机关':'这是密码门，靠近面板按 E / 🖐 输入密码')}}
  if(hintT<=0)for(const o of pu.inter)if(o.l===layer&&o.kind==='lever'&&!o.pulled&&Math.hypot(o.x-P.x,o.z-P.z)<2.8){hintT=3;toast('按 E / 🖐 拉动拉杆');break}
  let near=false;
  for(const s of pu.stairs){if(s.l!==layer)continue;const d=Math.hypot(s.x-P.x,s.z-P.z);if(d<2.6)near=true;if(d<1.3&&stairArm){stairArm=false;pu.ride={t:0,s,sw:false,px:P.x,pz:P.z};beep(500,.2);return}}
  if(!near)stairArm=true;
  let onS=false;
  for(const s of pu.spikes){if(s.l!==layer)continue;const p=(t+s.ph)%s.per,up=p<s.per*.4,tele=p>s.per-.35;s.sp.position.y=up?0:tele?-.55:-.95;
    if(Math.floor(P.x/T)===s.i&&Math.floor(P.z/T)===s.j){onS=true;if(up)hurt()}}
  safeT-=dt;if(!onS&&safeT<=0){safeT=.4;lastSafe.x=P.x;lastSafe.z=P.z}
  const kh=Object.keys(KC).filter(c=>keysHeld[c]>0).map(c=>KC[c].n+'×'+keysHeld[c]).join(' ')||'无';
  $('pinfo').innerHTML='⏱ '+fmt(elapsed)+'　'+(dl>.5?'☀️':'🌙')+'　🏢 '+(layer+1)+'/'+(topL+1)+'层<br>'+'❤️'.repeat(hearts)+'🖤'.repeat(3-hearts)+'<br>🔑 '+kh+(hasFl?'<br>🔦 '+Math.round(bat)+'%'+(flOn?' 开':' 关'):'');
}
const lerpStops=(S_,d)=>{let i=0;while(i<S_.length-2&&d>S_[i+1][0])i++;const a=S_[i],b=S_[i+1];return new THREE.Color(a[1]).lerp(new THREE.Color(b[1]),clamp((d-a[0])/(b[0]-a[0]),0,1))};
const SKT=[[0,'#010208'],[.12,'#0a0a28'],[.3,'#2a2a5a'],[.5,'#4a5a9a'],[.75,'#4a8ad8'],[1,'#2f7fe0']];
const skyU={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunCol:{value:new THREE.Color(0xff9a4a)},sunDir:{value:new THREE.Vector3(0,.3,-1)},sunK:{value:0}};
skyG.children[0].material=new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
 vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform vec3 top;uniform vec3 hor;uniform vec3 sunCol;uniform vec3 sunDir;uniform float sunK;varying vec3 vD;void main(){float h=clamp(vD.y,0.0,1.0);vec3 c=mix(hor,top,pow(h,0.55));float g=pow(max(dot(normalize(vD),sunDir),0.0),6.0);c+=sunCol*g*sunK;gl_FragColor=vec4(c,1.0);}'});
skyG.children.forEach((o,i)=>{o.renderOrder=-12+i;if(o.material){o.material.depthTest=false;o.material.depthWrite=false}});
const starsM=skyG.children[1],moonM=skyG.children[2];starsM.material.transparent=true;starsM.material.depthTest=true;starsM.material.depthWrite=false;
// 云朵：程序化软云贴图 + 面向相机的半透明 Sprite（保留深度测试，避免穿墙）
const cloudTex=(()=>{
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  for(let i=0;i<30;i++){const px=26+Math.random()*204,py=38+Math.random()*50,r=14+Math.random()*30;
    const g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,'rgba(255,255,255,'+(.10+Math.random()*.16).toFixed(3)+')');g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,6.283);x.fill()}
  return new THREE.CanvasTexture(c)})();
const clouds=[],cloudWhite=new THREE.Color(0xffffff);
for(let i=0;i<10;i++){const a=i/10*6.283+Math.random()*.5,r=66+Math.random()*16,
  s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.3,depthWrite:false,depthTest:true,fog:false,color:0xffffff}));
  s.position.set(Math.cos(a)*r,22+Math.random()*26,Math.sin(a)*r);
  s.scale.set(26+Math.random()*26,11+Math.random()*9,1);s.renderOrder=-3;skyG.add(s);clouds.push(s)}
let fRocks=[],fHang=[];
function skyApply(dl,fn,ff){
  const hor=skyCol(dl),top=lerpStops(SKT,dl),se=clamp((dl-.4)*1.6,-.2,1),me=clamp((.55-dl)*1.8,-.2,1);
  skyU.hor.value.copy(hor);skyU.top.value.copy(top);
  const sp=(el,az)=>new THREE.Vector3(Math.cos(el)*Math.sin(az)*85,Math.sin(el)*85,-Math.cos(el)*Math.cos(az)*85);
  sunM.position.copy(sp(se,.7));moonM.position.copy(sp(me,-.9));sunM.visible=se>-.05;moonM.visible=me>-.05;
  skyU.sunDir.value.copy(sunM.position).normalize();skyU.sunK.value=clamp(1-Math.abs(dl-.55)/.45,0,1)*.7+.1*dl;
  moonM.material.color.set(dl<.15?0xff5a4a:0xfff1c7).multiplyScalar(.5+.5*(1-dl));
  clouds.forEach(cv=>{cv.material.color.copy(hor).lerp(cloudWhite,.6);cv.material.opacity=.05+.42*Math.max(dl,.08)});
  starsM.material.opacity=clamp((.5-dl)*3,0,1);starsM.geometry.setDrawRange(0,Math.floor(220*clamp((.6-dl)*2.5,0,1)));
  scene.background.copy(hor);scene.fog.color.copy(hor);scene.fog.near=fn;scene.fog.far=ff;
  hemi.intensity=.1+.76*dl;lamp.intensity=.16+.82*dl;gHemi.intensity=.3+.65*dl;gDir.intensity=.3+.6*dl;
  const L=dl>.4?sunM.position:moonM.position;sun.position.copy(L).normalize().multiplyScalar(10);sun.color.set(dl>.4?0xfff0dd:0x8fa6ff);sun.intensity=dl>.4?.1+.6*dl:.12+.1*(1-dl);
}
// 肉鸽露天房间的白天天空：浅蓝渐变 + 太阳 + 白云（此前 rlEnv 从不更新天空着色器，默认色是白色，所以看到一片全白）
function rlSkyDay(){
  skyU.hor.value.setHex(0xd6ecf8);skyU.top.value.setHex(0x4a9ee8);
  const el=.62,az=1.15,R=85;
  sunM.position.set(Math.cos(el)*Math.sin(az)*R,Math.sin(el)*R,-Math.cos(el)*Math.cos(az)*R);
  sunM.visible=true;
  skyU.sunDir.value.copy(sunM.position).normalize();
  skyU.sunK.value=.95;
  moonM.visible=false;
  starsM.visible=false;
  clouds.forEach(cv=>{cv.visible=true;cv.material.color.copy(cloudWhite);cv.material.opacity=.55});
  if(sun){sun.position.copy(sunM.position).normalize().multiplyScalar(10);sun.color.setHex(0xfff0dd)}
}
function escapeEnv(dt){
  const dl=clamp(EDL[diff]-elapsed*.0008,0,1);
  skyApply(dl,(CFG[diff].fn||6)+dl*4,(CFG[diff].ff||32)+dl*45);
  spot.intensity=0;$('flb').classList.add('hide');
  if(CFG[diff].abyss){
    scene.background.setHex(0x030205);scene.fog.color.setHex(0x0b0709);
    scene.fog.near=2.6;scene.fog.far=17;
    hemi.intensity=.09;sun.intensity=.06;lamp.intensity=.11;gHemi.intensity=.28;gDir.intensity=.3;
    moonM.material.color.setHex(0xb01a08);moonM.material.opacity=1;
  }
}
function envTick(dt,t){
  if(gameMode==='roguelike'){rlEnv(t);return}
  if(mode!=='puzzle')escapeEnv(dt);
  for(const r of fRocks){r.m.position.y=r.y0+Math.sin(t*.6+r.ph)*.5;r.m.rotation.y+=dt*.1}
  for(const h of fHang){h.g.rotation.z=Math.sin(t*.7+h.ph)*.05;h.g.rotation.x=Math.sin(t*.5+h.ph*1.7)*.035}
}
addEventListener('keydown',e=>{if(e.code==='KeyL'&&!e.repeat&&mode==='puzzle')toggleFl()});
function gunAnim(dt,t){
  const u=gun.userData,b=u.base||[.3,-.27,-.5],run=Math.min(Math.hypot(vel.x,vel.z)/5.2,1),
    bx=Math.sin(bob*.5)*.012*run+Math.sin(t*1.3)*.003,by=Math.abs(Math.sin(bob))*.02*run+Math.sin(t*1.7)*.004,dp=u.dip||0;
  gun.position.set(b[0]+bx,b[1]-by-dp*.2,b[2]+gunKick*.1);
  gun.rotation.x=(u.rx||0)+gunKick*.08+dp*.5+Math.sin(t*1.7)*.003;gun.rotation.z=Math.sin(bob*.5)*.02*run;
  if(u.slide)u.slide.position.z=gunKick*.07;
  u.dip=Math.max(0,dp-dt*3);gunKick=Math.max(0,gunKick-dt*6);
  fxTick(dt);
}
const fxs=[],fxSm=new THREE.IcosahedronGeometry(.035,0),fxSh=new THREE.BoxGeometry(.015,.015,.04),fxFl=new THREE.ConeGeometry(.08,.28,6),fxShM=new THREE.MeshStandardMaterial({color:0xd9b44a,metalness:.3,roughness:.4});
function muzzleFx(){
  const u=gun.userData;if(!u.muz)return;gun.updateMatrixWorld(true);
  const mp=new THREE.Vector3(...u.muz).applyMatrix4(gun.matrixWorld),ep=new THREE.Vector3(...u.ej).applyMatrix4(gun.matrixWorld);
  const fl=new THREE.Mesh(fxFl,new THREE.MeshBasicMaterial({color:0xffc060,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));fl.position.copy(mp);fl.position.z-=.14;fl.rotation.x=-Math.PI/2;fl.scale.setScalar(.8+Math.random()*.6);gunScene.add(fl);fxs.push({m:fl,life:.05,t:0,type:0});
  if(Math.random()<.6){const sm=new THREE.Mesh(fxSm,new THREE.MeshBasicMaterial({color:0xb0b0b0,transparent:true,opacity:.45,depthWrite:false}));sm.position.copy(mp);gunScene.add(sm);fxs.push({m:sm,life:.7,t:0,type:1,v:new THREE.Vector3((Math.random()-.5)*.1,.15+Math.random()*.1,-.2-Math.random()*.2)})}
  const sh=new THREE.Mesh(fxSh,fxShM);sh.position.copy(ep);gunScene.add(sh);fxs.push({m:sh,life:.8,t:0,type:2,v:new THREE.Vector3(.7+Math.random()*.4,.6+Math.random()*.4,.2+Math.random()*.3)});
}
function fxTick(dt){
  for(let i=fxs.length-1;i>=0;i--){const f=fxs[i],k=(f.t+=dt)/f.life;
    if(f.type===0){f.m.material.opacity=1-k}
    else if(f.type===1){f.m.position.addScaledVector(f.v,dt);f.m.scale.setScalar(1+k*3);f.m.material.opacity=.45*(1-k)}
    else{f.v.y-=5*dt;f.m.position.addScaledVector(f.v,dt);f.m.rotation.x+=dt*14;f.m.rotation.z+=dt*9}
    if(k>=1){gunScene.remove(f.m);if(f.type<2)f.m.material.dispose();fxs.splice(i,1)}}
}
function iG(geo,mt,list,fn){const m=new THREE.InstancedMesh(geo,mt,Math.max(list.length,1)),d=new THREE.Object3D(),c=new THREE.Color();list.forEach((it,n)=>{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.set(1,1,1);c.set(0xffffff);fn(it,d,c);d.updateMatrix();m.setMatrixAt(n,d.matrix);m.setColorAt(n,c)});m.count=list.length;group.add(m);return m}
function escDecor(walls,floors){
  const rg=Math.random,pick=(a,p)=>a.filter(()=>rg()<p),ab=diff==='abyss';fRocks=[];fHang=[];
  const cr=pick(floors,.1).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1:1)*1.3,z:cxp(j)+(rg()<.5?-1:1)*1.3,r:rg()*3,s:.5+rg()*.5}));
  iG(new THREE.BoxGeometry(.8,.8,.8),lmat(ab?0x2e2822:0x9a7a52),cr,(f,d)=>{d.position.set(f.x,.4*f.s,f.z);d.scale.setScalar(f.s);d.rotation.y=f.r});
  iG(new THREE.BoxGeometry(.84,.1,.84),lmat(ab?0x171310:0x3a3f48),cr,(f,d)=>{d.position.set(f.x,.8*f.s,f.z);d.scale.setScalar(f.s);d.rotation.y=f.r});
  iG(new THREE.DodecahedronGeometry(1,0),lmat(ab?0x3f3a32:0x8a857a),pick(floors,.3).map(([i,j])=>({x:cxp(i)+(rg()-.5)*2.6,z:cxp(j)+(rg()-.5)*2.6,s:.12+rg()*.2})),(f,d)=>{d.position.set(f.x,f.s*.6,f.z);d.scale.set(f.s,f.s*.7,f.s);d.rotation.set(rg()*3,rg()*3,0)});
  if(!ab)return;
  // 深渊：焦黑骨窟 —— 头骨嵌墙+血泪、肋骨拱廊、脊椎立柱、股骨堆、骨刺、巨型骸骨、悬尸、血池、铁链、骨烛、黑暗中成对的红眼
  const bone=lmat(0x8a7f66),dark=lmat(0x14100c),flesh=lmat(0x3a1418);
  const faces=[];walls.forEach(([i,j])=>{if(i%2===0&&j%2===0)return;N4.forEach(([a,b])=>{if(maze[j+b]&&maze[j+b][i+a]===0)faces.push({x:cxp(i)+a*(T/2+.1),z:cxp(j)+b*(T/2+.1),a,b})})});
  iG(new THREE.BoxGeometry(T+.34,.32,T+.34),lmat(0x1e1814),walls,([i,j],d)=>{d.position.set(cxp(i),H+.14,cxp(j))});
  const sk=pick(faces,.18);
  iG(new THREE.SphereGeometry(.32,12,10),bone,sk,(f,d)=>{d.position.set(f.x+f.a*.15,1.4,f.z+f.b*.15);d.scale.set(1,1.1,1)});
  iG(new THREE.BoxGeometry(.3,.16,.3),bone,sk,(f,d)=>{d.position.set(f.x+f.a*.2,1.08,f.z+f.b*.2);d.rotation.y=f.a?Math.PI/2:0});
  for(const sg of[-1,1])iG(new THREE.SphereGeometry(.085,8,6),dark,sk,(f,d)=>{d.position.set(f.x+f.a*.4+f.b*sg*.12,1.45,f.z+f.b*.4+f.a*sg*.12)});
  iG(new THREE.ConeGeometry(.05,.12,5),dark,sk,(f,d)=>{d.position.set(f.x+f.a*.43,1.3,f.z+f.b*.43)});
  iG(new THREE.BoxGeometry(.045,.62,.02),flesh,sk,(f,d)=>{d.position.set(f.x+f.a*.46,1.06,f.z+f.b*.46);d.rotation.y=f.a?Math.PI/2:0});
  const rb=[];floors.forEach(([i,j])=>{if(rg()>.13)return;const wx=maze[j][i-1]&&maze[j][i+1],wz=maze[j-1][i]&&maze[j+1][i];if(wx&&!wz)for(let k=-1;k<=1;k++)rb.push({x:cxp(i),z:cxp(j)+k*.8,r:0});else if(wz&&!wx)for(let k=-1;k<=1;k++)rb.push({x:cxp(i)+k*.8,z:cxp(j),r:Math.PI/2})});
  iG(new THREE.TorusGeometry(1.7,.09,6,18,Math.PI),bone,rb,(f,d)=>{d.position.set(f.x,.02,f.z);d.rotation.y=f.r});
  const vp=[];walls.forEach(([i,j])=>{if(i%2===0&&j%2===0)for(let k=0;k<6;k++)vp.push({x:cxp(i),z:cxp(j),y:.3+k*.5,r:k%2?2.05:1.9})});
  iG(new THREE.CylinderGeometry(1,1,.42,12),lmat(0x9c9078),vp,(f,d)=>{d.position.set(f.x,f.y,f.z);d.scale.set(f.r,1,f.r)});
  const fm=pick(floors,.14).map(([i,j])=>({x:cxp(i)+(rg()-.5)*2.4,z:cxp(j)+(rg()-.5)*2.4,r:rg()*3.14}));
  iG(new THREE.CylinderGeometry(.06,.06,1.1,10),bone,fm,(f,d)=>{d.position.set(f.x,.08,f.z);d.rotation.set(0,f.r,Math.PI/2)});
  for(const sg of[-1,1])iG(new THREE.SphereGeometry(.1,8,6),bone,fm,(f,d)=>{d.position.set(f.x+Math.cos(f.r)*.55*sg,.08,f.z-Math.sin(f.r)*.55*sg)});
  const bs=pick(floors,.16).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1:1)*1.3,z:cxp(j)+(rg()<.5?-1:1)*1.3}));
  for(let k=0;k<3;k++)iG(new THREE.ConeGeometry(.16+k*.03,.9+k*.45,8),bone,bs,(f,d)=>{d.position.set(f.x+(k-1)*.25,.45+k*.22,f.z+(k-1)*.15);d.rotation.set((k-1)*.2,0,(1-k)*.25)});
  floors.filter(()=>rg()<.03).slice(0,3).forEach(([i,j])=>{
    const g=new THREE.Group(),sp=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,3.2,10),bone);sp.rotation.x=Math.PI/2;sp.position.y=.45;g.add(sp);
    for(let k=0;k<6;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(1-Math.abs(k-2.5)*.08,.07,6,16,Math.PI),bone);r.position.set(0,.2,-1.4+k*.56);g.add(r)}
    const cr2=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),bone);cr2.position.set(0,.55,1.95);g.add(cr2);
    const jw=new THREE.Mesh(new THREE.BoxGeometry(.5,.15,.5),bone);jw.position.set(0,.2,2.1);g.add(jw);
    for(const sx of[-.18,.18]){const e=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({color:0xff2a08}));e.position.set(sx,.6,2.38);g.add(e)}
    g.position.set(cxp(i),0,cxp(j));g.rotation.y=rg()*6;group.add(g)});
  // 血池
  const bp=pick(floors,.2).map(([i,j])=>({x:cxp(i)+(rg()-.5)*2.2,z:cxp(j)+(rg()-.5)*2.2,s:.7+rg()*1.1,r:rg()*3}));
  iG(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x2a0407,transparent:true,opacity:.92,depthWrite:false}),bp,(f,d)=>{d.position.set(f.x,.02,f.z);d.rotation.set(-Math.PI/2,0,f.r);d.scale.setScalar(f.s)});
  // 悬尸：从墙顶吊下的干尸，在走廊里缓缓摇晃
  pick(floors,.09).slice(0,9).forEach(([i,j])=>{
    const g=new THREE.Group();
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.9,6),dark);rope.position.y=2.75;g.add(rope);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.15,.22,.95,10),flesh);body.position.y=1.75;body.rotation.z=.08;g.add(body);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,1),bone);head.position.set(.06,2.32,0);g.add(head);
    for(const s2 of[-1,1]){
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.72,8),flesh);arm.position.set(s2*.2,1.95,.02);arm.rotation.z=s2*.14;g.add(arm);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.7,8),flesh);leg.position.set(s2*.1,.85,.02);leg.rotation.z=s2*.06;g.add(leg)}
    g.position.set(cxp(i),0,cxp(j));g.rotation.y=rg()*6;group.add(g);fHang.push({g,ph:rg()*6});
  });
  // 铁链
  const ch=pick(faces,.1);
  for(let k=0;k<4;k++)iG(new THREE.CylinderGeometry(.028,.028,.55,8),dark,ch,(f,d)=>{d.position.set(f.x+f.a*.18,2.5-k*.52,f.z+f.b*.18)});
  // 骨烛（深渊光源，暗红火光）
  const brz=pick(faces,.05).slice(0,14).map(f=>({x:f.x+f.a*.3,z:f.z+f.b*.3}));
  iG(new THREE.CylinderGeometry(.14,.18,.3,10),bone,brz,(f,d)=>{d.position.set(f.x,.15,f.z)});
  iG(new THREE.IcosahedronGeometry(.13,1),bone,brz,(f,d)=>{d.position.set(f.x,.36,f.z)});
  iG(new THREE.ConeGeometry(.08,.3,8),new THREE.MeshBasicMaterial({color:0xff3a10,fog:false}),brz,(f,d)=>{d.position.set(f.x,.55,f.z)});
  brz.forEach(b=>lant.push({x:b.x,z:b.z,y:-1.55}));
  // 黑暗中成对的红色眼睛
  const ey=pick(floors,.12).slice(0,22).map(([i,j])=>({x:cxp(i)+(rg()-.5)*2,z:cxp(j)+(rg()-.5)*2,y:1.25+rg()*.55,s:.055+rg()*.035}));
  iG(new THREE.SphereGeometry(1,10,7),new THREE.MeshBasicMaterial({color:0xff1808,fog:false}),ey,(f,d)=>{d.position.set(f.x,f.y,f.z);d.scale.setScalar(f.s)});
  for(let n=0;n<24;n++){const m=new THREE.Mesh(new THREE.ConeGeometry(.1+rg()*.15,.8+rg()*1.2,6),lmat(0x7d735c,{emissive:0x120e08}));m.rotation.set(rg()*3,rg()*3,rg()*3);m.position.set(rg()*S*T,4+rg()*6,rg()*S*T);group.add(m);fRocks.push({m,y0:m.position.y,ph:rg()*6})}
}
/* ===== GLB 道具摆放（异步加载队列）：模型未就位时排队，加载完成后自动补上 ===== */
const rlModelLoading={};
let glbPropQueue=[],glbPropGen=0,glbPropPoll=0;
function escGlbPlace(key,x,z,ry,h,y){
  const src=rlModelCache[key];if(!src)return false;
  const c=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(src):src.clone(true);
  const b=new THREE.Box3().setFromObject(c);const sz=b.getSize(new THREE.Vector3());
  if(!isFinite(sz.y)||sz.y<.01)return true;
  const s=h/sz.y;c.scale.setScalar(s);
  c.position.set(x-b.getCenter(new THREE.Vector3()).x*s,(y||0)-b.min.y*s,z-b.getCenter(new THREE.Vector3()).z*s);
  c.rotation.y=ry||0;c.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
  group.add(c);return true;
}
function glbProp(key,x,z,ry,h,y){
  if(rlModelCache[key]){escGlbPlace(key,x,z,ry,h,y);return}
  glbPropQueue.push({key,x,z,ry,h,y,gen:glbPropGen});
  if(!rlModelCache[key]&&!rlModelFail[key]){rlLoadQueuePush(key)}
  if(!glbPropPoll){glbPropPoll=1;
  const poll=n=>{setTimeout(()=>{
    const left=[];
    for(const q of glbPropQueue){if(q.gen!==glbPropGen)continue;if(rlModelCache[q.key])escGlbPlace(q.key,q.x,q.z,q.ry,q.h,q.y);else if(!rlModelFail[q.key])left.push(q)}
    glbPropQueue=left;
    if(left.length&&n<5)poll(n+1);else glbPropPoll=0;
  },2200)};poll(0)}
}
/* ===== 逃脱模式难度主题：白给=茂密明亮的阳光森林，难度越高越阴暗恐怖 ===== */
function escThemeDecor(walls,floors){
  const rg=Math.random;
  const bright=diff==='free'?1:diff==='easy'?.82:diff==='normal'?.52:diff==='hard'?.18:0;
  const dead=diff==='hard'?.5:(diff==='hell'||diff==='inferno')?1:0;
  // ---- 走道森林：树贴开放格的墙角/墙根，不挡路；树冠高过 3.2m 墙顶 ----
  if(bright>0||dead>0){
    const trees=pickF(floors,bright>0?(diff==='free'?.95:diff==='easy'?.8:diff==='normal'?.6:0):.2*dead).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1:1)*(1.05+rg()*.45),z:cxp(j)+(rg()<.5?-1:1)*(1.05+rg()*.45),s:.85+rg()*.75,ph:rg()*6.28}));
    if(bright>0){
      iG(new THREE.CylinderGeometry(.22,.38,3.8,7),lmat(0x6a4a2e),trees,(f,d)=>{d.position.set(f.x,1.9*f.s,f.z);d.scale.set(f.s,f.s,f.s);d.rotation.y=f.ph});
      iG(new THREE.IcosahedronGeometry(2.0,1),lmat(0x3f9a3a,{emissive:0x0a2606}),trees,(f,d)=>{d.position.set(f.x,(3.8+rg()*1.1)*f.s,f.z);d.scale.set(f.s*(0.9+rg()*.4),f.s,f.s*(0.9+rg()*.4))});
      iG(new THREE.IcosahedronGeometry(1.4,1),lmat(0x62b844,{emissive:0x0e2c08}),trees,(f,d)=>{d.position.set(f.x+(rg()-.5),(4.7+rg()*1.1)*f.s,f.z+(rg()-.5));d.scale.setScalar(f.s)});
    }else{
      // 枯树：焦黑扭曲，无叶
      iG(new THREE.CylinderGeometry(.14,.3,4.2,6),lmat(0x241c14),trees,(f,d)=>{d.position.set(f.x,2.1*f.s,f.z);d.scale.set(f.s,f.s,f.s);d.rotation.set((rg()-.5)*.14,f.ph,(rg()-.5)*.14)});
      iG(new THREE.CylinderGeometry(.05,.12,2.2,5),lmat(0x1c1610),trees,(f,d)=>{d.position.set(f.x+.3*f.s,(3.4+rg())*f.s,f.z);d.rotation.set(0,f.ph,.5+rg()*.4);d.scale.setScalar(f.s)});
      iG(new THREE.CylinderGeometry(.04,.1,1.7,5),lmat(0x1c1610),trees,(f,d)=>{d.position.set(f.x-.28*f.s,(3+rg())*f.s,f.z+.2);d.rotation.set(.3,f.ph,-.6-rg()*.3);d.scale.setScalar(f.s)});
    }
    // ---- 走廊内植被：草丛 / 灌木 / 野花 / 蘑菇 ----
    if(bright>0){
      const grass=[];pickF(floors,.6).forEach(([i,j])=>{for(let k=0;k<4;k++)grass.push({x:cxp(i)+(rg()-.5)*3.4,z:cxp(j)+(rg()-.5)*3.4,s:.5+rg()*.9,c:['#4fa83e','#62b844','#7cc94f','#3d8a32'][k%4]})});
      iG(new THREE.ConeGeometry(.07,.6,4),lmat(0xffffff),grass,(f,d,c)=>{d.position.set(f.x,.26*f.s,f.z);d.scale.set(1,f.s,1);d.rotation.y=rg()*3;c.set(f.c)});
      const bush=pickF(floors,.16).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1.45:1.45),z:cxp(j)+(rg()<.5?-1.45:1.45),s:.5+rg()*.6}));
      iG(new THREE.DodecahedronGeometry(.62,1),lmat(0x3a8a34,{emissive:0x082204}),bush,(f,d)=>{d.position.set(f.x,.34*f.s,f.z);d.scale.set(f.s,f.s*.7,f.s);d.rotation.y=rg()*3});
      // 蘑菇：伞盖 + 短柄，贴墙根
      const mush=pickF(floors,.25).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1.3:1.3)+(rg()-.5)*.6,z:cxp(j)+(rg()<.5?-1.3:1.3)+(rg()-.5)*.6,s:.4+rg()*.5,c:['#e85a4a','#e8d84a','#ffffff','#c85ae8'][rg()*4|0]}));
      iG(new THREE.CylinderGeometry(.04,.05,.12,5),lmat(0xe8e0d0),mush,(f,d)=>{d.position.set(f.x,.06*f.s,f.z);d.scale.setScalar(f.s)});
      iG(new THREE.SphereGeometry(.13,8,5),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:0}),mush,(f,d,c)=>{d.position.set(f.x,.14*f.s,f.z);d.scale.set(f.s,f.s*.5,f.s);c.set(f.c)});
      if(diff==='free'||diff==='easy'){
        const fl=[];pickF(floors,.3).forEach(([i,j])=>{for(let k=0;k<3;k++)fl.push({x:cxp(i)+(rg()-.5)*3,z:cxp(j)+(rg()-.5)*3,c:['#ff7ab8','#ffd84a','#ffffff','#ff9a5c','#b57aff'][k%5]})});
        iG(new THREE.SphereGeometry(.07,6,5),new THREE.MeshBasicMaterial({color:0xffffff}),fl,(f,d,c)=>{d.position.set(f.x,.3,f.z);c.set(f.c)});
      }
    }
  }
  // ---- 阴暗难度：地牢 GLB 遗物（骨堆/骸骨/铁笼/棺材/锁链/火盆）----
  const horror=(diff==='hell'||diff==='inferno')?1:diff==='abyss'?1.2:diff==='hard'?.25:0;
  if(horror>0){
    const spot=(p)=>pickF(floors,p).map(([i,j])=>{const a=rg()<.5?-1:1,b=rg()<.5?-1:1;return{x:cxp(i)+a*1.4,z:cxp(j)+b*1.4,r:rg()*6.28}});
    spot(.10*horror).slice(0,7).forEach(p=>glbProp('bonepile',p.x,p.z,p.r,.8));
    spot(.07*horror).slice(0,5).forEach(p=>glbProp('skeleton',p.x,p.z,p.r,.9));
    spot(.05*horror).slice(0,4).forEach(p=>glbProp('coffin',p.x,p.z,p.r,1.1));
    spot(.05*horror).slice(0,4).forEach(p=>glbProp('cage',p.x,p.z,p.r,1.9));
    spot(.06*horror).slice(0,6).forEach(p=>glbProp('rubble',p.x,p.z,p.r,.7));
    spot(.05*horror).slice(0,6).forEach(p=>glbProp('brazier',p.x,p.z,p.r,1.2));
    spot(.05*horror).slice(0,5).forEach(p=>glbProp('skull',p.x,p.z,p.r,.5));
  }
}
function pickF(f,p){return f.filter(()=>Math.random()<p)}
function extraP(l,thn,I,F,faces,pick,Bx,Cy,Co){
  const rg=Math.random,cr=pick(F,.12).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1:1)*1.3,z:cxp(j)+(rg()<.5?-1:1)*1.3,r:rg()*3,s:.5+rg()*.5}));
  I(Bx(.8,.8,.8),lmat({garden:0x9a7a52,temple:0xb89a62,lab:0x59616e}[thn]),cr,(f,d)=>{d.position.set(f.x,.4*f.s,f.z);d.scale.setScalar(f.s);d.rotation.y=f.r});
  I(Bx(.84,.1,.84),lmat(0x3a3f48),cr,(f,d)=>{d.position.set(f.x,.8*f.s,f.z);d.scale.setScalar(f.s);d.rotation.y=f.r});
  I(new THREE.DodecahedronGeometry(1,1),lmat(0x8a857a),pick(F,.3).map(([i,j])=>({x:cxp(i)+(rg()-.5)*2.6,z:cxp(j)+(rg()-.5)*2.6,s:.12+rg()*.2})),(f,d)=>{d.position.set(f.x,f.s*.6,f.z);d.scale.set(f.s,f.s*.7,f.s);d.rotation.set(rg()*3,rg()*3,0)});
  const wk=(f,d,k)=>{d.position.set(f.x+f.a*.1+f.b*k,0,f.z+f.b*.1+f.a*k)};
  if(thn==='garden'){
    const fc=pick(faces,.18);
    I(Bx(.12,1,.12),lmat(0x8a6a44),fc,(f,d)=>{wk(f,d,1.3);d.position.y=.5});I(Bx(.12,1,.12),lmat(0x8a6a44),fc,(f,d)=>{wk(f,d,-1.3);d.position.y=.5});
    I(Bx(2.8,.1,.06),lmat(0x9a7a52),fc,(f,d)=>{d.position.set(f.x+f.a*.1,.75,f.z+f.b*.1);d.rotation.y=f.a?Math.PI/2:0});I(Bx(2.8,.1,.06),lmat(0x9a7a52),fc,(f,d)=>{d.position.set(f.x+f.a*.1,.4,f.z+f.b*.1);d.rotation.y=f.a?Math.PI/2:0});
    const bd=pick(F,.08).map(([i,j])=>({x:cxp(i),z:cxp(j)})),fb=[];bd.forEach(b=>{for(let k=0;k<5;k++)fb.push({x:b.x+(rg()-.5)*1.3,z:b.z+(rg()-.5)*1.3,c:['#ff7ab8','#ffd84a','#ffffff','#b57aff'][k%4]})});
    I(Bx(1.9,.35,1.9),lmat(0xb5a67e),bd,(f,d)=>{d.position.set(f.x,.17,f.z)});I(Bx(1.55,.4,1.55),lmat(0x5a3d2a),bd,(f,d)=>{d.position.set(f.x,.2,f.z)});I(Co(.15,.4,5),lmat(0xffffff),fb,(f,d,c)=>{d.position.set(f.x,.55,f.z);c.set(f.c)});
    const bl=[];pick(F,.6).forEach(([i,j])=>{for(let k=0;k<6;k++)bl.push({x:cxp(i)+(rg()-.5)*3.4,z:cxp(j)+(rg()-.5)*3.4,s:.6+rg()*.7})});
    I(Co(.06,.9,3),lmat(0x6fbf4a),bl,(f,d)=>{d.position.set(f.x,.45*f.s,f.z);d.scale.y=f.s;d.rotation.z=(rg()-.5)*.3});
  }else if(thn==='temple'){
    const br=pick(F,.07).map(([i,j])=>({x:cxp(i)+1.2,z:cxp(j)-1.2}));
    I(Cy(.08,.1,.7,6),lmat(0x3a3f48),br,(f,d)=>{d.position.set(f.x,.35,f.z)});I(Cy(.38,.2,.3,8),lmat(0x3a3f48),br,(f,d)=>{d.position.set(f.x,.78,f.z)});I(Co(.26,.6,6),new THREE.MeshBasicMaterial({color:0xff8a2a}),br,(f,d)=>{d.position.set(f.x,1.15,f.z)});
    br.forEach(b=>lant.push({x:b.x,z:b.z,y:l*LH-1.2}));
    const st=pick(F,.06).map(([i,j])=>({x:cxp(i),z:cxp(j)}));
    I(Bx(.9,.5,.9),lmat(0xa89a7a),st,(f,d)=>{d.position.set(f.x,.25,f.z)});I(Cy(.3,.4,1.3,8),lmat(0xc9bfa0),st,(f,d)=>{d.position.set(f.x,1.15,f.z)});
    I(new THREE.SphereGeometry(.22,7,6),lmat(0xc9bfa0),st,(f,d)=>{d.position.set(f.x,2,f.z)});I(Co(.2,.35,6),lmat(0xe0b84a),st,(f,d)=>{d.position.set(f.x,2.35,f.z)});
    I(Bx(.14,.9,.14),lmat(0xc9bfa0),st,(f,d)=>{d.position.set(f.x+.45,1.35,f.z);d.rotation.z=-.5});I(Bx(.14,.9,.14),lmat(0xc9bfa0),st,(f,d)=>{d.position.set(f.x-.45,1.35,f.z);d.rotation.z=.5});
    const bg=pick(F,.05).map(([i,j])=>({x:cxp(i),z:cxp(j)}));
    I(Bx(1.1,.2,.9),lmat(0xb5a07a),bg,(f,d)=>{d.position.set(f.x-.9,.7,f.z)});I(Bx(1.1,.2,.9),lmat(0xb5a07a),bg,(f,d)=>{d.position.set(f.x+.9,.55,f.z);d.rotation.z=.15});I(Cy(.2,.25,.7,6),lmat(0x9a8a6a),bg,(f,d)=>{d.position.set(f.x-.9,.3,f.z)});
  }else{
    const gn=pick(F,.06).map(([i,j])=>({x:cxp(i),z:cxp(j),r:Math.floor(rg()*4)*Math.PI/2}));
    I(Bx(1.4,1,.8),lmat(0x2f6a4a),gn,(f,d)=>{d.position.set(f.x,.5,f.z);d.rotation.y=f.r});I(Bx(1.2,.1,.6),lmat(0x1b2129),gn,(f,d)=>{d.position.set(f.x,1.05,f.z);d.rotation.y=f.r});I(Cy(.1,.1,.8,6),lmat(0x6a7686),gn,(f,d)=>{d.position.set(f.x+.55,1.3,f.z);d.rotation.y=f.r});
    I(Bx(1,.12,.02),new THREE.MeshBasicMaterial({color:0x58ff9a}),gn,(f,d)=>{d.position.set(f.x+Math.sin(f.r)*.41,.6,f.z+Math.cos(f.r)*.41);d.rotation.y=f.r});
    const cb=pick(F,.35);I(Cy(.04,.04,T*.9,5),lmat(0x15181d),cb,([i,j],d)=>{d.position.set(cxp(i)+(rg()-.5),.05,cxp(j)+(rg()-.5));if((i+j)%2)d.rotation.x=Math.PI/2;else d.rotation.z=Math.PI/2});
    const dr=pick(F,.06);I(Bx(.25,H,.25),lmat(0x4a525e),dr,([i,j],d)=>{d.position.set(cxp(i)+((i+j)%2?0:1.8),H/2,cxp(j)+((i+j)%2?1.8:0))});I(Bx(.25,H,.25),lmat(0x4a525e),dr,([i,j],d)=>{d.position.set(cxp(i)-((i+j)%2?0:1.8),H/2,cxp(j)-((i+j)%2?1.8:0))});
    I(Bx(T,.3,.25),lmat(0x4a525e),dr,([i,j],d)=>{d.position.set(cxp(i),H-.15,cxp(j));d.rotation.y=(i+j)%2?Math.PI/2:0});I(Bx(.27,.5,.27),lmat(0xe8a23a),dr,([i,j],d)=>{d.position.set(cxp(i)+((i+j)%2?0:1.8),.25,cxp(j)+((i+j)%2?1.8:0))});
  }
  // ---- 解谜模式 GLB 道具：按主题摆放地牢组件（异步加载，到位后自动补上）----
  const py=l*LH,ps=(p,mx)=>pick(F,p).slice(0,mx||4).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1.4:1.4),z:cxp(j)+(rg()<.5?-1.4:1.4),r:rg()*6.28}));
  if(thn==='garden'){
    ps(.06,4).forEach(p=>glbProp('crate',p.x,p.z,p.r,.9,py));ps(.05,4).forEach(p=>glbProp('barrel',p.x,p.z,p.r,1,py));
    ps(.04,3).forEach(p=>glbProp('bench',p.x,p.z,p.r,.9,py));ps(.04,3).forEach(p=>glbProp('sack',p.x,p.z,p.r,.8,py));
    if(l===0){const tr=pick(F,.45).map(([i,j])=>({x:cxp(i)+(rg()<.5?-1:1)*(1.05+rg()*.45),z:cxp(j)+(rg()<.5?-1:1)*(1.05+rg()*.45),s:.75+rg()*.55,ph:rg()*6.28}));
      I(new THREE.CylinderGeometry(.2,.36,3.6,7),lmat(0x6a4a2e),tr,(f,d)=>{d.position.set(f.x,1.8*f.s,f.z);d.scale.setScalar(f.s);d.rotation.y=f.ph});
      I(new THREE.IcosahedronGeometry(1.9,1),lmat(0x3f9a3a,{emissive:0x0a2606}),tr,(f,d)=>{d.position.set(f.x,(3.7+rg()*1.1)*f.s,f.z);d.scale.setScalar(f.s*(.9+rg()*.3))});}
  }else if(thn==='temple'){
    ps(.05,4).forEach(p=>glbProp('brazier',p.x,p.z,p.r,1.2,py));ps(.05,3).forEach(p=>glbProp('modpillar',p.x,p.z,p.r,Math.min(LH-.3,3.4),py));
    ps(.05,3).forEach(p=>glbProp('bonepile',p.x,p.z,p.r,.8,py));ps(.04,3).forEach(p=>glbProp('skull',p.x,p.z,p.r,.5,py));
    ps(.04,2).forEach(p=>glbProp('coffin',p.x,p.z,p.r,1.1,py));
  }else{
    ps(.06,4).forEach(p=>glbProp('dc1_crate',p.x,p.z,p.r,.9,py));ps(.05,3).forEach(p=>glbProp('pot',p.x,p.z,p.r,.7,py));
    ps(.04,3).forEach(p=>glbProp('weaponrack',p.x,p.z,p.r,1.6,py));ps(.04,3).forEach(p=>glbProp('cage',p.x,p.z,p.r,1.9,py));
  }
}
/* =====================================================================
   肉鸽轮回模式（roguelike）：独立子系统，仅在 gameMode==='roguelike' 时运行
   ===================================================================== */
const RW=[
 {w:'torch',n:'老旧警用手电冲击',k:'melee',d:9,c:.5,r:2.6,p:0,ul:0,col:0xffe6b5,ds:'初始武器：近距离强光冲击，稳定但伤害有限。'},
 {w:'k1',n:'锈铁短刀',k:'melee',d:15,c:.42,r:2.8,p:40,ul:0,col:0xb8c4cc,ds:'锈迹斑斑的短刀，出手极快。'},
 {w:'k2',n:'断魂长刀',k:'melee',d:26,c:.62,r:3.4,p:75,ul:35,col:0xd8e6f0,ds:'长刀横扫，攻击范围更远。'},
 {w:'k3',n:'血纹双刃',k:'melee',d:19,c:.55,r:3,hits:2,p:95,ul:45,col:0xff5a6a,ds:'双刃回旋，一次斩出两道血纹。'},
 {w:'k4',n:'绞魂链刃',k:'melee',d:33,c:.8,r:4,kb:1.4,p:130,ul:60,col:0x9b7bff,ds:'链刃抽击，范围极大并附带击退。'},
 {w:'k5',n:'弑神骨锯',k:'melee',d:48,c:1,r:3.5,kb:.8,p:180,ul:90,col:0xf0e2c0,ds:'沉重骨锯，劈砍造成致命伤害。'},
 {w:'g1',n:'老旧手枪',k:'gun',d:13,c:.3,r:40,spd:60,p:45,ul:0,col:0x9aa7ad,ds:'可靠的旧手枪，单发精准。'},
 {w:'g2',n:'霰弹短铳',k:'gun',d:10,c:.85,r:14,spd:44,hits:5,spread:.22,p:85,ul:40,col:0xffa04d,ds:'五颗弹丸呈扇形喷射，近身爆发。'},
 {w:'g3',n:'战术冲锋枪',k:'gun',d:8,c:.12,r:34,spd:72,spread:.045,p:115,ul:50,col:0x7dffea,ds:'高速连射，弹道轻微散布。'},
 {w:'g4',n:'猎魂步枪',k:'gun',d:40,c:.95,r:70,spd:120,pierce:2,spread:.01,p:155,ul:65,col:0xffd76a,ds:'穿透猎魂的重型步枪。'},
 {w:'g5',n:'湮灭重炮',k:'gun',d:95,c:1.7,r:60,spd:38,aoe:2.6,p:230,ul:95,col:0xff6a3a,ds:'发射爆裂炮弹，命中后范围爆炸。'},
 {w:'r1',n:'引魂铃',k:'relic',d:12,c:.7,r:3.6,aoe:3.6,p:65,ul:30,col:0xc7a6ff,ds:'铃音震荡，波及周身所有怨魂。'},
 {w:'r2',n:'噬血符',k:'relic',d:24,c:.6,r:3.2,aoe:2.8,ls:.04,p:95,ul:45,col:0xff3b5c,ds:'符火灼魂，额外吸血 4%。'},
 {w:'r3',n:'冰魄晶杖',k:'relic',d:28,c:.75,r:35,spd:52,slow:1.6,p:135,ul:60,col:0x8fd8ff,ds:'射出冰棱，命中后冻结减速。'},
 {w:'r4',n:'雷罚骨珠',k:'relic',d:34,c:.9,r:30,spd:80,chain:3,p:170,ul:75,col:0xfff27a,ds:'雷珠连锁，最多弹跳 3 名敌人。'},
 {w:'r5',n:'轮回血莲',k:'relic',d:60,c:1.4,r:4.8,aoe:4.8,p:250,ul:100,col:0xff2a55,ds:'绽开血莲，重创周围一切。'}
];
const RWBY={};RW.forEach(w=>RWBY[w.w]=w);
const RB=[
 {id:'ls',n:'血嗜',ds:'吸血 +3%（上限 12%，最多 4 层）'},
 {id:'hp',n:'铁骨',ds:'生命上限 +20（最多 6 层）'},
 {id:'atk',n:'锋锐',ds:'攻击力 +12%（层数越高收益递减，最多 12 层）'},
 {id:'spd',n:'疾风',ds:'移动速度 +8%（收益递减，最多 8 层）'},
 {id:'cd',n:'迅捷',ds:'攻击间隔 -8%（最多 8 层）'},
 {id:'coin',n:'贪婪',ds:'星币获取 +15%（最多 6 层）'},
 {id:'thorn',n:'荆棘',ds:'反伤 20% 近身伤害（最多 5 层）'},
 {id:'crit',n:'猎杀',ds:'暴击率 +8%（最多 6 层）'},
 {id:'heal',n:'回魂',ds:'进入新层回复 12 生命（最多 3 层）'},
 {id:'dodge',n:'护体',ds:'闪避冷却 -15%（最多 4 层）'},
 {id:'shield',n:'护盾充能',ds:'立即恢复 1 个护盾（即时生效，不叠加）'},
 {id:'shieldmax',n:'护盾扩容',ds:'护盾上限 +1，并恢复 1 个护盾（最多 5 层）'},
 {id:'dodgeDist',n:'长距闪避',ds:'闪避距离 +20%（最多 5 层）'}
];
// 增益叠加上限：达到上限后商店不再售卖，也无法继续购买
const RBB_CAP={ls:4,hp:6,atk:12,spd:8,cd:8,coin:6,thorn:5,crit:6,heal:3,dodge:4,shieldmax:5,dodgeDist:5};
function rlBuffCap(id){return RBB_CAP[id]||99}
function rlBuffNow(id){return id==='shieldmax'?(RL.buffs.shieldmax||0):(RL.buffs[id]||0)}
const RD=[{id:'d1',n:'衰败',ds:'生命上限 -10%'},{id:'d2',n:'钝化',ds:'攻击力 -10%'},{id:'d3',n:'沉重',ds:'移动速度 -8%'},{id:'d4',n:'贪噬',ds:'星币获取 -20%'},{id:'d5',n:'蚀魂',ds:'吸血效果 -25%'}];
const RLD={
 white:{n:'白给',boss:'rot',hp:1,dmg:1,cnt:2,coin:1,frag:1},
 easy:{n:'简单',boss:'rot',hp:1.15,dmg:1.12,cnt:3,coin:1.12,frag:1.3},
 normal:{n:'普通',boss:'brood',hp:1.4,dmg:1.3,cnt:4,coin:1.25,frag:1.7},
 hard:{n:'困难',boss:'jailer',hp:1.7,dmg:1.55,cnt:5,coin:1.45,frag:2.2},
 hell:{n:'地狱',boss:'bloodmoon',hp:2.1,dmg:1.9,cnt:6,coin:1.7,frag:3}
};
const RBOSS={
 rot:{n:'腐污尸王',hp:180,ds:'缓慢而沉重，喷吐腐毒，濒死时召唤游魂。'},
 brood:{n:'裂影女鬼母巢',hp:260,ds:'瞬移突袭，尖啸撕裂，不断孵化疾行鬼影。'},
 jailer:{n:'锈蚀机械狱卒',hp:380,ds:'装甲厚重，冲撞与震波，受创时会短暂过载。'},
 bloodmoon:{n:'血月妖祀',hp:520,ds:'血月仪式，追踪血珠，吞噬生命回复自身。'},
 void:{n:'虚空怨厄主宰',hp:700,ds:'虚空的终点，兼有全部怨厄之力。'}
};
const RLTHEME=[
 {bg:0x090709,fog:0x0d0a10,w:'wall',f:'floor',amb:0x6a5a88,c:0xffb066},
 {bg:0x060b08,fog:0x0a120d,w:'mossWall',f:'mossFloor',amb:0x4a7a5a,c:0x9fe0a0},
 {bg:0x0e0a06,fog:0x14100a,w:'sandWall',f:'sandFloor',amb:0x8a6a3a,c:0xffc46a},
 {bg:0x06080b,fog:0x0a0d12,w:'metalWall',f:'concFloor',amb:0x5a6a8a,c:0x8fb6ff},
 {bg:0x0c0507,fog:0x120608,w:'abyssWall',f:'abyssFloor',amb:0x8a2a2a,c:0xff6a5a}
];
function rlLoad(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
let FRAG=rlLoad('mz_frag',0);
let rlDiff=rlLoad('mz_rldiff','white');if(!RLD[rlDiff])rlDiff='white';
let rlEndless=!!rlLoad('mz_rlendless',0);
let rlDetailTab=null; // 大厅详情面板：w 武器 / b 增益 / m 怪物
function rlSaveFrag(){FRAG=Math.max(0,Math.floor(FRAG));try{localStorage.setItem('mz_frag',JSON.stringify(FRAG))}catch(e){}}
const RL_CLASSES={
 vanguard:{name:'前锋',icon:'⚔️',role:'近战爆发 / 贴身清敌',hp:110,atk:1.10,spd:1.00,shield:3,passive:'嗜血战意：近战击杀额外恢复 3 生命；近战伤害 +10%。',e:'裂阵突袭：朝面向方向冲击并斩击前方敌人，造成 150% 武器伤害；冷却 10 秒。',q:'血狱修罗：对周围敌人连续斩击 4 次，每次 90% 武器伤害；击杀可延长效果，冷却能量制。',advice:'推荐刀剑、双刃、吸血与范围伤害。贴近敌人再放 E，敌群密集时用 Q。',color:0xff5368},
 gunner:{name:'枪手',icon:'🔫',role:'远程火力 / 持续输出',hp:100,atk:1.08,spd:1.02,shield:3,passive:'火力校准：远程命中后短暂提高伤害；基础远程伤害 +8%。',e:'超载弹药：5 秒内伤害 +25%、弹速 +30%、额外穿透 1 个目标；冷却 14 秒。',q:'终焉弹狱：向视野前方释放密集幽影弹幕，命中爆炸；持续 5 秒，终极能量满 100 释放。',advice:'推荐冲锋枪、步枪、重炮、穿透与暴击。保持距离，先开 E 再持续射击。',color:0xffb34f},
 mage:{name:'法师',icon:'❄️',role:'元素控场 / 范围伤害',hp:95,atk:1.04,spd:1.00,shield:3,passive:'元素共鸣：元素特效伤害 +15%，适合利用高星武器的元素效果。',e:'霜雷禁域：在前方区域释放冰雷冲击，造成 120% 武器伤害并减速敌人；冷却 12 秒。',q:'天罚·元素崩坏：对当前房间敌人发动多轮元素打击，最后产生范围爆发；Boss 控制减弱。',advice:'推荐法器、雷电/爆炸/燃烧特效与范围伤害。先用 E 控场，再用 Q 清理敌群。',color:0x71d8ff},
 spirit:{name:'灵师',icon:'👻',role:'召唤协同 / 持续消耗',hp:100,atk:1.00,spd:1.00,shield:3,passive:'百灵随行：战斗中周期性对附近敌人造成灵体伤害；灵体伤害随武器伤害成长。',e:'灵契召回：灵体冲向附近敌人造成 100% 武器伤害；没有合适目标时对前方造成冲击；冷却 12 秒。',q:'百鬼归墟：召唤鬼影冲击周围敌人并引发连续爆炸，适合清理多目标。',advice:'推荐法器、持续伤害、吸血与范围增益。保持移动，让被动持续消耗敌人。',color:0xb99aff},
 bulwark:{name:'铁壁',icon:'🛡️',role:'防御反击 / 稳定推进',hp:125,atk:.96,spd:.96,shield:4,passive:'不动壁垒：开局额外获得 1 格护盾，受到伤害时获得短暂反击强化。',e:'钢铁守势：3 秒内受到伤害降低 50%，结束时释放冲击波；冷却 14 秒。',q:'不灭壁垒：恢复 1 格护盾并对周围敌人造成强力反震伤害；终极能量满 100 释放。',advice:'推荐护盾扩容、生命、荆棘反伤和稳定近战武器。面对精英/Boss 时开 E 抗住关键攻击。',color:0x85baff},
 ranger:{name:'游侠',icon:'💨',role:'高机动 / 位移爆发',hp:95,atk:1.03,spd:1.10,shield:3,passive:'虚空余势：闪避后 3 秒移动速度 +15%、伤害 +10%；内部冷却 5 秒。',e:'折跃突袭：向前瞬移并造成范围斩击；短暂免伤，冷却 10 秒。',q:'万象断界：4 秒内连续发动最多 5 次折跃斩击，最后造成一次范围终结爆发。',advice:'推荐高攻速、暴击、移速与闪避冷却缩减。用 E 调整位置，用 Q 穿梭敌群，不要站桩输出。',color:0x78e0b3}
};
const RL={
 active:false,run:false,endless:false,classId:'vanguard',classEcd:0,classEtime:0,ult:0,ultTime:0,passiveT:0,classIdTemp:null,diffKey:'white',floor:1,coins:0,hp:100,maxHp:100,
 ls:.04,lsW:0,atk:1,spd:1,cdMul:1,coinMul:1,crit:.08,thorn:0,dodgeMul:1,
 buffs:{},deb:[],bag:['torch',null,null],slot:0,cds:[0,0,0],
 enemies:[],stars:[],shots:[],fx:[],boss:null,elite:null,altar:null,altarReady:false,
 shopOpen:false,shop:[],dodgeCd:0,iframe:0,dead:false,kills:0,runTime:0,totalCoins:0,
 frags:0,hudT:0,hitFlash:0,ko:0,floorCleared:false,bossSpawned:false,bossDefeated:false,pieces:[],room:1,roomCount:3,gates:[],roomSpawned:[],damageScale:1,shields:3,maxShields:3,dodgeDist:1,weaponStars:{},weaponBuys:{},weaponSpent:{},shopFloor:0
};
let rlGroup=null,rlReady=false,shotSeq=0;
// 音效资源映射（CC0 Kenney 音效包），加载失败时回退到 WebAudio 合成
const RL_SFX_MAP={
  click:AST+'assets/audio/interface-sounds/Audio/click_001.ogg',
  pick:AST+'assets/audio/interface-sounds/Audio/confirmation_001.ogg',
  buy:AST+'assets/audio/interface-sounds/Audio/confirmation_002.ogg',
  slash:AST+'assets/audio/rpg-audio/Audio/knifeSlice.ogg',
  shoot:AST+'assets/audio/digital-audio/Audio/laser1.ogg',
  hit:AST+'assets/audio/impact-sounds/Audio/impactPunch_medium_000.ogg',
  hurt:AST+'assets/audio/impact-sounds/Audio/impactWood_medium_000.ogg',
  kill:AST+'assets/audio/rpg-audio/Audio/knifeSlice2.ogg',
  dodge:AST+'assets/audio/digital-audio/Audio/phaseJump1.ogg',
  win:AST+'assets/audio/interface-sounds/Audio/confirmation_003.ogg',
  dead:AST+'assets/audio/digital-audio/Audio/lowThreeTone.ogg',
  warn:AST+'assets/audio/digital-audio/Audio/lowRandom.ogg'
};
const RL_SFX_BUF={};
function rlLoadSfx(){
  ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
  for(const k in RL_SFX_MAP){
    if(RL_SFX_BUF[k])continue;
    fetch(RL_SFX_MAP[k]).then(r=>{if(!r.ok)throw r;return r.arrayBuffer()})
      .then(b=>ac.decodeAudioData(b)).then(buf=>{RL_SFX_BUF[k]=buf}).catch(()=>{});
  }
}
// 肉鸽模式 BGM（CC0 暗黑氛围乐），循环播放，BOSS 战切换
const RL_BGM_SRC={explore:AST+'assets/audio/bgm/explore.ogg',boss:AST+'assets/audio/bgm/boss.ogg'};
let rlBgm={src:null,gain:null,cur:null};
function rlPlayBgm(name){
  if(!RL_BGM_SRC[name]||rlBgm.cur===name)return;
  ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
  const old=rlBgm.src,og=rlBgm.gain;
  if(og){og.gain.setTargetAtTime(0,ac.currentTime,.5);setTimeout(()=>{try{old.stop()}catch(e){}},700)}
  fetch(RL_BGM_SRC[name]).then(r=>{if(!r.ok)throw r;return r.arrayBuffer()})
    .then(b=>ac.decodeAudioData(b)).then(buf=>{
      if(rlBgm.cur&&rlBgm.cur!==name){const o=rlBgm.src,g=rlBgm.gain;if(g){g.gain.setTargetAtTime(0,ac.currentTime,.5);setTimeout(()=>{try{o.stop()}catch(e){}},700)}}
      const s=ac.createBufferSource();s.buffer=buf;s.loop=true;
      const g=ac.createGain();g.gain.value=0;s.connect(g);g.connect(ac.destination);s.start();
      g.gain.setTargetAtTime(.32,ac.currentTime,1.2);
      rlBgm.src=s;rlBgm.gain=g;rlBgm.cur=name;
    }).catch(()=>{});
}
function rlStopBgm(){if(rlBgm.gain){rlBgm.gain.gain.setTargetAtTime(0,ac.currentTime,.5);const s=rlBgm.src;setTimeout(()=>{try{s.stop()}catch(e){}},700)}rlBgm.src=null;rlBgm.gain=null;rlBgm.cur=null}
function rlSfx(k){
  try{
    if(!RL._sfxLoaded){RL._sfxLoaded=true;rlLoadSfx()}
    if(RL_SFX_BUF[k]){
      ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
      const s=ac.createBufferSource();s.buffer=RL_SFX_BUF[k];
      const g=ac.createGain();g.gain.value=.5;s.connect(g);g.connect(ac.destination);s.start();
      return;
    }
  }catch(e){}
  try{
    if(k==='pick'){rlTone(900,1500,.1,'triangle',.1);rlTone(1400,2100,.12,'sine',.06)}
    else if(k==='slash'){rlNoise(.16,2200,500,.14,1.1)}
    else if(k==='shoot'){rlNoise(.1,3000,900,.13,.9);rlTone(180,60,.09,'sawtooth',.08)}
    else if(k==='hit'){rlTone(220,70,.09,'square',.09);rlNoise(.06,1800,600,.05,.7)}
    else if(k==='hurt'){rlTone(160,50,.3,'sawtooth',.13);rlNoise(.2,900,200,.07,.8)}
    else if(k==='kill'){rlTone(520,90,.34,'sawtooth',.1);rlNoise(.3,1600,150,.06,.6)}
    else if(k==='dodge'){rlWhoosh()}
    else if(k==='buy'){rlTone(660,990,.12,'triangle',.1);rlTone(990,1320,.14,'sine',.07)}
    else if(k==='click'){rlTone(520,520,.05,'square',.06)}
    else if(k==='win'){[523,659,784,1046].forEach((f,i)=>rlTone(f,f*1.01,.18,'triangle',.08,i*.11))}
    else if(k==='dead'){rlTone(180,40,.9,'sawtooth',.12);rlNoise(.8,700,80,.07,.5)}
    else if(k==='warn'){monsterRoar(.8)}
  }catch(e){}
}
// 三类武器三类音色：近战=金属破空 / 枪械=火药爆响 / 法器=灵能共鸣
// 同一类内按商店价格由便宜到昂贵单调递增强度（音量、时长、低频冲击、谐波层数），
// 每把武器再叠加各自独有的点缀音，保证同类不同武器仍可听出区别。
function rlWeaponSfx(id){
  try{
    if(!RL._sfxLoaded){RL._sfxLoaded=true;rlLoadSfx()}
  }catch(e){}
  try{
    const w=RWBY[id];if(!w){rlSfx('slash');return}
    const MAXP={melee:180,gun:230,relic:250};
    const t=clamp((w.p||0)/(MAXP[w.k]||250),0,1); // 0=同类最便宜，1=同类最贵
    if(w.k==='melee'){
      if(id==='torch'){ // 手电冲击：最弱的电流爆闪，不与刀剑同质
        rlTone(1650,880,.09,'square',.06);rlNoise(.09,4200,2200,.05,1.5);
        return;
      }
      // 破空：档位越高越低沉、越长、越有重量
      rlNoise(.1+.28*t,4200-2500*t,760-540*t,.085+.075*t,1.05+.8*t);
      rlTone(1720-760*t,780-500*t,.055+.13*t,'triangle',.045+.05*t);
      if(t>.3)rlTone(130-45*t,42,.14+.22*t,'sine',.03+.075*t);   // 低频冲击
      if(id==='k3')rlTone(1450,700,.07,'square',.05,.09);         // 双刃第二击
      if(id==='k4')[0,.05,.1].forEach((d,i)=>rlTone(1900+i*240,900,.045,'triangle',.03+.01*t,d)); // 链节哗啦
      if(id==='k5')rlNoise(.26,430,90,.06+.05*t,.6);              // 骨锯闷响
    }else if(w.k==='gun'){
      // 枪火：档位越高口径越大，低频更沉、尾音更厚
      rlNoise(.07+.3*t,5200-2500*t,1500-1150*t,.1+.08*t,.85+.9*t);
      rlTone(300-190*t,90-50*t,.055+.2*t,'sawtooth',.055+.08*t);
      if(t>.28)rlNoise(.16+.26*t,900-480*t,110,.04+.07*t,.65);    // 尾音回荡
      if(t>.6)rlTone(74-24*t,28,.2+.26*t,'sine',.05+.075*t);      // 胸腔震撼
      if(id==='g2')[0,.045,.09,.135,.18].forEach(d=>rlNoise(.09,2600,700,.05,1.2,d)); // 五颗弹丸
      if(id==='g3'){rlNoise(.055,5000,1800,.09,1.4,.05);rlNoise(.055,5000,1800,.09,1.4,.1)} // 连射三连
      if(id==='g4')rlTone(2400,600,.1,'sawtooth',.05,.03);        // 破空尖啸
      if(id==='g5')rlNoise(.5,320,60,.08,.5);                     // 炮击地面震动
    }else{
      // 法器：档位越高泛音越多、尾音越长、深层震动越强
      const base=300+560*t,parts=t>.6?4:t>.28?3:2;
      for(let i=0;i<parts;i++)rlTone(base*(i+1),base*(i+1)*.994,.26+.42*t,'sine',(.055-.008*i)+.02*t,i*.028);
      if(id==='r1')rlTone(2640,2620,.5,'sine',.045,.03);           // 引魂铃的清越铃音
      else{
        rlNoise(.1+.18*t,1100+2400*t,6000,.035+.035*t,1.6+t);
        if(id==='r2')rlNoise(.24,860,240,.05,.75);                 // 符火燃烧
        if(id==='r3')rlTone(3600,2500,.12,'sine',.05,.02);         // 冰晶脆裂
        if(id==='r4'){rlNoise(.07,6800,2600,.07,2.6);rlNoise(.07,6800,2600,.06,2.6,.08)} // 雷珠噼啪
        if(id==='r5')rlNoise(.4,300,70,.07,.5);                    // 血莲沉重脉冲
      }
      if(t>.55)rlTone(70-20*t,34,.3+.3*t,'sine',.04+.07*t);
    }
  }catch(e){}
}
function rlTone(f0,f1,dur,type,gain,delay){
  try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();const t=ac.currentTime+(delay||0),o=ac.createOscillator(),g=ac.createGain();
    o.type=type||'triangle';o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(gain||.1,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.02)}catch(e){}
}
function rlNoise(dur,f0,f1,gain,q,delay){
  try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();const t=ac.currentTime+(delay||0),n=Math.floor(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.8);const s=ac.createBufferSource();s.buffer=buf;
    const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=q||1;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur);
    const g=ac.createGain();g.gain.setValueAtTime(gain||.1,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(ac.destination);s.start(t)}catch(e){}
}
// 闪避音效：布料破空的风声（高频噪声随速度扫过），不是低频轰鸣
function rlWhoosh(){
  try{
    ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();
    const t=ac.currentTime,dur=.34,n=Math.floor(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++){const k=i/n;d[i]=(Math.random()*2-1)*(k<.1?k/.1:Math.pow(1-(k-.1)/.9,2.4))}
    const s=ac.createBufferSource();s.buffer=buf;
    const hp=ac.createBiquadFilter();hp.type='highpass';hp.Q.value=.7;
    hp.frequency.setValueAtTime(300,t);hp.frequency.exponentialRampToValueAtTime(2800,t+dur*.75);
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.6;
    bp.frequency.setValueAtTime(1100,t);bp.frequency.exponentialRampToValueAtTime(3600,t+dur*.65);
    const g=ac.createGain();
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.035);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(hp);hp.connect(bp);bp.connect(g);g.connect(ac.destination);s.start(t);
    const o=ac.createOscillator(),og=ac.createGain();
    o.type='sine';o.frequency.setValueAtTime(1400,t);o.frequency.exponentialRampToValueAtTime(320,t+dur*.55);
    og.gain.setValueAtTime(.045,t);og.gain.exponentialRampToValueAtTime(.0001,t+dur*.7);
    o.connect(og);og.connect(ac.destination);o.start(t);o.stop(t+dur+.05);
  }catch(e){}
}
function rlStats(){
  const b=RL.buffs,cap=v=>Math.max(.35,1-v*.05);
  let maxHp=100+20*Math.min(b.hp||0,6);
  let ls=Math.min(.12,.04+.03*(b.ls||0)+RL.lsW);
  let atk=1+.12*(b.atk||0)*cap(b.atk||0);
  let spd=1+.08*(b.spd||0)*cap(b.spd||0);
  let cdMul=1/(1+.08*(b.cd||0));
  let coinMul=1+.15*(b.coin||0);
  let crit=.08+.08*(b.crit||0);
  let thorn=.2*(b.thorn||0),dodgeMul=Math.max(.5,1-.15*(b.dodge||0));
  RL.dodgeDist=1+.2*(b.dodgeDist||0);
  RL.maxShields=(RL_CLASSES[RL.classId]||RL_CLASSES.vanguard).shield+(b.shieldmax||0);RL.shields=Math.min(RL.shields,RL.maxShields);
  const cls=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard;maxHp=Math.round(maxHp*cls.hp/100);atk*=cls.atk;spd*=cls.spd;
  for(const k of RL.deb){if(k==='d1')maxHp*=.9;else if(k==='d2')atk*=.9;else if(k==='d3')spd*=.92;else if(k==='d4')coinMul*=.8;else if(k==='d5')ls*=.75}
  if(RL.endless)maxHp=Math.min(420,maxHp);
  RL.maxHp=Math.round(maxHp);RL.ls=ls;RL.atk=atk;RL.spd=spd;RL.cdMul=cdMul;RL.coinMul=coinMul;RL.crit=crit;RL.thorn=thorn;RL.dodgeMul=dodgeMul;
  if(RL.hp>RL.maxHp)RL.hp=RL.maxHp;
}
function rlHud(on){
  document.body.classList.toggle('rl',on);
  ['rlhud','rlhpwrap','rlshieldwrap','rlshieldtxt','rlweps','rlswap','rldodge','rlchar','rle','rlq'].forEach(id=>$(id).classList.toggle('hide',!on));
  $('info').classList.toggle('hide',on);$('mapw').classList.toggle('hide',on);
  if(!on){$('rlboss').classList.add('hide');rlClearDmgNums()}
}
function rlUpdateHUD(){
  $('rlf').textContent=RL.floor;
  $('rlc').textContent=RL.coins;
  $('rlm').textContent=(RL.endless?'无尽轮回':'闯关轮回')+' · '+(RL.endless?'复利':RLD[RL.diffKey].n)+' · 房间 '+(RL.room||1)+'/3';
  const p=clamp(RL.hp/RL.maxHp,0,1);
  $('rlhpfill').style.width=(p*100).toFixed(1)+'%';
  $('rlhptxt').textContent=Math.max(0,Math.ceil(RL.hp))+' / '+RL.maxHp;
  $('rlhpwrap').classList.toggle('low',p<=.25);
  $('rlshieldfill').style.width=(RL.maxShields?RL.shields/RL.maxShields*100:0)+'%';$('rlshieldtxt').textContent='🛡 '+RL.shields+' / '+RL.maxShields;
  const cc=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard;
  $('rldodge').textContent=RL.dodgeCd>0?RL.dodgeCd.toFixed(1):'💨';
  $('rle').textContent=RL.classEtime>0?'E '+RL.classEtime.toFixed(1)+'s':RL.classEcd>0?'E '+RL.classEcd.toFixed(1)+'s':'E 技能';
  $('rle').classList.toggle('cool',RL.classEcd>0&&RL.classEtime<=0);
  $('rlq').textContent=RL.ultTime>0?'Q '+RL.ultTime.toFixed(1)+'s':(RL.ult||0)>=100?'Q 大招 ✓':'Q '+Math.floor(RL.ult||0)+'%';
  $('rlq').classList.toggle('ready',(RL.ult||0)>=100);
  $('rlq').classList.toggle('cool',(RL.ult||0)<100&&RL.ultTime<=0);
  $('rle').title=cc.e;$('rlq').title=cc.q;
  const sl=$('rlweps').children;
  for(let i=0;i<3;i++){const el=sl[i];if(!el)continue;const id=RL.bag[i],w=id&&RWBY[id];
    el.classList.toggle('on',i===RL.slot);el.classList.toggle('empty',!w);
    el.innerHTML='<b>'+(i+1)+'</b><span>'+(w?w.n:'空')+'</span>';
    if(w&&RL.cds[i]>0)el.style.borderColor='rgba(255,120,90,.55)';else el.style.borderColor='';}
  // 增益与负面效果统一收纳在角色面板，游玩画面不再堆叠 Buff 列表。
  $('rlbuffs').innerHTML='';
  if(RL.boss&&!RL.boss.dead&&(!RL.boss.dormant||RL.room===RL.boss.roomId)){
    $('rlboss').classList.remove('hide');$('rlbossname').textContent=RL.boss.name;
    $('rlbossfill').style.width=clamp(RL.boss.hp/RL.boss.maxHp,0,1)*100+'%';
  }else $('rlboss').classList.add('hide');
}
function rlShow(s){
  state=s;
  const ov=$('ov');ov.classList.remove('hide');
  const pause=s==='pause'||s==='quit';
  $('modes').classList.toggle('hide',pause||!(s==='start'));
  $('rlobby').classList.toggle('hide',s!=='start');
  $('dif').classList.add('hide');$('dd').classList.add('hide');
  $('btn2').classList.toggle('hide',!(pause||s==='rldead'||s==='rlwin'));
  $('rlboss').classList.add('hide');
  if(s==='start'){
    running=false;RL.active=false;RL.shopOpen=false;speedBonus=0;$('vig').style.opacity=0;
    if(rlGroup)rlGroup.visible=false;if(rlGun)rlGun.visible=false;gun.visible=true;skyG.visible=true;
    $('ot').innerHTML='⛩ 肉鸽轮回 · 选择你的职业';
    $('ox').innerHTML='死亡即轮回。每层依次清空 3 个战斗房间，最后一间在 Boss 层迎战首领；通关后祭坛商店开启。<br>初始 100 生命，只能靠吸血回复；拾取金色六芒星换取星币。<br>六大职业可选 · E 职业技能 · Q 终极技能 · Tab 切换武器 · 3 格武器栏';
    $('btn').textContent='踏入轮回';rlRenderLobby();
  }else if(s==='pause'){
    $('ot').innerHTML='⏸ 轮回暂停';$('ox').innerHTML='第 <b>'+RL.floor+'</b> 层 · 星币 <b>'+RL.coins+'</b><br>准备好了就继续。';$('btn').textContent='继续';
  }else if(s==='quit'){
    $('ot').innerHTML='退出轮回？';$('ox').innerHTML='本局进度不会保存。';$('btn').textContent='继续';
  }else if(s==='rldead'){
    $('ot').innerHTML='💀 轮回终结';$('ox').innerHTML='抵达第 <b>'+RL.floor+'</b> 层<br>击杀 <b>'+RL.kills+'</b> · 星币 <b>'+RL.coins+'</b><br>残魂碎片 +<b>'+RL.frags+'</b>';$('btn').textContent='再次轮回';
    $('btn2').textContent='返回大厅';
  }else if(s==='rlwin'){
    $('ot').innerHTML='⛩ 轮回已通';$('ox').innerHTML='你走完了整条轮回。<br>击杀 <b>'+RL.kills+'</b> · 剩余生命 <b>'+Math.ceil(RL.hp)+'</b><br>残魂碎片 +<b>'+RL.frags+'</b>';$('btn').textContent='再次轮回';
    $('btn2').textContent='返回大厅';
  }
  if(!pause&&s==='start'){rlHud(false);$('rlshop').classList.add('hide')}
}
function rlRenderLobby(){
  $('rlfrag').textContent='残魂碎片 '+FRAG;
  const classes=$('rlclasses');classes.innerHTML='';
  Object.entries(RL_CLASSES).forEach(([id,c])=>{const b=document.createElement('button');b.className='rlclasspick'+(RL.classId===id?' on':'');b.innerHTML=c.icon+' '+c.name+'<small>'+c.role+'</small>';b.onclick=()=>{RL.classId=id;rlSfx('click');rlRenderLobby()};classes.appendChild(b)});
  const cc=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard;
  $('rlclassdetail').innerHTML='<b>'+cc.icon+' '+cc.name+'｜'+cc.role+'</b><div class="stats"><span>生命 '+cc.hp+'</span><span>伤害 '+Math.round(cc.atk*100)+'%</span><span>移速 '+Math.round(cc.spd*100)+'%</span><span>护盾 '+cc.shield+' 格</span></div><b>被动：</b>'+cc.passive+'<br><b>E 技能：</b>'+cc.e+'<br><b>Q 大招：</b>'+cc.q+'<br><b>玩法建议：</b>'+cc.advice;

  const m1=$('rlmode'),m2=$('rlmode2');
  const setMode=endless=>{RL.endless=endless;rlEndless=endless?1:0;try{localStorage.setItem('mz_rlendless',JSON.stringify(rlEndless))}catch(e){}rlSfx('click');rlRenderLobby()};
  m1.textContent='⛩ 闯关轮回';m1.classList.toggle('on',!RL.endless);m1.onclick=()=>{if(!RL.endless)return;setMode(false)};
  m2.textContent='♾ 无尽轮回';m2.classList.toggle('on',RL.endless);m2.onclick=()=>{if(RL.endless)return;setMode(true)};
  const dd=$('rldiff');dd.innerHTML='';
  if(!RL.endless){
    Object.keys(RLD).forEach(k=>{const b=document.createElement('button');b.textContent=RLD[k].n;b.classList.toggle('on',RL.diffKey===k);
      b.onclick=()=>{RL.diffKey=k;rlDiff=k;try{localStorage.setItem('mz_rldiff',JSON.stringify(k))}catch(e){}rlSfx('click');rlRenderLobby()};dd.appendChild(b)});
    const tip=document.createElement('div');tip.style.cssText='width:100%;font-size:11px;opacity:.72;margin-top:3px';
    tip.textContent='BOSS：'+RBOSS[RLD[RL.diffKey].boss].n+' · '+RBOSS[RLD[RL.diffKey].boss].ds;dd.appendChild(tip);
  }else{
    const tip=document.createElement('div');tip.style.cssText='width:100%;font-size:11px;opacity:.72';
    tip.textContent='从「白给」起步 · 房间制 · 怪物血量随层数复利成长（首领更高） · 玩家输出成长封顶 · 每 5 层追加诅咒（可叠 2 层） · 物价上浮';dd.appendChild(tip);
  }
  // 残魂商店内容待定：不再用残魂碎片解锁武器，武器默认全部可用
  const ul=$('rlunlock');ul.innerHTML='';ul.classList.add('hide');
  // 详情面板：武器 / 增益 / 怪物，三个按钮展开对应介绍
  const DP={w:$('rlweapons'),b:$('rlbuffslist'),m:$('rlmobslist')};
  const DB={w:$('rlbtnweapons'),b:$('rlbtnbuffs'),m:$('rlbtnmobs')};
  Object.keys(DP).forEach(k=>{
    DP[k].classList.toggle('hide',rlDetailTab!==k);
    DB[k].classList.toggle('on',rlDetailTab===k);
    DB[k].onclick=()=>{rlDetailTab=rlDetailTab===k?null:k;rlSfx('click');rlRenderLobby()};
  });
  // 武器详情：展示全部武器属性数值
  const wl=$('rlweapons');if(wl){wl.innerHTML='';
    const kindName={melee:'近战',gun:'枪械',relic:'法器'};
    RW.forEach(w=>{
      const d=document.createElement('div');d.className='rlw';
      const tags=['<span class="tag k">'+kindName[w.k]+'</span>',
        '<span class="tag">伤害 '+w.d+(w.hits?'×'+w.hits:'')+'</span>',
        '<span class="tag">间隔 '+w.c+'s</span>',
        '<span class="tag">'+(w.k==='melee'?'距离':'射程')+' '+w.r+'</span>'];
      if(w.pierce)tags.push('<span class="tag">穿透 '+w.pierce+'</span>');
      if(w.aoe)tags.push('<span class="tag">范围 '+w.aoe+'</span>');
      if(w.slow)tags.push('<span class="tag">减速 '+w.slow+'s</span>');
      if(w.chain)tags.push('<span class="tag">连锁 '+w.chain+'</span>');
      if(w.ls)tags.push('<span class="tag">吸血 '+Math.round(w.ls*100)+'%</span>');
      if(w.kb)tags.push('<span class="tag">击退</span>');
      d.innerHTML='<b>'+w.n+'</b>'+tags.join('')+'<div class="ds">'+w.ds+'（商店价 '+w.p+'🪙）</div>';
      wl.appendChild(d);
    });
    const tip=document.createElement('div');tip.style.cssText='grid-column:1/-1;font-size:11px;color:#3a3348;font-weight:800';
    tip.textContent='全部武器默认解锁，可在轮回祭坛用星币购入。';
    wl.appendChild(tip);
  }
  // 增益详情：正面词条 + 轮回诅咒
  const bl=$('rlbuffslist');if(bl){bl.innerHTML='';
    RB.forEach(b=>{const d=document.createElement('div');d.className='rlw';
      const capTag=b.id==='shield'?'<span class="tag">即时生效</span>':'<span class="tag">上限 '+rlBuffCap(b.id)+' 层</span>';
      d.innerHTML='<b>'+b.n+'</b><span class="tag k">增益</span>'+capTag+'<div class="ds">'+b.ds+'</div>';bl.appendChild(d)});
    RD.forEach(b=>{const d=document.createElement('div');d.className='rlw';
      d.innerHTML='<b>'+b.n+'</b><span class="tag k">诅咒</span><div class="ds">'+b.ds+'（无尽模式每 5 层随机追加一条）</div>';bl.appendChild(d)});
    const tip=document.createElement('div');tip.style.cssText='grid-column:1/-1;font-size:11px;color:#3a3348;font-weight:800';
    tip.textContent='增益可在祭坛商店购买叠加；诅咒只会出现在无尽模式。';
    bl.appendChild(tip);
  }
  // 怪物详情：普通怪 / 精英 / 首领（数值按当前难度换算）
  const ml=$('rlmobslist');if(ml){ml.innerHTML='';
    const cf=RL.endless?{hp:1,dmg:1}:RLD[RL.diffKey];
    const mobs=[
      {n:'幽影游魂',t:'普通',hp:32,dmg:8,spd:2.35,ds:'缓慢逼近的游魂，血量偏高，容易躲避。'},
      {n:'疾行鬼影',t:'普通',hp:16,dmg:5,spd:3.5,ds:'移速极快、血量很薄，成群时最容易被围。'},
      {n:'蜘蛛头颅',t:'普通',hp:24,dmg:10,spd:2.9,ds:'贴地爬行的头颅，出手很快，注意脚下。'},
      {n:'精英·银龙',t:'精英',hp:260,dmg:16,spd:1.9,ds:'高血量精英，非首领房间按层数概率刷新，越高层越常见。'},
      {n:'精英·千手',t:'精英',hp:300,dmg:14,spd:1.6,ds:'多臂精英，伤害中等但非常耐打，刷新概率随层数提升。'}
    ];
    mobs.forEach(o=>{const d=document.createElement('div');d.className='rlw';
      d.innerHTML='<b>'+o.n+'</b><span class="tag k">'+o.t+'</span><span class="tag">生命 '+Math.round(o.hp*cf.hp)+'</span><span class="tag">伤害 '+Math.round(o.dmg*cf.dmg)+'</span><span class="tag">速度 '+o.spd+'</span><div class="ds">'+o.ds+'</div>';
      ml.appendChild(d)});
    Object.keys(RBOSS).forEach(k=>{const B=RBOSS[k],d=document.createElement('div');d.className='rlw';
      d.innerHTML='<b>'+B.n+'</b><span class="tag k">首领</span><span class="tag">生命 '+Math.round(B.hp*cf.hp)+'</span><div class="ds">'+B.ds+'</div>';
      ml.appendChild(d)});
    const tip=document.createElement('div');tip.style.cssText='grid-column:1/-1;font-size:11px;color:#3a3348;font-weight:800';
    tip.textContent='当前难度：'+(RL.endless?'无尽轮回（数值随层数复利成长）':RLD[RL.diffKey].n)+'。无尽模式怪物血量/伤害每层提升。';
    ml.appendChild(tip);
  }
}
function rlStart(){
  RL.endless=!!rlEndless;RL.diffKey=rlEndless?'white':rlDiff;
  Object.assign(RL,{active:true,run:true,floor:1,coins:0,lsW:0,ifr:0,dodgeCd:0,dodgeCdTotal:0,iframe:0,classEcd:0,classEtime:0,classEtotal:0,ult:0,ultTime:0,ultTotal:0,passiveT:0,dead:false,kills:0,runTime:0,totalCoins:0,frags:0,buffs:{},deb:[],bag:['torch',null,null],slot:0,cds:[0,0,0],enemies:[],stars:[],shots:[],fx:[],boss:null,elite:null,altarReady:false,shopOpen:false,shop:[],floorCleared:false,bossSpawned:false,bossDefeated:false,pieces:[],room:1,roomCount:3,gates:[],roomSpawned:[],roomCleared:false,damageScale:1,hp:100,maxHp:100,shields:3,maxShields:3,dodgeDist:1,weaponStars:{torch:1},weaponBuys:{},weaponSpent:{},shopFloor:0});
  rlStats();RL.hp=RL.maxHp;RL.shields=RL.maxShields;
  rlLoadModels();
  $('ov').classList.add('hide');$('rlshop').classList.add('hide');
  rlHud(true);skyG.visible=false;
  gun.visible=false;rlSetupGunEnv();rlBuildGun();rlGun.visible=true;$('vig').style.opacity=0;
  rlBuildFloor();rlUpdateHUD();
  running=true;lock();rlPlayBgm('explore');beep(520,.1);
  toast('第 1 层：清空所有怨魂，祭坛才会开启');
}
const RL_W=35,RL_D=15;
// 三间房采用不同结构：封闭墓穴 / 露天中庭 / 高层神殿大厅
const RL_ROOM_TPL=[
  {x1:1,x2:9,z1:1,z2:11,h:7.4,ceil:true,style:'crypt'},
  {x1:11,x2:21,z1:2,z2:10,h:6.6,ceil:false,style:'court'},
  {x1:23,x2:33,z1:1,z2:13,h:9.6,ceil:true,style:'temple'}
];
function rlBuildFloor(){
  if(rlGroup){scene.remove(rlGroup);rlGroup.traverse(o=>{if(o.geometry&&o.geometry.dispose&&!o.userData.keep)o.geometry.dispose();if(o.material&&o.material.dispose&&!o.userData.keepMat)o.material.dispose()})}
  rlGroup=new THREE.Group();scene.add(rlGroup);if(group)group.visible=false;skyG.visible=false;
  RL.enemies=[];RL.stars=[];RL.shots=[];RL.fx=[];RL.warns=[];RL.boss=null;RL.elite=null;RL.altarReady=false;RL.floorCleared=false;RL.bossSpawned=false;RL.bossDefeated=false;RL.shopOpen=false;RL.shop=[];RL.shopFloor=0;RL.room=1;RL.roomCount=3;RL.gates=[];RL.roomSpawned=[false,false,false];RL.roomCleared=false;RL.deco=null;RL.shellCandles=[];RL.candles=[];
  if(rlGroup)rlGroup.visible=true;RL.hitFlash=0;rlClearDmgNums();$('vig').style.opacity=0;$('rlshop').classList.add('hide');$('rlprompt').classList.add('hide');
  const th=RLTHEME[(RL.floor-1)%RLTHEME.length];
  const rooms=RL_ROOM_TPL.map(r=>Object.assign({},r));
  RL.rooms=rooms;
  // 按模板重建网格：房间大小 / 位置各不相同
  maze=Array.from({length:RL_D},()=>Array(RL_W).fill(1));
  for(const r of rooms)for(let z=r.z1;z<=r.z2;z++)for(let x=r.x1;x<=r.x2;x++)maze[z][x]=0;
  // 露天中庭里留一处残破阶梯，形成室内障碍
  const court=rooms[1];
  RL.courtStair=[court.x1+1,court.z1+1];
  maze[RL.courtStair[1]][RL.courtStair[0]]=1;
  // 两处门洞（初始为石墙，清完前面房间才解锁）
  const gates=[{x:rooms[0].x2+1,z:6},{x:rooms[1].x2+1,z:6}];
  RL.gateCells=gates;
  rlBuildShell(th,rooms,gates);
  rlBuildGates(gates);
  // 玩家出生在第一间房
  P.x=(rooms[0].x1+1.2)*T;P.z=6*T;P.y=0;vel.x=vel.z=0;pitch=0;yaw=-Math.PI/2;bob=0;
  // 祭坛放在最终大厅正中
  rlBuildAltar(Math.round((rooms[2].x1+rooms[2].x2)/2),Math.round((rooms[2].z1+rooms[2].z2)/2));
  RL.altar.g.visible=false;
  for(let ri=0;ri<3;ri++){
    const r=rooms[ri],open=[];
    for(let z=r.z1+1;z<=r.z2-1;z+=2)for(let x=r.x1+1;x<=r.x2-1;x+=2)if(maze[z][x]===0)open.push([x,z]);
    const count=ri===2?Math.max(4,Math.floor((RLD[RL.diffKey].cnt+RL.floor)*.65)):Math.max(3,Math.floor((RLD[RL.diffKey].cnt+RL.floor)*.55));
    const bossFloor=RL.endless?(RL.floor%5===0):(RL.floor>=5);
    for(let n=0;n<count&&open.length;n++){const [i,j]=open.splice(Math.random()*open.length|0,1)[0];const rr=Math.random();const kind=rr<.35?'wraith':rr<.7?'shade':'spider';const e=rlAddEnemy(kind,(i+.5)*T,(j+.5)*T);e.roomId=ri+1;}
    // 非 BOSS 房按层数概率刷新精英怪（银龙 / 千手），层数越高概率越高
    if(ri<2&&open.length>0){const eliteChance=Math.min(0.9,0.10+RL.floor*0.04);if(Math.random()<eliteChance){const [i,j]=open.splice(Math.random()*open.length|0,1)[0];const ek=Math.random()<.5?'silver':'thousand';const e=rlAddEnemy(ek,(i+.5)*T,(j+.5)*T);e.roomId=ri+1;toast('⚠ 房间 '+ (ri+1) +' 出现了精英怪：'+e.name);}}
    if(ri===2&&bossFloor){const [i,j]=[Math.floor((r.x1+r.x2)/2)-2,r.z1+3];const bk=RL.endless?['rot','brood','jailer','bloodmoon','void'][(Math.floor((RL.floor-1)/5)+Math.floor(Math.random()*5))%5]:RLD[RL.diffKey].boss;const e=rlAddEnemy('boss',(i+.5)*T,(j+.5)*T,bk);e.roomId=3;RL.bossSpawned=true;}
    // Gold star currency pickups are distributed in each room.
    for(let n=0;n<Math.min(5,2+Math.floor(RL.floor/2));n++){const x=r.x1+1+Math.random()*(r.x2-r.x1-2),z=r.z1+1+Math.random()*(r.z2-r.z1-2);const g=mkSixStar(.34);g.position.set((x+.5)*T,1.15,(z+.5)*T);rlGroup.add(g);RL.stars.push({g,ph:Math.random()*6,roomId:ri+1});}
    rlDecorateRoom(ri,r);
    RL.roomSpawned[ri]=true;
  }
  // Enemies outside the active room remain dormant until their room is entered.
  RL.enemies.forEach(e=>{if(e.roomId!==1){e.g.visible=false;e.dormant=true}});
  rlTheme(th);rlUpdateHUD();toast('第 '+RL.floor+' 层 · 房间 1/3：清空房间内所有怪物');
}
/* ---------- 场景外壳：地牢模块化墙体 / 地板 / 天花板 ---------- */
function rlMergeAdd(bucket,obj){
  obj.updateMatrixWorld(true);
  obj.traverse(o=>{
    if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;
    const mat=Array.isArray(o.material)?o.material[0]:o.material;
    if(!mat)return;
    let b=bucket.get(mat.uuid);if(!b){b={mat,geos:[]};bucket.set(mat.uuid,b)}
    const g=o.geometry,out=new THREE.BufferGeometry();
    out.setAttribute('position',g.attributes.position.clone());
    if(g.attributes.normal)out.setAttribute('normal',g.attributes.normal.clone());
    else out.computeVertexNormals();
    if(g.attributes.uv)out.setAttribute('uv',g.attributes.uv.clone());
    else out.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(g.index)out.setIndex(g.index.clone());
    else{const n=g.attributes.position.count,idx=new Uint32Array(n);for(let i=0;i<n;i++)idx[i]=i;out.setIndex(new THREE.BufferAttribute(idx,1))}
    out.applyMatrix4(o.matrixWorld);
    b.geos.push(out);
  });
}
function rlMergeFlush(bucket,parent,tint){
  for(const {mat,geos} of bucket.values()){
    if(!geos.length)continue;
    let merged=null;
    try{if(THREE.BufferGeometryUtils&&THREE.BufferGeometryUtils.mergeBufferGeometries)merged=THREE.BufferGeometryUtils.mergeBufferGeometries(geos,false)}catch(e){}
    if(merged){
      const m=mat.clone();if(tint)m.color.multiply(tint);m.side=THREE.FrontSide;
      const mesh=new THREE.Mesh(merged,m);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;parent.add(mesh);
      geos.forEach(g=>g.dispose());
    }else{
      for(const g of geos){const mesh=new THREE.Mesh(g,mat);mesh.matrixAutoUpdate=false;parent.add(mesh)}
    }
  }
}
function rlBuildGates(gates){
  for(const gt of gates){
    const g=new THREE.Group();g.position.set((gt.x+.5)*T,0,(gt.z+.5)*T);rlGroup.add(g);
    const metal=new THREE.MeshStandardMaterial({color:0x47434c,metalness:.85,roughness:.32,emissive:0x32101a,emissiveIntensity:.55});
    for(let k=0;k<7;k++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.14,4.2,.14),metal);bar.position.set(0,2.1,(k-3)*.55);g.add(bar)}
    const beam=new THREE.Mesh(new THREE.BoxGeometry(.24,.2,4.0),metal);beam.position.y=4.2;g.add(beam);
    RL.gates.push({x:gt.x,z:gt.z,group:g,open:false});
  }
}
function rlBuildShell(th,rooms,gates){
  if(RL.shell){rlGroup.remove(RL.shell);RL.shell.traverse(o=>{if(o.geometry&&!o.userData.keep)o.geometry.dispose()});RL.shell=null}
  const sh=new THREE.Group();RL.shell=sh;RL.shellArgs={th,rooms,gates};rlGroup.add(sh);
  RL.candles=[];RL.shellCandles=[];
  const R=Math.random;
  const gateSet=new Set(gates.map(g=>g.x+','+g.z));
  const tint=new THREE.Color(0xbfb6a8);
  // 1) 可见地板格（含门洞下的地面）
  const cells=[];
  for(const r of rooms)for(let z=r.z1;z<=r.z2;z++)for(let x=r.x1;x<=r.x2;x++)cells.push([x,z,r]);
  for(const gt of gates)cells.push([gt.x,gt.z,rooms[1]]);
  const fmat=pbrMat(th.f,2,2,{color:0xa8a094});
  const fim=new THREE.InstancedMesh(new THREE.BoxGeometry(T,.24,T),fmat,cells.length);
  {const d=new THREE.Object3D();cells.forEach(([x,z],k)=>{d.position.set((x+.5)*T,-.14,(z+.5)*T);d.updateMatrix();fim.setMatrixAt(k,d.matrix)});}
  sh.add(fim);
  // 2) 地牢模块地板（合并为少量 draw call）
  if(rlModelCache.modfloor){
    const srcA=rlGetModel('modfloor'),srcB=rlGetModel('modfloorcrack');
    const fb=new Map();
    cells.forEach(([x,z])=>{
      const src=(srcB&&R()<.2)?srcB:srcA;if(!src)return;
      src.position.set((x+1)*T,0,z*T);src.rotation.set(0,Math.PI,0);src.scale.set(1,1,1);
      rlMergeAdd(fb,src);
    });
    rlMergeFlush(fb,sh,tint);
  }
  // 3) 墙体：只在临空面生成，按房间层高拉伸
  const faces=[];
  const D4=[[0,-1,0,0,-1],[0,1,1,0,1],[-1,0,2,-1,0],[1,0,3,1,0]];
  for(const r of rooms){
    for(let z=r.z1;z<=r.z2;z++)for(let x=r.x1;x<=r.x2;x++){
      for(const [dx,dz,di,nx,nz] of D4){
        const ax=x+dx,az=z+dz;
        if(gateSet.has(ax+','+az))continue; // 门洞不砌墙
        if(maze[az]&&maze[az][ax]===0)continue;
        faces.push({x,z,di,nx,nz,h:r.h,style:r.style});
      }
    }
  }
  // 门洞两侧也要砌墙，否则会看到空腔
  for(const gt of gates){
    const gr=rooms[1];
    for(const [dx,dz,di,nx,nz] of D4){
      if(dx!==0)continue; // 东西方向是门洞，不砌墙
      faces.push({x:gt.x,z:gt.z,di,nx,nz,h:gr.h,style:gr.style});
    }
  }
  RL.wallFaces=faces;
  const wallModel=rlModelCache.modwall;
  if(!wallModel&&!rlModelFail.modwall){rlLoadQueuePush('modwall')}
  if(wallModel){
    const wb=new Map();
    const mA=rlGetModel('modwall'),mB=rlGetModel('modwindow'),mC=rlGetModel('modtorch'),mD=rlGetModel('modarch');
    for(const f of faces){
      let src=mA,pick=R();
      if(mB&&pick<.07)src=mB;
      else if(mC&&pick<.14)src=mC;
      else if(mD&&pick<.19)src=mD;
      if(!src)src=mA;
      const pos=rlWallTransform(f);
      src.position.set(pos[0],0,pos[1]);src.rotation.set(0,pos[2],0);src.scale.set(1,f.h/4,1);
      rlMergeAdd(wb,src);
      if(src===mC){RL.candles.push({x:f.x*T+T/2-f.nx*.5,z:f.z*T+T/2-f.nz*.5,y:f.h-2.4})}
    }
    rlMergeFlush(wb,sh,tint);
  }else{
    // 模型未加载时的兜底墙体：用程序化砖纹纹理，非纯色
    const wb=new Map(),fmat2=pbrMat('wall',1,2,{color:0x9a9084,roughness:.95,metalness:.02});
    for(const f of faces){
      const box=new THREE.Mesh(new THREE.BoxGeometry(T,1,.5),fmat2);
      const fc=rlWallFallbackCenter(f);
      box.position.set(fc[0],f.h/2,fc[1]);
      if(f.nx!==0)box.rotation.y=Math.PI/2;
      box.scale.y=f.h;
      rlMergeAdd(wb,box);
    }
    rlMergeFlush(wb,sh,null);
  }
  // 3.5) 四角补角柱：墙模块只沿临空面生成，房间四个外角会留下 0.5×0.5 的竖直缝隙
  {
    const cb=new Map(),cmat=pbrMat(th.w,1,2,{color:0x9a9084,roughness:.95});
    for(const r of rooms){
      const xs=[r.x1*T-.275,(r.x2+1)*T+.275],zs=[r.z1*T-.275,(r.z2+1)*T+.275];
      for(const px of xs)for(const pz of zs){
        const H2=r.h+.34;
        const box=new THREE.Mesh(new THREE.BoxGeometry(.55,H2,.55),cmat);
        box.position.set(px,H2/2-.02,pz);
        rlMergeAdd(cb,box);
      }
    }
    rlMergeFlush(cb,sh,null);
  }
  // 4) 天花板（露天房不生成）+ 横梁
  const beamMat=pbrMat(th.w,2,.3,{color:0x6a6258});
  for(const r of rooms){
    const cx=((r.x1+r.x2+1)/2)*T,cz=((r.z1+r.z2+1)/2)*T,w=(r.x2-r.x1+1)*T,d=(r.z2-r.z1+1)*T;
    if(r.ceil){
      const ce=new THREE.Mesh(new THREE.BoxGeometry(w,.35,d),pbrMat(th.w,2,2,{color:0x6a6258,emissive:new THREE.Color(th.fog).multiplyScalar(.12)}));
      ce.position.set(cx,r.h+.18,cz);sh.add(ce);
      const bb=new Map();
      for(let k=1;k<4;k++){
        const bm=new THREE.Mesh(new THREE.BoxGeometry(w,.35,.42),beamMat);
        bm.position.set(cx,r.h-.05,r.z1*T+d*k/4);rlMergeAdd(bb,bm);
      }
      rlMergeFlush(bb,sh,null);
    }
  }
  // 5) 半嵌墙面的柱子（不挡路）
  if(rlModelCache.modpillar){
    const pb=new Map(),pil=rlGetModel('modpillar'),pilb=rlGetModel('modpillarbroken');
    for(let k=0;k<faces.length;k+=5){
      const f=faces[k];
      const src=(f.style==='court'&&R()<.45&&pilb)?pilb:pil;
      if(!src)continue;
      src.position.set((f.x+.5)*T+f.nx*2.0,0,(f.z+.5)*T+f.nz*2.0);
      src.rotation.set(0,0,0);src.scale.set(1,f.h/4,1);
      rlMergeAdd(pb,src);
    }
    rlMergeFlush(pb,sh,tint);
  }
  // 6) 露天中庭的残破阶梯（对应 maze 里的障碍格）
  if(RL.courtStair&&rlModelCache.modstairs){
    const st=rlGetModel('modstairs');
    if(st){const [sx,sz]=RL.courtStair;st.position.set(sx*T,0,(sz+1)*T);st.rotation.set(0,Math.PI,0);st.scale.set(1,.8,1);
      const sb=new Map();rlMergeAdd(sb,st);rlMergeFlush(sb,sh,tint)}
  }
  // 7) 场景光源：跟随离玩家最近的骨烛 / 火盆
  if(!RL.lights){RL.lights=[0,1,2].map(()=>{const l=new THREE.PointLight(th.c,.9,16);scene.add(l);return l})}
  RL.lights.forEach(l=>{l.color.setHex(th.c);l.distance=16});
  if(!RL.torchLight){RL.torchLight=new THREE.PointLight(0xffcf8a,3.0,20,1.4);scene.add(RL.torchLight)}
  RL.shellCandles=RL.candles.slice();
  RL.openSky=rooms.some(r=>!r.ceil);
  skyG.visible=RL.openSky;
  if(RL.openSky)rlSkyDay();
}
function rlWallTransform(f){
  switch(f.di){
    case 0:return [f.x*T,f.z*T,0];
    case 1:return [(f.x+1)*T,(f.z+1)*T,Math.PI];
    case 2:return [f.x*T,(f.z+1)*T,Math.PI/2];
    default:return [(f.x+1)*T,f.z*T,-Math.PI/2];
  }
}
function rlWallFallbackCenter(f){
  switch(f.di){
    case 0:return [(f.x+.5)*T,f.z*T-.25];
    case 1:return [(f.x+.5)*T,(f.z+1)*T+.25];
    case 2:return [f.x*T-.25,(f.z+.5)*T];
    default:return [(f.x+1)*T+.25,(f.z+.5)*T];
  }
}
/* ---------- 房间道具装饰 ---------- */
// baseY：道具底部的世界高度（用于壁挂火把、悬挂铁链等非落地物体）
function rlPlaceProp(key,wx,wz,targetH,rotY,baseY){
  const m=rlGetModel(key);if(!m)return null;
  const sz=m.userData.size;if(!sz||sz.y<.01)return null;
  const s=targetH/sz.y;
  m.scale.setScalar(s);
  const ctr=m.userData.center;
  m.position.set(wx,(baseY||0)-ctr.y*s+targetH/2,wz);
  if(rotY)m.rotation.y=rotY;
  m.name='prop_'+key;
  (RL.deco||rlGroup).add(m);
  return m;
}
// 露天刑场的木制绞架：铁链必须挂在横梁上，不能凭空悬在半空
let rlWoodMat=null;
function rlGallows(x,z,topY){
  if(!rlWoodMat)rlWoodMat=pbrMat('door',1,3,{color:0x6d5238,roughness:.95});
  const g=new THREE.Group();
  const add=(w,h,d,px,py,pz)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),rlWoodMat);b.position.set(px,py,pz);g.add(b)};
  add(.26,topY,.26,x-1.25,topY/2,z);
  add(.26,topY,.26,x+1.25,topY/2,z);
  add(2.9,.3,.3,x,topY-.15,z);
  add(2.3,.14,.14,x,.5,z); // 底部横撑，落地不悬空
  (RL.deco||rlGroup).add(g);
  return topY-.3; // 横梁底面高度
}
// 重新布置全部已生成房间（GLB 迟到时补上真实道具）
function rlRebuildDeco(){
  if(!RL.deco)return;
  while(RL.deco.children.length){const o=RL.deco.children[0];RL.deco.remove(o)}
  RL.candles=(RL.shellCandles||[]).slice();
  const rooms=RL.rooms||[];
  for(let ri=0;ri<rooms.length;ri++)if(RL.roomSpawned[ri])rlDecorateRoom(ri,rooms[ri]);
}
function rlDecorateRoom(ri,r){
  if(!RL.deco){RL.deco=new THREE.Group();rlGroup.add(RL.deco)}
  const R=Math.random;
  // 按每间房的真实边界布置，而不是固定坐标
  const W=r.x1*T,E=(r.x2+1)*T,N=r.z1*T,S=(r.z2+1)*T;
  const CX=(W+E)/2,CZ=(N+S)/2;
  const put=(key,x,z,h,rot,baseY)=>rlPlaceProp(key,x,z,h,rot,baseY);
  // 让道具背面严丝合缝贴到墙内表面，避免离墙悬空
  const snapW=(m,wallX)=>{if(!m)return m;m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m);m.position.x+=wallX-b.min.x;return m};
  const snapE=(m,wallX)=>{if(!m)return m;m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m);m.position.x+=wallX-b.max.x;return m};
  const cnd=(x,z,y)=>{RL.candles=RL.candles||[];RL.candles.push({x,z,y:y||1.6})};
  if(ri===0){
    // 封闭墓穴：石棺贴墙、骸骨散落、壁挂火把
    put('coffin',W+2.4,N+7,1.15,Math.PI/2);
    put('coffin',W+2.4,N+17,1.15,Math.PI/2);
    put('coffin',E-2.4,S-9,1.15,Math.PI/2);
    put('coffin_lid',W+1.2,N+12.5,1.0,Math.PI/2);
    put('bonepile',E-3.4,N+4.5,.58,R()*6);
    put('bonepile',W+3.2,S-4.5,.62,R()*6);
    put('skeleton',W+3.6,S-10,.72,R()*6);
    put('skeleton',E-3.2,N+12,.7,R()*6);
    put('skeleton',CX+5,S-4.2,.72,R()*6);
    for(let k=0;k<5;k++)put('skull',W+5+R()*(E-W-10),N+5+R()*(S-N-10),.26,R()*6);
    put('rubble',W+2.6,CZ-2.5,.66,R()*6);
    put('rubble',E-2.6,CZ+3,.6,R()*6);
    put('rubble',CX-4,N+3.4,.55,R()*6);
    for(let k=0;k<3;k++){const z=N+9+k*12;const m=put('walltorch',W+.6,z,.85,Math.PI/2,1.95);snapW(m,W);cnd(W+.55,z,2.7)}
    for(let k=0;k<2;k++){const z=N+13+k*13;const m=put('walltorch',E-.6,z,.85,-Math.PI/2,1.95);snapE(m,E);cnd(E-.55,z,2.7)}
    put('crate',E-2.2,S-2.2,.85,R()*6);
    put('dc1_crate',E-3.6,S-3.6,.8,R()*6);
    put('pot',W+2.2,N+2.4,.52,0);
    put('pot',W+2.9,N+3.2,.44,0);
    put('bench',CX,N+2.6,.55,0);
  }else if(ri===1){
    // 露天刑场：铁笼、尖刺、镣铐、吊链、木桶木箱
    put('cage',W+6,N+9.5,2.3,R()*6);
    put('cage',E-6,N+9.5,2.3,R()*6);
    put('cage',W+6,S-9,2.2,R()*6);
    put('spike',CX-7,N+5,.45,Math.PI/4);
    put('spike',CX+6,S-5,.45,-Math.PI/4);
    put('spike',E-9,S-7,.45,R()*6);
    put('spike',W+11,S-3.5,.45,R()*6);
    // 吊链挂在木制绞架横梁上，链顶与横梁底面接触，不再悬空
    for(let k=0;k<4;k++){
      const x=W+9+k*7.5,z=N+7+(k%2)*2.2;
      const beamB=rlGallows(x,z,5.6),len=3.4;
      put('chain',x,z,len,R()*6,beamB-len);
    }
    put('shackles',W+3.2,CZ+3,.8,Math.PI/2);
    put('shackles',E-3.2,CZ-3,.8,-Math.PI/2);
    put('barrel',W+2.4,N+2.6,.95,0);
    put('barrel',W+2.4,N+4.0,.95,0);
    put('barrel',E-2.4,S-3.4,.9,0);
    put('sack',E-2.6,S-2.4,.62,R()*6);
    put('sack',W+3.4,S-2.6,.58,R()*6);
    put('crate',W+5.2,S-2.6,.85,R()*6);
    put('table',W+4.2,CZ+9,.75,R()*6);
    put('bench',W+4.2,CZ+11.4,.55,R()*6);
    put('weaponrack',E-2.2,CZ+6,1.05,-Math.PI/2);
    put('bonepile',CX+9,N+3.4,.55,R()*6);
    put('rubble',E-2.6,N+2.6,.62,R()*6);
    put('rubble',CX-10,S-3.2,.6,R()*6);
    snapE(put('dc1_door',E-.7,N+11,2.4,-Math.PI/2),E); // 废门贴东墙立着
    put('pot',W+2.2,CZ-6,.52,0);
  }else{
    // 高层神殿（BOSS 房）：四角火盆、武器架、宝箱、骨堆
    const bz=[N+7,S-7];
    for(const z of bz)for(const x of [W+6,E-6]){put('brazier',x,z,1.7,0);cnd(x,z,2.2)}
    put('dc1_brazier',CX-3.2,N+9,1.5,0);cnd(CX-3.2,N+9,2.0);
    put('dc1_brazier',CX+3.2,N+9,1.5,0);cnd(CX+3.2,N+9,2.0);
    put('weaponrack',W+1.9,CZ,1.1,Math.PI/2);
    put('weaponrack',E-1.9,CZ,1.1,-Math.PI/2);
    put('weaponrack',W+1.9,N+18,1.1,Math.PI/2);
    put('chest',CX,S-4.5,.8,Math.PI);
    put('chest',E-3.2,N+4,.75,R()*6);
    put('bonepile',W+4.2,N+4.2,.6,R()*6);
    put('bonepile',E-4.2,S-4.2,.58,R()*6);
    put('rubble',CX-8,S-7,.68,R()*6);
    put('rubble',CX+8,N+6,.65,R()*6);
    for(let k=0;k<4;k++)put('skull',CX-4+R()*8,N+12+R()*10,.26,R()*6);
    put('spike',CX-6,CZ+9,.45,Math.PI/4);
    put('spike',CX+6,CZ-9,.45,-Math.PI/4);
    put('bench',W+2.6,CZ+9,.55,0);
    put('pot',E-2.2,N+2.6,.52,0);
    put('pot',E-2.9,N+3.4,.44,0);
    put('coffin',W+2.4,N+24,1.15,Math.PI/2);
  }
}
function rlOpenGate(index){const gate=RL.gates[index];if(!gate||gate.open)return;gate.open=true;gate.group.visible=false;maze[gate.z][gate.x]=0;}
function rlRoomProgress(){
  if(!RL.active||RL.dead)return;
  const alive=RL.enemies.some(e=>!e.dead&&!e.dormant&&e.roomId===RL.room);
  if(!alive&&!RL.roomCleared){
    RL.roomCleared=true;
    if(RL.room<3){rlOpenGate(RL.room-1);toast('房间 '+RL.room+' 已清空！通往下一个房间的门已开启');rlSfx('win')}
    else{RL.altarReady=true;RL.floorCleared=true;if(RL.altar)RL.altar.g.visible=true;toast('最终房间清空！轮回祭坛已开启');rlSfx('win')}
  }
  const rooms=RL.rooms||RL_ROOM_TPL;
  const next=RL.room===1?rooms[0].x2+1.35:RL.room===2?rooms[1].x2+1.35:Infinity;
  if(RL.room<3&&RL.roomCleared&&P.x/T>next){
    RL.room++;RL.roomCleared=false;
    RL.enemies.forEach(e=>{if(e.roomId===RL.room){e.dormant=false;e.g.visible=true;e.riseT=.8;e.reactT=.35+Math.random()*.5;e.faceT=.3+Math.random()*.3;e.faceTarget=e.g.rotation.y}});
    toast('进入房间 '+RL.room+'/3');rlUpdateHUD();
  }
}
function rlTheme(th){
  scene.background.setHex(th.bg);scene.fog.color.setHex(th.fog);
  scene.fog.near=2.5;scene.fog.far=RL.bossSpawned?70:62;
  hemi.intensity=1.25;hemi.color.setHex(th.amb);sun.intensity=.72;lamp.intensity=.8;
  gHemi.intensity=1.1;gDir.intensity=1.0;spot.intensity=1.35;spot.distance=36;
  if(RL.torchLight){RL.torchLight.color.setHex(th.c);RL.torchLight.intensity=3.0;RL.torchLight.distance=20}
  if(RL.ambient){RL.ambient.color.setHex(th.amb)}
}
function rlEnv(t){
  const th=RLTHEME[(RL.floor-1)%RLTHEME.length];
  scene.background.setHex(th.bg);scene.fog.color.setHex(th.fog);
  const flick=.82+Math.sin(t*17+(RL.floor||0))*0.06+Math.random()*.06;
  if(RL.lights){
    const cs=(RL.candles||[]).slice().sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z)).slice(0,3);
    RL.lights.forEach((L,i)=>{
      const n=cs[i];
      if(n){L.position.set(n.x,1.9,n.z);L.intensity=1.65*flick;L.distance=22;L.color.setHex(th.c)}
      else L.intensity=0;
    });
  }
  if(RL.altarLight)RL.altarLight.intensity=(RL.altarReady?1.5:0.55)*(0.85+Math.sin(t*3)*.12);
  if(RL.torchLight){RL.torchLight.intensity=3.0+Math.sin(t*9)*.12;RL.torchLight.distance=20}
  if(hemi)hemi.intensity=1.25;if(sun)sun.intensity=.72;gHemi.intensity=1.1;gDir.intensity=1.0;lamp.intensity=.8;spot.intensity=1.35;spot.distance=36;scene.fog.near=2.5;scene.fog.far=RL.bossSpawned?70:62;
  if(RL.openSky)rlSkyDay();
}
function rlBuildAltar(i,j){
  const g=new THREE.Group();g.position.set((i+.5)*T,0,(j+.5)*T);rlGroup.add(g);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.75,2.05,.34,10),pbrMat('wall',1.4,.4,{color:0xb8ab9a}));base.position.y=.17;g.add(base);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.62,.12,8,26),new THREE.MeshStandardMaterial({color:0x2a1a3a,metalness:.7,roughness:.35,emissive:0x3a1060,emissiveIntensity:.7}));rim.rotation.x=Math.PI/2;rim.position.y=.36;g.add(rim);
  const rune=new THREE.Mesh(new THREE.RingGeometry(1.05,1.55,28),new THREE.MeshBasicMaterial({color:0x9a4bff,transparent:true,opacity:.35,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));rune.rotation.x=-Math.PI/2;rune.position.y=.38;g.add(rune);
  // 四根石柱 + 紫色符文
  for(let k=0;k<4;k++){
    const a=k*Math.PI/2+.4,px=Math.cos(a)*1.5,pz=Math.sin(a)*1.5;
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,1.6,8),pbrMat('wall',.4,1.2,{color:0x9a8f80}));col.position.set(px,.8+.34,pz);g.add(col);
    const glyph=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.12),new THREE.MeshBasicMaterial({color:0xc06bff,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));glyph.position.set(px,.95+.34,pz);g.add(glyph);
  }
  const st=mkSixStar(.6);st.position.y=1.5;g.add(st);
  const haze=new THREE.Mesh(new THREE.CylinderGeometry(.55,1.1,2.4,10,1,true),new THREE.MeshBasicMaterial({color:0x8a3aff,transparent:true,opacity:.12,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));haze.position.y=1.5;g.add(haze);
  const L=new THREE.PointLight(0x9a4bff,1,14);L.position.y=1.9;g.add(L);
  RL.altar={g,star:st,rune,haze};RL.altarLight=L;RL.altarPos={x:(i+.5)*T,z:(j+.5)*T};
  RL.altar.x=RL.altarPos.x;RL.altar.z=RL.altarPos.z;
}
function rlExplore(dt){
  for(let n=RL.stars.length-1;n>=0;n--){
    const s=RL.stars[n];
    if((!s.roomId||s.roomId===RL.room)&&Math.hypot(s.g.position.x-P.x,s.g.position.z-P.z)<1.25){
      rlGroup.remove(s.g);RL.stars.splice(n,1);
      const v=Math.round((8+RL.floor*2)*RL.coinMul);
      RL.coins+=v;RL.totalCoins+=v;rlSfx('pick');toast('拾取星辉 +'+v+' 🪙');
    }
  }
  if(RL.altar){
    const dd=Math.hypot(RL.altarPos.x-P.x,RL.altarPos.z-P.z);
    const pr=$('rlprompt');
    if(RL.altarReady&&dd<3&&!RL.shopOpen){pr.classList.remove('hide');pr.textContent='⛩ 点击此处开启祭坛商店';}
    else pr.classList.add('hide');
    if(RL.altarReady&&dd<3){RL.altar.rune.material.opacity=.5+Math.sin(performance.now()/240)*.2}
  }
}
function mkSixStar(size){
  const sh=new THREE.Shape();
  for(let i=0;i<12;i++){const r=i%2?size*.44:size,a=i*Math.PI/6-Math.PI/2,x=Math.cos(a)*r,y=Math.sin(a)*r;i?sh.lineTo(x,y):sh.moveTo(x,y)}
  sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:size*.2,bevelEnabled:true,bevelSize:size*.05,bevelThickness:size*.04,bevelSegments:2});
  geo.center();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xffcf4a,metalness:1,roughness:.24,emissive:0x8a5400,emissiveIntensity:.7}));
  m.userData.keep=1;m.userData.keepMat=1;
  const halo=new THREE.Mesh(new THREE.SphereGeometry(size*1.35,10,8),new THREE.MeshBasicMaterial({color:0xffcf5a,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false}));m.add(halo);
  return m;
}
/* ---------- 肉鸽场景装饰：5 类墙面主题 × 8 类装饰物 ---------- */
function rlDecor(walls,floors,th){
  const cx=i=>(i+.5)*T,rg=Math.random,mx=(a,b)=>a+rg()*(b-a);
  const inst=(geo,mat,list,fn)=>{if(!list.length)return;const m=new THREE.InstancedMesh(geo,mat,list.length),d=new THREE.Object3D(),c=new THREE.Color();
    list.forEach((it,k)=>{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.set(1,1,1);c.set(0xffffff);fn(it,d,c);d.updateMatrix();m.setMatrixAt(k,d.matrix);m.setColorAt(k,c)});rlGroup.add(m);return m};
  // 1 石柱
  const pl=walls.filter(([i,j])=>i%3===1&&j%3===1&&!(i<3&&j<3));
  inst(new THREE.CylinderGeometry(.52,.62,H,12),pbrMat(th.w,2,1,{color:0xb8b0a4}),pl,([i,j],d)=>{d.position.set(cx(i),H/2,cx(j))});
  // 2 顶部横梁
  inst(new THREE.BoxGeometry(T+.16,.3,T+.16),pbrMat(th.w,2,.3,{color:0x8a8478}),walls,([i,j],d)=>{d.position.set(cx(i),H-.05,cx(j))});
  // 3 垂落铁链
  const chains=[];for(const [i,j] of walls){if(rg()<.06){const x=cx(i)+mx(-1.4,1.4),z=cx(j)+mx(-1.4,1.4),n=3+(rg()*4|0);for(let k=0;k<n;k++)chains.push({x,z,y:H-.2-k*.26})}}
  inst(new THREE.TorusGeometry(.1,.028,4,10),new THREE.MeshStandardMaterial({color:0x3a3a40,metalness:.9,roughness:.45}),chains,(c,d)=>{d.position.set(c.x,c.y,c.z);d.rotation.set(0,0,0);d.rotation.x=Math.PI/2;d.rotation.z=c.y*3});
  // 4 骨堆（头骨+股骨）
  const bones=floors.filter(()=>rg()<.12).map(([i,j])=>({x:cx(i)+mx(-1.3,1.3),z:cx(j)+mx(-1.3,1.3),r:rg()*6,s:mx(.7,1.2)}));
  inst(new THREE.DodecahedronGeometry(.24,0),new THREE.MeshStandardMaterial({color:0xc9c0a4,roughness:.75}),bones,(b,d)=>{d.position.set(b.x,.22*b.s,b.z);d.scale.set(b.s,b.s*.85,b.s);d.rotation.y=b.r});
  inst(new THREE.CylinderGeometry(.045,.045,.76,6),new THREE.MeshStandardMaterial({color:0xb8ae92,roughness:.8}),bones.map(b=>({...b,r:rg()*6})),(b,d)=>{d.position.set(b.x+.3,.16,b.z);d.rotation.set(Math.PI/2,b.r,0)});
  // 5 牢笼铁栏
  const cages=floors.filter(()=>rg()<.05).map(([i,j])=>({x:cx(i)+mx(-1,1),z:cx(j)+mx(-1,1),r:rg()*6}));
  inst(new THREE.BoxGeometry(.07,2.1,.07),new THREE.MeshStandardMaterial({color:0x4a4a52,metalness:.85,roughness:.5}),cages.flatMap(c=>[0,1,2,3].map(k=>({...c,a:k*Math.PI/2}))),(c,d)=>{const a=c.a,r=.6;d.position.set(c.x+Math.cos(a)*r,1.05,c.z+Math.sin(a)*r);d.rotation.y=c.r});
  inst(new THREE.TorusGeometry(.6,.05,6,14),new THREE.MeshStandardMaterial({color:0x55555e,metalness:.85,roughness:.5}),cages,(c,d)=>{d.position.set(c.x,2.05,c.z);d.rotation.x=Math.PI/2});
  // 6 骨烛（提供摇曳光源）
  const cand=floors.filter(()=>rg()<.14).map(([i,j])=>({x:cx(i)+mx(-1.5,1.5),z:cx(j)+mx(-1.5,1.5),r:rg()*6,s:mx(.8,1.3)}));
  RL.candles=cand.slice(0,24);
  inst(new THREE.CylinderGeometry(.05,.07,.5,7),new THREE.MeshStandardMaterial({color:0xd8cdb4,roughness:.7}),cand,(c,d)=>{d.position.set(c.x,.25*c.s,c.z);d.scale.setScalar(c.s)});
  inst(new THREE.ConeGeometry(.055,.16,6),new THREE.MeshBasicMaterial({color:0xffb45a}),cand,(c,d)=>{d.position.set(c.x,.58*c.s,c.z)});
  // 7 木箱与酒桶
  const cr=floors.filter(()=>rg()<.08).map(([i,j])=>({x:cx(i)+mx(-1.4,1.4),z:cx(j)+mx(-1.4,1.4),r:rg()*6,s:mx(.7,1.15)}));
  inst(new THREE.BoxGeometry(.78,.7,.78),pbrMat('door',.5,.5,{color:0x9a7a52}),cr,(c,d)=>{d.position.set(c.x,.35*c.s,c.z);d.scale.setScalar(c.s);d.rotation.y=c.r});
  inst(new THREE.CylinderGeometry(.34,.34,.8,10),pbrMat('door',.4,.5,{color:0x7a5a3a}),cr.filter(()=>rg()<.5),(c,d)=>{d.position.set(c.x+.9,.4,c.z);d.rotation.y=c.r});
  // 8 符文石板
  const slabs=floors.filter(()=>rg()<.07).map(([i,j])=>({x:cx(i)+mx(-1,1),z:cx(j)+mx(-1,1),r:rg()*6}));
  inst(new THREE.BoxGeometry(1.3,.08,1.3),pbrMat('wall',.8,.08,{color:0x6a6470}),slabs,(c,d)=>{d.position.set(c.x,.04,c.z);d.rotation.y=c.r});
  inst(new THREE.BoxGeometry(.9,.012,.9),new THREE.MeshBasicMaterial({color:0x6a3aff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}),slabs,(c,d)=>{d.position.set(c.x,.09,c.z);d.rotation.y=c.r});
  // 光源：3 盏跟随最近骨烛的灯 + 玩家手持微光
  if(!RL.lights){RL.lights=[0,1,2].map(()=>{const l=new THREE.PointLight(th.c,.8,12);scene.add(l);return l})}
  RL.lights.forEach(l=>{l.color.setHex(th.c);l.distance=12});
  if(!RL.torchLight){RL.torchLight=new THREE.PointLight(0xffcf8a,3.0,20,1.4);scene.add(RL.torchLight)}
}
/* ---------- 怨魂模型 ---------- */
function mkShade(){
  const g=new THREE.Group();
  const robe=new THREE.MeshStandardMaterial({color:0x1c1726,roughness:.96,metalness:0,emissive:0x140a24,emissiveIntensity:.75,side:THREE.DoubleSide,transparent:true,opacity:.94});
  const skin=new THREE.MeshStandardMaterial({color:0x8b9498,roughness:.9,metalness:0});
  const eyeM=new THREE.MeshBasicMaterial({color:0x7dffea});
  const body=new THREE.Mesh(new THREE.ConeGeometry(.56,1.5,9,1,true),robe);body.position.y=.78;g.add(body);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(.32,10,8,0,6.283,0,2.1),robe);hood.position.y=1.62;g.add(hood);
  const face=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),skin);face.position.set(0,1.6,.16);g.add(face);
  const eyes=[];
  [-.075,.075].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.035,7,6),eyeM);e.position.set(x,1.64,.3);g.add(e);eyes.push(e)});
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.1,.06,.02),new THREE.MeshBasicMaterial({color:0x09060c}));mouth.position.set(0,1.52,.3);g.add(mouth);
  const armM=new THREE.MeshStandardMaterial({color:0xb0b8b8,roughness:.9});
  [-1,1].forEach(s=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.85,6),armM);a.position.set(s*.42,1.15,.08);a.rotation.z=s*.55;a.rotation.x=-.5;g.add(a);
    const h=new THREE.Mesh(new THREE.SphereGeometry(.1,7,6),armM);h.position.set(s*.64,.78,.36);g.add(h)});
  for(let k=0;k<3;k++){const w=new THREE.Mesh(new THREE.CylinderGeometry(.03,.09,1.2,5),robe);w.position.set((rg1()-.5)*.6,.35,(rg1()-.5)*.6);w.rotation.z=(rg1()-.5)*.6;g.add(w)}
  g.userData.mats=[robe,skin,armM];
  return {g,body,eye:eyeM,eyes,mats:[robe,skin,armM]};
}
function mkLWraith(){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0x9aa39a,roughness:.86,metalness:0});
  const cloth=new THREE.MeshStandardMaterial({color:0x2c2a2e,roughness:.95,metalness:0});
  const eyeM=new THREE.MeshBasicMaterial({color:0xff3b2a});
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,1),skin);body.scale.set(.78,1.25,.62);body.position.y=1.42;g.add(body);
  const rib=new THREE.MeshStandardMaterial({color:0xc9c2aa,roughness:.7});
  for(let k=0;k<4;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(.21-.02*k,.018,4,10,Math.PI),rib);r.position.set(0,1.12+k*.13,.14);r.rotation.z=Math.PI;g.add(r)}
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.22,1),skin);head.scale.set(.85,1.1,.9);head.position.set(0,1.9,.04);g.add(head);
  const eyes=[];
  [-.075,.075].forEach(x=>{const e=new THREE.Mesh(new THREE.OctahedronGeometry(.05),eyeM);e.position.set(x,1.94,.19);g.add(e);eyes.push(e)});
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.2,.08,.12),new THREE.MeshStandardMaterial({color:0x120e10}));jaw.position.set(0,1.78,.17);g.add(jaw);
  for(let k=0;k<5;k++){const t=new THREE.Mesh(new THREE.ConeGeometry(.014,.06,4),rib);t.position.set(-.075+k*.037,1.82,.21);t.rotation.x=Math.PI;g.add(t)}
  [-1,1].forEach(s=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.036,.05,1.05,6),skin);a.position.set(s*.38,1.15,.02);a.rotation.z=s*.24;g.add(a);
    for(let c=0;c<3;c++){const cl=new THREE.Mesh(new THREE.ConeGeometry(.02,.2,5),new THREE.MeshStandardMaterial({color:0xe8e0cc,roughness:.6}));cl.position.set(s*.45+c*.05,.56,.06);cl.rotation.x=Math.PI;g.add(cl)}});
  [-1,1].forEach(s=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.9,6),cloth);l.position.set(s*.17,.45,0);g.add(l)});
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(.42,.72,7,1,true),cloth);skirt.position.y=.78;g.add(skirt);
  g.userData.mats=[skin,cloth,rib];
  return {g,body,eye:eyeM,eyes,mats:[skin,cloth,rib]};
}
function rg1(){return Math.random()}
/* ===== 普通怪：蜘蛛头颅 ===== */
function mkSpider(){
  const g=new THREE.Group();
  const shell=new THREE.MeshStandardMaterial({color:0x2a1018,roughness:.85,metalness:.1,emissive:0x3a0a12,emissiveIntensity:.5});
  const hair=new THREE.MeshStandardMaterial({color:0x1a0c12,roughness:.95});
  const eyeM=new THREE.MeshBasicMaterial({color:0xff3a2a});
  // 头壳
  const head=new THREE.Mesh(new THREE.SphereGeometry(.42,12,10),shell);head.scale.set(1.1,.85,1.2);head.position.y=.55;g.add(head);
  // 八眼
  const eyes=[];
  [[-.14,.62,.34,-.18],[.14,.62,.34,.18],[-.1,.66,.38,0],[.1,.66,.38,0],[-.16,.55,.3,-.32],[.16,.55,.3,.32],[-0,.5,.42,0],[-.12,.48,.34,-.1],[.12,.48,.34,.1]].forEach(p=>{
    const e=new THREE.Mesh(new THREE.SphereGeometry(.028,7,6),eyeM);e.position.set(p[0],p[1],p[2]);g.add(e);eyes.push(e);
  });
  // 螯肢
  [-1,1].forEach(s=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.04,.18,5),new THREE.MeshStandardMaterial({color:0xc8b890,roughness:.6}));f.position.set(s*.12,.42,.44);f.rotation.x=.7;g.add(f)});
  // 八条腿
  for(let k=0;k<8;k++){const a=k*Math.PI/4,side=k<4?-1:1;const l=new THREE.Mesh(new THREE.CylinderGeometry(.025,.018,.7,5),hair);
    const lx=Math.cos(a)*.35*side,ly=.4,la=Math.cos(a)*.9;l.position.set(lx,ly,la*.3);l.rotation.set(-.6,a*.4,side*.8);g.add(l);
    const j=new THREE.Mesh(new THREE.CylinderGeometry(.018,.012,.45,5),hair);j.position.set(lx+side*.18,.12,la*.55);j.rotation.set(-1.2,a*.3,side*.3);g.add(j)}
  g.userData.mats=[shell,hair];
  return {g,body:head,eye:eyeM,eyes,mats:[shell,hair]};
}
/* ===== 精英怪：银龙（占位） ===== */
function mkSilver(){
  const g=new THREE.Group();
  const scale=new THREE.MeshStandardMaterial({color:0xc8d4e0,metalness:.85,roughness:.28,emissive:0x2a3a55,emissiveIntensity:.5});
  const belly=new THREE.MeshStandardMaterial({color:0xe8eef4,metalness:.6,roughness:.4});
  const eyeM=new THREE.MeshBasicMaterial({color:0x88ddff});
  // 躯干（r128 没有 CapsuleGeometry，用圆柱+两端球体拼合）
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.1,10),scale);body.position.y=1.5;g.add(body);
  [-1,1].forEach(s=>{const cap=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),scale);cap.position.set(0,1.5+s*.55,0);g.add(cap)});
  // 头颈
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,.7,8),scale);neck.position.set(0,2.3,.1);neck.rotation.x=.3;g.add(neck);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,1),scale);head.scale.set(.9,1,1.3);head.position.set(0,2.75,.25);g.add(head);
  // 双角
  [-1,1].forEach(s=>{const h=new THREE.Mesh(new THREE.ConeGeometry(.07,.32,6),new THREE.MeshStandardMaterial({color:0xf0f4fa,metalness:.5,roughness:.3}));h.position.set(s*.14,3.05,-.05);h.rotation.z=s*.4;g.add(h)});
  // 眼
  const eyes=[];
  [-.13,.13].forEach(x=>{const e=new THREE.Mesh(new THREE.OctahedronGeometry(.06),eyeM);e.position.set(x,2.78,.55);g.add(e);eyes.push(e)});
  // 双翼（膜）
  [-1,1].forEach(s=>{const w=new THREE.Mesh(new THREE.ConeGeometry(.5,1.6,4,1,true),new THREE.MeshStandardMaterial({color:0x9aaec0,metalness:.4,roughness:.5,side:THREE.DoubleSide,transparent:true,opacity:.85}));w.position.set(s*.6,1.9,0);w.rotation.set(.3,0,s*1.1);w.scale.set(1,.6,1);g.add(w)});
  // 尾
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.9,6),scale);tail.position.set(0,1.05,-.8);tail.rotation.x=-.7;g.add(tail);
  const aura=new THREE.PointLight(0x88c8ff,.7,8);aura.position.y=2;g.add(aura);
  g.userData.mats=[scale,belly];
  return {g,body,eye:eyeM,eyes,mats:[scale,belly]};
}
/* ===== 精英怪：千手（占位） ===== */
function mkThousand(){
  const g=new THREE.Group();
  const robe=new THREE.MeshStandardMaterial({color:0x6a2a2a,roughness:.9,metalness:.1,emissive:0x4a1010,emissiveIntensity:.4,side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:0xd8b44a,metalness:.85,roughness:.3});
  const skin=new THREE.MeshStandardMaterial({color:0xc8a890,roughness:.8});
  const eyeM=new THREE.MeshBasicMaterial({color:0xffcc33});
  // 底座莲台
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.9,.95,.3,12),gold);base.position.y=.15;g.add(base);
  // 主身
  const body=new THREE.Mesh(new THREE.ConeGeometry(.6,2.2,10,1,true),robe);body.position.y=1.5;g.add(body);
  // 多头
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),skin);head.scale.set(.85,1.1,.9);head.position.set(0,2.75,0);g.add(head);
  const eyes=[];
  [-.08,.08].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.035,7,6),eyeM);e.position.set(x,2.8,.28);g.add(e);eyes.push(e)});
  // 冠
  const crown=new THREE.Mesh(new THREE.ConeGeometry(.34,.2,6),gold);crown.position.set(0,3.05,0);g.add(crown);
  // 多臂（环绕）
  for(let k=0;k<10;k++){const a=k*Math.PI*2/10;const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,1.1,6),robe);
    const ax=Math.cos(a)*.55,az=Math.sin(a)*.55;arm.position.set(ax,2.0,az);arm.rotation.set(Math.sin(a)*.5,a,-Math.cos(a)*.5);g.add(arm);
    const palm=new THREE.Mesh(new THREE.SphereGeometry(.09,7,6),skin);palm.position.set(ax+Math.cos(a)*.5,1.7,az+Math.sin(a)*.5);g.add(palm);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.03,6,5),eyeM);eye.position.set(ax+Math.cos(a)*.55,1.75,az+Math.sin(a)*.55);g.add(eye);eyes.push(eye)}
  const aura=new THREE.PointLight(0xffaa33,.8,9);aura.position.y=2;g.add(aura);
  g.userData.mats=[robe,gold,skin];
  return {g,body,eye:eyeM,eyes,mats:[robe,gold,skin]};
}
function mkBoss(key){
  const g=new THREE.Group(),mats=[];
  const M=(c,m,r,e)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r,emissive:e||0,emissiveIntensity:e?.9:0});
  const A=(geo,mt,x,y,z,rx,ry,rz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);g.add(o);if(mt)mats.push(mt);return o};
  const skin=M(0x6b7a4a,0,.92),bone=M(0xd8d0b2,0,.7),dark=M(0x0e0a0c,0,.95),eyeM=new THREE.MeshBasicMaterial({color:0xff2a20});
  if(key==='rot'){
    A(new THREE.IcosahedronGeometry(.95,1),skin,0,1.5,0,0,0,0).scale.set(1.15,1.25,1.05);
    A(new THREE.IcosahedronGeometry(.62,1),skin,0,1.05,.15).scale.set(1.1,.85,.9);
    A(new THREE.IcosahedronGeometry(.42,1),skin,0,2.42,.05).scale.set(.9,1,.95);
    for(let k=0;k<7;k++){const a=k*Math.PI*2/7;A(new THREE.ConeGeometry(.1,.45,5),bone,Math.cos(a)*.3,2.78,Math.sin(a)*.3,.2,0,0)}
    [-.15,.15].forEach(x=>{A(new THREE.OctahedronGeometry(.09),eyeM,x,2.46,.36).scale.set(1.3,1.5,.8);A(new THREE.SphereGeometry(.1,7,6),new THREE.MeshBasicMaterial({color:0xff1a10,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}),x,2.46,.4)});
    A(new THREE.BoxGeometry(.44,.2,.18),dark,0,2.2,.36,.3,0,0);
    for(let k=0;k<6;k++){const t=new THREE.Mesh(new THREE.ConeGeometry(.03,.14,4),bone);t.position.set(-.17+k*.068,2.28,.42);t.rotation.x=Math.PI;g.add(t);mats.push(bone)}
    for(let k=0;k<14;k++){const a=Math.random()*6.28,y=mx2(1.1,2.2),r=.8;A(new THREE.SphereGeometry(.09,8,6),new THREE.MeshStandardMaterial({color:0x9ab060,emissive:0x4a6a20,emissiveIntensity:.8,roughness:.6}),Math.cos(a)*r,y,Math.sin(a)*r)}
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.13,.18,1.25,7),skin,s*.85,1.45,.05,0,0,s*.3);A(new THREE.SphereGeometry(.2,8,6),skin,s*1.02,.92,.1)});
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.16,.2,.7,7),skin,s*.36,.38,0);A(new THREE.BoxGeometry(.32,.18,.46),skin,s*.36,.1,.12)});
    const aura=new THREE.PointLight(0x7aff6a,.8,9);aura.position.set(0,1.9,0);g.add(aura);
  }else if(key==='brood'){
    const skinM=M(0xb8a6b0,0,.88),hairM=M(0x0a0609,0,.95),redM=M(0x6a0a18,0,.8);
    A(new THREE.IcosahedronGeometry(.6,1),skinM,0,2.35,0).scale.set(.85,1.1,.8);
    A(new THREE.SphereGeometry(.34,12,10),skinM,0,2.62,.1).scale.set(.85,1,.9);
    for(let k=0;k<9;k++){const a=k*Math.PI*2/9;const h=A(new THREE.CylinderGeometry(.03,.09,1.5,5),hairM,Math.cos(a)*.24,2.05,Math.sin(a)*.24);h.rotation.set(Math.cos(a)*.3,0,Math.sin(a)*.3)}
    [-.1,.1].forEach(x=>{A(new THREE.OctahedronGeometry(.06),eyeM,x,2.66,.3).scale.set(1.2,1.5,.7)});
    A(new THREE.BoxGeometry(.24,.1,.12),dark,0,2.5,.3);
    A(new THREE.SphereGeometry(.75,14,12),redM,0,1.45,-.15).scale.set(1.1,.9,1.2);
    for(let k=0;k<8;k++){const a=k*Math.PI*2/8,rr=.55;A(new THREE.SphereGeometry(.14,8,6),new THREE.MeshStandardMaterial({color:0xff5a6a,emissive:0x8a0a1a,emissiveIntensity:1,roughness:.35}),Math.cos(a)*rr,1.45+Math.sin(a*.7)*.2,Math.sin(a)*rr-.15)}
    for(let k=0;k<6;k++){const a=k*Math.PI*2/6+.3;const L=A(new THREE.CylinderGeometry(.055,.09,2.6,6),redM,Math.cos(a)*1.1,1.2,Math.sin(a)*1.1);L.rotation.set(Math.sin(a)*1.0,0,-Math.cos(a)*1.0)}
    const aura=new THREE.PointLight(0xff3b5c,.9,10);aura.position.set(0,1.8,0);g.add(aura);
  }else if(key==='jailer'){
    const steel=M(0x7a6a52,.85,.42),iron=M(0x4a4a52,.9,.35),rust=M(0x8a4a22,.6,.7);
    A(new THREE.BoxGeometry(1.05,1.15,.72),steel,0,1.75,0);
    for(let k=0;k<10;k++){A(new THREE.SphereGeometry(.035,6,5),iron,-.48+(k%5)*.24,1.3+Math.floor(k/5)*.9,.37)}
    A(new THREE.BoxGeometry(.7,.5,.08),new THREE.MeshBasicMaterial({color:0xff7a1a}),0,1.8,.37);
    for(let k=0;k<4;k++)A(new THREE.BoxGeometry(.5,.04,.02),dark,0,1.6+k*.13,.42);
    A(new THREE.BoxGeometry(.62,.6,.62),iron,0,2.62,0);
    A(new THREE.BoxGeometry(.44,.1,.04),new THREE.MeshBasicMaterial({color:0xff2a10}),0,2.62,.32);
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.18,.22,1.2,8),steel,s*.74,1.7,0,0,0,s*.12);A(new THREE.SphereGeometry(.26,8,6),iron,s*.85,1.05,0)});
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.14,.18,.9,7),iron,s*.34,.55,0);A(new THREE.BoxGeometry(.34,.16,.52),rust,s*.34,.12,.1)});
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.04,.04,1.1,6),rust,s*.95,1.4,.1,s*.5,0,0);for(let k=0;k<4;k++)A(new THREE.SphereGeometry(.07,7,6),rust,s*1.18,.95+k*.22,.3)});
    const aura=new THREE.PointLight(0xff7a1a,.9,9);aura.position.set(0,1.8,.4);g.add(aura);
  }else if(key==='bloodmoon'){
    const robe=M(0x4a0610,0,.92),skinM=M(0xd8c8cc,0,.8),gold=M(0xc8a03a,.9,.28);
    A(new THREE.ConeGeometry(1.0,2.2,12,1,true),robe,0,1.1,0);
    A(new THREE.IcosahedronGeometry(.5,1),skinM,0,2.5,0).scale.set(.8,1,.8);
    A(new THREE.SphereGeometry(.3,12,10),skinM,0,2.55,.12).scale.set(.9,1.1,.85);
    [-.1,.1].forEach(x=>{A(new THREE.OctahedronGeometry(.055),new THREE.MeshBasicMaterial({color:0xff2040}),x,2.6,.34).scale.set(1.2,1.5,.7)});
    A(new THREE.BoxGeometry(.18,.08,.08),dark,0,2.44,.32);
    const halo=A(new THREE.TorusGeometry(1.35,.06,6,30,Math.PI*1.25),new THREE.MeshStandardMaterial({color:0xff2040,metalness:.6,roughness:.25,emissive:0xff1030,emissiveIntensity:1.2}),0,2.9,0,0,0,Math.PI*.4);
    halo.rotation.x=Math.PI/2;halo.rotation.z=-.3;
    for(let k=0;k<3;k++){const o=A(new THREE.SphereGeometry(.13,10,8),new THREE.MeshStandardMaterial({color:0xff1030,emissive:0x8a0010,emissiveIntensity:1.4,roughness:.3}),Math.cos(k*2.1)*.9,1.9,Math.sin(k*2.1)*.9);o.userData.orb=k}
    [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(.05,.09,1.1,6),robe,s*.55,1.9,.05,0,0,s*.35);A(new THREE.SphereGeometry(.1,7,6),skinM,s*.72,1.38,.1)});
    const aura=new THREE.PointLight(0xff1030,1.2,11);aura.position.set(0,2,0);g.add(aura);
  }else{
    const voidM=M(0x160a26,.2,.6),core=M(0x6a2aff,.4,.2,0x4a10ff),bone=M(0xbfc8d8,0,.6);
    A(new THREE.IcosahedronGeometry(.95,1),voidM,0,1.65,0,0,0,0).scale.set(.9,1.2,.9);
    A(new THREE.OctahedronGeometry(.34,0),core,0,1.75,.35).scale.set(1,1.4,.5);
    A(new THREE.SphereGeometry(.42,14,12),new THREE.MeshStandardMaterial({color:0x2a1a3a,emissive:0x6a2aff,emissiveIntensity:.5,roughness:.4}),0,2.55,0);
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;A(new THREE.OctahedronGeometry(.085),new THREE.MeshBasicMaterial({color:0xc07aff}),Math.cos(a)*.28,2.62,Math.sin(a)*.28)}
    for(let k=0;k<9;k++){const a=Math.random()*6.28,rr=1.1+Math.random()*.7,sh=A(new THREE.TetrahedronGeometry(.2+Math.random()*.16),voidM,Math.cos(a)*rr,1.1+Math.random()*2,Math.sin(a)*rr);sh.userData.sp=k*.7}
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;const t=A(new THREE.CylinderGeometry(.04,.14,1.6,5),voidM,Math.cos(a)*.34,.5,Math.sin(a)*.34);t.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5)}
    [-1,1].forEach(s=>{const a=A(new THREE.CylinderGeometry(.11,.16,1.5,6),voidM,s*.85,1.65,0);a.rotation.z=s*.45;
      A(new THREE.TorusGeometry(.18,.035,5,10),bone,s*1.2,1.15,0,0,0,0)});
    const aura=new THREE.PointLight(0x8a3aff,1.3,12);aura.position.set(0,1.9,0);g.add(aura);
  }
  return {g,body:g,eye:eyeM,eyes:[],mats};
}
function mx2(a,b){return a+Math.random()*(b-a)}
/* ---------- GLB 模型缓存 ---------- */
const RL_GLB={
  shade:'shadow_wraith',wraith:'swift_ghost',spider:'spider_head',
  silver:'silver_dragon',thousand:'thousand_hands',
  rot:'rot_king',brood:'shadow_brood',jailer:'rust_jailer',
  bloodmoon:'bloodmoon',void:'void_lord'
};
const RL_PROP_GLB={
  crate:'PROP_01_WoodenCrate',barrel:'PROP_02_Barrel',sack:'PROP_03_SackPile',
  table:'PROP_04_WoodenTable',bench:'PROP_05_WoodenBench',walltorch:'PROP_06_WallTorch',
  brazier:'PROP_07_Brazier',chain:'PROP_08_HangingChain',shackles:'PROP_09_Shackles',
  cage:'PROP_10_IronCage',chest:'PROP_11_TreasureChest',bonepile:'PROP_12_BonePile',
  skeleton:'PROP_13_SkeletonRemains',skull:'PROP_14_Skull',spike:'PROP_15_SpikeTrap',
  weaponrack:'PROP_16_WeaponRack',rubble:'PROP_17_RubblePile',
  dc1_brazier:'dc1_Brazier',coffin:'dc1_coffin',coffin_lid:'dc1_coffin_lid',
  dc1_crate:'dc1_crate',dc1_door:'dc1_door',pot:'dc1_pot',
  // 地牢模块化结构件（4×4 米标准格）
  modwall:'MOD_01_Wall_Straight',modtorch:'MOD_02_Wall_TorchMount',modwindow:'MOD_03_Wall_BarredWindow',
  moddoorway:'MOD_04_Wall_Doorway',modarch:'MOD_05_Archway',moddoor:'MOD_06_Door_Closed',moddooropen:'MOD_07_Door_Open',
  modgate:'MOD_08_IronGate',modfloor:'MOD_09_Floor_Standard',modfloorcrack:'MOD_10_Floor_Cracked',
  modfloorcorner:'MOD_11_Floor_CornerVariation',modceil:'MOD_12_Ceiling_Standard',modstairs:'MOD_13_Stairs_Straight',
  modstairs2:'MOD_14_Stairs_Corner',modpillar:'MOD_15_Pillar_Stone',modpillarbroken:'MOD_16_Pillar_Broken',
  modinner:'MOD_17_Wall_InnerCorner',modouter:'MOD_18_Wall_OuterCorner'
};
const rlModelCache={};
const rlModelAnim={};
const rlModelFail={};
let rlModelsLoaded=false;
// 限并发加载队列：最多同时 4 个模型请求，避免 CDN/GitHub Pages 限流导致全部失败
const rlLoadQueue=[];let rlLoadActive=0;const RL_LOAD_MAX_CONCURRENT=4;
function rlLoadQueuePush(key){
  // 已在缓存/已在加载/已失败 的跳过
  if(rlModelCache[key]||rlModelLoading[key]||rlModelFail[key])return;
  rlLoadQueue.push(key);rlLoadQueueDrain();
}
function rlLoadQueueDrain(){
  while(rlLoadActive<RL_LOAD_MAX_CONCURRENT&&rlLoadQueue.length){
    const key=rlLoadQueue.shift();
    if(rlModelCache[key]||rlModelLoading[key]||rlModelFail[key])continue;
    rlModelLoading[key]=true;rlLoadActive++;
    rlLoadOneModel(key,0);
  }
}
function rlLoadOneModelDone(key){rlLoadActive--;rlModelLoading[key]=false;rlLoadQueueDrain();}
const RL_WEAPON_GLB={
  torch:null,k1:'rust_blade',k2:'soul_reaver',k3:'blood_blade',k4:'soul_chain',k5:'godslayer_saw',
  g1:'old_pistol',g2:'shotgun',g3:'smg',g4:'soul_rifle',g5:'annihilation_cannon',
  r1:'soul_bell',r2:'blood_talisman',r3:'ice_staff',r4:'thunder_beads',r5:'blood_lotus'
};
const rlWeaponCache={};
// 贴图预载：在特效触发前就准备好真实粒子贴图
const rlTexPreload={
  soft:'circle_01',spark:'spark_03',smoke:'smoke_04',ring:'light_01',
  flame:'flame_03',muzzle:'muzzle_02',star:'star_04',magic:'magic_02',slash:'slash_01'
};
let rlTexReady=false;
function rlPreloadTextures(){
  if(rlTexReady||!THREE.TextureLoader)return;
  rlTexReady=true;
  const ld=new THREE.TextureLoader();
  for(const k in rlTexPreload){
    const rel='assets/textures/fx/'+rlTexPreload[k]+'.png';
    const tryLoad=(retry)=>{
      ld.load(AST+rel,t=>{t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;rlParticleTex[k]=t},undefined,()=>{
        if(retry<2){tryLoad(retry+1)}
        else ld.load(AST+'assets/textures/fx/circle_01.png',t2=>{rlParticleTex[k]=t2},undefined,()=>{});
      });
    };tryLoad(0);
  }
}
function rlLoadOneModel(key,retry){
  retry=retry||0;
  if(rlModelCache[key]){rlLoadOneModelDone(key);return;}
  if(!THREE.GLTFLoader||!THREE.LoadingManager){rlLoadOneModelDone(key);return;}
  const all=Object.assign({},RL_GLB,RL_PROP_GLB);
  if(all[key]===undefined){rlLoadOneModelDone(key);return;}
  const sub=(RL_GLB[key]!==undefined)?'':'dungeon/';
  const url=AST+'assets/models/'+sub+all[key]+'.glb';
  new THREE.GLTFLoader().load(url,gltf=>{
    rlModelCache[key]=gltf.scene;rlModelAnim[key]=gltf.animations||[];delete rlModelFail[key];
    // 道具/结构件 GLB 可能用 MeshBasicMaterial（无光照、纯白剪影），统一修复为 PBR 并染色
    if(RL_PROP_GLB[key]!==undefined)rlFixPropMaterials(gltf.scene);
    const box=new THREE.Box3().setFromObject(gltf.scene);
    gltf.scene.userData.bbox=box;
    gltf.scene.userData.size=box.getSize(new THREE.Vector3());
    gltf.scene.userData.center=box.getCenter(new THREE.Vector3());
    rlOnModelReady(key);rlLoadOneModelDone(key);
  },undefined,e=>{
    if(retry<2){setTimeout(()=>rlLoadOneModel(key,retry+1),400)}
    else{
      rlModelFail[key]=true;console.warn('[GLB] 加载失败(已重试):',url,e&&e.message);
      const pend=rlPendingSwap[key];if(pend){for(const en of pend){if(!en.dead)en.pendingGlb=null}delete rlPendingSwap[key]}
      rlLoadOneModelDone(key);
    }
  });
}
// 模型迟到时，把已存在的占位怪物替换为真实模型，并补上房间结构/道具外观
const rlPendingSwap={};
let rlPropRebuildTimer=0;
function rlOnModelReady(key){
  const list=rlPendingSwap[key];
  if(list){for(const e of list){if(e.dead)continue;e.pendingGlb=null;rlSwapEnemyModel(e,key)}delete rlPendingSwap[key]}
  if(RL.active&&!RL.dead&&RL.shellArgs&&RL_PROP_GLB[key]!==undefined){
    clearTimeout(rlPropRebuildTimer);
    rlPropRebuildTimer=setTimeout(()=>{
      if(!RL.active||RL.dead||!RL.shellArgs)return;
      rlBuildShell(RL.shellArgs.th,RL.shellArgs.rooms,RL.shellArgs.gates);
      rlRebuildDeco();
    },900);
  }
}
function rlLoadModels(){
  if(rlModelsLoaded)return;
  rlModelsLoaded=true;
  if(!THREE.GLTFLoader){console.warn('[GLB] GLTFLoader 未加载');return}
  rlPreloadTextures();
  // 按需加载：不预加载全部模型，只在怪物/道具出现时加载对应 GLB，避免一次性 50+ 请求卡死
  console.log('[GLB] 贴图预载完成，模型将按需加载');
}
function rlGetModel(key){
  const src=rlModelCache[key];
  if(!src)return null;
  let clone;
  if(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)clone=THREE.SkeletonUtils.clone(src);
  else clone=src.clone(true);
  clone.userData.bbox=src.userData.bbox;
  clone.userData.size=src.userData.size;
  clone.userData.center=src.userData.center;
  return clone;
}
function rlGetAnims(key){return rlModelAnim[key]||[]}
// 尝试用 GLB 模型替换几何体；返回 {g,body,mats,eye,eyes,mixer,anims} 或 null
const RL_GLB_HEIGHT={shade:2.0,wraith:2.2,spider:1.2,silver:4.2,thousand:3.6,rot:3.6,brood:3.2,jailer:3.8,bloodmoon:3.2,void:4.2};
// 骨骼动画把骨盆拉低导致的穿地修正：按模型整体上抬（血月妖祀动画姿态下沉明显，抬到脚尖刚好离地）
const RL_GLB_LIFT={bloodmoon:3.3};
// 模型朝向修正：千手模型正反颠倒，需要绕 Y 转 180°
// 注意：蜘蛛模型的根节点已自带 -90°X（Z-up→Y-up），不能再额外旋转，否则会躺平
const RL_GLB_ROT={thousand:{ry:Math.PI},void:{ry:Math.PI}};
// 无贴图白模的染色（避免渲染成纯白剪影）
const RL_GLB_TINT={shade:0x93a3ad,wraith:0x9aa7a0,spider:0x8d7a74,thousand:0x9a8f9c,silver:0x9aa6b8,rot:0x8a7a63,brood:0x9a7a86,jailer:0x8a8f96,bloodmoon:0x9a6a76,void:0x8a7aa8};
// GLTF 里的 unlit 材质会被加载成 MeshBasicMaterial（完全不受光照，看起来像白色剪影）→ 统一换成 PBR
function rlFixGlbMaterials(root,key){
  const tint=new THREE.Color(RL_GLB_TINT[key]||0x8e8e96);
  root.traverse(o=>{
    if(!o.isMesh)return;
    const skinned=!!o.isSkinnedMesh;
    const arr=Array.isArray(o.material)?o.material:[o.material];
    for(let i=0;i<arr.length;i++){
      const m=arr[i];if(!m)continue;
      // 每个实例克隆一份材质：避免多敌人共享同一材质，被击中泛白互相串色
      const mc=m.clone();
      const hasMap=!!mc.map;
      const col=mc.color?mc.color.clone():new THREE.Color(0xffffff);
      if(mc.isMeshBasicMaterial){
        const nm=new THREE.MeshStandardMaterial({
          color:hasMap?col:tint.clone().multiply(col),
          map:mc.map||null,normalMap:mc.normalMap||null,
          transparent:mc.transparent,opacity:mc.opacity,alphaTest:mc.alphaTest,
          side:mc.side===THREE.DoubleSide?THREE.DoubleSide:THREE.FrontSide,
          depthWrite:mc.depthWrite,roughness:.82,metalness:.05,
          skinning:skinned||mc.skinning,morphTargets:mc.morphTargets,morphNormals:mc.morphNormals
        });
        if(!hasMap){
          const lum=col.r*.299+col.g*.587+col.b*.114;
          if(lum>.6){nm.emissive=col.clone();nm.emissiveIntensity=.75}
        }
        nm.name=mc.name;
        if(Array.isArray(o.material))o.material[i]=nm;else o.material=nm;
      }else{
        // 骨骼网格必须保留 skinning，否则停在绑定姿态导致滑行
        mc.skinning=skinned||mc.skinning;
        if(mc.color&&!hasMap){
          const lum=col.r*.299+col.g*.587+col.b*.114;
          if(lum>.93)mc.color.copy(tint);
        }
        if(Array.isArray(o.material))o.material[i]=mc;else o.material=mc;
      }
    }
  });
}
// 道具/地牢结构件 GLB 材质修复：把无光照的 MeshBasicMaterial 换成 PBR，纯白无贴图的染色为石灰色
function rlFixPropMaterials(root){
  const stoneTint=new THREE.Color(0x9a9084);
  root.traverse(o=>{
    if(!o.isMesh)return;
    const arr=Array.isArray(o.material)?o.material:[o.material];
    for(let i=0;i<arr.length;i++){
      const m=arr[i];if(!m)continue;
      const hasMap=!!m.map;
      const col=m.color?m.color.clone():new THREE.Color(0xffffff);
      let nm;
      if(m.isMeshBasicMaterial){
        nm=new THREE.MeshStandardMaterial({
          color:hasMap?col:stoneTint.clone().multiply(col),
          map:m.map||null,normalMap:m.normalMap||null,
          transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,
          side:m.side===THREE.DoubleSide?THREE.DoubleSide:THREE.FrontSide,
          depthWrite:m.depthWrite,roughness:.9,metalness:.02
        });
        nm.name=m.name;
      }else{
        nm=m;
        if(nm.color&&!hasMap){
          const lum=col.r*.299+col.g*.587+col.b*.114;
          if(lum>.93)nm.color.copy(stoneTint);
        }
      }
      if(Array.isArray(o.material))o.material[i]=nm;else o.material=nm;
    }
  });
}
function rlTryGlb(key,targetH){
  const scene=rlGetModel(key);if(!scene)return null;
  // 蜘蛛头颅模型自带一块 Floor 材质的大圆盘底座，不删掉就像一只在地上爬的铜盘
  let stripped=false;
  if(key==='spider'){
    const junk=[];
    scene.traverse(o=>{
      if(!o.isMesh)return;
      const tag=(o.name||'')+'|'+((o.material&&o.material.name)||'');
      if(/floor/i.test(tag))junk.push(o);
    });
    junk.forEach(o=>{if(o.parent)o.parent.remove(o)});
    stripped=junk.length>0;
  }
  const rot=RL_GLB_ROT[key];
  // 朝向修正放在内层，外层 root 仍用于面向玩家（否则每帧朝向会覆盖掉修正）
  let root=scene;
  if(rot){root=new THREE.Group();root.add(scene);scene.rotation.set(rot.rx||0,rot.ry||0,rot.rz||0)}
  scene.updateMatrixWorld(true);
  // 旋转/删件后重新计算包围盒（缓存里的 bbox 是原始模型的）
  const box=(rot||stripped)?new THREE.Box3().setFromObject(scene):scene.userData.bbox;
  const sz=box?box.getSize(new THREE.Vector3()):scene.userData.size;
  if(!sz||sz.y<.01)return null;
  const ctr=box?box.getCenter(new THREE.Vector3()):scene.userData.center;
  const s=targetH/sz.y;
  scene.scale.setScalar(s);
  // 脚部着地 + 水平居中（部分模型原点不在中心）；RL_GLB_LIFT 处理动画姿态下沉导致的穿地
  scene.position.set(-ctr.x*s,-ctr.y*s+targetH/2+(RL_GLB_LIFT[key]||0),-ctr.z*s);
  rlFixGlbMaterials(root,key);
  // 收集材质与眼睛（发光mesh）
  const mats=[],eyes=[];let body=null;
  root.traverse(o=>{
    if(o.isMesh){
      if(o.material){mats.push(o.material);if(!body)body=o}
      if(o.material&&o.material.emissive&&o.material.emissiveIntensity>0.3)eyes.push(o)
    }
  });
  let mixer=null,anims=rlGetAnims(key);
  if(anims&&anims.length){mixer=new THREE.AnimationMixer(root)}
  return {g:root,body,mats,eye:null,eyes,mixer,anims,glb:true};
}
// 模型迟到：把占位怪物原地替换成真实 GLB 模型
function rlSwapEnemyModel(e,key){
  if(!rlModelCache[key]){rlLoadQueuePush(key);return}
  const m=rlTryGlb(key,RL_GLB_HEIGHT[key]||2);if(!m)return;
  const old=e.g;
  const g=m.g;e.baseY=g.position.y||0;
  g.position.set(e.x,e.baseY,e.z);
  g.rotation.y=old.rotation.y;
  rlGroup.add(g);
  if(e.hpBar&&e.hpBar.sp)old.remove(e.hpBar.sp);
  if(old.parent)old.parent.remove(old);
  e.g=g;e.body=m.body;e.mats=m.mats;e.eyes=m.eyes;e.mixer=m.mixer;e.anims=m.anims;e.curAnim=null;e.m=m;
  if(e.hpBar&&e.hpBar.sp){const h=RL_GLB_HEIGHT[e.kind]||2.25;e.hpBar.sp.position.y=h+.15;g.add(e.hpBar.sp)}
}
// 怪物动画状态机：根据 moving/attacking/hitT 切换动画
function rlPlayAnim(e,name){
  if(!e.mixer||!name||!e.anims||!e.anims.length)return;
  if(e.curAnim===name)return;
  // 名称可能不完全匹配（各家模型命名差异），做包含匹配兜底
  let clip=e.anims.find(a=>a.name===name);
  if(!clip){const ln=name.toLowerCase();clip=e.anims.find(a=>a.name.toLowerCase().indexOf(ln)>=0)}
  if(!clip){
    // 退一步：根据关键字猜测（run/walk/idle/attack/hit/die）
    const k=name.toLowerCase();
    const pick=kw=>e.anims.find(a=>a.name.toLowerCase().indexOf(kw)>=0);
    clip=(k.indexOf('atk')>=0||k.indexOf('attack')>=0)?pick('atk')||pick('attack'):
         (k.indexOf('hit')>=0||k.indexOf('dmg')>=0)?pick('hit')||pick('dmg'):
         (k.indexOf('run')>=0)?pick('run')||pick('walk'):
         (k.indexOf('std')>=0||k.indexOf('idle')>=0)?pick('idle')||pick('std'):null;
  }
  if(!clip)return;
  e.curAnim=name;
  try{
    e.mixer.stopAllAction();
    e.mixer.clipAction(clip).reset().play();
  }catch(_){}
}
function rlEnemyAnimState(e){
  if(!e.mixer)return;
  // 动画速度跟随移速，避免大模型慢速时像滑行
  e.mixer.timeScale=clamp((e.sp||1.6)/2.2,.65,1.5);
  if(e.kind==='silver'){
    // 优先级：攻击 > 跑步 > 受击（受击只在站定时播，避免高射速武器把动画永久锁在受击）
    if(e.attackAnimT>0)rlPlayAnim(e,'Mon_BlackDragon31_Btl_Atk01');
    else if(e.moving)rlPlayAnim(e,'Mon_BlackDragon31_Btl_Run01');
    else if(e.hitT>0)rlPlayAnim(e,'Mon_BlackDragon31_Dmg_Hit01');
    else rlPlayAnim(e,'Mon_BlackDragon31_Btl_Std01');
  }else if(e.kind==='spider'){
    rlPlayAnim(e,e.moving?'MOVE':'IDLE');
  }else if(e.kind==='bloodmoon'){
    rlPlayAnim(e,'human|humanAction');
  }else if(e.anims&&e.anims.length){
    // 其余有动画的怪物默认循环第一个
    rlPlayAnim(e,e.anims[0].name);
  }
}
/* ---------- 敌人生成 ---------- */
function rlAddEnemy(kind,x,z,bk){
  const cf=RLD[RL.diffKey];
  const F=Math.max(0,RL.floor-1);
  // 怪物血量随层数复利增长，并按体型分档封顶：杂兵封顶早、精英与首领更耐打，避免高层被瞬间蒸发
  const grow=Math.pow(1.19,F);
  const hpCap=kind==='boss'?450:(kind==='silver'||kind==='thousand'?300:120);
  const envHpMul=RL.endless?Math.min(hpCap,grow):1;
  const envDmgMul=RL.endless?Math.min(9,Math.pow(1.11,F)):1;
  const floorMul=1; // 闯关模式不按楼层自动叠加怪物数值
  RL.damageScale=RL.endless?Math.min(12,Math.pow(1.12,F)):1; // 玩家输出成长封顶 12 倍，低于怪物后期血量成长，保证高层仍有压力
  let m,hp,dmg,sp,name,type;
  if(kind==='shade'){m=rlTryGlb('shade',RL_GLB_HEIGHT.shade)||mkShade();hp=32*cf.hp*envHpMul*floorMul;dmg=8*cf.dmg*envDmgMul*floorMul;sp=2.35;name='幽影游魂';type='shade'}
  else if(kind==='wraith'){m=rlTryGlb('wraith',RL_GLB_HEIGHT.wraith)||mkLWraith();hp=16*cf.hp*envHpMul*floorMul;dmg=5*cf.dmg*envDmgMul*floorMul;sp=3.5;name='疾行鬼影';type='wraith'}
  else if(kind==='spider'){m=rlTryGlb('spider',RL_GLB_HEIGHT.spider)||mkSpider();hp=24*cf.hp*envHpMul*floorMul;dmg=10*cf.dmg*envDmgMul*floorMul;sp=2.9;name='蜘蛛头颅';type='spider'}
  else if(kind==='silver'){m=rlTryGlb('silver',RL_GLB_HEIGHT.silver)||mkSilver();hp=260*cf.hp*envHpMul*floorMul;dmg=16*cf.dmg*envDmgMul*floorMul;sp=1.9;name='精英·银龙';type='silver'}
  else if(kind==='thousand'){m=rlTryGlb('thousand',RL_GLB_HEIGHT.thousand)||mkThousand();hp=300*cf.hp*envHpMul*floorMul;dmg=14*cf.dmg*envDmgMul*floorMul;sp=1.6;name='精英·千手';type='thousand'}
  else{
    const B=RBOSS[bk]||RBOSS.rot;const gk=bk==='rot'?'rot':bk==='brood'?'brood':bk==='jailer'?'jailer':bk==='bloodmoon'?'bloodmoon':'void';
    m=rlTryGlb(gk,RL_GLB_HEIGHT[gk])||mkBoss(bk);
    hp=B.hp*cf.hp*envHpMul;
    dmg=(bk==='rot'?16:bk==='brood'?18:bk==='jailer'?22:bk==='bloodmoon'?26:30)*cf.dmg*(RL.endless?Math.min(3.6,Math.pow(1.1,Math.floor((RL.floor-1)/5)*5)):1);
    sp=bk==='rot'?1.35:bk==='brood'?2.15:bk==='jailer'?1.6:bk==='bloodmoon'?1.75:2.3;name=B.n;type='boss';
  }
  const g=m.g;const baseY=g.position.y||0;g.position.set(x,baseY,z);rlGroup.add(g);
  const e={kind:type,x,z,g,baseY,hp,maxHp:hp,dmg,sp,spd:sp,name,dead:false,hitT:0,atkT:1.2,slowT:0,phase:0,skillT:2.4+Math.random(),stun:0,kbX:0,kbZ:0,path:null,pt:0,wanderT:0,riseT:kind==='boss'?1.4:0,ph:Math.random()*6,body:m.body,mats:m.mats,eye:m.eye,eyes:m.eyes,bossKey:bk,elite:type==='silver'||type==='thousand',m:null,mixer:m.mixer||null,anims:m.anims||[],curAnim:null,moving:false,attacking:false,faceT:Math.random()*.35,faceTarget:Math.random()*6.283,reactT:.35+Math.random()*.5};
  e.m=m;RL.enemies.push(e);rlAttachHpBar(e);
  // 模型还没加载完（大体积 GLB）：先显示占位体，加载完成后原地换成真实模型
  {
    const gkey=type==='boss'?(bk==='rot'?'rot':bk==='brood'?'brood':bk==='jailer'?'jailer':bk==='bloodmoon'?'bloodmoon':'void'):type;
    if(!m.glb&&rlModelCache[gkey]===undefined){
      e.pendingGlb=gkey;(rlPendingSwap[gkey]=rlPendingSwap[gkey]||[]).push(e);rlLoadQueuePush(gkey);
    }
  }
  if(type==='boss'){e.boss=true;RL.boss=e;RL.bossSpawned=true;rlPlayBgm('boss')}
  return e;
}
/* ---------- 小怪头顶血条 ---------- */
function rlDrawHpBar(e){
  if(!e.hpBar)return;
  const {ctx,tex}=e.hpBar;
  if(!ctx)return;
  ctx.clearRect(0,0,64,12);
  ctx.fillStyle='rgba(10,8,14,.80)';ctx.fillRect(0,0,64,12);
  ctx.strokeStyle='rgba(255,255,255,.34)';ctx.lineWidth=1;ctx.strokeRect(.5,.5,63,11);
  const r=clamp(e.hp/e.maxHp,0,1);
  ctx.fillStyle=r>.55?'#7dff9a':r>.25?'#ffd35c':'#ff4d58';
  ctx.fillRect(2,2,60*r,8);
  tex.needsUpdate=true;
}
function rlAttachHpBar(e){
  if(e.kind==='boss')return;
  const cv=document.createElement('canvas');cv.width=64;cv.height=12;
  const ctx=cv.getContext('2d');
  const tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}));
  sp.scale.set(1.05,.2,1);
  const h=RL_GLB_HEIGHT[e.kind]||2.25;
  sp.position.y=h+.15;
  sp.renderOrder=6;
  e.g.add(sp);
  e.hpBar={ctx,tex,sp};
  rlDrawHpBar(e);
}
/* ---------- 命中伤害数字 ---------- */
const rlDmgNums=[];
function rlDmgNum(x,y,z,val,col,crit){
  const box=$('dmgnums');if(!box)return;
  const el=document.createElement('div');
  el.className='dmgnum'+(crit?' crit':'');
  el.textContent=Math.max(1,Math.round(val));
  el.style.color='#'+((col|0)>>>0).toString(16).padStart(6,'0');
  box.appendChild(el);
  rlDmgNums.push({el,x,y,z,t:0,life:crit?.95:.8,ox:(Math.random()-.5)*22});
}
function rlUpdateDmgNums(dt){
  const v=new THREE.Vector3();
  for(let i=rlDmgNums.length-1;i>=0;i--){
    const d=rlDmgNums[i];d.t+=dt;
    const k=d.t/d.life;
    if(k>=1){d.el.remove();rlDmgNums.splice(i,1);continue}
    v.set(d.x,d.y,d.z).project(cam);
    const sx=(v.x*.5+.5)*innerWidth+d.ox*(1-k),sy=(-v.y*.5+.5)*innerHeight-k*46;
    d.el.style.left=sx.toFixed(1)+'px';
    d.el.style.top=sy.toFixed(1)+'px';
    d.el.style.opacity=Math.min(1,(1-k)*1.8).toFixed(2);
    d.el.style.transform='translate(-50%,-50%) scale('+(1+k*.18).toFixed(2)+')';
    d.el.style.display=v.z<1?'':'none';
  }
}
function rlClearDmgNums(){
  for(const d of rlDmgNums)d.el.remove();
  rlDmgNums.length=0;
}
/* ---------- 闪避 / E / Q 圆周读条 ---------- */
function rlSetRing(id,p,col){
  const el=$(id);if(!el)return;
  el.style.setProperty('--p',clamp(p,0,1).toFixed(3));
  if(col)el.style.setProperty('--ring',col);
}
function rlSkillRings(){
  if(!RL.active)return;
  // 闪避：光圈 = 冷却剩余进度
  const dTotal=RL.dodgeCdTotal||(2.7*RL.dodgeMul);
  rlSetRing('rldodge',RL.dodgeCd>0?RL.dodgeCd/dTotal:1,'#7fe5ff');
  $('rldodge').classList.toggle('cool',RL.dodgeCd>0);
  // E / Q：光圈 = 技能生效后的剩余持续时间，不显示冷却进度
  const eOn=RL.classEtime>0;
  rlSetRing('rle',eOn?RL.classEtime/(RL.classEtotal||1):1,eOn?'#7fe5ff':(RL.classEcd>0?'#2f4a58':'#7fe5ff'));
  const qOn=RL.ultTime>0;
  rlSetRing('rlq',qOn?RL.ultTime/(RL.ultTotal||1):1,qOn?'#ffcf5c':((RL.ult||0)>=100?'#ffcf5c':'#4a3a18'));
}
/* ---------- 16 把武器的高模写实外观（枪层） ---------- */
const rlGun=new THREE.Group();gunScene.add(rlGun);
let rlKick=0,rlMeleeT=0,rlMeleeTotal=.16;
function mkWeaponModel(w){
  const g=new THREE.Group();
  const std=(c,m,r,e)=>new THREE.MeshStandardMaterial({color:c,metalness:m==null?.88:m,roughness:r==null?.33:r,emissive:e||0,emissiveIntensity:e?.9:0});
  const add=(geo,mt,x,y,z,rx,ry,rz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);g.add(o);return o};
  const B=(w2,h,l,c,m,r,x,y,z,rx,ry,rz)=>add(new THREE.BoxGeometry(w2,h,l),std(c,m,r),x,y,z,rx,ry,rz);
  const C=(r1,r2,h,c,m,r,x,y,z,rx,ry,rz)=>add(new THREE.CylinderGeometry(r1,r2,h,12),std(c,m,r),x,y,z,rx,ry,rz);
  const T=(R,r,c,x,y,z,rx,ry,rz)=>add(new THREE.TorusGeometry(R,r,6,16),std(c,.9,.3),x,y,z,rx,ry,rz);
  const S=(r,c,x,y,z,sx,sy,sz)=>add(new THREE.SphereGeometry(r,10,8),std(c,.9,.3),x,y,z).scale.set(sx||1,sy||1,sz||1);
  const blade=(len,wid,col,x,y,z)=>{
    const b=add(new THREE.BoxGeometry(wid,.05,len),std(col,.92,.2),x,y,z);
    add(new THREE.ConeGeometry(wid*.55,wid*2.6,4),std(col,.92,.2),x,y,z-len/2-wid*.7,-Math.PI/2,0,0);
    add(new THREE.BoxGeometry(wid*.22,.058,len*.94),std(0xffffff,.5,.18,0x552222),x,y,z);
    return b;
  };
  let muzzle=null;
  switch(w.w){
    case 'torch':
      C(.045,.05,.42,0x2a343e,.6,.5,0,0,.02,Math.PI/2);
      for(let k=0;k<6;k++)T(.052,.012,0x161c22,0,0,.08-k*.06,0,0,0).rotation.x=Math.PI/2;
      C(.09,.072,.09,0x9aa7ad,.85,.35,0,0,-.24,Math.PI/2);
      C(.062,.04,.05,0xfff2c0,0,1,0,0,-.3,Math.PI/2);
      add(new THREE.SphereGeometry(.06,10,8),new THREE.MeshBasicMaterial({color:0xfff6d8}),0,0,-.32).scale.set(1,1,.45);
      B(.1,.09,.1,0x161c22,.4,.6,-.055,-.55,.12);
      B(.12,.055,.1,0x2f3b33,0,.8,0,-.6,.14);
      muzzle=[0,0,-.38];break;
    case 'k1':
      C(.026,.03,.26,0x3a2a22,.2,.8,0,-.02,.1,Math.PI/2);
      B(.13,.035,.05,0x6a5a42,.5,.5,0,-.01,-.02);T(.045,.012,0x6a5a42,0,-.01,-.02,0,0,0);
      C(.05,.05,.06,0x6a5a42,.6,.4,0,-.02,-.26,Math.PI/2);
      blade(.56,.1,0xa8b4bc,0,.02,-.5);break;
    case 'k2':
      C(.03,.034,.36,0x2a1a14,.2,.8,0,0,.1,Math.PI/2);
      B(.16,.04,.06,0x8a7a4a,.7,.35,0,0,-.02);
      T(.05,.014,0x8a7a4a,0,0,-.02,0,0,0);
      blade(.92,.085,0xd8e6f0,0,.02,-.62);break;
    case 'k3':
      C(.028,.032,.28,0x2a1420,.3,.7,0,0,.08,Math.PI/2);
      B(.2,.035,.06,0x6a1a2a,.7,.35,0,0,-.02);
      blade(.6,.075,0xff8a96,-.06,.02,-.46);blade(.6,.075,0xff8a96,.06,.02,-.46);
      T(.05,.012,0xff3b5c,0,0,.02,Math.PI/2,0,0);break;
    case 'k4':
      C(.03,.036,.24,0x2a2236,.3,.7,0,0,.08,Math.PI/2);
      for(let k=0;k<7;k++)T(.032,.009,0x6a5a8a,0,0,-.14-k*.05,Math.PI/2,0,k%2?0:Math.PI/2);
      blade(.72,.075,0xb8a6ff,0,0,-.62);
      add(new THREE.ConeGeometry(.09,.3,4),std(0x9b7bff,.9,.2,0x2a1050),0,0,-.28,-Math.PI/2,0,0);break;
    case 'k5':
      C(.03,.04,.3,0x3a2a1a,.2,.75,0,0,.1,Math.PI/2);
      B(.24,.05,.9,0xe8dcc0,.5,.45,0,0,-.66);
      for(let k=0;k<9;k++)add(new THREE.ConeGeometry(.035,.1,4),std(0xe8dcc0,.5,.45),.12,.0,-.28-k*.08,0,0,-Math.PI/2);
      add(new THREE.ConeGeometry(.09,.42,4),std(0xd8cbaa,.6,.4),0,0,-1.16,-Math.PI/2,0,0);
      B(.06,.08,.12,0x6a2a1a,.3,.7,-.1,.02,-.2);
      break;
    case 'g1':
      B(.075,.085,.42,0x6a727c,.9,.32,0,.02,-.18);
      B(.08,.045,.4,0x3a4048,.9,.3,0,.065,-.18);
      for(let k=0;k<4;k++)B(.084,.075,.012,0x1a1e24,.6,.5,0,.02,-.04-k*.03);
      C(.026,.03,.1,0x1a1e24,.9,.3,0,.02,-.44,Math.PI/2);
      B(.07,.2,.1,0x2a2e34,.5,.7,0,-.15,.04,0,0,.22);
      B(.02,.03,.02,0x9aa7ad,.9,.2,0,.1,-.4);
      muzzle=[0,.02,-.48];break;
    case 'g2':
      C(.032,.032,.62,0x3a3f46,.9,.3,-.035,.03,-.3,Math.PI/2);C(.032,.032,.62,0x3a3f46,.9,.3,.035,.03,-.3,Math.PI/2);
      B(.14,.11,.26,0x5a3a22,.4,.6,0,0,-.02);
      B(.12,.09,.16,0x6a4a2a,.3,.65,0,-.02,-.22);
      for(let k=0;k<5;k++)B(.12,.012,.02,0x2a1a12,.6,.6,0,-.05,-.16-k*.04);
      B(.11,.16,.32,0x6a4a2a,.2,.7,0,-.14,-.02,0,0,.26);
      muzzle=[0,.03,-.62];break;
    case 'g3':
      B(.09,.1,.5,0x2a3038,.9,.3,0,.02,-.2);
      B(.085,.06,.4,0x3a424a,.85,.3,0,.085,-.18);
      B(.02,.02,.34,0x6ad0ff,.4,.2,0,.12,-.2);
      for(let k=0;k<3;k++)B(.1,.012,.5,0x11161a,.7,.4,0,.02,-.22+k*.02);
      C(.02,.02,.22,0x1a1e24,.9,.3,0,.02,-.5,Math.PI/2);
      B(.07,.22,.11,0x232a32,.7,.45,0,-.16,.1,0,0,.1);
      B(.06,.2,.08,0x1a1e24,.4,.7,0,-.1,-.16,0,0,-.2);
      B(.05,.2,.06,0x2a3038,.7,.5,0,.02,.18);
      muzzle=[0,.02,-.62];break;
    case 'g4':
      C(.032,.036,1.15,0x2a3038,.9,.28,0,.03,-.55,Math.PI/2);
      B(.1,.12,.62,0x3a424a,.85,.3,0,.02,-.05);
      B(.11,.06,.6,0x2a3038,.8,.35,0,.1,-.05);
      C(.06,.06,.34,0x101418,.9,.25,0,.22,-.06,Math.PI/2);
      C(.048,.048,.03,0x6ad0ff,.4,.15,0,.22,-.23,Math.PI/2);
      B(.09,.16,.34,0x4a3a2a,.25,.7,0,-.08,.34,0,0,.06);
      B(.02,.02,.6,0x9aa7ad,.8,.3,-.06,.02,-.5);
      B(.02,.02,.6,0x9aa7ad,.8,.3,.06,.02,-.5);
      for(let k=0;k<5;k++)B(.11,.012,.02,0x11161a,.6,.5,0,.132,-.2-k*.06);
      C(.028,.028,.14,0x9aa7ad,.9,.2,0,.03,-1.15,Math.PI/2);
      muzzle=[0,.03,-1.24];break;
    case 'g5':
      C(.085,.1,.9,0x3a3230,.9,.3,0,.02,-.4,Math.PI/2);
      C(.11,.11,.12,0x6a5a4a,.9,.25,0,.02,-.9,Math.PI/2);
      C(.13,.13,.14,0x2a2422,.85,.3,0,.02,-1.0,Math.PI/2);
      for(let k=0;k<4;k++)B(.2,.03,.06,0x1a1614,.7,.4,0,.02,-.95+k*.03);
      C(.14,.14,.3,0x2a2422,.5,.6,0,-.18,.08,Math.PI/2);
      B(.14,.16,.24,0x4a3a2a,.4,.6,0,-.02,.3);
      B(.1,.24,.14,0x2a2422,.5,.7,0,-.2,.24,0,0,.15);
      B(.05,.07,.3,0x9aa7ad,.8,.3,0,.14,-.2);
      muzzle=[0,.02,-1.1];break;
    case 'r1':
      C(.02,.024,.2,0x5a3a1a,.4,.65,0,-.1,-.15,Math.PI/2);
      add(new THREE.ConeGeometry(.13,.24,12,1,true),std(0xc8a03a,.9,.25),0,-.12,-.32,-Math.PI/2,0,0);
      T(.13,.015,0xc8a03a,0,-.04,-.32,Math.PI/2,0,0);
      S(.045,0xffd76a,0,-.2,-.34);
      for(let k=0;k<5;k++){const p=add(new THREE.BoxGeometry(.012,.14,.012),new THREE.MeshBasicMaterial({color:0xffe9a0,transparent:true,opacity:.6}),0,-.2,-.34);p.userData.p=k}
      break;
    case 'r2':
      B(.2,.3,.035,0xc8b48a,.1,.6,0,.02,-.4);
      B(.12,.18,.01,0xff2030,0,.2,0,.02,-.42).material.transparent=true;
      add(new THREE.BoxGeometry(.1,.15,.012),new THREE.MeshBasicMaterial({color:0xff2a40,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}),0,.02,-.42);
      for(let k=0;k<4;k++)B(.014,.26,.008,0x8a1020,.2,.6,-.08+k*.055,-.24,-.4,0,0,(k-1.5)*.1);
      C(.014,.014,.2,0x5a3a1a,.4,.65,0,-.2,-.18,Math.PI/2);
      break;
    case 'r3':
      C(.018,.024,1.0,0x3a2a4a,.5,.5,0,-.02,.1,Math.PI/2);
      add(new THREE.OctahedronGeometry(.13,0),std(0x8fd8ff,.3,.12,0x2a8ac0),0,.02,-.5).scale.set(1,1.9,1);
      T(.16,.012,0x8fd8ff,0,.02,-.5,Math.PI/2,0,0);
      C(.06,.03,.1,0xc8d8e8,.8,.2,0,.02,-.36,Math.PI/2);
      break;
    case 'r4':
      C(.016,.022,.5,0x3a2a1a,.4,.6,0,-.02,.1,Math.PI/2);
      for(let k=0;k<6;k++)S(.045,0xd8ccb0,Math.sin(k*1.1)*.09,-.04-Math.cos(k*1.1)*.09,-.28-k*.05);
      S(.07,0xfff27a,0,-.02,-.3);
      add(new THREE.OctahedronGeometry(.1,0),std(0xfff27a,.4,.2,0x8a8a00),0,-.02,-.3).scale.set(1,1.4,1);
      break;
    case 'r5':
      C(.02,.026,.7,0x2a1a22,.3,.7,0,-.05,.18,Math.PI/2);
      for(let k=0;k<6;k++){const a=k*Math.PI/3,pt=add(new THREE.ConeGeometry(.13,.34,5),std(0xd01030,.3,.35,0x5a0010),Math.cos(a)*.16,-.02+Math.sin(a)*.16,-.44,0,0,a);pt.scale.set(1,1.4,.4)}
      S(.1,0xff2a55,0,-.02,-.44);
      T(.24,.02,0xff2a55,0,-.02,-.44,Math.PI/2,0,0);
      break;
    default:
      B(.1,.1,.5,0x9aa7ad,.9,.35,0,0,-.2);
  }
  g.userData.muzzle=muzzle;
  g.position.set(.32,-.26,-.6);g.rotation.set(-.02,-.08,0);
  return g;
}
function rlBuildGun(){
  while(rlGun.children.length){const c=rlGun.children[0];rlGun.remove(c)}
  const id=RL.bag[RL.slot],w=id&&RWBY[id];
  rlGun.userData.w=w||null;
  if(!w){rlGun.visible=false;return}
  rlGun.visible=true;
  let m=null,isGlb=false;
  if(id&&RL_WEAPON_GLB[id]){
    rlLoadWeaponModel(id);
    if(rlWeaponCache[id]){m=rlMakeWeaponGlb(id,w);isGlb=!!m}
  }
  if(!m)m=mkWeaponModel(w);
  rlGun.add(m);rlGun.userData.model=m;
  // 第一人称拿近点：老旧手枪(g1)与法器(relic)保持原位，其余枪/刀拉近并略抬高
  rlGun.userData.base=(id!=='g1'&&w.k!=='relic')?[.23,-.24,-.38]:[.30,-.50,-.68];
  rlGun.userData.spin=(!isGlb&&w.k==='relic')?1:0;
}
// 每把武器的朝向/缩放微调表（自动定向后仍不对的在此覆盖）
// ry:Math.PI = 前后翻转；ax 覆盖主轴旋转（y 主轴模型的上下翻转）
const RL_WEAPON_TUNE={
  k1:{rx:Math.PI},k2:{rz:-Math.PI/4},k3:{ry:Math.PI,rx:-Math.PI/6,rz:-Math.PI/4},k4:{rz:Math.PI/4},k5:{rz:3*Math.PI/4},
  g1:{ry:Math.PI},g2:{ry:Math.PI},g3:{ry:Math.PI},g4:{ry:Math.PI},g5:{},
  r1:{ry:Math.PI},r2:{},r3:{ry:Math.PI/6},r4:{},r5:{ax:Math.PI/2}
};
const rlWeaponLoading={};
function rlLoadWeaponModel(id,retry){
  retry=retry||0;
  const fn=RL_WEAPON_GLB[id];
  if(!fn||rlWeaponCache[id]){rlWeaponLoading[id]=false;return;}
  rlWeaponLoading[id]=true;
  const url=AST+'assets/models/weapons/'+fn+'.glb';
  new THREE.GLTFLoader().load(url,g=>{
    rlWeaponCache[id]=g.scene;rlWeaponLoading[id]=false;
    if(RL.active&&RL.bag[RL.slot]===id)rlBuildGun();
    if(gameMode!=='roguelike')setGunModel();
  },undefined,e=>{
    if(retry<2){setTimeout(()=>rlLoadWeaponModel(id,retry+1),400)}
    else{rlWeaponLoading[id]=false;console.warn('[GLB] 武器加载失败(已重试):',fn,e&&e.message)}
  });
}
function rlMakeWeaponGlb(id,w){
  const src=rlWeaponCache[id];if(!src)return null;
  const clone=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(src):src.clone(true);
  const box=new THREE.Box3().setFromObject(clone);
  if(!isFinite(box.min.x))return null;
  const size=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3());
  let axis='z',len=size.z;
  if(size.x>len){axis='x';len=size.x}
  if(size.y>len){axis='y';len=size.y}
  const tune=RL_WEAPON_TUNE[id]||{};
  const target=tune.len||(w.k==='gun'?1.0:w.k==='melee'?1.25:.8);
  const s=len>.0001?target/len:1;
  // 材质修正：GLB 常见全金属无环境贴图 → 发黑；压低金属度、加环境反射
  clone.traverse(o=>{
    if(!o.isMesh)return;
    const ms=Array.isArray(o.material)?o.material:[o.material];
    for(const m of ms){
      if(!m)continue;
      if(m.metalness!==undefined)m.metalness=Math.min(m.metalness,.4);
      if(m.roughness!==undefined)m.roughness=Math.max(m.roughness,.42);
      if(m.envMapIntensity!==undefined)m.envMapIntensity=1.15;
      m.side=THREE.FrontSide;
    }
  });
  const holder=new THREE.Group(),inner=new THREE.Group();
  clone.position.set(-ctr.x,-ctr.y,-ctr.z);
  inner.add(clone);
  if(axis==='x')inner.rotation.y=tune.ax===undefined?Math.PI/2:tune.ax;
  else if(axis==='y')inner.rotation.x=tune.ax===undefined?-Math.PI/2:tune.ax;
  holder.add(inner);
  holder.scale.setScalar(s*(tune.scale||1));
  // 俯仰/偏航作用在 holder；绕刀身长轴的滚转单独用外层组，避免 ry:π 把局部 Z 轴翻反
  holder.rotation.set(tune.rx||0,tune.ry||0,0);
  holder.position.set(tune.px||0,tune.py||0,tune.pz===undefined?0:tune.pz);
  let out=holder;
  if(tune.rz){const rg=new THREE.Group();rg.add(holder);rg.rotation.z=tune.rz;out=rg}
  // 把武器整体后移，使“握把末端”落在原点：挥砍时绕手握位置旋转，而不是绕刀身中点
  out.updateMatrixWorld(true);
  const wb=new THREE.Box3().setFromObject(out);
  if(isFinite(wb.max.z)){
    const pivot=new THREE.Group();
    out.position.z-=wb.max.z; // 让 max.z 对齐原点
    pivot.add(out);
    return pivot;
  }
  return out;
}
// 手部视角环境反射（否则 PBR 金属武器在手电场景里是纯黑）
let rlEnvDone=false;
function rlSetupGunEnv(){
  if(rlEnvDone)return;rlEnvDone=true;
  try{
    const pm=new THREE.PMREMGenerator(ren);pm.compileEquirectangularShader();
    const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');
    const g=c.createLinearGradient(0,0,0,128);
    g.addColorStop(0,'#e6ecf6');g.addColorStop(.42,'#9aa2b0');g.addColorStop(.58,'#4e545f');g.addColorStop(1,'#1e222a');
    c.fillStyle=g;c.fillRect(0,0,256,128);
    const tex=new THREE.CanvasTexture(cv);tex.mapping=THREE.EquirectangularReflectionMapping;
    gunScene.environment=pm.fromEquirectangular(tex).texture;
    const pl=new THREE.PointLight(0xfff3dd,.85,6);pl.position.set(.4,.5,.35);gunScene.add(pl);
    tex.dispose();
  }catch(e){console.warn('[ENV]',e)}
}
function rlWeaponAnim(dt,t){
  if(!RL.active)return;
  gun.visible=false;
  const id=RL.bag[RL.slot],w=id&&RWBY[id];if(!w)return;
  const melee=w.k==='melee';
  const run=Math.min(Math.hypot(vel.x,vel.z)/5.2,1);
  const bx=Math.sin(bob*.5)*.014*run+Math.sin(t*1.3)*.004,by=Math.abs(Math.sin(bob))*.022*run+Math.sin(t*1.7)*.005;
  // 刀剑默认斜向上自然握姿（握把在原点，刀身朝 -Z，rx>0 抬刀尖，ry<0 刀尖偏右）
  let rx=melee?.38:-.02,ry=melee?-.30:-.08,rz=melee?.16:0,dip=0;
  if(rlMeleeT>0){
    const T0=rlMeleeTotal||.16,k=clamp(1-rlMeleeT/T0,0,1);
    // 斜劈：起手在右上，顺着斜线劈到左下（同步压低刀尖 + 刀尖从右侧扫向左侧）
    const sw=clamp(k/.6,0,1);        // 0=右上，1=左下（劈砍段提前到 60% 完成，跟手）
    rx+=1.1-2.3*sw;                 // 抬刀尖 → 压刀尖
    ry+=-.95+2.2*sw;                // 右侧 → 左侧
    rz+=-.3+.7*sw;
    dip=Math.sin(Math.min(1,k)*Math.PI)*.06;
  }
  rlMeleeT=Math.max(0,rlMeleeT-dt);
  const base=rlGun.userData.base||[.30,-.35,-.68];
  rlGun.position.set(base[0]+bx,base[1]-by-rlKick*.035-dip,base[2]+rlKick*.09);
  rlGun.rotation.set(rx+rlKick*.14+Math.sin(t*1.6)*.004,ry+Math.sin(bob*.5)*.02,rz+Math.sin(bob*.5)*.025);
  if(rlGun.userData.model&&rlGun.userData.spin)rlGun.userData.model.rotation.y+=dt*1.2;
  rlKick=Math.max(0,rlKick-dt*7);
}
/* ---------- 攻击、投射物、伤害 ---------- */
function rlStarAreaEffects(x,z,r,dmg,star,col,primary){
  if(star>=2){rlFxRing(x,.75,z,r,0xffb347,.8);if(star>=2)rlAoe(x,z,r*.72,dmg*.22,0xffa43a,false,.25)}
  if(star>=3){let n=0;for(const e of RL.enemies){if(e.dead||e===primary||Math.hypot(e.x-x,e.z-z)>r+1.4)continue;if(n++>=2)break;rlHurt(e,dmg*.28,false,0xfff27a);rlHitSpark(e.x,1.2,e.z,0xffdf76)}}
  if(star>=4){let n=0;for(const e of RL.enemies){if(e.dead||e===primary||Math.hypot(e.x-x,e.z-z)>r+2.2)continue;if(n++>=2)break;rlHurt(e,dmg*.22,false,0x69eaff);rlFxRing(e.x,.9,e.z,.75,0x69eaff,.65);rlHitSpark(e.x,1.4,e.z,0x69eaff)}}
  if(star>=5){for(const e of RL.enemies){if(!e.dead&&Math.hypot(e.x-x,e.z-z)<=r+1.2){e.burnT=Math.max(e.burnT||0,3.2);e.burnDmg=Math.max(e.burnDmg||0,dmg*.12)}}rlFxRing(x,.7,z,r*.85,0xff4b18,.65)}
  if(star>=6){for(const e of RL.enemies){if(!e.dead&&Math.hypot(e.x-x,e.z-z)<=r+1.2){e.corrodeT=Math.max(e.corrodeT||0,4.5);e.corrodeDmg=Math.max(e.corrodeDmg||0,dmg*.10)}}rlFxRing(x,.6,z,r,0x75ff55,.7)}
}
function rlAttack(){
  if(!RL.active||!running||RL.shopOpen)return;
  const id=RL.bag[RL.slot];if(!id)return;const w=RWBY[id];
  if(!w||RL.cds[RL.slot]>0)return;
  const star=Math.max(1,RL.weaponStars[id]||1),starDmg=1+.20*(star-1),starCd=Math.max(.75,1-.05*(star-1));
  RL.cds[RL.slot]=Math.max(.07,w.c*RL.cdMul*starCd*(RL.classId==='gunner'&&RL.ultTime>0?.55:1));rlKick=1;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  if(w.k==='melee'){
    rlWeaponSfx(id);rlMeleeT=.16;rlMeleeTotal=.16;
    const mul=(w.hits||1)*(1+Math.max(0,RL.atk-1));
    const ad=Math.round(w.d*mul*RL.damageScale*starDmg);rlAoe(P.x+fx*.6,P.z+fz*.6,w.r,ad,w.col,true,w.kb||0);rlStarAreaEffects(P.x+fx*.6,P.z+fz*.6,w.r,ad,star,w.col);
    rlFxRing(P.x+fx*.9,1.1,P.z+fz*.9,w.r*.9,w.col,1.15);
  }else if(w.k==='gun'){
    rlWeaponSfx(id);
    const n=w.hits||1;
    for(let k=0;k<n;k++){
      const sp=(w.spread||0)*(n>1?(k/(n-1)-.5)*2:(Math.random()-.5)*2);
      const a=yaw+sp,cp=Math.cos(pitch),sp2=Math.sin(pitch);
      const dx=-Math.sin(a)*cp,dz=-Math.cos(a)*cp;
      rlShot({x:P.x+dx*.5,y:1.35+sp2*.3,z:P.z+dz*.5,vx:dx*w.spd,vy:sp2*w.spd,vz:dz*w.spd,dmg:Math.round(w.d*(1+Math.max(0,RL.atk-1))*(RL.classId==='ranger'&&RL.rangerBuff>0?1.1:1)*RL.damageScale*starDmg),life:w.r*(1+.04*(star-1))/w.spd,pierce:(w.pierce||0)+(star>=3?1:0),aoe:Math.max(w.aoe||0,star>=2?.9+star*.13:0),col:w.col,slow:w.slow||0,star,element:star>=6?'corrosion':star>=5?'fire':star>=4?'electric':star>=3?'bounce':star>=2?'explosive':''});
    }
    rlMuzzleFx(w.col);
  }else{
    if(w.aoe&&!w.spd){
      rlWeaponSfx(id);
      const ad=Math.round(w.d*(1+Math.max(0,RL.atk-1))*(RL.classId==='ranger'&&RL.rangerBuff>0?1.1:1)*RL.damageScale*starDmg);rlAoe(P.x,P.z,w.aoe,ad,w.col,false,w.w==='r5'?1.2:.4);rlStarAreaEffects(P.x,P.z,w.aoe,ad,star,w.col);
      rlFxRing(P.x,1,P.z,w.aoe,w.col,1.3);
      if(w.ls){RL.hp=Math.min(RL.maxHp,RL.hp+w.d*w.ls*2);rlFxRing(P.x,1.4,P.z,.7,0x66ff88,.8)}
    }else{
      rlWeaponSfx(id);
      const cp=Math.cos(pitch),sp2=Math.sin(pitch);
      const dx=-Math.sin(yaw)*cp,dz=-Math.cos(yaw)*cp;
      rlShot({x:P.x+dx*.1,y:1.35+sp2*.1,z:P.z+dz*.1,vx:dx*w.spd,vy:sp2*w.spd,vz:dz*w.spd,dmg:Math.round(w.d*(1+Math.max(0,RL.atk-1))*(RL.classId==='ranger'&&RL.rangerBuff>0?1.1:1)*RL.damageScale*starDmg),life:w.r*(1+.04*(star-1))/w.spd,pierce:star>=3?1:0,aoe:star>=2?.9+star*.13:0,col:w.col,slow:w.slow||0,chain:(w.chain||0)+(star>=3?1:0),star,element:star>=6?'corrosion':star>=5?'fire':star>=4?'electric':star>=3?'bounce':star>=2?'explosive':''});
      rlMuzzleFx(w.col);
    }
  }
}
function rlShot(o){
  const m=new THREE.Mesh(new THREE.SphereGeometry(o.aoe?.22:.1,7,6),new THREE.MeshBasicMaterial({color:o.col,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.position.set(o.x,o.y,o.z);
  if(o.aoe){const halo=new THREE.Mesh(new THREE.SphereGeometry(.34,8,6),new THREE.MeshBasicMaterial({color:o.col,transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false}));m.add(halo)}
  rlGroup.add(m);
  RL.shots.push({m,x:o.x,y:o.y,z:o.z,vx:o.vx,vy:o.vy||0,vz:o.vz,life:o.life,dmg:o.dmg,pierce:o.pierce,aoe:o.aoe,col:o.col,slow:o.slow,chain:o.chain||0,star:o.star||1,element:o.element||'',hit:new Set(),hostile:!!o.hostile,homing:o.homing||0});
}
function rlMuzzle(col){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  const m=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.position.set(P.x+fx*.9,1.3,P.z+fz*.9);rlGroup.add(m);
  RL.fx.push({m,life:.09,t:0,type:'flash'});
}
function rlAoe(x,z,r,dmg,col,melee,kb){
  for(const e of RL.enemies){
    if(e.dead)continue;const d=Math.hypot(e.x-x,e.z-z);if(d>r+ (e.kind==='boss'?.9:.2))continue;
    rlHurt(e,dmg,Math.random()<RL.crit);
    if(kb){const dx=(e.x-x)/(d||1),dz=(e.z-z)/(d||1);e.kbX+=dx*kb*3.2;e.kbZ+=dz*kb*3.2}
  }
  if(melee&&RL.thorn>0){} // 荆棘在受击时结算
}
function rlHurt(e,dmg,crit,col){
  if(e.dead)return;
  let d=dmg;
  if(RL.classEtime>0&&RL.classId==='gunner')d*=1.25;
  if(RL.classId==='mage'&&e.slowT>0)d*=1.05;
  if(e.kind==='boss'&&e.bossKey==='jailer'&&e.stun<=0)d*=.7;
  if(crit){d*=2;rlSfx('hit')}
  e.hp-=d;e.hitT=.16;RL.ult=Math.min(100,(RL.ult||0)+Math.min(3,d*.045));
  rlDrawHpBar(e);
  rlDmgNum(e.x,1.55+(e.kind==='boss'?.95:0),e.z,d,crit?0xffd35c:(col||0xffffff),crit);
  // 单次吸血上限为最大生命的 6%，避免高额伤害下无限回血
  const heal=Math.min(RL.maxHp*.06,d*RL.ls);if(heal>0){RL.hp=Math.min(RL.maxHp,RL.hp+heal);if(RL.hp===RL.maxHp&&RL.ls>0&&Math.random()<.2)rlFxRing(P.x,1.2,P.z,.6,0x66ff88,.5)}
  rlHitSpark(e.x,1.35+Math.random()*.6,e.z,crit?0xfff27a:0xff5a5a);
  if(!crit)rlSfx('hit');
  if(e.hp<=0)rlKill(e);
}
function rlKill(e){
  e.dead=true;e.g.visible=false;
  const idx=RL.enemies.indexOf(e);if(idx>=0)RL.enemies.splice(idx,1);
  RL.kills++;RL.ult=Math.min(100,(RL.ult||0)+8);
  const base=e.kind==='boss'?120+RL.floor*20:e.kind==='wraith'?6:e.kind==='spider'?9:e.elite?50+RL.floor*6:11;
  const gain=Math.round(base*RL.coinMul*(RL.endless?1+RL.floor*.08:1));
  RL.coins+=gain;RL.totalCoins+=gain;
  rlSfx(e.kind==='boss'?'warn':'kill');
  rlFxRing(e.x,1.2,e.z,e.kind==='boss'?6:1.6,e.kind==='boss'?0xff2a55:0x9b7bff,1.5);
  rlDeathBurst(e.x,e.baseY,e.z,e.kind==='boss'?0xff2a55:0x9b7bff);
  if(e.kind==='boss'){
    RL.bossDefeated=true;RL.boss=null;$('rlboss').classList.add('hide');rlPlayBgm('explore');
    toast('💀 '+e.name+' 已被击溃！+'+gain+' 🪙');RL.bossSpawned=false;
  }else toast('怨魂消散 +'+gain+' 🪙');
  rlCheckClear();
}
function rlCheckClear(){rlRoomProgress();}
function rlHitSpark(x,y,z,col){
  for(let k=0;k<5;k++){
    const m=new THREE.Mesh(new THREE.TetrahedronGeometry(.055+Math.random()*.05),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.position.set(x,y,z);rlGroup.add(m);
    const a=Math.random()*6.28,sp=1.6+Math.random()*3;
    RL.fx.push({m,life:.3+Math.random()*.2,t:0,type:'spark',vx:Math.cos(a)*sp,vy:1+Math.random()*2.4,vz:Math.sin(a)*sp});
  }
  const f=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  f.position.set(x,y,z);rlGroup.add(f);RL.fx.push({m:f,life:.12,t:0,type:'flash'});
  rlHitBurst(x,y,z,col);
}
/* ---------- 粒子纹理与粒子特效 ---------- */
const rlParticleTex={};
let rlCanvasTex={};
function rlMakeParticleTex(name){
  // 优先使用预载/已加载的真实贴图；拿不到才用程序生成的圆形回退
  const real=rlParticleTex[name];
  if(real)return real;
  if(rlCanvasTex[name])return rlCanvasTex[name];
  const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
  const g=c.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.35,'rgba(255,255,255,.55)');
  g.addColorStop(.72,'rgba(255,255,255,.12)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.beginPath();c.arc(64,64,64,0,7);c.fill();
  const t=new THREE.CanvasTexture(cv);t.needsUpdate=true;
  rlCanvasTex[name]=t;return t;
}
function rlBurst(x,y,z,col,count,opts){
  opts=opts||{};
  const tex=rlMakeParticleTex(opts.tex||'soft');
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3),colA=new Float32Array(count*3);
  const baseCol=new THREE.Color(col),parts=[];
  const dirx=opts.dirx||0,diry=opts.diry||0,dirz=opts.dirz||0;
  for(let i=0;i<count;i++){
    const a=Math.random()*6.28,elev=(Math.random()-.5)*1.4,sp=(opts.spd||3)*(.4+Math.random()*.8);
    pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;
    // 逐粒子色相抖动，避免整片同色纸片感
    const c2=baseCol.clone();const j=(Math.random()-.5)*.18;
    c2.offsetHSL(j*0.3,j*(opts.satJit==null?.15:opts.satJit),j*.12);
    colA[i*3]=c2.r;colA[i*3+1]=c2.g;colA[i*3+2]=c2.b;
    parts.push({
      vx:Math.cos(a)*Math.cos(elev)*sp+dirx,vy:Math.sin(elev)*sp+(opts.up||0)+diry,vz:Math.sin(a)*Math.cos(elev)*sp+dirz,
      life:(opts.life||.6)*(.7+Math.random()*.6),
      sz:(opts.size||.25)*(Math.random()*.55+.75),gr:1
    });
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colA,3));
  const mat=new THREE.PointsMaterial({
    size:opts.size||.25,map:tex,vertexColors:true,transparent:true,opacity:.95,
    blending:opts.blend||THREE.AdditiveBlending,depthWrite:false,fog:false,alphaTest:.01,sizeAttenuation:true
  });
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;(opts.parent||rlGroup).add(pts);
  RL.fx.push({m:pts,parts,geo,life:opts.life||.6,t:0,type:'points',gravity:opts.gravity==null?4:opts.gravity,drag:opts.drag||.92,baseSize:opts.size||.25,grow:opts.grow==null?.85:opts.grow,op0:opts.op0==null?.95:opts.op0});
}
function rlMuzzleFx(col){
  // 在第一人称枪模型的枪口位置生成火焰，而非角色眼前
  const mdl=rlGun.userData.model;
  rlGun.updateMatrixWorld(true);
  let mp=null;
  if(mdl&&mdl.userData&&mdl.userData.muzzle){
    mp=new THREE.Vector3(mdl.userData.muzzle[0],mdl.userData.muzzle[1],mdl.userData.muzzle[2]).applyMatrix4(rlGun.matrixWorld);
  }else if(mdl){
    // GLB 武器没有预设枪口偏移：取枪模型包围盒最前端（枪朝向 -Z，即 min.z）作为枪口
    const bb=new THREE.Box3().setFromObject(rlGun);
    if(isFinite(bb.min.z))mp=new THREE.Vector3((bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,bb.min.z);
  }
  if(!mp){return}
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(rlGun.getWorldQuaternion(new THREE.Quaternion()));
  const fx=fwd.x,fz=fwd.z;
  // 枪口焰（沿射向拉伸的火舌）
  rlBurst(mp.x,mp.y,mp.z,0xffd08a,8,{tex:'flame',size:.42,spd:2.4,life:.16,gravity:0,drag:.72,up:.6,dirx:fx*4,dirz:fz*4,grow:1.6,parent:gunScene});
  // 高温核心火花
  rlBurst(mp.x,mp.y,mp.z,col,12,{tex:'spark',size:.2,spd:5.5,life:.2,gravity:1.5,drag:.86,up:.8,dirx:fx*3,dirz:fz*3,parent:gunScene});
  // 枪口烟
  rlBurst(mp.x,mp.y,mp.z,0x8a8680,4,{tex:'smoke',size:.34,spd:1.1,life:.5,gravity:-.6,drag:.94,up:.9,dirx:fx*2,dirz:fz*2,blend:THREE.NormalBlending,op0:.42,parent:gunScene});
  const f=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  f.position.copy(mp);gunScene.add(f);RL.fx.push({m:f,life:.075,t:0,type:'flash'});
}
function rlHitBurst(x,y,z,col){
  rlBurst(x,y,z,col,12,{tex:'spark',size:.19,spd:4.5,life:.42,gravity:6.5,drag:.94,up:2.2});
  rlBurst(x,y,z,0xfff0d0,5,{tex:'soft',size:.22,spd:2.2,life:.26,gravity:4,drag:.9,up:1.5});
  rlBurst(x,y,z,0x2e2a28,6,{tex:'smoke',size:.42,spd:1.4,life:.75,gravity:-.4,drag:.95,up:1,blend:THREE.NormalBlending,op0:.45});
}
function rlDeathBurst(x,y,z,col){
  rlBurst(x,y+1,z,col,22,{tex:'magic',size:.34,spd:4.6,life:.85,gravity:2,drag:.9,up:2.6,grow:1.2});
  rlBurst(x,y+1,z,0xfff4e0,10,{tex:'spark',size:.24,spd:6,life:.55,gravity:4.5,drag:.88,up:3.2});
  rlBurst(x,y+.5,z,0x2a2630,8,{tex:'smoke',size:.6,spd:1.8,life:1.3,gravity:-.3,drag:.96,up:1.4,blend:THREE.NormalBlending,op0:.4});
}
function rlFxRing(x,y,z,r,col,op){
  const m=new THREE.Mesh(new THREE.TorusGeometry(r,.05,4,24),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op||.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  m.position.set(x,y,z);m.rotation.x=Math.PI/2;rlGroup.add(m);RL.fx.push({m,life:.34,t:0,type:'ring',r0:.35});
}
function rlTickFx(dt){
  for(let i=RL.fx.length-1;i>=0;i--){
    const f=RL.fx[i],k=(f.t+=dt)/f.life;
    if(f.type==='ring'){f.m.scale.setScalar(f.r0+k*1.5);f.m.material.opacity=.9*(1-k)}
    else if(f.type==='spark'){f.vy-=7*dt;f.m.position.set(f.m.position.x+f.vx*dt,f.m.position.y+f.vy*dt,f.m.position.z+f.vz*dt);f.m.rotation.x+=dt*9;f.m.material.opacity=.95*(1-k)}
    else if(f.type==='points'){
      const pos=f.geo.attributes.position.array;
      for(let j=0;j<f.parts.length;j++){
        const p=f.parts[j];
        p.vy-=f.gravity*dt;
        const d=Math.pow(f.drag,dt*60);p.vx*=d;p.vy*=d;p.vz*=d;
        pos[j*3]+=p.vx*dt;pos[j*3+1]+=p.vy*dt;pos[j*3+2]+=p.vz*dt;
      }
      f.geo.attributes.position.needsUpdate=true;
      f.m.material.opacity=f.op0*(1-k*k);
      f.m.material.size=f.baseSize*(1+k*f.grow);
    }
    else{f.m.material.opacity=.9*(1-k);f.m.scale.setScalar(1+k*2)}
    if(k>=1){if(f.m.parent)f.m.parent.remove(f.m);f.m.geometry&&f.m.geometry.dispose&&f.m.geometry.dispose();f.m.material&&f.m.material.dispose&&f.m.material.dispose();RL.fx.splice(i,1)}
  }
}
function rlUpdateShots(dt){
  for(let i=RL.shots.length-1;i>=0;i--){
    const s=RL.shots[i];s.life-=dt;
    if(s.homing){const dx=P.x-s.x,dz=P.z-s.z,l=Math.hypot(dx,dz)||1;s.vx+=dx/l*s.homing*dt;s.vz+=dz/l*s.homing*dt;
      const sp=Math.hypot(s.vx,s.vz),mx=7.5;if(sp>mx){s.vx=s.vx/sp*mx;s.vz=s.vz/sp*mx}}
    s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt;
    s.m.position.set(s.x,s.y,s.z);
    const ti=s.x/T|0,tj=s.z/T|0;
    let gone=s.life<=0||s.y<0||!maze[tj]||(maze[tj][ti]!==0&&s.y<H);
    if(!gone){
      if(s.hostile){
        if(Math.hypot(s.x-P.x,s.z-P.z)<.85&&Math.abs(s.y-1.3)<1.6){rlDamage(s.dmg);gone=true}
      }else{
        for(const e of RL.enemies){
          if(e.dead||s.hit.has(e))continue;
          const rr=e.kind==='boss'?1.7:.95;
          if(Math.hypot(s.x-e.x,s.z-e.z)<rr){
            s.hit.add(e);
            if(s.aoe){rlAoe(s.x,s.z,s.aoe,s.dmg*.7,s.col,false,1);rlFxRing(s.x,.8,s.z,s.aoe,s.col,.65)}
            rlHurt(e,s.dmg,false,s.element==='fire'?0xff6a2a:s.element==='corrosion'?0x7dff6a:s.element==='electric'?0x69eaff:0xffffff);
            if(s.slow)e.slowT=Math.max(e.slowT,s.slow);
            if(s.element==='fire'){e.burnT=Math.max(e.burnT||0,3.2);e.burnDmg=Math.max(e.burnDmg||0,s.dmg*.12);rlFxRing(e.x,.65,e.z,.55,0xff5a18,.55)}
            if(s.element==='corrosion'){e.corrodeT=Math.max(e.corrodeT||0,4.5);e.corrodeDmg=Math.max(e.corrodeDmg||0,s.dmg*.10);rlFxRing(e.x,.65,e.z,.65,0x75ff55,.6)}
            if(s.element==='electric'||s.chain>0){
              let best=null,bd=s.element==='electric'?4.5:7;
              for(const o of RL.enemies){if(o.dead||o===e||s.hit.has(o))continue;const d2=Math.hypot(o.x-e.x,o.z-e.z);if(d2<bd){bd=d2;best=o}}
              if(best){s.hit.add(best);rlHurt(best,s.dmg*(s.element==='electric'?.58:.7),false,s.element==='electric'?0x69eaff:0xfff27a);rlHitSpark(best.x,1.5,best.z,s.element==='electric'?0x69eaff:0xfff27a);if(s.element==='electric')rlFxRing(best.x,.9,best.z,.8,0x69eaff,.7)}
            }
            if(s.pierce>0)s.pierce--;else gone=true;
            break;
          }
        }
      }
    }
    if(gone){rlGroup.remove(s.m);s.m.geometry.dispose();s.m.material.dispose();RL.shots.splice(i,1)}
  }
}
/* ---------- 敌人寻路与 AI ---------- */
function rlNextStep(sx,sz){
  const gx=P.x/T|0,gz=P.z/T|0;
  if(sx===gx&&sz===gz)return null;
  const prev=new Map(),q=[[sx,sz]];prev.set(sx+','+sz,null);
  while(q.length){
    const [x,y]=q.shift();if(x===gx&&y===gz)break;
    for(const [a,b] of N4){const nx=x+a,ny=y+b,k=nx+','+ny;
      if(maze[ny]&&maze[ny][nx]===0&&!prev.has(k)){prev.set(k,[x,y]);q.push([nx,ny])}}
  }
  let c=[gx,gz];if(!prev.has(gx+','+gz))return null;
  for(;;){const p=prev.get(c[0]+','+c[1]);if(!p)return null;if(p[0]===sx&&p[1]===sz)return c;c=p}
}
function rlMoveEnemy(e,nx,nz){
  const i=nx/T|0,j=nz/T|0;
  if(maze[j]&&maze[j][i]===0){e.x=nx;e.z=nz;return true}
  return false;
}
/* BOSS 技能预警区：先落地一个红光圈，计时结束后才结算伤害，给玩家反应时间 */
function rlWarnZone(x,z,r,delay,col,onDone){
  const ring=new THREE.Mesh(new THREE.RingGeometry(r*.84,r,40),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.75,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(x,.07,z);
  const fill=new THREE.Mesh(new THREE.CircleGeometry(r*.82,32),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.16,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  fill.rotation.x=-Math.PI/2;fill.position.set(x,.06,z);
  rlGroup.add(ring);rlGroup.add(fill);
  RL.warns=RL.warns||[];
  RL.warns.push({ring,fill,t:delay,total:delay,onDone});
}
function rlTickWarns(dt){
  const list=RL.warns||[];
  for(let i=list.length-1;i>=0;i--){
    const w=list[i];w.t-=dt;
    const k=clamp(1-w.t/w.total,0,1);
    w.ring.material.opacity=.35+.55*Math.abs(Math.sin(k*Math.PI*5));
    w.fill.material.opacity=.1+.25*k;
    w.ring.scale.setScalar(.75+.25*k);
    if(w.t<=0){
      rlGroup.remove(w.ring);rlGroup.remove(w.fill);
      w.ring.geometry.dispose();w.ring.material.dispose();
      w.fill.geometry.dispose();w.fill.material.dispose();
      list.splice(i,1);
      try{w.onDone&&w.onDone()}catch(e){}
    }
  }
}
function rlClearWarns(){
  for(const w of (RL.warns||[])){
    if(w.ring.parent)w.ring.parent.remove(w.ring);
    if(w.fill.parent)w.fill.parent.remove(w.fill);
    w.ring.geometry.dispose();w.ring.material.dispose();
    w.fill.geometry.dispose();w.fill.material.dispose();
  }
  RL.warns=[];
}
function rlBossSkill(e,dt){
  e.skillT-=dt;if(e.skillT>0)return;
  const k=e.bossKey,d=Math.hypot(P.x-e.x,P.z-e.z),fl=RL.floor;
  if(k==='rot'){
    e.skillT=5.2;rlSfx('warn');
    rlWarnZone(e.x,e.z,4.4,.95,0x6aff4a,()=>{
      if(!RL.active||RL.floor!==fl||e.dead)return;
      if(Math.hypot(P.x-e.x,P.z-e.z)<4.6)rlDamage(e.dmg*.9);
      rlFxRing(e.x,1,e.z,4.4,0x6aff4a,1);
    });
    if(e.hp<e.maxHp*.55&&!e.summoned){e.summoned=1;rlAddEnemy('shade',e.x+2.4,e.z);rlAddEnemy('shade',e.x-2.4,e.z);toast('腐污尸王开始召唤游魂！')}
  }else if(k==='brood'){
    e.skillT=5.0;rlSfx('warn');
    const a=Math.random()*6.28,dist=3.6;
    const nx=P.x+Math.cos(a)*dist,nz=P.z+Math.sin(a)*dist;
    // 先给目标位置预警 0.85 秒，玩家可以走开；伤害范围只有 2.4 米
    rlWarnZone(nx,nz,2.4,.85,0xff3b5c,()=>{
      if(!RL.active||RL.floor!==fl||e.dead)return;
      if(!rlMoveEnemy(e,nx,nz)){e.x=nx;e.z=nz}
      e.g.position.x=e.x;e.g.position.z=e.z;
      rlFxRing(e.x,1,e.z,2.6,0xff3b5c,1);scream(.55);
      if(Math.hypot(P.x-e.x,P.z-e.z)<2.4)rlDamage(e.dmg*.7);
    });
    if(Math.random()<.6){const w=rlAddEnemy('wraith',e.x+1.5,e.z+1.5);toast('母巢孵化了疾行鬼影！')}
  }else if(k==='jailer'){
    e.skillT=4.6;rlSfx('warn');
    const dx=P.x-e.x,dz=P.z-e.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l;
    // 冲撞前 0.6 秒蓄力预警，冲撞速度也留出侧移空间
    rlWarnZone(e.x+ux*3.5,e.z+uz*3.5,2.6,.6,0xffb03a,()=>{
      if(!RL.active||RL.floor!==fl||e.dead)return;
      for(let s=0;s<10;s++){
        if(!rlMoveEnemy(e,e.x+ux*.45,e.z+uz*.45))break;
        if(Math.hypot(P.x-e.x,P.z-e.z)<1.5)rlDamage(e.dmg*.7);
      }
      rlFxRing(e.x,1,e.z,2.2,0xffb03a,1);
      if(Math.hypot(P.x-e.x,P.z-e.z)<3.6)rlDamage(e.dmg*.4);
    });
  }else if(k==='bloodmoon'){
    e.skillT=4.4;rlSfx('warn');
    for(let s=0;s<3;s++){
      const a=Math.atan2(P.z-e.z,P.x-e.x)+(s-1)*.34;
      rlShot({x:e.x+Math.cos(a)*.7,y:1.9,z:e.z+Math.sin(a)*.7,vx:Math.cos(a)*4.2,vz:Math.sin(a)*4.2,dmg:e.dmg*.55,life:6,col:0xff1030,hostile:true,homing:1.7});
    }
    e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.03);rlFxRing(e.x,1.4,e.z,1.2,0xff1030,.8);
  }else{
    e.skillT=3.8;
    const pick=Math.random();
    if(pick<.34){
      rlSfx('warn');
      for(let s=0;s<4;s++){const a=s*Math.PI/2+Math.random();rlShot({x:e.x,y:1.6,z:e.z,vx:Math.cos(a)*5,vz:Math.sin(a)*5,dmg:e.dmg*.5,life:4.5,col:0x8a3aff,hostile:true,homing:1.4})}
      rlFxRing(e.x,1.2,e.z,3,0x8a3aff,1);
    }else if(pick<.7){
      const a=Math.random()*6.28,nx=P.x+Math.cos(a)*3.0,nz=P.z+Math.sin(a)*3.0;
      rlWarnZone(nx,nz,2.6,.8,0x8a3aff,()=>{
        if(!RL.active||RL.floor!==fl||e.dead)return;
        if(!rlMoveEnemy(e,nx,nz)){e.x=nx;e.z=nz}
        e.g.position.x=e.x;e.g.position.z=e.z;
        rlFxRing(e.x,1,e.z,2.6,0x8a3aff,1);
        if(Math.hypot(P.x-e.x,P.z-e.z)<2.6)rlDamage(e.dmg*.55);
      });
    }else{
      e.armorT=3;for(let s=0;s<2;s++)rlAddEnemy('shade',e.x+2+s,e.z-s);
      toast('虚空主宰撕裂了现实，唤出怨魂！');
    }
  }
}
function rlTick(dt){
  if(!RL.active)return;
  RL.runTime+=dt;
  RL.iframe=Math.max(0,RL.iframe-dt);
  RL.dodgeCd=Math.max(0,RL.dodgeCd-dt);RL.classEcd=Math.max(0,(RL.classEcd||0)-dt);RL.classEtime=Math.max(0,(RL.classEtime||0)-dt);RL.ultTime=Math.max(0,(RL.ultTime||0)-dt);RL.passiveT=Math.max(0,(RL.passiveT||0)-dt);RL.rangerBuff=Math.max(0,(RL.rangerBuff||0)-dt);
  const cls=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard;if(RL.classId==='spirit'&&RL.passiveT<=0&&RL.enemies.some(e=>!e.dead&&!e.dormant)){RL.passiveT=2.4;const target=RL.enemies.filter(e=>!e.dead&&!e.dormant).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0];if(target){rlHurt(target,Math.max(5,Math.round(RWBY[RL.bag[RL.slot]||'torch'].d*.45)),false);rlFxRing(target.x,.7,target.z,.55,cls.color,.45)}}
  for(let i=0;i<3;i++)if(RL.cds[i]>0)RL.cds[i]=Math.max(0,RL.cds[i]-dt);
  if(fireHeld&&running&&!RL.shopOpen)rlAttack();
  speedBonus=5.2*(RL.spd-1);
  if(RL.torchLight)RL.torchLight.position.set(P.x,2.2,P.z);
  rlUpdateShots(dt);rlTickFx(dt);rlTickWarns(dt);rlRoomProgress();
  const now=performance.now();
  for(const s of RL.stars){s.g.rotation.y+=dt*2.2;s.g.position.y=1.15+Math.sin(now/500+s.ph)*.16}
  if(RL.altar)RL.altar.star.rotation.y+=dt*1.1;
  for(const e of RL.enemies){
    if(e.dead||e.dormant)continue;
    if(e.pendingGlb)continue; // GLB 未就位前冻结占位模型：宁可原地站着也不让无骨骼模型平移滑行
    if(e.mixer){e.mixer.update(dt);rlEnemyAnimState(e)}
    if(!e.emis0){e.emis0=(e.mats||[]).map(mm=>mm&&mm.emissive?mm.emissive.getHex():null);e.emis0I=(e.mats||[]).map(mm=>mm&&mm.emissive?mm.emissiveIntensity:0)}
    e.hitT=Math.max(0,e.hitT-dt);e.slowT=Math.max(0,e.slowT-dt);e.stun=Math.max(0,e.stun-dt);e.atkT-=dt;
    e.reactT=Math.max(0,(e.reactT||0)-dt);
    if(e.burnT>0){e.burnT-=dt;e._burnTick=(e._burnTick||0)-dt;if(e._burnTick<=0){e._burnTick=.55;rlHurt(e,e.burnDmg||0,false,0xff6a2a);rlFxRing(e.x,.45,e.z,.35,0xff4b18,.35)}}
    if(e.corrodeT>0){e.corrodeT-=dt;e._corTick=(e._corTick||0)-dt;if(e._corTick<=0){e._corTick=.7;rlHurt(e,e.corrodeDmg||0,false,0x7dff6a);rlFxRing(e.x,.5,e.z,.42,0x75ff55,.4)}}
    if(e.riseT>0){e.riseT-=dt;e.g.position.y=-1.4*(e.riseT/1.4);continue}
    // 命中不变白：不修改任何材质颜色/emissive
    if(e.kbX||e.kbZ){
      if(!rlMoveEnemy(e,e.x+e.kbX*dt,e.z+e.kbZ*dt)){e.kbX*=.3;e.kbZ*=.3}
      const damp=Math.pow(.03,dt);e.kbX*=damp;e.kbZ*=damp;
      if(Math.abs(e.kbX)<.05)e.kbX=0;if(Math.abs(e.kbZ)<.05)e.kbZ=0;
    }
    const dx=P.x-e.x,dz=P.z-e.z,dist=Math.hypot(dx,dz)||1;
    const atkR=e.kind==='boss'?2.4:1.35;
    if(e.stun<=0&&e.reactT<=0&&dist>atkR){
      e.pt-=dt;if(e.pt<=0){e.pt=.32;e.path=rlNextStep(e.x/T|0,e.z/T|0)}
      // 与玩家同一格（路径为 null）时直接朝玩家走，避免原地发呆
      const tx=e.path?(e.path[0]+.5)*T:P.x,tz=e.path?(e.path[1]+.5)*T:P.z;
      const ax=tx-e.x,az=tz-e.z,al=Math.hypot(ax,az)||1;
      const spd=e.sp*(e.slowT>0?.42:1);
      if(al>.05){
        e.stillT=0;e.moving=true;
        if(!rlMoveEnemy(e,e.x+ax/al*spd*dt,e.z+az/al*spd*dt))
          rlMoveEnemy(e,e.x+Math.sign(ax)*spd*dt,e.z+Math.sign(az)*spd*dt);
      }else{e.stillT=(e.stillT||0)+dt;if(e.stillT>.18)e.moving=false} // 滞回：短暂停顿不打断跑步动画
    }else e.moving=false;
    if(e.stun<=0&&e.reactT<=0&&dist<=atkR&&e.atkT<=0){
      e.atkT=e.kind==='boss'?1.5:1.15;e.attackAnimT=.55;rlDamage(e.dmg);
      if(RL.thorn>0)rlHurt(e,e.dmg*RL.thorn*3,false);
    }
    if(e.attackAnimT>0)e.attackAnimT-=dt;
    if(e.kind==='boss')rlBossSkill(e,dt);
    // 面向与浮动
    e.g.position.x=e.x;e.g.position.z=e.z;
    // 纯水平移动：模型没有走路动画时不做上下浮动，避免一弹一弹的“跳跃式”走路
    if(e.riseT<=0)e.g.position.y=e.baseY;
    // 面向：转身有速度上限，目标角度每 0.3~0.5 秒才刷新一次（让怪物有“反应时间”，不会永远贴脸盯着你）
    e.faceT=(e.faceT||0)-dt;
    if(e.faceT<=0){
      e.faceT=.3+Math.random()*.22;
      e.faceTarget=Math.atan2(dx,dz)+(Math.random()-.5)*.24;
    }
    if(e.faceTarget===undefined)e.faceTarget=e.g.rotation.y;
    {
      let da=e.faceTarget-e.g.rotation.y;
      da=Math.atan2(Math.sin(da),Math.cos(da));
      const maxTurn=(e.kind==='boss'?1.7:2.9)*dt;
      e.g.rotation.y+=clamp(da,-maxTurn,maxTurn);
    }
    if(e.eyes&&e.eyes.length){const sc=1+Math.sin(now/160+e.ph)*.22;e.eyes.forEach(o=>o.scale.setScalar(sc))}
    if(e.bossKey==='void'){for(const c of e.g.children){if(c.userData.sp!==undefined){const a=now/900+c.userData.sp;c.position.x=Math.cos(a)*1.4;c.position.z=Math.sin(a)*1.4}}}
    if(e.bossKey==='bloodmoon')for(const c of e.g.children){if(c.userData.orb!==undefined){const a=now/700+c.userData.orb*2.1;c.position.x=Math.cos(a)*.9;c.position.z=Math.sin(a)*.9}}
    // 视线压迫
    if(dist<9&&!e.sfxT)e.sfxT=now+3000+Math.random()*3000;
    if(e.sfxT&&now>e.sfxT){e.sfxT=now+4000+Math.random()*4000;if(Math.random()<.35&&e.kind!=='boss')whisper(.5)}
  }
  RL.hitFlash=Math.max(0,RL.hitFlash-dt*1.6);
  $('vig').style.opacity=RL.hitFlash>0?Math.min(.85,.5+RL.hitFlash*.4):(1-RL.hp/RL.maxHp)*.55;
  shake=Math.max(0,shake-dt*2);
  rlSkillRings();
  rlUpdateDmgNums(dt);
  RL.hudT+=dt;if(RL.hudT>.12){RL.hudT=0;rlUpdateHUD()}
}
function rlDamage(n){
  if(!RL.active||RL.dead)return;
  if(RL.iframe>0)return;
  if(RL.shields>0){RL.shields--;RL.hitFlash=.55;shake=.2;rlSfx('hurt');toast('护盾抵消了这次伤害！剩余 '+RL.shields);rlUpdateHUD();return}
  RL.hp-=n;RL.hitFlash=1;shake=Math.min(.7,.28+n*.012);
  rlSfx('hurt');
  if(RL.hp<=0){RL.hp=0;rlDie()}
}
function rlDodge(){
  if(!RL.active||!running||RL.shopOpen||RL.dodgeCd>0)return;
  let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  let s=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  f-=joy.dy;s+=joy.dx;
  let dx=-Math.sin(yaw)*f+Math.cos(yaw)*s,dz=-Math.cos(yaw)*f-Math.sin(yaw)*s;
  if(Math.hypot(dx,dz)<.05){dx=-Math.sin(yaw);dz=-Math.cos(yaw)}
  const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  RL.dodgeCd=2.7*RL.dodgeMul;RL.dodgeCdTotal=RL.dodgeCd;RL.iframe=.35;if(RL.classId==='ranger'){RL.passiveT=3;RL.rangerBuff=3;}
  for(let i=0;i<8;i++){P.x+=dx*.275*RL.dodgeDist;P.z+=dz*.275*RL.dodgeDist;resolve()}
  rlSfx('dodge');
  for(let k=0;k<4;k++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.34,8,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.position.set(P.x-dx*.55*k,1.05,P.z-dz*.55*k);m.scale.set(1,1.9,1);rlGroup.add(m);
    RL.fx.push({m,life:.26,t:0,type:'flash'});
  }
}
/* ---------- 商店 / 祭坛 ---------- */
function rlOpenShop(){
  if(!RL.altarReady)return;
  if(RL.shopOpen){$('rlshop').classList.remove('hide');$('rlprompt').classList.add('hide');return;}
  RL.shopOpen=true;running=false;fireHeld=false;keys.clear();
  document.exitPointerLock&&document.exitPointerLock();
  $('rlprompt').classList.add('hide');$('rlshop').classList.remove('hide');
  if(!RL.shop.length||RL.shopFloor!==RL.floor){rlShopStock();RL.shopFloor=RL.floor}rlRenderShop();rlSfx('click');
}
function rlCloseShop(){
  RL.shopOpen=false;$('rlshop').classList.add('hide');
  fireHeld=false;keys.clear();running=true;lock();rlSfx('click');
}
// 武器价格：首次购买为基础价，升星按星级递增；出售后自动回到基础价重新计算
function rlWeaponPrice(id,owned){
  const w=RWBY[id];if(!w)return 0;
  const infl=RL.endless?Math.min(2.2,1+.03*Math.max(0,RL.floor-1)):1;
  const star=owned?Math.max(1,RL.weaponStars[id]||1):0;
  const mul=owned?(.6+.25*(star-1)):1;
  return Math.max(1,Math.round(w.p*mul*infl));
}
function rlShopStock(){
  const pool=RW.filter(w=>w.w!=='torch').map(w=>w.w);const picks=[];
  for(let k=0;k<2&&pool.length;k++)picks.push({t:'w',id:pool.splice(Math.random()*pool.length|0,1)[0]});
  // 已叠满上限的增益不再出现在商店；全部满时回退为随机（购买时仍会被拦截）
  const avail=RB.filter(b=>b.id==='shield'||rlBuffNow(b.id)<rlBuffCap(b.id)).map(b=>b.id);
  const src=avail.length?avail:RB.map(b=>b.id);
  for(let k=0;k<3;k++)picks.push({t:'b',id:src[Math.random()*src.length|0]});
  RL.shop=picks.map(p=>({t:p.t,id:p.id,price:p.t==='w'?rlWeaponPrice(p.id,false):Math.round(35+RL.floor*8),sold:false}));
}
function rlStarPerks(star){const p=[];if(star>=2)p.push('爆裂：命中时造成范围爆炸伤害');if(star>=3)p.push('弹跳：额外弹跳/追击附近敌人');if(star>=4)p.push('电弧：电击附近敌人并产生蓝白电光');if(star>=5)p.push('燃烧：命中后持续灼烧并产生火焰');if(star>=6)p.push('腐蚀：持续腐蚀伤害并产生绿色腐蚀特效');return p.length?p.join('；'):'暂无额外元素特性（升至 2 星解锁爆裂）'}
function rlWeaponInfo(id){
  const w=RWBY[id];if(!w)return '空武器槽';const star=Math.max(1,RL.weaponStars[id]||1),starDmg=1+.20*(star-1),starCd=Math.max(.75,1-.05*(star-1));
  const atkMul=1+Math.max(0,RL.atk-1),dmg=Math.round(w.d*atkMul*RL.damageScale*starDmg),cd=Math.max(.07,w.c*RL.cdMul*starCd);
  const traits=rlStarPerks(star);const lines=['<b>'+w.n+'　'+('★'.repeat(star))+'☆'.repeat(6-star)+'</b>',w.ds,'类型：'+({melee:'近战',gun:'枪械',relic:'法器'}[w.k]),'当前单次基础伤害：'+dmg+(RL.endless?'（已计入无尽楼层成长）':'（闯关模式不按楼层自动加伤）'),'当前攻击间隔：'+cd.toFixed(2)+' 秒（约 '+(1/cd).toFixed(2)+' 次/秒）','攻击范围 / 射程：'+w.r+(w.k==='melee'?' 格近战范围':' 格射程'),'攻击速度：'+(1/cd).toFixed(2)+' 次/秒'];
  if(w.spd)lines.push('投射物速度：'+w.spd.toFixed(2)+' 格/秒');if(w.hits)lines.push('每次攻击投射物 / 命中数：'+w.hits);if(w.pierce||star>=3)lines.push('穿透目标数：'+((w.pierce||0)+(star>=3?1:0)));if(w.aoe)lines.push('原生范围伤害半径：'+w.aoe.toFixed(2)+' 格');if(star>=2)lines.push('升星爆裂半径：'+(.9+star*.13).toFixed(2)+' 格；爆炸追加伤害约为命中伤害的 22%');if(star>=3)lines.push('弹跳：额外追击最多 1 个附近目标，追加伤害约为当前伤害的 28%');if(star>=4)lines.push('电弧：最多电击 2 个附近目标，单个追加伤害约为当前伤害的 22%');if(star>=5)lines.push('燃烧：持续 3.2 秒，每跳约造成当前伤害的 12%');if(star>=6)lines.push('腐蚀：持续 4.5 秒，每跳约造成当前伤害的 10%');if(w.slow)lines.push('减速持续时间：'+w.slow+' 秒');if(w.chain)lines.push('原生连锁目标数：'+w.chain);lines.push('当前星级新增特性：'+traits,'升星伤害加成：+'+Math.round((starDmg-1)*100)+'%','升星攻速加成：'+Math.round((1-starCd)*100)+'%','星级上限：6 星');return lines.join('<br>');
}
function rlWeaponDetail(id){const w=RWBY[id];if(!w)return;const content=$('rlpanelcontent');content.innerHTML=rlWeaponInfo(id);$('rlpanel').classList.remove('hide');$('rlptabs').classList.add('hide');$('rlpanelclose').textContent='返回';RL.panelDetail=true;}
function rlRenderShop(){
  const box=$('rlstock');box.innerHTML='';$('rlscoins').textContent='🪙 '+RL.coins;
  RL.shop.forEach((it,i)=>{
    const d=document.createElement('div');
    if(it.t==='w'){
      const w=RWBY[it.id],owned=RL.bag.includes(it.id),star=RL.weaponStars[it.id]||0;
      it.price=rlWeaponPrice(it.id,owned);
      d.className='rlcard wpn';d.innerHTML='<div class="tag">武器 · '+({melee:'刀剑',gun:'枪械',relic:'法器'}[w.k])+'</div><div class="nm">'+w.n+(owned?'　'+('★'.repeat(star)):'')+'</div><div class="ds">'+w.ds+'<br>基础伤害 '+w.d+' · 间隔 '+w.c+'s · 范围 '+w.r+(owned?'<br>重复购买会升星，最高 6 星':'')+'</div>';
      const info=document.createElement('button');info.textContent='查看属性';info.onclick=()=>{rlWeaponDetail(it.id)};d.appendChild(info);
      const b=document.createElement('button');b.textContent=it.sold?'已售出':(owned?(star>=6?'已满星':'升星购买 · '):'购买 · ')+it.price+'🪙';
      b.disabled=it.sold||RL.coins<it.price||(owned&&star>=6);b.onclick=()=>rlBuy(i);d.appendChild(b);
    }else{
      const bf=RB.find(x=>x.id===it.id),now=it.id==='shield'?0:rlBuffNow(it.id),cap=rlBuffCap(it.id),full=it.id!=='shield'&&now>=cap;
      d.className='rlcard buf';d.innerHTML='<div class="tag">增益</div><div class="nm">'+bf.n+'</div><div class="ds">'+bf.ds+'<br>当前 '+now+(it.id==='shield'?'':' / '+cap)+' 层'+(full?' · <b>已达上限</b>':'')+'</div>';
      const b=document.createElement('button');b.textContent=it.sold?'已售出':(full?'已达上限':'购买 · '+it.price+'🪙');b.disabled=it.sold||full||RL.coins<it.price||(it.id==='shield'&&RL.shields>=RL.maxShields);b.onclick=()=>rlBuy(i);d.appendChild(b);
    }
    box.appendChild(d);
  });
  // Weapon sales are separate from the attack button, preventing accidental shop actions.
  const sales=document.createElement('div');sales.className='rlcard';sales.style.gridColumn='1 / -1';sales.innerHTML='<div class="nm">出售持有武器</div><div class="ds">出售后该槽位变为空槽，返还该武器累计投入星币的 50%；再次购买时价格从基础价重新计算。</div>';
  RL.bag.forEach((id,slot)=>{if(!id)return;const w=RWBY[id],star=RL.weaponStars[id]||1;const b=document.createElement('button');b.textContent='出售槽位 '+(slot+1)+'：'+w.n+' '+('★'.repeat(star))+'（+'+rlSellPrice(id)+'🪙）';b.onclick=()=>rlSellWeapon(slot);sales.appendChild(b)});box.appendChild(sales);
  $('rlref').disabled=RL.coins<10;$('rlnext').textContent=(!RL.endless&&RL.floor>=5)?'完成轮回 · 结算':'进入第 '+(RL.floor+1)+' 层';
}
function rlSellPrice(id){const w=RWBY[id];if(!w)return 0;const spent=RL.weaponSpent[id]||w.p*(RL.weaponStars[id]||1);return Math.max(1,Math.round(spent*.5))}
function rlSellWeapon(slot){const id=RL.bag[slot];if(!id)return;RL.coins+=rlSellPrice(id);RL.bag[slot]=null;RL.cds[slot]=0;delete RL.weaponStars[id];delete RL.weaponSpent[id];delete RL.weaponBuys[id];if(RL.slot===slot){const n=RL.bag.findIndex(Boolean);RL.slot=n<0?0:n;rlBuildGun()}rlSfx('buy');toast('已出售 '+RWBY[id].n);rlRenderShop();rlUpdateHUD()}
function rlBuy(i){
  const it=RL.shop[i];if(!it||it.sold)return;
  const owned=it.t==='w'&&RL.bag.includes(it.id);
  const price=it.t==='w'?rlWeaponPrice(it.id,owned):it.price;
  if(it.t==='b'&&it.id!=='shield'&&rlBuffNow(it.id)>=rlBuffCap(it.id)){toast('该增益已达叠加上限（'+rlBuffCap(it.id)+' 层）');return}
  if(RL.coins<price){toast('星币不足');beep(200,.12);return}
  if(it.t==='w'){
    if(owned){
      const star=RL.weaponStars[it.id]||1;if(star>=6){toast('该武器已达六星');return}RL.weaponStars[it.id]=star+1;
    }else{
      let slot=RL.bag.indexOf(null);if(slot<0){toast('武器栏已满，请先出售武器');return}
      RL.bag[slot]=it.id;RL.slot=slot;RL.cds[slot]=0;RL.weaponStars[it.id]=1;
    }
    RL.weaponSpent[it.id]=(RL.weaponSpent[it.id]||0)+price;
    RL.coins-=price;rlBuildGun();
  }else{
    if(it.id==='shield'){RL.shields=Math.min(RL.maxShields,RL.shields+1)}
    else if(it.id==='shieldmax'){RL.buffs.shieldmax=(RL.buffs.shieldmax||0)+1;rlStats();RL.shields=Math.min(RL.maxShields,RL.shields+1)}
    else{RL.buffs[it.id]=(RL.buffs[it.id]||0)+1;if(it.id==='dodgeDist')RL.dodgeDist=1+.2*RL.buffs.dodgeDist;const old=RL.maxHp;rlStats();if(it.id==='hp')RL.hp=Math.min(RL.maxHp,RL.hp+(RL.maxHp-old))}
    RL.coins-=price;it.sold=true;
  }
  rlSfx('buy');rlUpdateHUD();rlRenderShop();rlRenderLobby();
}
function rlClassSkill(){
  if(!RL.active||!running||RL.shopOpen||RL.classEcd>0)return;
  const c=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard,fx=-Math.sin(yaw),fz=-Math.cos(yaw),x=P.x+fx*1.4,z=P.z+fz*1.4;
  const ecd=({vanguard:10,gunner:14,mage:12,spirit:12,bulwark:14,ranger:10}[RL.classId]||10);
  RL.classEcd=ecd;RL.classEtime=0;RL.classEtotal=0;
  const w=RWBY[RL.bag[RL.slot]||'torch'],base=w.d*(1+Math.max(0,RL.atk-1))*RL.damageScale*(1+.20*((RL.weaponStars[RL.bag[RL.slot]||'torch']||1)-1));
  if(RL.classId==='gunner'){RL.classEtime=5;RL.classEtotal=5;RL.classBuffShot=1;toast('超载弹药！5 秒火力强化');}
  else if(RL.classId==='bulwark'){RL.classEtime=3;RL.classEtotal=3;RL.iframe=Math.max(RL.iframe,.15);rlFxRing(P.x,1,P.z,2.8,c.color,.8);for(const e of RL.enemies){if(!e.dead&&Math.hypot(e.x-P.x,e.z-P.z)<2.8)rlHurt(e,base*.9,false)}toast('钢铁守势！3 秒减伤与反击');}
  else if(RL.classId==='ranger'){RL.iframe=Math.max(RL.iframe,.28);for(let i=0;i<7;i++){P.x+=fx*.42;P.z+=fz*.42;resolve()}rlAoe(P.x,P.z,1.7,base*1.05,c.color,false,.4);rlFxRing(P.x,1,P.z,1.7,c.color,.8);toast('折跃突袭！');}
  else if(RL.classId==='vanguard'){for(let i=0;i<6;i++){P.x+=fx*.35;P.z+=fz*.35;resolve()}rlAoe(P.x+fx*.7,P.z+fz*.7,2.1,base*1.5,c.color,true,.65);rlFxRing(P.x+fx,1,P.z+fz,2,c.color,.9);toast('裂阵突袭！');}
  else if(RL.classId==='mage'){rlAoe(x,z,3,base*1.2,c.color,false,0);for(const e of RL.enemies){if(!e.dead&&Math.hypot(e.x-x,e.z-z)<3)e.slowT=Math.max(e.slowT||0,3)}rlFxRing(x,.8,z,3,c.color,.8);toast('霜雷禁域！敌人减速');}
  else {let target=RL.enemies.filter(e=>!e.dead&&!e.dormant).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];if(target&&Math.hypot(target.x-x,target.z-z)<8){rlHurt(target,base,c.color===0);rlFxRing(target.x,.8,target.z,1.1,c.color,.8)}else rlAoe(x,z,2,base,c.color,false,0);toast('灵契召回！');}
  rlSfx('slash');rlUpdateHUD();
}
function rlClassUltimate(){
  if(!RL.active||!running||RL.shopOpen)return;if((RL.ult||0)<100){toast('终极能量不足：'+Math.floor(RL.ult||0)+' / 100');return}
  const c=RL_CLASSES[RL.classId]||RL_CLASSES.vanguard,w=RWBY[RL.bag[RL.slot]||'torch'],base=w.d*(1+Math.max(0,RL.atk-1))*RL.damageScale*(1+.20*((RL.weaponStars[RL.bag[RL.slot]||'torch']||1)-1));RL.ult=0;
  RL.ultTime=0;RL.ultTotal=0;
  if(RL.classId==='vanguard'){RL.ultTime=6;RL.ultTotal=6;for(let i=0;i<4;i++)rlAoe(P.x,P.z,2.4,base*.9,c.color,true,.3);toast('血狱修罗！');}
  else if(RL.classId==='gunner'){RL.ultTime=5;RL.ultTotal=5;const fx=-Math.sin(yaw),fz=-Math.cos(yaw);for(let k=-2;k<=2;k++){const a=yaw+k*.13,dx=-Math.sin(a),dz=-Math.cos(a);rlShot({x:P.x+dx*.6,y:1.4,z:P.z+dz*.6,vx:dx*10,vz:dz*10,dmg:Math.round(base*1.25),life:12,pierce:3,aoe:1.5,col:c.color})}toast('终焉弹狱！幽影弹幕已释放');}
  else if(RL.classId==='mage'){for(let wave=0;wave<3;wave++)for(const e of [...RL.enemies])if(!e.dead&&!e.dormant){rlHurt(e,base*.75,false);if(wave===0)e.slowT=Math.max(e.slowT||0,1.2)}rlFxRing(P.x,1,P.z,7,c.color,1);toast('天罚·元素崩坏！');}
  else if(RL.classId==='spirit'){const targets=RL.enemies.filter(e=>!e.dead&&!e.dormant);targets.forEach((e,i)=>{rlHurt(e,base*1.25,false);rlFxRing(e.x,.8,e.z,1.7,c.color,.75)});rlAoe(P.x,P.z,4,base*.8,c.color,false,0);toast('百鬼归墟！');}
  else if(RL.classId==='bulwark'){RL.shields=Math.min(RL.maxShields,RL.shields+1);RL.iframe=Math.max(RL.iframe,1.5);rlAoe(P.x,P.z,4,base*1.7,c.color,false,.9);rlFxRing(P.x,.7,P.z,4,c.color,1);toast('不灭壁垒！');}
  else {const fx=-Math.sin(yaw),fz=-Math.cos(yaw);for(let dash=0;dash<5;dash++){for(let i=0;i<4;i++){P.x+=fx*.42;P.z+=fz*.42;resolve()}rlAoe(P.x,P.z,1.8,base*1.2,c.color,true,.35);rlFxRing(P.x,.9,P.z,1.6,c.color,.65)}rlAoe(P.x,P.z,3,base*2.5,c.color,false,.4);toast('万象断界！');}
  rlSfx('warn');rlUpdateHUD();
}
function rlSwap(){
  if(!RL.active)return;
  RL.slot=(RL.slot+1)%3;rlBuildGun();rlSfx('click');rlUpdateHUD();
}
function rlNextFloor(){
  $('rlshop').classList.add('hide');RL.shopOpen=false;
  const cleared=RL.floor;
  if(!RL.endless&&cleared>=5){rlFinish(true);return}
  RL.floor++;
  if(RL.endless&&cleared%5===0){
    // 诅咒可重复叠加，但每条最多 2 层，保证高层仍持续有压力
    const rem=RD.filter(d=>RL.deb.filter(x=>x===d.id).length<2);
    if(rem.length){const d=rem[Math.random()*rem.length|0];RL.deb.push(d.id);toast('⚠ 轮回诅咒：'+d.n+' · '+d.ds)}
  }
  rlStats();
  if(RL.buffs.heal)RL.hp=Math.min(RL.maxHp,RL.hp+12*Math.min(3,RL.buffs.heal));
  RL.hp=Math.min(RL.maxHp,RL.hp);
  rlBuildFloor();running=true;lock();beep(520,.1);
  toast('第 '+RL.floor+' 层'+(RL.endless&&RL.floor%5===0?' · BOSS 层':''));
}
function rlFinish(win){
  RL.run=false;RL.dead=!win;running=false;
  document.exitPointerLock&&document.exitPointerLock();
  const mult=RLD[RL.diffKey].frag*(RL.endless?1.4:1);
  RL.frags=Math.round((RL.floor*7+RL.kills*1.6)*(win?1.7:1)*mult);
  FRAG+=RL.frags;rlSaveFrag();
  rlHud(false);rlSfx(win?'win':'dead');
  show(win?'rlwin':'rldead');
}
function rlDie(){
  if(RL.dead)return;
  RL.dead=true;scream(1);shake=.6;rlStopBgm();
  rlFinish(false);
}
/* ---------- 输入绑定 ---------- */
addEventListener('keydown',e=>{
  if(gameMode!=='roguelike')return;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(!e.repeat){e.preventDefault();rlDodge()}return}
  if(e.code==='KeyE'&&!e.repeat){e.preventDefault();rlClassSkill();return}
  if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();rlClassUltimate();return}
  if(e.code==='KeyF'&&!e.repeat&&RL.active&&RL.altarReady&&RL.altarPos&&Math.hypot(RL.altarPos.x-P.x,RL.altarPos.z-P.z)<3){e.preventDefault();rlOpenShop();return}
  if(e.code==='Digit1'&&!e.repeat){RL.slot=0;rlBuildGun();rlUpdateHUD()}
  else if(e.code==='Digit2'&&!e.repeat){RL.slot=1;rlBuildGun();rlUpdateHUD()}
  else if(e.code==='Digit3'&&!e.repeat){RL.slot=2;rlBuildGun();rlUpdateHUD()}
  else if(e.code==='Tab'&&!e.repeat){e.preventDefault();rlSwap()}
});
$('rlweps').addEventListener('click',e=>{if(RL.active&&!running&& !RL.shopOpen&&!$('rlpanel').classList.contains('hide')){const el=e.target.closest('.rlslot');if(el){const id=RL.bag[+el.dataset.s];if(id)rlWeaponDetail(id)}}});
$('rlswap').addEventListener('pointerdown',e=>{e.preventDefault();rlSwap()});
$('rldodge').addEventListener('pointerdown',e=>{e.preventDefault();rlDodge()});
$('rle').addEventListener('pointerdown',e=>{e.preventDefault();rlClassSkill()});$('rlq').addEventListener('pointerdown',e=>{e.preventDefault();rlClassUltimate()});

function rlOpenPanel(tab='stats'){
  if(!RL.active||RL.shopOpen)return;running=false;fireHeld=false;keys.clear();document.exitPointerLock&&document.exitPointerLock();$('rlpanel').classList.remove('hide');$('rlptabs').classList.remove('hide');RL.panelDetail=false;rlRenderPanel(tab);rlSfx('click');
}
function rlRenderPanel(tab='stats'){
  document.querySelectorAll('#rlptabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));const box=$('rlpanelcontent');
  if(tab==='weapons'){
    box.innerHTML='<p>点击武器可查看详细属性。出售武器请前往祭坛商店。</p>'+RL.bag.map((id,i)=>id?'<button class="rlpweapon" data-w="'+id+'">槽位 '+(i+1)+' · '+RWBY[id].n+'　'+('★'.repeat(RL.weaponStars[id]||1))+'<br>当前伤害 '+Math.round(RWBY[id].d*(1+Math.max(0,RL.atk-1))*RL.damageScale*(1+.20*((RL.weaponStars[id]||1)-1)))+' · 攻击间隔 '+Math.max(.07,RWBY[id].c*RL.cdMul*Math.max(.75,1-.05*((RL.weaponStars[id]||1)-1))).toFixed(2)+' 秒</button>':'<div class="rlpweapon">槽位 '+(i+1)+' · 空</div>').join('');box.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>rlRenderPanelWeapon(b.dataset.w));
  }else{
    const b=RL.buffs;const buffs=Object.keys(b).filter(k=>b[k]).map(k=>{const x=RB.find(v=>v.id===k);return x?x.n+' ×'+b[k]+'：'+x.ds:k+' ×'+b[k]}).join('<br>')||'无';
    const deb=RL.deb.map(k=>{const x=RD.find(v=>v.id===k);return x?x.n+'：'+x.ds:k}).join('<br>')||'无';
    box.innerHTML='<b>基础状态</b><br>模式：'+(RL.endless?'无尽轮回':'闯关轮回')+'<br>楼层 / 房间：'+RL.floor+' / '+RL.room+'<br>生命：'+Math.ceil(RL.hp)+' / '+RL.maxHp+'<br>护盾：'+RL.shields+' / '+RL.maxShields+'（每个抵消一次受击）<br>攻击倍率：'+(RL.atk*RL.damageScale).toFixed(2)+'×'+(RL.endless?'（无尽逐层成长）':'（闯关不自动逐层成长）')+'<br>移动速度倍率：'+RL.spd.toFixed(2)+'×<br>攻击间隔倍率：'+RL.cdMul.toFixed(2)+'×<br>吸血：'+(RL.ls*100).toFixed(1)+'%<br>暴击率：'+(RL.crit*100).toFixed(1)+'%<br>荆棘反伤：'+(RL.thorn*100).toFixed(0)+'%<br>闪避冷却倍率：'+RL.dodgeMul.toFixed(2)+'×<br>闪避距离倍率：'+RL.dodgeDist.toFixed(2)+'×<br>星币：'+RL.coins+'<br><hr><b>增益 Buff</b><br>'+buffs+'<br><hr><b>负面效果</b><br>'+deb;
  }
}
function rlRenderPanelWeapon(id){const box=$('rlpanelcontent');box.innerHTML=rlWeaponInfo(id)+'<p><button id="rlbackweps">返回武器列表</button></p>';$('rlbackweps').onclick=()=>rlRenderPanel('weapons')}
$('rlchar').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();rlOpenPanel('stats')});
$('rlptabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)rlRenderPanel(b.dataset.tab)});
$('rlpanelclose').addEventListener('click',()=>{$('rlpanel').classList.add('hide');RL.panelDetail=false;if(RL.active&&!RL.dead&&!RL.shopOpen){running=true;lock()}});
$('rlprompt').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
$('rlprompt').addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();if(RL.altarReady)rlOpenShop()});
$('rlprompt').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(RL.altarReady)rlOpenShop()});
$('rlref').onclick=()=>{if(RL.coins<10){toast('星币不足');beep(200,.12);return}RL.coins-=10;rlShopStock();RL.shopFloor=RL.floor;rlRenderShop();rlUpdateHUD();rlSfx('click')};
$('rlnext').onclick=()=>rlNextFloor();
$('rlclose').onclick=e=>{e.preventDefault();e.stopPropagation();rlCloseShop()};
RL.endless=!!rlEndless;RL.diffKey=rlDiff;
rlBuildGun();rlGun.visible=false;
rlready=true;
const clock=new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(running){
    elapsed+=dt;
    if(keys.has('ArrowLeft'))yaw+=2.7*dt;if(keys.has('ArrowRight'))yaw-=2.7*dt;
    const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),
          s=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),sp=5.2+speedBonus;
    const F=f-joy.dy,Sx=s+joy.dx;
    let tx=(-Math.sin(yaw)*F+Math.cos(yaw)*Sx),tz=(-Math.cos(yaw)*F-Math.sin(yaw)*Sx);
    const l=Math.hypot(tx,tz)||1;if(l>1){tx/=l;tz/=l}
    const k=1-Math.exp(-14*dt);vel.x+=(tx*sp-vel.x)*k;vel.z+=(tz*sp-vel.z)*k;
    P.x+=vel.x*dt;P.z+=vel.z*dt;resolve();mode==='puzzle'?ptick(dt):(gameMode==='roguelike'?rlTick(dt):tick(dt));
    bob+=Math.hypot(vel.x,vel.z)*dt*2.2;
    if(gameMode!=='roguelike'){
    const ci=P.x/T,cj=P.z/T;
    for(let j=Math.floor(cj-2);j<=Math.ceil(cj+2);j++)for(let i=Math.floor(ci-2);i<=Math.ceil(ci+2);i++)
      if(i>=0&&j>=0&&i<S&&j<S&&Math.hypot(i+.5-ci,j+.5-cj)<2.1)explored[j*S+i]=1;
    for(let n=gems.length-1;n>=0;n--){const g=gems[n];
      if(Math.hypot(g.m.position.x-P.x,g.m.position.z-P.z)<1){group.remove(g.m);gems.splice(n,1);got++;$('gc').textContent=got;beep(760+got*40)}}
    $('gt').textContent=gems.length+got;
    if(running&&(mode!=='puzzle'||layer===topL)&&Math.hypot(exit.position.x-P.x,exit.position.z-P.z)<1.4){running=false;document.exitPointerLock&&document.exitPointerLock();beep(988,.4);show('win')}
    }else rlExplore(dt);
    $('tm').textContent=fmt(elapsed);
  }
  for(const g of gems){g.m.rotation.y=t*1.8+g.ph;g.m.position.y=1+Math.sin(t*2+g.ph)*.15}
  exit.userData.star.rotation.y=t*2;exit.userData.star.position.y=1.5+Math.sin(t*2.4)*.2;
  cam.position.set(P.x+(Math.random()-.5)*shake,1.6+(P.y||0)+Math.sin(bob)*.06+(Math.random()-.5)*shake,P.z+(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*2);cam.rotation.set(pitch,yaw,Math.sin(bob*.5)*.012*Math.min(Math.hypot(vel.x,vel.z)/5.2,1));
  gunAnim(dt,t);if(gameMode==='roguelike')rlWeaponAnim(dt,t);envUpdate(t,dt);lamp.position.copy(cam.position);
  drawMap();ren.clear();ren.render(scene,cam);ren.clearDepth();ren.render(gunScene,gunCam);
}
build();show('start');loop();
