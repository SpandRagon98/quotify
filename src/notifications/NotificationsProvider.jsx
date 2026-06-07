import { NotificationsContext, useNotificationsStore } from "./useNotifications";

/** Provides the persistent notification store to the authenticated app. */
export default function NotificationsProvider({ children }) {
  const store = useNotificationsStore();
  return (
    <NotificationsContext.Provider value={store}>
      {children}
    </NotificationsContext.Provider>
  );
}
