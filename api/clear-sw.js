export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>루아 - Cache Clear</title>
<style>
body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F4F4F4;color:#191F28;text-align:center}
.box{padding:40px 24px}
h2{font-size:18px;margin-bottom:12px}
p{font-size:14px;color:#8B95A1;line-height:1.6}
.spinner{width:32px;height:32px;border:3px solid #eee;border-top-color:#7C5CFC;border-radius:50%;animation:spin 0.8s linear infinite;margin:20px auto}
@keyframes spin{to{transform:rotate(360deg)}}
.safe{color:#22c55e;font-weight:600}
</style></head><body><div class="box">
<h2>캐시를 초기화하고 있어요</h2>
<div class="spinner"></div>
<p id="status">데이터를 백업하는 중...</p>
<script>
(async function(){
  var s=document.getElementById('status');
  try{
    // Step 1: 데이터 백업 (IndexedDB에 localStorage 스냅샷)
    s.textContent='데이터를 안전하게 백업하는 중...';
    var backupData={};
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(key&&(key.startsWith('nou_')||key.startsWith('lua_')||key==='baselineImage')){
        backupData[key]=localStorage.getItem(key);
      }
    }
    var keyCount=Object.keys(backupData).length;
    if(keyCount>0){
      var recordCount=0;
      try{var raw=backupData['nou_skin_records'];if(raw)recordCount=(raw.match(/"id":/g)||[]).length;}catch(e){}
      var backup={id:'latest',timestamp:Date.now(),keyCount:keyCount,recordCount:recordCount,data:backupData};
      await new Promise(function(resolve,reject){
        var req=indexedDB.open('nou_backup_db',1);
        req.onupgradeneeded=function(e){
          var db=e.target.result;
          if(!db.objectStoreNames.contains('backups'))db.createObjectStore('backups',{keyPath:'id'});
        };
        req.onsuccess=function(){
          var db=req.result;
          var tx=db.transaction('backups','readwrite');
          tx.objectStore('backups').put(backup);
          tx.oncomplete=resolve;
          tx.onerror=function(){reject(tx.error);};
        };
        req.onerror=function(){reject(req.error);};
      });
      s.innerHTML='<span class="safe">데이터 백업 완료 ('+keyCount+'개 항목)</span>';
    }

    // Step 2: 서비스 워커 해제
    if('serviceWorker' in navigator){
      var regs=await navigator.serviceWorker.getRegistrations();
      for(var r of regs){await r.unregister();}
      s.innerHTML+='<br/>서비스 워커 해제 완료 ('+regs.length+'개)';
    }

    // Step 3: 캐시 삭제 (SW 캐시만 — localStorage/IndexedDB는 보존)
    if('caches' in window){
      var names=await caches.keys();
      for(var n of names){await caches.delete(n);}
      s.innerHTML+='<br/>캐시 삭제 완료 ('+names.length+'개)';
    }

    s.innerHTML+='<br/><br/><span class="safe">피부 기록은 안전하게 보존되었어요!</span><br/>잠시 후 이동합니다...';
    setTimeout(function(){window.location.href='/?t='+Date.now();},2000);
  }catch(e){
    s.textContent='오류: '+e.message+'\\n데이터는 안전합니다. 잠시 후 이동합니다...';
    setTimeout(function(){window.location.href='/?t='+Date.now();},2500);
  }
})();
</script></div></body></html>`);
}
