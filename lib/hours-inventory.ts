export type HoursFileReport = {
  id: string;
  name: string;
  mimeType: string;
  kind: "csv" | "sheet" | "other";
  headers: string[];
  signature: string;
  delimiter: string;
  rowCountSample: number;
  error?: string;
};

export type PersonFolderReport = {
  folderId: string;
  folderName: string;
  matchedPersonName: string | null;
  files: HoursFileReport[];
  otherFiles: { id: string; name: string; mimeType: string }[];
};

export type HoursInventoryReport = {
  rootFolderId: string;
  generatedAt: string;
  folders: PersonFolderReport[];
  peopleWithoutFolder: string[];
  foldersWithoutCsv: string[];
  formatSignatures: { signature: string; count: number; examples: string[] }[];
};
