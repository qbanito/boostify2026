import { 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  getRedirectResult,
  signOut,
  User,
  Auth,
  signInAnonymously
} from 'firebase/auth';
import { auth } from '../firebase';
import { useLocation } from 'wouter';

/**
 * Servicio mejorado de autenticación que proporciona una capa adicional de
 * manejo de errores y reintento para resolver problemas comunes con Firebase Auth.
 * 
 * Incluye login anónimo como alternativa cuando hay problemas con la API key
 */
class AuthService {
  private auth: Auth;
  private googleProvider: GoogleAuthProvider;
  
  constructor() {
    this.auth = auth;
    this.googleProvider = new GoogleAuthProvider();
    // Configuración mínima para reducir posibilidad de errores
    this.googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
  }
  
  /**
   * Limpia el estado de autenticación actual, incluyendo localStorage, sessionStorage y cookies
   */
  async clearAuthState(): Promise<void> {
    try {
      // 1. Cerrar sesión para limpiar el estado interno de Firebase Auth
      await signOut(this.auth);
      
      // 2. Limpiar almacenamiento local y de sesión
      localStorage.removeItem('firebase:authUser:' + this.auth.app.options.apiKey + ':' + window.location.hostname);
      sessionStorage.removeItem('firebase:authUser:' + this.auth.app.options.apiKey + ':' + window.location.hostname);
      
      // Limpiar cualquier otro dato relacionado con Firebase
      localStorage.removeItem('firebase:authUser');
      sessionStorage.removeItem('firebase:authUser');
      
      // 3. Limpiar cookies relacionadas con Firebase
      document.cookie.split(";").forEach(c => {
        if (c.trim().startsWith("firebaseAuth") || c.trim().startsWith("firebase:")) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        }
      });
      
      console.log('AuthService: Estado de autenticación limpiado correctamente');
    } catch (error) {
      console.error('AuthService: Error al limpiar estado de autenticación:', error);
    }
  }
  
  /**
   * Intenta iniciar sesión con Google usando primero el método popup,
   * y si falla, intenta con redirect como fallback.
   * @param redirectPath Ruta a la que redirigir después de una autenticación exitosa
   */
  /**
   * Inicia sesión anónima para pruebas y desarrollo
   * Útil cuando las APIs de autenticación tienen problemas o para uso en entornos de desarrollo
   * @param redirectPath Ruta a la que redirigir después de la autenticación
   */
  async signInAnonymously(redirectPath: string = '/dashboard'): Promise<User | null> {
    try {
      console.log('AuthService: Iniciando sesión anónima para pruebas');
      const result = await signInAnonymously(this.auth);
      console.log('AuthService: Sesión anónima iniciada correctamente');
      
      // Redirigir después de una autenticación exitosa
      if (typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
      
      return result.user;
    } catch (error) {
      console.error('AuthService: Error al iniciar sesión anónima:', error);
      throw error;
    }
  }

  async signInWithGoogle(redirectPath: string = '/dashboard'): Promise<User | null> {
    try {
      // USAR LOCALSTORAGE en lugar de sessionStorage para iOS Safari
      // sessionStorage se borra en iOS entre redirecciones
      localStorage.setItem('auth_redirect_path', redirectPath);
      
      // Generar un proveedor específico para esta sesión para evitar problemas de caché
      const sessionProvider = new GoogleAuthProvider();
      
      // Configuración mejorada para móviles
      sessionProvider.setCustomParameters({ 
        prompt: 'select_account',
        // Forzar UI responsive
        display: 'popup'
      });
      
      // Mejorar detección de móviles incluyendo tablets y navegadores específicos
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari/i.test(navigator.userAgent) ||
                       (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
      
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
      
      console.log('🔐 [AUTH] Device detection:', {
        isMobile,
        isIOS,
        isSafari,
        userAgent: navigator.userAgent,
        touchPoints: navigator.maxTouchPoints
      });
      
      // En móviles o Safari, usar redirect directamente (los popups no funcionan bien)
      if (isMobile || (isIOS && isSafari)) {
        console.log('🔐 [MOBILE] Dispositivo móvil/iOS detectado, usando redirect');
        console.log('🔐 [MOBILE] authDomain:', this.auth.config.authDomain);
        
        // USAR LOCALSTORAGE para iOS - sessionStorage se borra
        localStorage.setItem('auth_redirect_attempt', 'true');
        localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
        localStorage.setItem('auth_device_info', JSON.stringify({
          isMobile,
          isIOS,
          isSafari,
          timestamp: new Date().toISOString()
        }));
        
        await signInWithRedirect(this.auth, sessionProvider);
        return null;
      }
      
      // Estrategia 1: Usar popup (preferido en desktop por mejor experiencia de usuario)
      try {
        console.log('AuthService: Intentando autenticación con popup');
        const result = await signInWithPopup(this.auth, sessionProvider);
        console.log('AuthService: Autenticación con popup exitosa');
        
        // Redirigir después de una autenticación exitosa
        if (typeof window !== 'undefined') {
          window.location.href = redirectPath;
        }
        
        return result.user;
      } catch (popupError: any) {
        console.warn('AuthService: Error en autenticación con popup:', popupError);
        
        // Si el error es que el usuario cerró el popup, no intentamos redirect
        if (popupError.code === 'auth/popup-closed-by-user') {
          throw popupError;
        }
        
        // Si el error está relacionado con API key inválida, intentamos autenticación anónima
        if (popupError.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
          console.log('AuthService: Error de API key inválida, iniciando sesión anónima como fallback');
          return this.signInAnonymously(redirectPath);
        }
        
        // Si el error es específicamente de popup bloqueado o error interno,
        // intentamos con redirect que es más robusto
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/internal-error') {
          
          console.log('AuthService: Intentando autenticación con redirect como fallback');
          
          // Primero almacenamos información sobre el reintento para la redirección
          // USAR LOCALSTORAGE para iOS - sessionStorage se borra
          localStorage.setItem('auth_redirect_attempt', 'true');
          localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
          
          // Estrategia 2: Usar redirect como fallback
          await signInWithRedirect(this.auth, sessionProvider);
          // El control NO regresa aquí - la página se recargará después de la redirección
          return null;
        }
        
        // Si no es un error específico que podamos manejar, intentamos con autenticación anónima
        console.log('AuthService: Error no manejado en autenticación, intentando sesión anónima');
        return this.signInAnonymously(redirectPath);
      }
    } catch (error) {
      console.error('AuthService: Error general en autenticación:', error);
      
      // Como último recurso, intentamos sesión anónima
      console.log('AuthService: Intentando sesión anónima como último recurso');
      try {
        return await this.signInAnonymously(redirectPath);
      } catch (anonError) {
        console.error('AuthService: Error también en la autenticación anónima:', anonError);
        throw error; // Lanzamos el error original
      }
    }
  }
  
  /**
   * Verifica si hay un resultado de redirección pendiente (después de loginWithRedirect)
   * Este método debe llamarse al iniciar la aplicación para manejar el flujo de redirección
   * MEJORADO PARA iOS: Usa localStorage y SIEMPRE verifica getRedirectResult
   */
  async checkRedirectResult(): Promise<User | null> {
    try {
      console.log('🔐 [MOBILE] Verificando resultado de redirección...');
      
      // Recuperar info del dispositivo para debugging
      const deviceInfo = localStorage.getItem('auth_device_info');
      if (deviceInfo) {
        console.log('🔐 [MOBILE] Device info:', JSON.parse(deviceInfo));
      }
      
      // SIEMPRE verificar getRedirectResult en caso de que venimos de una redirección
      // No depender solo de flags porque iOS Safari puede borrar sessionStorage
      console.log('🔐 [MOBILE] Llamando a getRedirectResult...');
      const result = await getRedirectResult(this.auth);
      console.log('🔐 [MOBILE] getRedirectResult completed:', !!result);
      
      if (result && result.user) {
        console.log('✅ [MOBILE] Redirección exitosa! Usuario autenticado:', result.user.email);
        console.log('✅ [MOBILE] User UID:', result.user.uid);
        console.log('✅ [MOBILE] Provider:', result.providerId);
        
        // Limpiar flags de localStorage
        localStorage.removeItem('auth_redirect_attempt');
        localStorage.removeItem('auth_redirect_timestamp');
        localStorage.removeItem('auth_device_info');
        
        // Redirigir al path almacenado después de una autenticación exitosa
        const redirectPath = localStorage.getItem('auth_redirect_path') || '/dashboard';
        localStorage.removeItem('auth_redirect_path');
        
        console.log('🔐 [MOBILE] Redirigiendo a:', redirectPath);
        
        if (typeof window !== 'undefined') {
          // Delay pequeño para asegurar que el estado se guarde
          await new Promise(resolve => setTimeout(resolve, 500));
          window.location.href = redirectPath;
        }
        
        return result.user;
      }
      
      // Si no hay resultado pero había un intento reciente, limpiar flags viejos
      const redirectTimestamp = localStorage.getItem('auth_redirect_timestamp');
      if (redirectTimestamp) {
        const elapsed = Date.now() - parseInt(redirectTimestamp);
        console.log('🔐 [MOBILE] Tiempo desde último intento:', Math.round(elapsed / 1000), 'segundos');
        
        // Si pasaron más de 5 minutos, limpiar flags viejos
        if (elapsed > 5 * 60 * 1000) {
          console.log('🧹 [MOBILE] Limpiando flags viejos de redirección');
          localStorage.removeItem('auth_redirect_attempt');
          localStorage.removeItem('auth_redirect_timestamp');
          localStorage.removeItem('auth_device_info');
        }
      }
      
      console.log('🔐 [MOBILE] No hay resultado de redirección pendiente');
      return null;
    } catch (redirectError: any) {
      console.error('❌ [MOBILE] Error al verificar resultado de redirección:', redirectError);
      console.error('❌ [MOBILE] Error code:', redirectError?.code);
      console.error('❌ [MOBILE] Error message:', redirectError?.message);
      
      // Log más detalles del error
      if (redirectError?.code === 'auth/operation-not-allowed') {
        console.error('❌ [MOBILE] Google Sign-In no está habilitado en Firebase Console');
      } else if (redirectError?.code === 'auth/unauthorized-domain') {
        console.error('❌ [MOBILE] Dominio no autorizado. Verifica "Authorized domains" en Firebase Console');
        console.error('❌ [MOBILE] Dominio actual:', window.location.hostname);
      }
      
      // Limpiar flags en caso de error
      localStorage.removeItem('auth_redirect_attempt');
      localStorage.removeItem('auth_redirect_timestamp');
      localStorage.removeItem('auth_device_info');
      
      return null;
    }
  }
  
  /**
   * Cierra la sesión actual del usuario
   */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      await this.clearAuthState();
      console.log('AuthService: Sesión cerrada correctamente');
      
      // Redirigir a la página principal después de cerrar sesión
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('AuthService: Error al cerrar sesión:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene el usuario actual
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }
}

// Exportar una instancia única del servicio
export const authService = new AuthService();