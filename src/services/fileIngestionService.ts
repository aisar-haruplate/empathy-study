export interface DiscoveredFile {
  file: File;
  relativePath: string;
}

export interface ValidatedUploadFile {
  file: File;
  relativePath: string;
  kind: 'audio' | 'text';
  folderName?: string;
  folderPath?: string;
  extension: string;
}

export interface FileDiscoveryValidation {
  validItems: ValidatedUploadFile[];
  skippedUnsupported: number;
  skippedEmpty: number;
  folderRootNames: string[];
}

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.webm', '.aac', '.ogg']);
export const TEXT_EXTENSIONS = new Set(['.txt', '.docx', '.doc', '.md', '.csv', '.srt', '.vtt']);
export const ACCEPTED_FILE_EXTENSIONS =
  'audio/*,.mp3,.m4a,.wav,.webm,.aac,.ogg,.txt,.doc,.docx,.md,.csv,.srt,.vtt,text/plain,text/csv';

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export function isHiddenOrSystemFile(name: string, relativePath: string): boolean {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('.') || lowerName === 'thumbs.db' || lowerName === 'desktop.ini') {
    return true;
  }
  const segments = relativePath.split('/').filter(Boolean);
  return segments.some((seg) => seg.startsWith('.') || seg === '__MACOSX');
}

export function classifySupportedFile(file: File): 'audio' | 'text' | null {
  const ext = getFileExtension(file.name);
  if (AUDIO_EXTENSIONS.has(ext) || file.type.startsWith('audio/')) {
    return 'audio';
  }
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/')) {
    return 'text';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractFolderMetadata(relativePath: string): {
  folderName?: string;
  folderPath?: string;
} {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length <= 1) return {};
  const dirParts = parts.slice(0, -1);
  return {
    folderName: dirParts[dirParts.length - 1],
    folderPath: dirParts.join(' / '),
  };
}

export function validateDiscoveredFiles(
  discovered: readonly DiscoveredFile[]
): FileDiscoveryValidation {
  const validItems: ValidatedUploadFile[] = [];
  let skippedUnsupported = 0;
  let skippedEmpty = 0;

  for (const item of discovered) {
    if (isHiddenOrSystemFile(item.file.name, item.relativePath)) {
      continue;
    }
    const kind = classifySupportedFile(item.file);
    if (!kind) {
      skippedUnsupported++;
      continue;
    }
    if (item.file.size === 0) {
      skippedEmpty++;
      continue;
    }
    const { folderName, folderPath } = extractFolderMetadata(item.relativePath);
    const extension =
      getFileExtension(item.file.name).replace('.', '').toUpperCase() || kind.toUpperCase();
    validItems.push({
      file: item.file,
      relativePath: item.relativePath,
      kind,
      folderName,
      folderPath,
      extension,
    });
  }

  const folderRootNames = Array.from(
    new Set(
      validItems
        .map((v) => v.relativePath.split('/').filter(Boolean))
        .filter((parts) => parts.length > 1)
        .map((parts) => parts[0])
    )
  );

  return {
    validItems,
    skippedUnsupported,
    skippedEmpty,
    folderRootNames,
  };
}

async function readEntryRecursively(
  entry: FileSystemEntry,
  parentPath: string = ''
): Promise<DiscoveredFile[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise<DiscoveredFile[]>((resolve) => {
      fileEntry.file(
        (file) => {
          const relativePath = parentPath ? `${parentPath}/${file.name}` : file.name;
          resolve([{ file, relativePath }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    const readAllBatchEntries = async (): Promise<FileSystemEntry[]> => {
      const all: FileSystemEntry[] = [];
      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve) => {
          reader.readEntries(
            (entries) => resolve(entries),
            () => resolve([])
          );
        });

      while (true) {
        const batch = await readBatch();
        if (batch.length === 0) break;
        all.push(...batch);
      }
      return all;
    };

    const children = await readAllBatchEntries();
    const collected: DiscoveredFile[] = [];
    for (const child of children) {
      const nested = await readEntryRecursively(child, nextPath);
      collected.push(...nested);
    }
    return collected;
  }

  return [];
}

/**
 * Traverse dropped files or nested folders via DataTransferItem.webkitGetAsEntry(),
 * with graceful fallback to DataTransfer.files.
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<{
  discovered: DiscoveredFile[];
  hadDirectory: boolean;
}> {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) =>
      typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    )
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length > 0) {
    const hadDirectory = entries.some((entry) => entry.isDirectory);
    const discovered: DiscoveredFile[] = [];
    for (const entry of entries) {
      const files = await readEntryRecursively(entry);
      discovered.push(...files);
    }
    return { discovered, hadDirectory };
  }

  const fallbackFiles = Array.from(dataTransfer.files || []).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
  return { discovered: fallbackFiles, hadDirectory: false };
}

export function collectInputFiles(fileList: FileList | null): DiscoveredFile[] {
  if (!fileList) return [];
  return Array.from(fileList).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}
