
let tokenClient: any = null;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  const checkInterval = setInterval(() => {
    if ((window as any).google && (window as any).google.accounts && (window as any).google.accounts.oauth2) {
      clearInterval(checkInterval);
      const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        return;
      }
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            cachedAccessToken = tokenResponse.access_token;
            if (onAuthSuccess) onAuthSuccess({ name: 'Google User' }, cachedAccessToken);
          } else {
            if (onAuthFailure) onAuthFailure();
          }
        },
      });
    }
  }, 100);
  
  return () => {
    clearInterval(checkInterval);
  };
};

export const googleSignIn = (): Promise<{ user: any; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Identity Services not configured (VITE_GOOGLE_CLIENT_ID is not set).'));
      return;
    }
    
    // Check if we are running in an iframe
    if (window.self !== window.top) {
      reject(new Error('Google Sign-in cannot be completed inside an embedded preview iframe. Please open the app in a new browser tab to connect Google Drive.'));
      return;
    }
    
    try {
      tokenClient.callback = (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          cachedAccessToken = tokenResponse.access_token;
          resolve({ user: { name: 'Google User' }, accessToken: cachedAccessToken });
        } else {
          reject(new Error('Failed to get access token from Google'));
        }
      };
      
      tokenClient.requestAccessToken();
    } catch (error) {
      console.warn('Error opening Google popup:', error);
      reject(new Error('Failed to open Google login popup.'));
    }
  });
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  cachedAccessToken = null;
};
