import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { logger } from "../logger";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    uid: "admin123",
    email: "convoycubano@gmail.com",
    displayName: "Admin User",
    photoURL: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // En una implementación real, estas funciones se comunicarían con el servidor
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simular login exitoso
      setUser({
        uid: "user123",
        email: email,
        displayName: "Regular User",
        photoURL: null,
      });
    } catch (error) {
      logger.error("Error al iniciar sesión:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Simular logout
      setUser(null);
    } catch (error) {
      logger.error("Error al cerrar sesión:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}