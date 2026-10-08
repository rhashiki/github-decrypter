export const CODE_EXPLORER_FOLDER_BUILD = 73 as const;
export const CODE_EXPLORER_FOLDER_MAX_FILES = 64 as const;
export const CODE_EXPLORER_FOLDER_MAX_ENTRIES = 10_000 as const;
export const CODE_EXPLORER_FOLDER_MAX_CHARS = 400_000 as const;
export const CODE_EXPLORER_FOLDER_MAX_FILE_CHARS = 100_000 as const;
export const CODE_EXPLORER_FOLDER_MAX_FILE_BYTES = 400_000 as const;

export interface ExplicitlySelectedFile {
  readonly name: string;
  readonly size: number;
  readonly webkitRelativePath?: string;
  text(): Promise<string>;
}
export interface SelectedFolderSource {
  readonly path: string;
  readonly content: string;
}
export interface SelectedFolderResult {
  readonly files: readonly SelectedFolderSource[];
  readonly eligibleCount: number;
  readonly skippedCount: number;
  readonly maxFiles: typeof CODE_EXPLORER_FOLDER_MAX_FILES;
  readonly explicitUserSelectionRequired: true;
  readonly networkAccess: false;
  readonly serverFilesystemAccess: false;
  readonly persistentStorage: false;
}
const EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const EXCLUDED = new Set([
  '.git','node_modules','.next','.cache','dist','build','coverage',
  '.ssh','.aws','.config','.vscode','.idea','secrets',
]);
const SENSITIVE = /^(?:\.env(?:\..*)?|id_(?:rsa|ed25519|ecdsa)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets(?:\..*)?)$/i;

/** Local folder paths contain the selected folder's display name as segment zero. */
export function safeSelectedFolderPath(relativePath: unknown): string | null {
  if (typeof relativePath !== 'string' || relativePath.length > 2300
    || /[\u0000-\u001f\u007f\\]/.test(relativePath) || relativePath.startsWith('/')) return null;
  const parts = relativePath.split('/');
  if (parts.length < 2 || parts.some(part=>!part || part==='.' || part==='..'
    || EXCLUDED.has(part.toLowerCase()) || SENSITIVE.test(part))) return null;
  const normalized = parts.slice(1).join('/');
  if (!normalized || normalized.length > 2048 || !EXTENSION.test(normalized)) return null;
  return normalized;
}

/** Reads only browser-picked files, never discovers or traverses the host filesystem. */
export async function readExplicitlySelectedFolder(files: readonly ExplicitlySelectedFile[]): Promise<SelectedFolderResult> {
  if (!Array.isArray(files) || files.length === 0 || files.length > CODE_EXPLORER_FOLDER_MAX_ENTRIES) {
    throw new RangeError('Select one folder with up to 10,000 entries.');
  }
  const roots = new Set<string>();
  const eligible: Array<{path:string; file: ExplicitlySelectedFile}> = [];
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || file.size < 0) {
      throw new TypeError('Folder selection contains invalid file metadata.');
    }
    const relative = file.webkitRelativePath;
    if (typeof relative !== 'string' || !relative.includes('/')) continue;
    const path = safeSelectedFolderPath(relative);
    if (!path) continue;
    roots.add(relative.split('/')[0]!);
    eligible.push({path,file});
  }
  if (roots.size > 1) throw new TypeError('Only one explicitly selected folder is supported.');
  eligible.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const selected = eligible.slice(0,CODE_EXPLORER_FOLDER_MAX_FILES);
  if (new Set(selected.map(item=>item.path)).size!==selected.length) {
    throw new TypeError('Duplicate relative source paths were selected.');
  }
  if (!selected.length) throw new Error('The selected folder has no eligible JavaScript/TypeScript source files.');
  const loaded: SelectedFolderSource[]=[];
  let chars=0;
  for (const entry of selected) {
    if (entry.file.size > CODE_EXPLORER_FOLDER_MAX_FILE_BYTES) {
      throw new RangeError('Selected source file exceeds the 400 KB byte limit.');
    }
    const content = await entry.file.text();
    if (typeof content !== 'string' || content.length > CODE_EXPLORER_FOLDER_MAX_FILE_CHARS) {
      throw new RangeError('Selected source file exceeds the 100,000 character limit.');
    }
    chars += content.length;
    if(chars > CODE_EXPLORER_FOLDER_MAX_CHARS) {
      throw new RangeError('Selected folder exceeds the 400,000 character budget.');
    }
    loaded.push(Object.freeze({path:entry.path,content}));
  }
  return Object.freeze({
    files:Object.freeze(loaded),
    eligibleCount:eligible.length,
    skippedCount:eligible.length-loaded.length,
    maxFiles:CODE_EXPLORER_FOLDER_MAX_FILES,
    explicitUserSelectionRequired:true,
    networkAccess:false,
    serverFilesystemAccess:false,
    persistentStorage:false,
  });
}
