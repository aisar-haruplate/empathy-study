import { DriveFileItem, SharedDriveItem } from '../types';

/**
 * List all Shared Drives (Team Drives) that the user has access to
 */
export async function listSharedDrives(accessToken: string): Promise<SharedDriveItem[]> {
  try {
    const url = new URL('https://www.googleapis.com/drive/v3/drives');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('fields', 'drives(id, name, colorRgb)');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn('Error listing shared drives:', errorData);
      return [];
    }

    const data = await res.json();
    return data.drives || [];
  } catch (error) {
    console.error('Error listing shared drives:', error);
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
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Failed to fetch Google Drive files (HTTP ${res.status})`
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
  } catch (error) {
    console.warn('Error listing Drive contents:', error);
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
  const { targetId, targetMimeType } = await resolveDriveFileTarget(
    file.id,
    file.mimeType || '',
    file.shortcutDetails,
    accessToken
  );

  // All Google Workspace / Docs Editors files (Docs, Sheets, Slides, Shortcuts to them, etc.)
  // must be exported rather than downloaded with ?alt=media
  if (targetMimeType.startsWith('application/vnd.google-apps.')) {
    return exportGoogleWorkspaceFile(targetId, targetMimeType, file.name, accessToken);
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
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => '');
    // Fallback: if Drive reports this is actually a Docs Editors file, fetch its mimeType and export it
    if (
      res.status === 403 &&
      (rawText.includes('Docs Editors') || rawText.includes('binary content'))
    ) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${targetId}?fields=mimeType,shortcutDetails(targetId,targetMimeType)&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const resolved = await resolveDriveFileTarget(
          targetId,
          meta.mimeType || 'application/vnd.google-apps.document',
          meta.shortcutDetails,
          accessToken
        );
        return exportGoogleWorkspaceFile(
          resolved.targetId,
          resolved.targetMimeType,
          file.name,
          accessToken
        );
      }
      return exportGoogleWorkspaceFile(
        targetId,
        'application/vnd.google-apps.document',
        file.name,
        accessToken
      );
    }

    throw new Error(`Failed to download file from Google Drive (HTTP ${res.status}): ${rawText.substring(0, 120)}`);
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
