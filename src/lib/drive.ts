import { DriveFileItem, SharedDriveItem } from '../types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export interface GoogleDriveConfigStatus {
  clientId: string;
  apiKey: string;
  hasCustomOAuthClient: boolean;
  hasCustomApiKey: boolean;
}

/**
 * Inspect optional client-side Google Drive/OAuth environment variables.
 * (Primary Drive access uses the OAuth token from Firebase Google Sign-In.)
 */
export function getGoogleDriveConfigStatus(): GoogleDriveConfigStatus {
  const clientId = (env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const apiKey = (env.VITE_GOOGLE_API_KEY || '').trim();
  return {
    clientId,
    apiKey,
    hasCustomOAuthClient: clientId.length > 0,
    hasCustomApiKey: apiKey.length > 0,
  };
}

function requireAccessToken(accessToken: string | null | undefined): string {
  const token = (accessToken || '').trim();
  if (!token) {
    throw new Error(
      'Google Drive access token is missing or expired. Please click "Reconnect Google Account" to sign in again.'
    );
  }
  return token;
}

function formatDriveApiError(status: number, errorData: any, fallback: string): string {
  const apiMessage: string = errorData?.error?.message || '';
  const reason: string = errorData?.error?.errors?.[0]?.reason || '';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'this origin';

  if (status === 401 || reason === 'authError') {
    return 'Your Google Drive session has expired. Click "Reconnect Google Account" to sign in again.';
  }

  if (
    status === 403 &&
    (reason === 'accessNotConfigured' ||
      apiMessage.includes('drive.googleapis.com') ||
      apiMessage.includes('has not been used in project') ||
      apiMessage.includes('is disabled'))
  ) {
    return (
      apiMessage ||
      'Google Drive API (drive.googleapis.com) is not enabled for this Google Cloud project.'
    );
  }

  if (status === 403 && (reason === 'insufficientPermissions' || reason === 'forbidden')) {
    return `Google Drive access was denied (${apiMessage || 'insufficient permissions'}). Verify OAuth consent, Authorized JavaScript origins (${origin}), and Drive read permissions, then reconnect your Google account.`;
  }

  if (status === 404) {
    return 'The requested Google Drive file or folder could not be found or is no longer shared with your account.';
  }

  return apiMessage || `${fallback} (HTTP ${status})`;
}

/**
 * List all Shared Drives (Team Drives) that the user has access to
 */
export async function listSharedDrives(accessToken: string): Promise<SharedDriveItem[]> {
  try {
    const token = requireAccessToken(accessToken);
    const url = new URL('https://www.googleapis.com/drive/v3/drives');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('fields', 'drives(id, name, colorRgb)');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn(
        '[Google Drive] Error listing shared drives:',
        formatDriveApiError(res.status, errorData, 'Failed to list Shared Drives')
      );
      return [];
    }

    const data = await res.json();
    return data.drives || [];
  } catch (error) {
    console.warn('[Google Drive] Error listing shared drives:', error);
    return [];
  }
}

/**
 * List files and folders inside a specific Google Drive folder or Shared Drive
 */
export async function listDriveFolderContents(
  accessToken: string,
  folderId: string = 'root',
  searchQuery?: string,
  isSharedWithMe: boolean = false
): Promise<{ folders: DriveFileItem[]; files: DriveFileItem[] }> {
  try {
    const token = requireAccessToken(accessToken);
    let q = `trashed = false`;

    if (searchQuery && searchQuery.trim()) {
      const sanitized = searchQuery.trim().replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    } else if (isSharedWithMe && (folderId === 'sharedWithMe' || !folderId)) {
      q += ` and sharedWithMe = true`;
    } else {
      q += ` and '${folderId}' in parents`;
    }

    const fields =
      'files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink, shortcutDetails(targetId,targetMimeType))';
    const orderBy = 'folder,name,modifiedTime desc';
    const pageSize = 100;

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', fields);
    url.searchParams.set('orderBy', orderBy);
    url.searchParams.set('pageSize', pageSize.toString());

    // Essential parameters to include Shared Drives and team files
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (folderId !== 'root' && folderId !== 'sharedWithMe' && !isSharedWithMe) {
      url.searchParams.set('corpora', 'allDrives');
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        formatDriveApiError(res.status, errorData, 'Failed to fetch Google Drive files')
      );
    }

    const data = await res.json();
    const allItems: DriveFileItem[] = (data.files || []).map((f: any) => {
      const effectiveMime =
        f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType
          ? f.shortcutDetails.targetMimeType
          : f.mimeType;
      return {
        ...f,
        isFolder: effectiveMime === 'application/vnd.google-apps.folder',
      };
    });

    const folders = allItems.filter((i) => i.isFolder);
    const files = allItems.filter((i) => !i.isFolder);

    return { folders, files };
  } catch (error: unknown) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      const networkErr = new Error(
        'Unable to reach Google Drive API. Check your internet connection and verify Authorized JavaScript origins in Google Cloud Console.'
      );
      console.warn('[Google Drive] Network error listing Drive contents:', error);
      throw networkErr;
    }
    console.warn('[Google Drive] Error listing Drive contents:', error);
    throw error;
  }
}

/**
 * List files from Google Drive with focus on audio and text/document files
 */
export async function listDriveFiles(
  accessToken: string,
  searchQuery?: string
): Promise<DriveFileItem[]> {
  const result = await listDriveFolderContents(accessToken, 'root', searchQuery);
  return [...result.folders, ...result.files];
}

/**
 * Download a file's content from Google Drive (supporting both My Drive and Shared Drives)
 */
async function resolveDriveFileTarget(
  fileId: string,
  mimeType: string,
  shortcutDetails: DriveFileItem['shortcutDetails'] | undefined,
  accessToken: string
): Promise<{ targetId: string; targetMimeType: string }> {
  if (mimeType === 'application/vnd.google-apps.shortcut') {
    if (shortcutDetails?.targetId && shortcutDetails?.targetMimeType) {
      return {
        targetId: shortcutDetails.targetId,
        targetMimeType: shortcutDetails.targetMimeType,
      };
    }
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,shortcutDetails(targetId,targetMimeType)&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.shortcutDetails?.targetId) {
        return {
          targetId: meta.shortcutDetails.targetId,
          targetMimeType: meta.shortcutDetails.targetMimeType || meta.mimeType,
        };
      }
    }
  }
  return { targetId: fileId, targetMimeType: mimeType || '' };
}

function getWorkspaceExportMimeType(workspaceMimeType: string): string | null {
  switch (workspaceMimeType) {
    case 'application/vnd.google-apps.document':
    case 'application/vnd.google-apps.presentation':
      return 'text/plain';
    case 'application/vnd.google-apps.spreadsheet':
      return 'text/csv';
    case 'application/vnd.google-apps.script':
      return 'application/vnd.google-apps.script+json';
    default:
      return null;
  }
}

async function exportGoogleWorkspaceFile(
  fileId: string,
  workspaceMimeType: string,
  fileName: string,
  accessToken: string
): Promise<{
  fileType: 'text';
  mimeType: string;
  text: string;
}> {
  if (workspaceMimeType === 'application/vnd.google-apps.folder') {
    throw new Error(`"${fileName}" is a Google Drive folder and cannot be transcribed directly.`);
  }

  const exportMime = getWorkspaceExportMimeType(workspaceMimeType) || 'text/plain';
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
  const res = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const rawErr = await res.text().catch(() => '');
    throw new Error(
      `Failed to export "${fileName}" (${workspaceMimeType}): HTTP ${res.status}${rawErr ? ` - ${rawErr.substring(0, 120)}` : ''}`
    );
  }

  const text = await res.text();
  return {
    fileType: 'text',
    mimeType: exportMime,
    text,
  };
}

/**
 * Download a file's content from Google Drive (supporting both My Drive and Shared Drives)
 */
export async function downloadDriveFile(
  file: DriveFileItem,
  accessToken: string
): Promise<{
  fileType: 'audio' | 'text';
  mimeType: string;
  text?: string;
  audioBase64?: string;
  blob?: Blob;
}> {
  const token = requireAccessToken(accessToken);
  const { targetId, targetMimeType } = await resolveDriveFileTarget(
    file.id,
    file.mimeType || '',
    file.shortcutDetails,
    token
  );

  // All Google Workspace / Docs Editors files (Docs, Sheets, Slides, Shortcuts to them, etc.)
  // must be exported rather than downloaded with ?alt=media
  if (targetMimeType.startsWith('application/vnd.google-apps.')) {
    return exportGoogleWorkspaceFile(targetId, targetMimeType, file.name, token);
  }

  const isAudio =
    targetMimeType.startsWith('audio/') ||
    file.name.toLowerCase().endsWith('.mp3') ||
    file.name.toLowerCase().endsWith('.wav') ||
    file.name.toLowerCase().endsWith('.m4a') ||
    file.name.toLowerCase().endsWith('.webm');

  // Download binary media (with supportsAllDrives)
  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${targetId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => '');
    let parsedError: any = {};
    try {
      parsedError = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsedError = {};
    }
    // Fallback: if Drive reports this is actually a Docs Editors file, fetch its mimeType and export it
    if (
      res.status === 403 &&
      (rawText.includes('Docs Editors') || rawText.includes('binary content'))
    ) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${targetId}?fields=mimeType,shortcutDetails(targetId,targetMimeType)&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const resolved = await resolveDriveFileTarget(
          targetId,
          meta.mimeType || 'application/vnd.google-apps.document',
          meta.shortcutDetails,
          token
        );
        return exportGoogleWorkspaceFile(
          resolved.targetId,
          resolved.targetMimeType,
          file.name,
          token
        );
      }
      return exportGoogleWorkspaceFile(
        targetId,
        'application/vnd.google-apps.document',
        file.name,
        token
      );
    }

    throw new Error(
      formatDriveApiError(
        res.status,
        parsedError,
        `Failed to download "${file.name}" from Google Drive`
      )
    );
  }

  const blob = await res.blob();

  // Guard against Google Drive returning an HTML interstitial for audio files
  if (isAudio && blob.type && blob.type.includes('text/html')) {
    throw new Error(
      `Google Drive returned an HTML page instead of audio for "${file.name}". Please re-connect Google Drive with full access.`
    );
  }

  if (isAudio) {
    const base64 = await blobToBase64(blob);
    let audioMime = 'audio/mp4';
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.mp3')) audioMime = 'audio/mp3';
    else if (lower.endsWith('.wav')) audioMime = 'audio/wav';
    else if (lower.endsWith('.webm')) audioMime = 'audio/webm';
    else if (lower.endsWith('.aac')) audioMime = 'audio/aac';
    else if (lower.endsWith('.m4a')) audioMime = 'audio/mp4';
    else if (targetMimeType && targetMimeType.startsWith('audio/')) audioMime = targetMimeType;

    return {
      fileType: 'audio',
      mimeType: audioMime,
      audioBase64: base64,
      blob,
    };
  } else {
    // Assume text-based document
    const text = await blob.text();
    return {
      fileType: 'text',
      mimeType: targetMimeType || 'text/plain',
      text,
      blob,
    };
  }
}

/**
 * Utility to convert Blob to Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
