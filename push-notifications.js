import {firebaseConfig,vapidKey} from './push-config.js';
const panel = document.getElementById('pushNotificationPanel');
const status = document.getElementById('pushNotificationStatus');
const enable = document.getElementById('enablePushNotification');
const disable = document.getElementById('disablePushNotification');
const optKey = 'attendancePushEnabled';
let busy = false, sdkPromise, refreshed = false;
const identity = () => ({employee:localStorage.getItem('employeeName') || '',deviceId:localStorage.getItem('attendanceDeviceId') || ''});
function allowed() { return identity().employee === 'テスト' && typeof isDeviceApproved === 'function' && isDeviceApproved(); }
function render() {
  panel.hidden = !allowed();
  enable.disabled = disable.disabled = busy;
  disable.hidden = localStorage.getItem(optKey) !== 'true';
}
function sdk() {
  if (!sdkPromise) sdkPromise = Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js')
  ]).then(async ([app,msg]) => {
    if (!await msg.isSupported()) throw new Error('この端末ではプッシュ通知を利用できません。iPhoneはホーム画面に追加したアプリから開いてください。');
    const messaging=msg.getMessaging(app.initializeApp(firebaseConfig,'attendance-push'));
    msg.onMessage(messaging,async payload => {
      if (!allowed() || localStorage.getItem(optKey)!=='true') return;
      const registration=await navigator.serviceWorker.getRegistration('./');
      if (registration && payload.notification) await registration.showNotification(payload.notification.title || '現場管理システム',{body:payload.notification.body || '',icon:'./icon.png',tag:'attendance-foreground',data:{FCM_MSG:payload}});
    });
    return {msg,messaging};
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}
async function post(token,enabled,user) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(),30000);
  try {
    const response = await fetch(webAppUrl,{method:'POST',body:JSON.stringify({action:'registerPushNotification',...user,token,enabled}),signal:controller.signal});
    const result = await response.json();
    if (result.result !== 'success') throw new Error(result.message || '通知設定を保存できませんでした。');
  } finally { clearTimeout(timer); }
}
async function register() {
  const user = identity();
  const {msg,messaging} = await sdk();
  const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  const token = await msg.getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});
  if (!token) throw new Error('通知の登録情報を取得できませんでした。');
  if (!allowed() || JSON.stringify(user) !== JSON.stringify(identity())) throw new Error('社員設定が変わりました。もう一度設定してください。');
  await post(token,true,user);
  localStorage.setItem(optKey,'true');
  localStorage.setItem('attendancePushToken',token);
  status.textContent = '通知は有効です。現在はテスト社員のみが対象です。';
}
enable.onclick = async () => {
  if (!allowed() || busy) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) { status.textContent='この環境では通知を利用できません。iPhoneはホーム画面に追加したアプリで開いてください。'; return; }
  busy = true; render();
  try {
    // iOSではユーザー操作の直後に許可を求める必要がある。
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('通知が許可されていません。端末の通知設定を確認してください。');
    status.textContent='通知を登録しています…';
    await register();
  } catch (error) { status.textContent = error.name === 'AbortError' ? '通信がタイムアウトしました。もう一度お試しください。' : error.message; }
  finally { busy=false; render(); }
};
disable.onclick = async () => {
  if (!allowed() || busy) return;
  busy=true; render();
  try {
    const token=localStorage.getItem('attendancePushToken');
    if (token) await post(token,false,identity());
    localStorage.removeItem(optKey);
    status.textContent='通知を停止しました。';
  } catch (error) { status.textContent='停止できませんでした。通信状態を確認して再度お試しください。'; }
  finally {busy=false;render();}
};
// 保存済みの許可がある場合のみ、起動時にトークンを更新する。許可画面は自動表示しない。
const timer=setInterval(async () => {
  render();
  if (!refreshed && allowed() && localStorage.getItem(optKey)==='true' && 'Notification' in window && Notification.permission==='granted') {
    refreshed=true;
    try { await register(); } catch (_) { status.textContent='通知設定を更新できませんでした。「通知を有効にする」で再設定できます。'; }
  }
},2000);
window.addEventListener('pagehide',() => clearInterval(timer),{once:true});
render();
