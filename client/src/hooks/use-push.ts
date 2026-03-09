import { useEffect } from "react";
import { api } from "@shared/routes";
import { urlBase64ToUint8Array } from "@/lib/utils";

export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const registerPush = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('ServiceWorker registered:', registration.scope);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Push permission denied');
          return;
        }

        const vapidRes = await fetch(api.push.vapidPublicKey.path, { credentials: "include" });
        if (!vapidRes.ok) return;
        const { publicKey } = await vapidRes.json();

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        await fetch(api.push.subscribe.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
          credentials: 'include'
        });
        
        console.log('Push subscription successful');
      } catch (err) {
        console.error('Error setting up push notifications:', err);
      }
    };

    registerPush();
  }, [isAuthenticated]);
}
