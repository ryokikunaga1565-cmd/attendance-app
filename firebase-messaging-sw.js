// 通知専用。ページやAPIレスポンスのキャッシュ処理は行わない。
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyA1VGVdOPktRfdxRWaFKX2dMIc0WpJEDgU',authDomain:'attendance-admin-ee719.firebaseapp.com',projectId:'attendance-admin-ee719',messagingSenderId:'653854375196',appId:'1:653854375196:web:769d671fca81fa36c64ed9'});
// notification ペイロードの表示と fcm_options.link のクリック処理はSDKが行う。
firebase.messaging();
