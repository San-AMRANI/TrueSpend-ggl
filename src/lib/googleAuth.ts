
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
        console.error('VITE_GOOGLE_CLIENT_ID is not defined');
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
      reject(new Error('Google Identity Services not loaded yet or VITE_GOOGLE_CLIENT_ID is missing.'));
      return;
    }
    
    // Check if we are running in an iframe
    if (window.self !== window.top) {
      // In an iframe, the popup might be blocked by Cross-Origin-Opener-Policy.
      alert('Google Sign-in cannot be completed inside this preview iframe due to browser security restrictions.\n\nPlease open the application in a new tab (using the button in the top right corner of the preview) to connect your Google Drive.');
      reject(new Error('Popup blocked in iframe. Please open in a new tab.'));
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
      console.error('Error opening Google popup:', error);
      alert('Failed to open Google login popup. Please try again.');
      reject(new Error('Failed to open Google login popup.'));
    }
  });
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  cachedAccessToken = null;
};
