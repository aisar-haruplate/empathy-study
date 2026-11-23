import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Users,
  Folder,
  FolderGit2,
  ChevronRight,
  ArrowLeft,
  Search,
  FileAudio,
  FileText,
  Loader2,
  X,
  RefreshCw,
  CheckSquare,
  Music,
  Check,
  AlertCircle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { DriveFileItem, BreadcrumbItem, SharedDriveItem, DriveRootType } from '../../types';
import { listDriveFolderContents, listSharedDrives } from '../../lib/drive';
import { FirebaseAuthErrorInfo } from '../../lib/firebase';

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  onImportFiles: (files: DriveFileItem[], folderName?: string, folderPath?: string) => void;
  onConnectGoogle: () => void;
  authError?: FirebaseAuthErrorInfo | null;
  onDismissAuthError?: () => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({
  isOpen,
  onClose,
  accessToken,
  onImportFiles,
  onConnectGoogle,
  authError,
  onDismissAuthError,
}) => {
  // Current Drive root: 'my_drive' | 'shared_drives' | 'shared_with_me'
  const [rootType, setRootType] = useState<DriveRootType>('my_drive');

  // Shared Drives list (Team Drives)
  const [sharedDrives, setSharedDrives] = useState<SharedDriveItem[]>([]);
  const [selectedSharedDrive, setSelectedSharedDrive] = useState<SharedDriveItem | null>(null);

  // Folder navigation inside active drive
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');

  const [folders, setFolders] = useState<DriveFileItem[]>([]);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedFoldersMap, setSelectedFoldersMap] = useState<
    Map<string, { folder: DriveFileItem; path: string }>
  >(new Map());
  const [isBatchFetching, setIsBatchFetching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    folderName: string;
    totalFilesFound: number;
  } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'doc'>('all');

  // Load Shared Drives list once when modal opens
  useEffect(() => {
    if (isOpen && accessToken) {
      loadSharedDrivesList();
    }
  }, [isOpen, accessToken]);

  const loadSharedDrivesList = async () => {
    if (!accessToken) return;
    try {
      const drives = await listSharedDrives(accessToken);
      setSharedDrives(drives);
    } catch (err) {
      console.warn('Failed to load shared drives list', err);
    }
  };

  // Switch Root Type (My Drive vs Shared Drives vs Shared With Me)
  const handleSwitchRoot = (type: DriveRootType) => {
    setRootType(type);
    setSelectedSharedDrive(null);
    setSelectedFileIds(new Set());
    setSelectedFolderIds(new Set());
    setSelectedFoldersMap(new Map());
    setSearchQuery('');

    if (type === 'my_drive') {
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      setCurrentFolderId('root');
    } else if (type === 'shared_drives') {
      setBreadcrumbs([{ id: 'shared_drives_root', name: 'Shared Drives' }]);
      setCurrentFolderId('shared_drives_root');
    } else if (type === 'shared_with_me') {
      setBreadcrumbs([{ id: 'sharedWithMe', name: 'Shared with Me' }]);
      setCurrentFolderId('sharedWithMe');
    }
  };

  // Load folder contents whenever folderId or rootType changes
  useEffect(() => {
    if (isOpen && accessToken) {
      // If we are at the top level of 'shared_drives' without a specific shared drive selected, show shared drives list
      if (rootType === 'shared_drives' && !selectedSharedDrive) {
        setFolders([]);
        setFiles([]);
        loadSharedDrivesList();
      } else {
        loadContents(currentFolderId);
      }
    }
  }, [isOpen, accessToken, currentFolderId, rootType, selectedSharedDrive]);

  // Reset search and selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      setSelectedFoldersMap(new Map());
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadContents = async (folderId: string, search = searchQuery) => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const isSharedWithMe = rootType === 'shared_with_me' && folderId === 'sharedWithMe';
      const targetFolderId = folderId === 'shared_drives_root' && selectedSharedDrive
        ? selectedSharedDrive.id
        : folderId;

      const res = await listDriveFolderContents(
        accessToken,
        targetFolderId,
        search,
        isSharedWithMe
      );
      setFolders(res.folders);
      setFiles(res.files);
    } catch (err: any) {
      setError(err.message || 'Failed to load Google Drive contents');
    } finally {
      setIsLoading(false);
    }
  };

  // Click on a Shared Drive from the list
  const handleSelectSharedDrive = (drive: SharedDriveItem) => {
    setSelectedSharedDrive(drive);
    setBreadcrumbs([
      { id: 'shared_drives_root', name: 'Shared Drives' },
      { id: drive.id, name: drive.name, isSharedDriveRoot: true },
    ]);
    setCurrentFolderId(drive.id);
  };

  const handleNavigateToFolder = (folder: DriveFileItem) => {
    setSearchQuery('');
    const targetId = folder.shortcutDetails?.targetId || folder.id;
    setBreadcrumbs((prev) => [...prev, { id: targetId, name: folder.name }]);
    setCurrentFolderId(targetId);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setSearchQuery('');

    // If clicking on 'Shared Drives' root
    if (target.id === 'shared_drives_root') {
      setSelectedSharedDrive(null);
      setBreadcrumbs([{ id: 'shared_drives_root', name: 'Shared Drives' }]);
      setCurrentFolderId('shared_drives_root');
      return;
    }

    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  const handleGoBack = () => {
    if (breadcrumbs.length <= 1) return;
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    const target = newBreadcrumbs[newBreadcrumbs.length - 1];
    setSearchQuery('');

    if (target.id === 'shared_drives_root') {
      setSelectedSharedDrive(null);
    }

    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(target.id);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadContents(currentFolderId, searchQuery);
  };

  const getEffectiveMime = (f: DriveFileItem) =>
    f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType
      ? f.shortcutDetails.targetMimeType
      : f.mimeType || '';

  const isAudioFile = (f: DriveFileItem) => {
    const mime = getEffectiveMime(f);
    return (
      mime.includes('audio') ||
      f.name.toLowerCase().endsWith('.mp3') ||
      f.name.toLowerCase().endsWith('.wav') ||
      f.name.toLowerCase().endsWith('.m4a') ||
      f.name.toLowerCase().endsWith('.webm')
    );
  };

  const isDocFile = (f: DriveFileItem) => {
    const mime = getEffectiveMime(f);
    return (
      mime.includes('document') ||
      mime.includes('spreadsheet') ||
      mime.includes('presentation') ||
      mime.includes('text') ||
      f.name.toLowerCase().endsWith('.txt') ||
      f.name.toLowerCase().endsWith('.md') ||
      f.name.toLowerCase().endsWith('.csv') ||
      f.name.toLowerCase().endsWith('.docx')
    );
  };

  const filteredFiles = files.filter((f) => {
    if (filterType === 'audio') return isAudioFile(f);
    if (filterType === 'doc') return isDocFile(f);
    return true;
  });

  const mp3Files = files.filter(isAudioFile);

  // Toggle single file selection
  const toggleFileSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle single folder selection (with current breadcrumb path attached)
  const toggleFolderSelect = (folder: DriveFileItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        next.add(folder.id);
      }
      return next;
    });
    setSelectedFoldersMap((prev) => {
      const next = new Map(prev);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        const path = [...breadcrumbs.map((b) => b.name), folder.name].join(' / ');
        next.set(folder.id, { folder, path });
      }
      return next;
    });
  };

  // Check if all folders in the current view are selected
  const areAllFoldersSelected =
    folders.length > 0 && folders.every((f) => selectedFolderIds.has(f.id));

  // Select / Deselect all folders in current view
  const handleSelectAllFolders = () => {
    if (areAllFoldersSelected) {
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        folders.forEach((f) => next.delete(f.id));
        return next;
      });
      setSelectedFoldersMap((prev) => {
        const next = new Map(prev);
        folders.forEach((f) => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        folders.forEach((f) => next.add(f.id));
        return next;
      });
      setSelectedFoldersMap((prev) => {
        const next = new Map(prev);
        folders.forEach((f) => {
          const path = [...breadcrumbs.map((b) => b.name), f.name].join(' / ');
          next.set(f.id, { folder: f, path });
        });
        return next;
      });
    }
  };

  // "Select all by MP3" - Explicit user request!
  const handleSelectAllMp3 = () => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const allSelected = mp3Files.length > 0 && mp3Files.every((f) => next.has(f.id));
      if (allSelected) {
        mp3Files.forEach((f) => next.delete(f.id));
      } else {
        mp3Files.forEach((f) => next.add(f.id));
      }
      return next;
    });
  };

  const handleSelectAllCurrent = () => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        filteredFiles.length > 0 && filteredFiles.every((f) => next.has(f.id));
      if (allSelected) {
        filteredFiles.forEach((f) => next.delete(f.id));
      } else {
        filteredFiles.forEach((f) => next.add(f.id));
      }
      return next;
    });
  };

  const handleClearAllSelections = () => {
    setSelectedFileIds(new Set());
    setSelectedFolderIds(new Set());
    setSelectedFoldersMap(new Map());
  };

  // Confirm import: supports direct files AND multi-folder recursive imports!
  const handleConfirmImport = async () => {
    if (!accessToken) return;

    // Direct selected files from current view
    const directSelectedFiles: DriveFileItem[] = files.filter((f) => selectedFileIds.has(f.id));

    // If one or more folders were selected:
    if (selectedFolderIds.size > 0) {
      setIsBatchFetching(true);
      setError(null);

      const selectedList = Array.from(selectedFoldersMap.values());
      const collectedFiles: DriveFileItem[] = [...directSelectedFiles];

      setBatchProgress({
        current: 0,
        total: selectedList.length,
        folderName: selectedList[0]?.folder.name || '',
        totalFilesFound: collectedFiles.length,
      });

      let idx = 0;
      for (const item of selectedList) {
        idx++;
        setBatchProgress({
          current: idx,
          total: selectedList.length,
          folderName: item.folder.name,
          totalFilesFound: collectedFiles.length,
        });

        try {
          const targetFolderId = item.folder.shortcutDetails?.targetId || item.folder.id;
          const res = await listDriveFolderContents(accessToken, targetFolderId);
          const eligibleFiles = res.files.filter((f) => isAudioFile(f) || isDocFile(f));

          eligibleFiles.forEach((file) => {
            collectedFiles.push({
              ...file,
              targetFolderName: item.folder.name,
              targetFolderPath: item.path,
            });
          });
        } catch (err: any) {
          console.warn(`Error scanning folder ${item.folder.name}:`, err);
        }
      }

      setIsBatchFetching(false);
      setBatchProgress(null);

      if (collectedFiles.length === 0) {
        setError('No audio recordings or metadata documents were found in the selected folder(s).');
        return;
      }

      const currentFolder = breadcrumbs[breadcrumbs.length - 1];
      const folderName = currentFolder?.name || 'Recording';
      const folderPath = breadcrumbs.map((b) => b.name).join(' / ');
      onImportFiles(collectedFiles, folderName, folderPath);
      onClose();
      return;
    }

    // Direct files only
    if (directSelectedFiles.length > 0) {
      const currentFolder = breadcrumbs[breadcrumbs.length - 1];
      const folderName = currentFolder?.name || 'Recording';
      const folderPath = breadcrumbs.map((b) => b.name).join(' / ');
      onImportFiles(directSelectedFiles, folderName, folderPath);
      onClose();
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Doc';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];
  const areAllMp3sSelected =
    mp3Files.length > 0 && mp3Files.every((f) => selectedFileIds.has(f.id));

  const isShowingSharedDrivesIndex = rootType === 'shared_drives' && !selectedSharedDrive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#292524]/45 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] rounded-3xl shadow-studio border border-[#EAE6DF] w-full max-w-3xl h-[88vh] max-h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[#EAE6DF] flex items-center justify-between bg-[#F7F5F0] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#528BCA] text-white flex items-center justify-center shadow-2xs shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-lg font-bold text-[#292524] tracking-[-0.02em] flex items-center gap-2 truncate">
                <span>Google Drive &amp; Shared Drives</span>
              </h3>
              <p className="text-base leading-[1.65] text-[#57534E] truncate">
                Browse My Drive, Shared Drives, or Shared with Me to select and transcribe interview recordings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(selectedFileIds.size > 0 || selectedFolderIds.size > 0) && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isBatchFetching}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-bold rounded-full bg-[#528BCA] hover:bg-[#3A71B0] text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 tabular-nums"
              >
                {isBatchFetching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedFolderIds.size > 0
                    ? `Upload from ${selectedFolderIds.size} Folders`
                    : `Upload (${selectedFileIds.size})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isBatchFetching}
              aria-label="Close Google Drive picker"
              className="p-2 text-[#78716C] hover:text-[#292524] rounded-full hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Not authenticated state */}
        {!accessToken ? (
          <div className="p-8 sm:p-10 text-center flex flex-col items-center justify-center flex-1 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#F2F7FC] border border-[#528BCA]/30 text-[#528BCA] flex items-center justify-center mb-3">
              <HardDrive className="w-7 h-7" />
            </div>
            <h4 className="font-heading text-xl font-bold text-[#292524]">
              Sign in with Google required
            </h4>
            <p className="text-base leading-[1.65] text-[#57534E] mt-1.5 max-w-sm">
              Connect your Google account to browse your My Drive and Shared Team Drives.
            </p>
            {authError && (
              <div
                role="alert"
                className="mt-4 w-full max-w-lg text-left p-4 rounded-2xl bg-[#FDF4F3] border border-[#D97A75]/50 text-sm text-[#7A3A36] space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#D97A75] shrink-0 mt-0.5" />
                    <p className="font-heading font-bold text-[#292524]">{authError.title}</p>
                  </div>
                  {onDismissAuthError && (
                    <button
                      type="button"
                      onClick={onDismissAuthError}
                      className="text-xs font-semibold text-[#7A3A36] hover:underline shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
                <p className="text-[#7A3A36] leading-relaxed">{authError.message}</p>
                <p className="text-[#57534E] leading-relaxed">{authError.guidance}</p>
                {authError.consoleUrl && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <a
                      href={authError.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D97A75] hover:bg-[#C66661] text-white text-xs font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open Firebase Auth Settings</span>
                    </a>
                    {authError.hostname && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white border border-[#D97A75]/35 text-[#7A3A36]">
                        Domain: {authError.hostname}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onConnectGoogle}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-semibold rounded-full bg-[#528BCA] hover:bg-[#3A71B0] text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            {/* Drive Source Tabs: My Drive vs Shared Drives vs Shared With Me */}
            <div className="px-5 pt-3 pb-2.5 bg-[#FDFCF8] border-b border-[#EAE6DF] flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => handleSwitchRoot('my_drive')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-heading text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  rootType === 'my_drive'
                    ? 'bg-[#292524] text-white shadow-2xs'
                    : 'bg-[#FFFFFF] text-[#57534E] hover:text-[#292524] border border-[#EAE6DF]'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>My Drive</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchRoot('shared_drives')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-heading text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  rootType === 'shared_drives'
                    ? 'bg-[#528BCA] text-white shadow-2xs'
                    : 'bg-[#FFFFFF] text-[#57534E] hover:text-[#292524] border border-[#EAE6DF]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Shared Drives</span>
                {sharedDrives.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[13px] font-bold tabular-nums ${
                      rootType === 'shared_drives'
                        ? 'bg-white/25 text-white'
                        : 'bg-[#F7F5F0] text-[#57534E]'
                    }`}
                  >
                    {sharedDrives.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchRoot('shared_with_me')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-heading text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  rootType === 'shared_with_me'
                    ? 'bg-[#7C8CE0] text-white shadow-2xs'
                    : 'bg-[#FFFFFF] text-[#57534E] hover:text-[#292524] border border-[#EAE6DF]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Shared with Me</span>
              </button>
            </div>

            {/* Breadcrumbs & Search */}
            <div className="px-5 py-2 border-b border-[#EAE6DF] bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Folder Breadcrumbs */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[13px] py-1">
                {breadcrumbs.length > 1 && (
                  <button
                    type="button"
                    onClick={handleGoBack}
                    title="Go up one folder"
                    className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-[#F7F5F0] cursor-pointer mr-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id + idx}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-[#78716C] shrink-0" />}
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(idx)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                          isLast
                            ? 'bg-[#F2F7FC] text-[#234B78] font-bold border border-[#528BCA]/40'
                            : 'text-[#57534E] hover:text-[#292524] hover:bg-[#F7F5F0]'
                        }`}
                      >
                        {idx === 0 ? (
                          rootType === 'shared_drives' ? (
                            <Building2 className="w-3.5 h-3.5 text-[#528BCA]" />
                          ) : rootType === 'shared_with_me' ? (
                            <Users className="w-3.5 h-3.5 text-[#7C8CE0]" />
                          ) : (
                            <HardDrive className="w-3.5 h-3.5 text-[#528BCA]" />
                          )
                        ) : crumb.isSharedDriveRoot ? (
                          <Building2 className="w-3.5 h-3.5 text-[#528BCA]" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-[#D4AD1F]" />
                        )}
                        <span>{crumb.name}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Live search input */}
              {!isShowingSharedDrivesIndex && (
                <div className="flex items-center gap-1.5">
                  <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search files..."
                      className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-full border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                    />
                  </form>
                  <button
                    type="button"
                    onClick={() => loadContents(currentFolderId)}
                    disabled={isLoading}
                    title="Refresh folder"
                    className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Multi-Select Toolbar (When viewing files inside a folder) */}
            {!isShowingSharedDrivesIndex && (
              <div className="px-5 py-2.5 border-b border-[#EAE6DF] bg-[#F7F5F0]/70 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* "Select All Folders" button when folders exist in this directory */}
                  {folders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFolders}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        areAllFoldersSelected
                          ? 'bg-[#292524] text-white'
                          : 'bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] hover:bg-[#F7D147]/25'
                      }`}
                    >
                      <Folder className={`w-3.5 h-3.5 ${areAllFoldersSelected ? 'text-[#F7D147]' : 'text-[#6B5306]'}`} />
                      <span>
                        {areAllFoldersSelected ? 'Deselect Folders' : 'Select All Folders'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[13px] font-bold tabular-nums ${
                          areAllFoldersSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-[#F7D147]/35 text-[#292524]'
                        }`}
                      >
                        {folders.length}
                      </span>
                    </button>
                  )}

                  {/* "Select all by MP3" button */}
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllMp3}
                      disabled={mp3Files.length === 0}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        areAllMp3sSelected
                          ? 'bg-[#292524] text-white'
                          : 'bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] hover:bg-[#F7D147]/25'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Music className={`w-3.5 h-3.5 ${areAllMp3sSelected ? 'text-[#F7D147]' : 'text-[#6B5306]'}`} />
                      <span>
                        {areAllMp3sSelected ? 'Deselect All MP3s' : 'Select All by MP3'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[13px] font-bold tabular-nums ${
                          areAllMp3sSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-[#F7D147]/35 text-[#292524]'
                        }`}
                      >
                        {mp3Files.length}
                      </span>
                    </button>
                  )}

                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllCurrent}
                      disabled={filteredFiles.length === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-semibold bg-[#FFFFFF] border border-[#EAE6DF] text-[#57534E] hover:bg-[#F7F5F0] hover:text-[#292524] cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-[#78716C]" />
                      Select All Files
                    </button>
                  )}

                  {(selectedFileIds.size > 0 || selectedFolderIds.size > 0) && (
                    <button
                      type="button"
                      onClick={handleClearAllSelections}
                      className="text-[#57534E] hover:text-[#292524] text-[13px] underline cursor-pointer tabular-nums"
                    >
                      Clear ({selectedFolderIds.size > 0 ? `${selectedFolderIds.size} folders, ` : ''}{selectedFileIds.size} files)
                    </button>
                  )}

                  {/* Primary Upload Button in Toolbar - Always visible right next to selection */}
                  {(selectedFileIds.size > 0 || selectedFolderIds.size > 0) && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isBatchFetching}
                      className="ml-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-[13px] font-bold bg-[#528BCA] hover:bg-[#3A71B0] text-white shadow-2xs cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap shrink-0 tabular-nums"
                    >
                      {isBatchFetching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <HardDrive className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {selectedFolderIds.size > 0
                          ? `Upload from ${selectedFolderIds.size} Folders`
                          : `Upload & Transcribe (${selectedFileIds.size})`}
                      </span>
                    </button>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 bg-[#EAE6DF]/70 p-0.5 rounded-full text-[13px]">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer tabular-nums transition-all ${
                      filterType === 'all'
                        ? 'bg-[#292524] text-white shadow-2xs font-semibold'
                        : 'text-[#57534E] hover:text-[#292524]'
                    }`}
                  >
                    All ({files.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('audio')}
                    className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer tabular-nums transition-all ${
                      filterType === 'audio'
                        ? 'bg-[#292524] text-white shadow-2xs font-semibold'
                        : 'text-[#57534E] hover:text-[#292524]'
                    }`}
                  >
                    MP3 ({mp3Files.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('doc')}
                    className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-all ${
                      filterType === 'doc'
                        ? 'bg-[#292524] text-white shadow-2xs font-semibold'
                        : 'text-[#57534E] hover:text-[#292524]'
                    }`}
                  >
                    Docs
                  </button>
                </div>
              </div>
            )}

            {/* Error view */}
            {error && (() => {
              const consoleUrlMatch = error.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s]+/);
              const isDriveApiDisabled =
                error.includes('drive.googleapis.com') ||
                error.includes('has not been used in project') ||
                error.includes('is disabled');
              const enableUrl =
                consoleUrlMatch?.[0] ||
                'https://console.cloud.google.com/apis/library/drive.googleapis.com';

              return (
                <div className="m-4 p-4 rounded-2xl bg-[#FDF4F3] border border-[#D97A75]/45 text-[#7A3A36] text-base leading-[1.65] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#D97A75] mt-1" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="font-heading font-bold text-[#292524]">
                        {isDriveApiDisabled
                          ? 'Google Drive API is not enabled on this Cloud project yet'
                          : 'Unable to fetch Google Drive contents'}
                      </p>
                      <p className="mt-0.5 text-[#7A3A36] leading-[1.65] text-base">{error}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      {isDriveApiDisabled && (
                        <a
                          href={enableUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D97A75] hover:bg-[#C66661] text-white font-semibold shadow-2xs transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Enable Google Drive API</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => loadContents(currentFolderId)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFFFFF] hover:bg-[#FDF4F3] text-[#7A3A36] border border-[#D97A75]/45 font-semibold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={onConnectGoogle}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFFFFF] hover:bg-[#F7F5F0] text-[#57534E] border border-[#EAE6DF] font-semibold cursor-pointer transition-colors"
                      >
                        <span>Reconnect Google Account</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-[#FFFFFF] relative">
              {/* Batch Scanning & Fetching Overlay */}
              {isBatchFetching && (
                <div className="absolute inset-0 bg-[#FFFFFF]/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-[#F2F7FC] border border-[#528BCA]/30 text-[#528BCA] flex items-center justify-center mb-4">
                    <Loader2 className="w-7 h-7 animate-spin text-[#528BCA]" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-[#292524]">
                    Scanning &amp; Preparing Recordings
                  </h3>
                  <p className="text-base leading-[1.65] text-[#57534E] mt-1 max-w-sm">
                    {batchProgress
                      ? `Reading folder "${batchProgress.folderName}" (${batchProgress.current} of ${batchProgress.total})...`
                      : 'Connecting to Google Drive...'}
                  </p>
                  {batchProgress && (
                    <div className="mt-4 w-64 bg-[#F7F5F0] rounded-full h-2 overflow-hidden border border-[#EAE6DF]">
                      <div
                        className="bg-[#528BCA] h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-[13px] text-[#78716C] mt-2 tabular-nums">
                    {batchProgress?.totalFilesFound || 0} audio &amp; doc files discovered so far
                  </p>
                </div>
              )}

              {/* CASE 1: Top level of Shared Drives (Listing Team Drives) */}
              {isShowingSharedDrivesIndex ? (
                <div>
                  <div className="text-[13px] font-bold text-[#78716C] mb-2.5 flex items-center gap-1.5 tabular-nums">
                    <Building2 className="w-3.5 h-3.5 text-[#528BCA]" />
                    Available Shared Drives ({sharedDrives.length})
                  </div>

                  {sharedDrives.length === 0 ? (
                    <div className="py-12 text-center bg-[#FDFCF8] rounded-2xl border border-dashed border-[#EAE6DF] p-6 space-y-2">
                      <Building2 className="w-9 h-9 text-[#528BCA]/60 mx-auto mb-2" />
                      <p className="font-heading text-lg font-bold text-[#292524]">
                        No Shared Drives found for this account
                      </p>
                      <p className="text-base leading-[1.65] text-[#57534E]">
                        Try checking Shared with Me or My Drive above
                      </p>
                      <p className="text-base leading-[1.65] text-[#78716C] mt-1 max-w-sm mx-auto">
                        If your organization uses Shared Drives (Team Drives), make sure your account has member access, or check files under <strong>&quot;Shared with Me&quot;</strong> or <strong>&quot;My Drive&quot;</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {sharedDrives.map((drive) => (
                        <div
                          key={drive.id}
                          onClick={() => handleSelectSharedDrive(drive)}
                          className="p-3 rounded-2xl border border-[#EAE6DF] hover:border-[#528BCA]/50 hover:bg-[#F2F7FC]/60 bg-[#FDFCF8] flex items-center justify-between gap-3 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#F2F7FC] text-[#528BCA] border border-[#528BCA]/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-heading text-base font-bold text-[#292524] truncate group-hover:text-[#234B78]">
                                {drive.name}
                              </h4>
                              <span className="text-[13px] text-[#78716C] font-medium">
                                Shared Team Drive
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#78716C] group-hover:text-[#528BCA] shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-[#78716C] gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#528BCA]" />
                  <p className="text-base leading-[1.65]">Loading items from &quot;{currentFolder.name}&quot;...</p>
                </div>
              ) : (
                <>
                  {/* FOLDERS IN CURRENT DRIVE/FOLDER */}
                  {folders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-[13px] font-bold text-[#57534E] flex items-center gap-1.5 tabular-nums">
                          <Folder className="w-3.5 h-3.5 text-[#D4AD1F]" />
                          <span>Folders in {currentFolder.name} ({folders.length})</span>
                          {selectedFolderIds.size > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] ml-1">
                              {selectedFolderIds.size} Selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFolders}
                            className="text-[13px] font-semibold text-[#528BCA] hover:text-[#234B78] underline cursor-pointer tabular-nums"
                          >
                            {areAllFoldersSelected ? 'Deselect All Folders' : `Select All Folders (${folders.length})`}
                          </button>
                          {selectedFolderIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFolderIds(new Set());
                                setSelectedFoldersMap(new Map());
                              }}
                              className="text-[13px] text-[#78716C] hover:text-[#292524] underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {folders.map((folder) => {
                          const isSelected = selectedFolderIds.has(folder.id);
                          return (
                            <div
                              key={folder.id}
                              onClick={(e) => toggleFolderSelect(folder, e)}
                              className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all group ${
                                isSelected
                                  ? 'bg-[#FEFBEB] border-[#F7D147] ring-1 ring-[#F7D147]/50 shadow-2xs'
                                  : 'border-[#EAE6DF] hover:border-[#F7D147] hover:bg-[#FEFBEB]/40 bg-[#FDFCF8]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Folder Checkbox */}
                                <div
                                  onClick={(e) => toggleFolderSelect(folder, e)}
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-[#292524] text-white'
                                      : 'border border-[#D6D0C6] bg-[#FFFFFF] group-hover:border-[#D4AD1F]'
                                  }`}
                                  title={isSelected ? 'Deselect folder' : 'Select folder for batch import'}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 text-[#F7D147]" />}
                                </div>

                                <div className="w-8 h-8 rounded-xl bg-[#FEFBEB] border border-[#F7D147]/50 text-[#6B5306] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <Folder className="w-4 h-4 fill-[#F7D147]/30 text-[#D4AD1F]" />
                                </div>

                                <div className="min-w-0">
                                  <span className="text-base font-semibold text-[#292524] truncate block">
                                    {folder.name}
                                  </span>
                                  {isSelected ? (
                                    <span className="text-[13px] font-bold text-[#6B5306] block leading-tight">
                                      Ready to import
                                    </span>
                                  ) : (
                                    <span className="text-[13px] text-[#78716C] block leading-tight">
                                      Click to select
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Dedicated Browse / Open inside folder button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigateToFolder(folder);
                                }}
                                className="inline-flex items-center gap-0.5 px-2.5 py-1 text-[13px] font-semibold text-[#57534E] hover:text-[#292524] hover:bg-[#EAE6DF]/60 rounded-full transition-colors shrink-0"
                                title={`Open and browse inside ${folder.name}`}
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* FILES IN CURRENT DRIVE/FOLDER */}
                  <div>
                    <div className="text-[13px] font-bold text-[#57534E] mb-2 flex items-center justify-between tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <FileAudio className="w-3.5 h-3.5 text-[#78716C]" />
                        Files in {currentFolder.name} ({filteredFiles.length})
                      </span>
                      {selectedFileIds.size > 0 && (
                        <span className="text-[#528BCA] font-semibold">
                          {selectedFileIds.size} selected
                        </span>
                      )}
                    </div>

                    {filteredFiles.length === 0 ? (
                      <div className="py-10 text-center bg-[#FDFCF8] rounded-2xl border border-dashed border-[#EAE6DF] space-y-1.5">
                        <p className="font-heading text-lg font-bold text-[#292524]">No files match the current view in this folder.</p>
                        <p className="text-base leading-[1.65] text-[#78716C]">
                          Click on a subfolder above or check another folder in this Drive
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredFiles.map((file) => {
                          const isAudio = isAudioFile(file);
                          const isSelected = selectedFileIds.has(file.id);

                          return (
                            <div
                              key={file.id}
                              onClick={() => toggleFileSelect(file.id)}
                              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#FEFBEB]/80 border-[#F7D147] ring-1 ring-[#F7D147]/40'
                                  : 'hover:bg-[#F7F5F0]/60 border-[#EAE6DF]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Checkbox */}
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-[#292524] text-white'
                                      : 'border border-[#D6D0C6] bg-[#FFFFFF]'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 text-[#F7D147]" />}
                                </div>

                                {/* Icon */}
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    isAudio
                                      ? 'bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/50'
                                      : 'bg-[#F2F7FC] text-[#234B78] border border-[#528BCA]/30'
                                  }`}
                                >
                                  {isAudio ? (
                                    <FileAudio className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-[#292524] truncate">
                                    {file.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-[13px] text-[#78716C] mt-0.5 tabular-nums">
                                    <span>{formatDate(file.modifiedTime)}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(file.size)}</span>
                                    {isAudio && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/50 text-[13px] font-bold">
                                        Audio
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-[13px] font-medium text-[#78716C]">
                                {isSelected ? (
                                  <span className="text-[#1E4D42] font-semibold text-[13px]">
                                    Ready to import
                                  </span>
                                ) : (
                                  <span className="text-[13px]">Click to select</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Action Bar - Strictly pinned and highly visible */}
            <div className="shrink-0 px-6 py-3.5 border-t border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between gap-3 z-20 flex-wrap">
              <div className="text-[13px] text-[#57534E] flex items-center gap-2 flex-wrap">
                {selectedFolderIds.size > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap tabular-nums">
                    <span className="font-bold text-[#6B5306] bg-[#FEFBEB] border border-[#F7D147] px-3 py-1 rounded-full text-[13px] flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-[#D4AD1F]" />
                      <span>{selectedFolderIds.size} folder{selectedFolderIds.size > 1 ? 's' : ''} selected</span>
                    </span>
                    <span className="text-[#57534E] text-[13px] font-medium">
                      ({Array.from(selectedFoldersMap.values()).map((f) => f.folder.name).slice(0, 3).join(', ')}
                      {selectedFolderIds.size > 3 ? '...' : ''})
                    </span>
                    {selectedFileIds.size > 0 && (
                      <span className="text-[#292524] font-semibold text-[13px]">
                        + {selectedFileIds.size} individual file{selectedFileIds.size > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ) : selectedFileIds.size > 0 ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-bold text-[#292524] text-base">
                      {selectedFileIds.size} file(s) selected
                    </span>
                    <span className="text-[#57534E] font-medium">
                      ({files.filter((f) => selectedFileIds.has(f.id) && isAudioFile(f)).length} audio)
                    </span>
                  </div>
                ) : (
                  <span className="text-base text-[#78716C]">
                    Select one or more folders or audio files above to import
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBatchFetching}
                  className="px-4 py-2 text-[13px] font-semibold text-[#57534E] hover:text-[#292524] rounded-full hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isBatchFetching || (selectedFileIds.size === 0 && selectedFolderIds.size === 0)}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 font-heading text-sm font-bold rounded-full bg-[#528BCA] hover:bg-[#3A71B0] text-white shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 tabular-nums"
                >
                  {isBatchFetching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning Folders...</span>
                    </>
                  ) : selectedFolderIds.size > 0 ? (
                    <>
                      <HardDrive className="w-4 h-4" />
                      <span>
                        Upload &amp; Transcribe from {selectedFolderIds.size} Folder{selectedFolderIds.size > 1 ? 's' : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4" />
                      <span>Upload &amp; Transcribe ({selectedFileIds.size} Files)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
