/* app.js — Firebase-powered frontend controller (real) */
/* Mobile-first, works with styles.css and map-logic.js.
   Important: add your Firebase client config to firebase-config.js
*/

(async function(){
  // helpers
  function q(id){return document.getElementById(id)}
  function el(tag,cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function toast(msg,t=2200){ const n=el('div','_toast'); n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),t); }
  function toFixedNum(n,dec=1){ return Math.round(n*Math.pow(10,dec))/Math.pow(10,dec); }
  function distanceKm(a,b){ const R=6371; const toRad=(x)=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat); const dLon=toRad(b.lng-a.lng); const A=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)*Math.sin(dLon/2); const C=2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A)); return R*C; }

  // init firebase
  if(window.FIREBASE_CLIENT_CONFIG){
    if(!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CLIENT_CONFIG);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    try{ await firebase.firestore().enablePersistence({synchronizeTabs:true}); }catch(e){}
  } else {
    console.warn('Firebase client config missing in firebase-config.js');
  }

  // state
  let mode = localStorage.getItem('search_mode') || null; // passenger | driver
  let currentUser = null;
  let userHasAccess = false; // paid today
  let passengerPublished = null;
  let myDriverRef = null;
  let driversUnsub = null, userPaidUnsub = null;

  // require mode for dashboard
  if(location.pathname.endsWith('dashboard.html')){
    if(!mode) location.href='index.html';
  }

  // common DOM wiring
  document.addEventListener('DOMContentLoaded', ()=>{
    // header toggles
    const togglePass = q('toggle-pass'), toggleDrive = q('toggle-drive');
    if(togglePass && toggleDrive){
      const setActive = (m)=>{ if(m==='passenger'){ togglePass.classList.add('active'); toggleDrive.classList.remove('active'); } else { toggleDrive.classList.add('active'); togglePass.classList.remove('active'); } };
      setActive(mode);
      togglePass.addEventListener('click', ()=>{ mode='passenger'; localStorage.setItem('search_mode',mode); setActive(mode); adaptUI(); subscribeForMode(); });
      toggleDrive.addEventListener('click', ()=>{ mode='driver'; localStorage.setItem('search_mode',mode); setActive(mode); adaptUI(); subscribeForMode(); });
    }

    q('ui-mode-pass') && q('ui-mode-pass').addEventListener('click', ()=>{ mode='passenger'; localStorage.setItem('search_mode',mode); adaptUI(); subscribeForMode(); });
    q('ui-mode-drive') && q('ui-mode-drive').addEventListener('click', ()=>{ mode='driver'; localStorage.setItem('search_mode',mode); adaptUI(); subscribeForMode(); });

    q('signout') && q('signout').addEventListener('click', async ()=>{ if(window.auth){ await auth.signOut(); location.href='index.html'; } else location.href='index.html'; });

    q('locate') && q('locate').addEventListener('click', ()=>{ if(window.focusOnMe) window.focusOnMe(); });
    q('toggle-panel') && q('toggle-panel').addEventListener('click', ()=>{ const cp=q('control-panel'); cp.style.display=(cp.style.display==='none'?'block':'none'); });

    q('publish-btn') && q('publish-btn').addEventListener('click', ()=>{ if(mode==='passenger') publishPassenger(); else publishDriver(); });
    q('find-btn') && q('find-btn').addEventListener('click', ()=>{ if(mode==='passenger') findDrivers(); });

    q('save-fav') && q('save-fav').addEventListener('click', saveFavorite);
    q('panic') && q('panic').addEventListener('click', async ()=>{ if(!currentUser){ toast('Sign in first'); return; } if(confirm('Send SOS?')){ await db.collection('sos').add({ uid: currentUser.uid, ts: firebase.firestore.FieldValue.serverTimestamp(), loc: window.myPos||null }); toast('SOS sent'); } });

    // start map
    if(window.setupMap) window.setupMap();
    if(window.startGeoWatch) window.startGeoWatch();

    adaptUI();
    renderFavorites();
    // auth listeners
    if(window.auth) initAuth();
  });

  // AUTH
  function initAuth(){
    auth.onAuthStateChanged(user=>{
      currentUser = user;
      if(user){
        q('user-badge') && (q('user-badge').textContent = user.displayName || user.email);
        // ensure user doc exists
        db.collection('users').doc(user.uid).set({ name: user.displayName||'', email:user.email||'', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        watchUserPaid(user.uid);
        subscribeForMode();
      } else {
        q('user-badge') && (q('user-badge').textContent = 'Guest');
        if(location.pathname.endsWith('dashboard.html')) {
          // redirect to login page for security / smoothness
          location.href='login.html';
        }
      }
    });
  }

  // watch user's paidDate
  function watchUserPaid(uid){
    if(userPaidUnsub) userPaidUnsub();
    userPaidUnsub = db.collection('users').doc(uid).onSnapshot(snap=>{
      const d = snap.exists? snap.data(): null;
      const today = new Date().toISOString().slice(0,10);
      userHasAccess = d && d.paidDate === today;
      q('access-flag') && (q('access-flag').textContent = userHasAccess ? 'Paid (today)' : 'Not paid');
    });
  }

  // UI adaptation
  function adaptUI(){
    const controls = q('controls'), driverCard = q('driver-list-card');
    const welcomeTitle = q('welcome-title'), sub = q('sub-welcome');
    if(mode==='passenger'){
      if(controls) controls.style.display='block';
      if(driverCard) driverCard.style.display = passengerPublished ? 'block' : 'none';
      if(welcomeTitle) welcomeTitle.textContent='Passenger mode';
      if(sub) sub.textContent = passengerPublished ? 'Published — drivers available' : 'Enter pickup & destination then publish';
      q('find-btn') && (q('find-btn').disabled = false);
      q('publish-btn') && (q('publish-btn').textContent = passengerPublished ? 'Update my destination' : 'Publish');
    } else {
      if(controls) controls.style.display='block';
      if(driverCard) driverCard.style.display='block';
      if(welcomeTitle) welcomeTitle.textContent='Driver mode';
      if(sub) sub.textContent='Publish your vehicle to appear to passengers';
      q('find-btn') && (q('find-btn').disabled = true);
      q('publish-btn') && (q('publish-btn').textContent = 'Publish');
    }
  }

  // FAVORITES
  function saveFavorite(){
    const dest = (q('dest-input') && q('dest-input').value||'').trim();
    if(!dest) return toast('Type destination then save');
    if(!currentUser) return toast('Sign in first');
    db.collection('users').doc(currentUser.uid).collection('favorites').add({ name: dest, ts: firebase.firestore.FieldValue.serverTimestamp() })
      .then(()=> { toast('Saved'); renderFavorites(); }).catch(()=>toast('Failed to save'));
  }
  async function renderFavorites(){
    const ul = q('fav-list'); if(!ul) return;
    ul.innerHTML = '';
    if(!currentUser) return;
    const snap = await db.collection('users').doc(currentUser.uid).collection('favorites').orderBy('ts','desc').limit(8).get();
    snap.forEach(d=>{ const li=el('li'); li.textContent = d.data().name; li.addEventListener('click', ()=> { q('dest-input').value = d.data().name; toast('Destination selected'); }); ul.appendChild(li); });
  }

  // Publish passenger
  async function publishPassenger(){
    if(!currentUser) { toast('Sign in first'); location.href='login.html'; return; }
    if(!userHasAccess){ if(!confirm('You must pay ₦100 for today to use this. Go to payment page?')) return; location.href='payment.html'; return; }
    const pickup = (q('pickup-input') && q('pickup-input').value||'').trim();
    const dest = (q('dest-input') && q('dest-input').value||'').trim();
    if(!pickup||!dest) return toast('Enter pickup & destination');
    const loc = window.myPos || null;
    await db.collection('passengers').doc(currentUser.uid).set({
      uid: currentUser.uid, name: currentUser.displayName || currentUser.email,
      pickup, dest, loc, active:true, ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    passengerPublished = { pickup, dest, loc, ts: Date.now() };
    toast('Published — searching drivers');
    adaptUI();
    findDrivers();
  }

  // Publish driver
  async function publishDriver(){
    if(!currentUser){ toast('Sign in first'); location.href='login.html'; return; }
    if(!userHasAccess){ if(!confirm('You must pay ₦100 for today to use this. Go to payment page?')) return; location.href='payment.html'; return; }
    if(!navigator.geolocation) return toast('Allow location in browser');
    const seats = parseInt((q('seats-input') && q('seats-input').value)||'0',10) || 0;
    const price = (q('price-input') && q('price-input').value) || null;
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude, lng=pos.coords.longitude;
      myDriverRef = db.collection('drivers').doc(currentUser.uid);
      await myDriverRef.set({ uid: currentUser.uid, name: currentUser.displayName||currentUser.email, loc:{lat,lng}, seats, price, active:true, ts: firebase.firestore.FieldValue.serverTimestamp() });
      if(window.pushDriverMarker) window.pushDriverMarker({ pos:{lat,lng}, name:(currentUser.displayName||'You').split(' ')[0], seats, price });
      toast('Driver published');
      adaptUI();
    }, ()=> toast('Allow GPS'), { enableHighAccuracy:true });
  }

  // Find drivers: simple distance-based query
  async function findDrivers(){
    if(!currentUser) { toast('Sign in first'); return; }
    const myPos = window.myPos || { lat:6.5244, lng:3.3792 }; // fallback Lagos
    try{
      const snap = await db.collection('drivers').where('active','==',true).limit(50).get();
      const arr = [];
      snap.forEach(d=>{
        const data = d.data();
        if(!data.loc) return;
        const km = toFixedNum(distanceKm(myPos, { lat:data.loc.lat, lng:data.loc.lng }),1);
        arr.push({ uid:d.id, name: data.name, km, seats: data.seats||0, price: data.price||'', lat:data.loc.lat, lng:data.loc.lng });
      });
      arr.sort((a,b)=>a.km - b.km);
      renderDriverList(arr);
    }catch(e){ toast('Failed to load drivers'); console.error(e); }
  }

  function renderDriverList(list){
    const container = q('drivers-list'); if(!container) return;
    container.innerHTML = '';
    if(!list.length){ container.innerHTML = '<div class="muted small">No drivers found</div>'; q('driver-list-card') && (q('driver-list-card').style.display='block'); return; }
    list.slice(0,12).forEach(d=>{
      const card = el('div','driver-card');
      card.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${d.name}</strong><div class="muted small">⭐ — ${d.km} km</div></div><div><strong>₦${d.price||'—'}</strong></div></div>`;
      const btn = el('button','primary'); btn.textContent='Choose';
      btn.addEventListener('click', ()=> chooseDriver(d));
      const row = el('div','row'); row.style.marginTop='8px'; row.appendChild(btn);
      card.appendChild(row);
      container.appendChild(card);
    });
    q('driver-list-card') && (q('driver-list-card').style.display='block');
  }

  function chooseDriver(driver){
    if(!currentUser){ toast('Sign in first'); return; }
    // create trip
    const tripRef = db.collection('trips').doc();
    tripRef.set({ passengerUid: currentUser.uid, driverUid: driver.uid, status:'requested', ts: firebase.firestore.FieldValue.serverTimestamp() })
      .then(()=> { toast('Request sent'); if(window.map) window.map.setView([driver.lat, driver.lng],14); })
      .catch(()=> toast('Request failed'));
  }

  // Subscribe drivers on map & passengers if driver mode
  function subscribeForMode(){
    if(!db) return;
    if(driversUnsub) { driversUnsub(); driversUnsub = null; }
    if(passengersUnsub) { passengersUnsub(); passengersUnsub = null; }
    driversUnsub = db.collection('drivers').where('active','==',true).onSnapshot(snap=>{
      const list=[];
      snap.forEach(d=>{ const data=d.data(); if(!data.loc) return; list.push({ name:(data.name||'D').split(' ')[0], pos:{ lat:data.loc.lat, lng:data.loc.lng }, meta:data }); });
      if(window.showDemoDrivers) window.showDemoDrivers(list);
    });
  }

  // favorites & startup
  function renderFavorites(){ if(currentUser) db.collection('users').doc(currentUser.uid).collection('favorites').orderBy('ts','desc').limit(8).get().then(snap=>{ const ul=q('fav-list'); if(!ul) return; ul.innerHTML=''; snap.forEach(d=>{ const li=el('li'); li.textContent=d.data().name; li.addEventListener('click', ()=> { q('dest-input').value = d.data().name; toast('Destination selected'); }); ul.appendChild(li); }); }).catch(()=>{}); }

  // start: watch auth
  if(window.auth){
    auth.onAuthStateChanged(user=>{
      currentUser = user;
      if(user) { q('user-badge') && (q('user-badge').textContent = user.displayName||user.email); watchUserPaid(user.uid); renderFavorites(); subscribeForMode(); }
      else { /* redirect handled earlier */ }
    });
  }

  // expose some functions
  window.publishDriver = publishDriver;
  window.publishPassenger = publishPassenger;
  window.findDrivers = findDrivers;

})();
