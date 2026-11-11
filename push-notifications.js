import {firebaseConfig,vapidKey} from './push-config.js';
const panel = document.getElementById('pushNotificationPanel');
const status = document.getElementById('pushNotificationStatus');
const enable = document.getElementById('enablePushNotification');
const disable = document.getElementById('disablePushNotification');
const optKey = 'attendancePushEnabled';
const notificationSummary = document.getElementById('pushNotificationSummary');
let lastEnabledState;
let busy = false, sdkPromise, refreshed = false;
let invitationShown = false;
const invitation = document.createElement('dialog');
invitation.setAttribute('aria-labelledby','pushInvitationTitle');
invitation.style.cssText='width:min(360px,calc(100% - 32px));box-sizing:border-box;padding:24px;border:1px solid #d6cbb9;border-radius:16px;background:#faf8f3;color:#30383e;box-shadow:0 12px 40px #0003';
invitation.innerHTML=`<h2 id="pushInvitationTitle" style="font-size:21px;margin:0 0 12px">締め日のお知らせを受け取る</h2>
<p style="font-size:16px;line-height:1.6">毎月20日に出勤履歴の確認をお知らせします。</p>
<p style="font-size:14px;line-height:1.5">次の画面で「許可」を選ぶと、アプリを閉じていても通知が届きます。</p>
<p style="font-size:14px;line-height:1.5">スマホではホーム画面に追加したアプリから設定してください。</p>
<p id="pushInvitationStatus" role="status" style="font-size:14px;line-height:1.5"></p>
<button id="pushInvitationAccept" type="button" style="width:100%;min-height:48px;border:0;border-radius:10px;background:#14523e;color:white;font-size:17px;font-weight:bold">通知を受け取る</button>
<button id="pushInvitationLater" type="button" style="width:100%;min-height:44px;margin-top:8px;border:1px solid #d6cbb9;border-radius:10px;background:white;font-size:15px">拒否する</button>`;
document.body.append(invitation);
const accept = invitation.querySelector('#pushInvitationAccept');
const later = invitation.querySelector('#pushInvitationLater');
const invitationStatus = invitation.querySelector('#pushInvitationStatus');
const rejectionKey = () => 'attendancePushInvitationRejected:'+identity().employee;
function rejectInvitation() {
  localStorage.setItem(rejectionKey(),'true');
  invitation.close();
}
later.onclick = rejectInvitation;
invitation.addEventListener('cancel',event => {event.preventDefault();if (!busy) rejectInvitation();});
function maybeInvite() {
  if (invitationShown || busy || !allowed() || localStorage.getItem(optKey)==='true') return;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission==='denied') return;
  const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if (appleMobile && !navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem(rejectionKey())==='true' || typeof invitation.showModal!=='function') return;
  invitationShown=true;
  invitation.showModal();
}
const identity = () => ({employee:localStorage.getItem('employeeName') || '',deviceId:localStorage.getItem('attendanceDeviceId') || ''});
function allowed() { return identity().employee === 'テスト' && typeof isDeviceApproved === 'function' && isDeviceApproved(); }
function render() {
  panel.hidden = !allowed();
  enable.disabled = disable.disabled = busy;
  accept.disabled = later.disabled = busy;
  const enabledState = localStorage.getItem(optKey) === 'true';
  disable.hidden = !enabledState;
  enable.hidden = enabledState;
  notificationSummary.textContent = enabledState ? '締め日の通知：有効' : '締め日の通知（テスト）';
  if (enabledState !== lastEnabledState) {
    panel.open = !enabledState;
    lastEnabledState = enabledState;
  }
  if (!allowed() && invitation.open) invitation.close();
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
      // 通知クリックで既存画面が再利用された場合も案内を表示する。
      if (payload.fcmOptions?.link?.includes('attendanceNotice=deadline')) {
        window.dispatchEvent(new Event('attendance-deadline-notice'));
      }
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
  if (invitation.open) invitation.close();
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
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? '通信がタイムアウトしました。もう一度お試しください。' : error.message;
    invitationStatus.textContent = status.textContent;
  }
  finally { busy=false; render(); }
};
// クリックの同じ処理内で許可を求め、iPhoneのユーザー操作条件を維持する。
accept.onclick = () => enable.onclick();
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
  maybeInvite();
  if (!refreshed && allowed() && localStorage.getItem(optKey)==='true' && 'Notification' in window && Notification.permission==='granted') {
    refreshed=true;
    try { await register(); } catch (_) { status.textContent='通知設定を更新できませんでした。「通知を有効にする」で再設定できます。'; }
  }
},2000);
window.addEventListener('pagehide',() => clearInterval(timer),{once:true});
render();
