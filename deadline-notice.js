// 通知から開いた場合と、未確認通知がある状態でアイコンから開いた場合の案内。
const noticeCache='attendance-notice-state';
const noticeKey=new URL('./__deadline_notice__',location.href).href;
let noticeDialog;
async function showDeadlineNotice() {
  if (noticeDialog?.open) return;
  if (!noticeDialog) {
    noticeDialog=document.createElement('dialog');
    noticeDialog.setAttribute('aria-labelledby','deadlineNoticeTitle');
    noticeDialog.style.cssText='width:min(360px,calc(100% - 32px));box-sizing:border-box;padding:24px;border:1px solid #d6cbb9;border-radius:16px;background:#faf8f3;color:#30383e';
    noticeDialog.innerHTML='<h2 id="deadlineNoticeTitle" style="font-size:22px;margin:0 0 16px">20日になりました</h2><p style="font-size:18px;font-weight:bold;line-height:1.6">今月分の出勤入力を確認してください。</p><button type="button" style="width:100%;min-height:48px;border:0;border-radius:10px;background:#14523e;color:white;font-size:17px">確認する</button>';
    document.body.append(noticeDialog);
    noticeDialog.querySelector('button').onclick=async () => {
      try { if ('caches' in window) {const cache=await caches.open(noticeCache);await cache.delete(noticeKey);} } catch (_) {}
      try { if (typeof navigator.clearAppBadge==='function') await navigator.clearAppBadge(); } catch (_) {}
      noticeDialog.close();
      const url=new URL(location.href);url.searchParams.delete('attendanceNotice');history.replaceState(null,'',url.href);
      const historyForm=document.getElementById('historyForm');
      if (historyForm && getComputedStyle(historyForm).display==='none') document.getElementById('historyButton')?.click();
      historyForm?.scrollIntoView({behavior:'smooth',block:'start'});
    };
    noticeDialog.addEventListener('cancel',event => event.preventDefault());
  }
  noticeDialog.showModal();
}
async function checkDeadlineNotice() {
  let pending=new URL(location.href).searchParams.get('attendanceNotice')==='deadline';
  try { if ('caches' in window) {const cache=await caches.open(noticeCache);pending=pending || !!await cache.match(noticeKey);} } catch (_) {}
  if (pending) await showDeadlineNotice();
}
window.addEventListener('attendance-deadline-notice',showDeadlineNotice);
document.addEventListener('visibilitychange',() => {if(document.visibilityState==='visible')checkDeadlineNotice();});
checkDeadlineNotice();
