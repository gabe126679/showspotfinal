import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { supabase } from './supabase';
import { makeRedirectUri } from 'expo-auth-session';

// Required for web browser auth session to complete properly
WebBrowser.maybeCompleteAuthSession();

// Create redirect URI for OAuth
const redirectUri = makeRedirectUri({
  scheme: 'showspot',
  path: 'auth-callback',
});

console.log('===========================================');
console.log('OAUTH REDIRECT URI:', redirectUri);
console.log('===========================================');

export type OAuthProvider = 'google' | 'facebook';

interface OAuthResult {
  success: boolean;
  error?: string;
  needsProfile?: boolean;
}

/**
 * Set the user's profile picture from OAuth provider if they don't have one
 */
async function setOAuthProfilePicture(userId: string, avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;

  try {
    const { data: spotter } = await supabase
      .from('spotters')
      .select('spotter_profile_picture')
      .eq('id', userId)
      .single();

    if (!spotter?.spotter_profile_picture) {
      await supabase
        .from('spotters')
        .update({ spotter_profile_picture: avatarUrl })
        .eq('id', userId);
      console.log('Set OAuth profile picture:', avatarUrl);
    }
  } catch (e) {
    console.error('Error setting OAuth profile picture:', e);
  }
}

/**
 * Check if user needs to complete their profile
 */
async function checkNeedsProfile(userId: string): Promise<boolean> {
  const { data: spotter } = await supabase
    .from('spotters')
    .select('spotter_profile_picture')
    .eq('id', userId)
    .single();

  return !spotter?.spotter_profile_picture;
}

/**
 * Google OAuth configuration
 * You need to create OAuth credentials in Google Cloud Console:
 * 1. Web client ID (for Expo Go / development)
 * 2. iOS client ID (for standalone iOS builds)
 * 3. Android client ID (for standalone Android builds)
 */
export const googleConfig = {
  // Web Client ID - also used as expoClientId for Expo Go development
  webClientId: '207007720216-0qrg54t8pi0lqvov9kp83okea7frhr0v.apps.googleusercontent.com',
  // iOS Client ID - for iOS devices
  iosClientId: '207007720216-0ot539v7sb5vlrbu89i589hbhl0m9u4t.apps.googleusercontent.com',
  // Android Client ID - for standalone Android app
  androidClientId: undefined as string | undefined,
};

/**
 * Hook to get Google auth request - use this in your component
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleConfig.webClientId,
    webClientId: googleConfig.webClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    scopes: ['profile', 'email'],
  });

  return { request, response, promptAsync };
}

/**
 * Sign in with Google using ID token (more reliable for mobile)
 */
export async function signInWithGoogleToken(idToken: string): Promise<OAuthResult> {
  try {
    console.log('Signing in with Google ID token...');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('Supabase signInWithIdToken error:', error);
      return { success: false, error: error.message };
    }

    if (data.user) {
      const avatarUrl = data.user.user_metadata?.avatar_url ||
                       data.user.user_metadata?.picture ||
                       null;

      await setOAuthProfilePicture(data.user.id, avatarUrl);
      const needsProfile = await checkNeedsProfile(data.user.id);

      console.log('Google sign in successful!');
      return { success: true, needsProfile };
    }

    return { success: false, error: 'No user returned' };
  } catch (error) {
    console.error('Google token sign in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Legacy OAuth flow using WebBrowser (fallback)
 * This has issues with redirect on iOS Expo Go
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    console.log('=== OAUTH DEBUG ===');
    console.log('Provider:', provider);
    console.log('Redirect URI:', redirectUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.url) {
      return { success: false, error: 'No OAuth URL returned' };
    }

    console.log('Opening auth URL...');

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUri,
      {
        showInRecents: true,
        preferEphemeralSession: false,
      }
    );

    console.log('WebBrowser result:', result.type);

    if (result.type === 'success' && result.url) {
      // Parse tokens from URL
      const url = result.url;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      if (accessToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }

        if (sessionData.user) {
          const avatarUrl = sessionData.user.user_metadata?.avatar_url ||
                           sessionData.user.user_metadata?.picture ||
                           null;
          await setOAuthProfilePicture(sessionData.user.id, avatarUrl);
          const needsProfile = await checkNeedsProfile(sessionData.user.id);
          return { success: true, needsProfile };
        }
      }
    }

    if (result.type === 'cancel') {
      return { success: false, error: 'Sign in was cancelled' };
    }

    return { success: false, error: 'Could not complete sign in. Please try again.' };
  } catch (error) {
    console.error('OAuth exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

export function getRedirectUri(): string {
  return redirectUri;
}
