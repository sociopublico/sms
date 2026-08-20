export const DRIVE_ROOT_FOLDER_ID = "1scTgoGGwDCG33yCcTuZRQKFz6Bq2-p1c";

export const DRIVE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

export const DRIVE_CONNECT_NEXT = "/horas/sync?connected=1";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};
