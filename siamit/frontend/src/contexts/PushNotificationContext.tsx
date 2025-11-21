import React, { createContext, useContext, useState, useEffect } from "react";

const PushNotificationContext = createContext<{
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}>({ enabled: true, setEnabled: () => {} });

export const PushNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem("pushNotificationEnabled");
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem("pushNotificationEnabled", String(enabled));
  }, [enabled]);

  return (
    <PushNotificationContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </PushNotificationContext.Provider>
  );
};

export const usePushNotification = () => useContext(PushNotificationContext); 