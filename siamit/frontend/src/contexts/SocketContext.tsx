import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { logger } from '@/lib/logger';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  // Track if we should connect based on authentication
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect socket when user is authenticated
    if (!user?.id) {
      // Clean up existing socket on logout
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Prevent duplicate connections
    if (socketRef.current) {
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    // Get current user's token for authentication
    let authToken = null;
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      authToken = currentUser?.token;
    } catch (e) {
      if (import.meta.env.DEV) {
        logger.error("Error parsing currentUser for socket auth:", e);
      }
    }

    const newSocket = io(API_BASE_URL, {
      transports: ['polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        token: authToken
      }
    });

    newSocket.on('connect', () => {
      console.log('connec success');
      setIsConnected(true);

      // Join user room
      newSocket.emit('joinRoom', user.id);

      // Join admin room if user is admin
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        newSocket.emit('joinAdminRoom');
      }
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (import.meta.env.DEV) {
        logger.debug('Socket disconnected:', reason);
      }
    });

    newSocket.on('connect_error', (error) => {
      if (import.meta.env.DEV) {
        logger.error('Socket.io connection error:', error);
      }
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      if (import.meta.env.DEV) {
        logger.debug('Socket reconnected after', attemptNumber, 'attempts');
      }
      setIsConnected(true);
    });

    newSocket.on('reconnect_failed', () => {
      if (import.meta.env.DEV) {
        logger.error('Socket reconnection failed after all attempts');
      }
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.off('reconnect');
      newSocket.off('reconnect_failed');
      newSocket.close();
      socketRef.current = null;
    };
  }, [user?.id, user?.role]);

  // Room joining is now handled in the main socket effect above

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    if (import.meta.env.DEV) {
      logger.warn('useSocket must be used within a SocketProvider');
    }
    // Return a default context to prevent crashes
    return {
      socket: null,
      isConnected: false,
    };
  }
  return context;
}; 
