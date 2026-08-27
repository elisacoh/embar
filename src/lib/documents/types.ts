export interface DocumentPage {
  id: string;
  title: string;
  body: string;
  level: number;
}

export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  pages: DocumentPage[];
  folderId: string | null;
  documentTypeId: string | null;
  currentContentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocFolder {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export type DocumentVersionSource =
  | "manual"
  | "export"
  | "import"
  | "restore"
  | "copy_source"
  | "system";

export interface DocumentVersion {
  id: string;
  documentId: string;
  parentVersionId: string | null;
  versionNumber: number;
  contentHash: string;
  label: string | null;
  highlighted: boolean;
  source: DocumentVersionSource;
  createdAt: string;
}

export type DocumentAssetType =
  | "original_docx"
  | "pdf_export"
  | "uploaded_pdf"
  | "image"
  | "attachment";

export interface DocumentAsset {
  id: string;
  documentId: string;
  documentVersionId: string | null;
  assetType: DocumentAssetType;
  filename: string;
  mimeType: string;
  storageKey: string;
  contentHash: string | null;
  createdAt: string;
}

export interface DocumentType {
  id: string;
  workspaceId: string | null;
  systemKey: string | null;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export type DocumentFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "single_select"
  | "multi_select";

export interface FieldDefinition {
  id: string;
  documentTypeId: string;
  key: string;
  label: string;
  fieldType: DocumentFieldType;
  config: Record<string, unknown>;
  visibleByDefault: boolean;
  searchWeight: number;
  position: number;
}

export interface DocumentFieldValue {
  id: string;
  documentId: string;
  fieldDefinitionId: string | null;
  localFieldKey: string | null;
  value: unknown;
}

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  parentCollectionId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface DocumentCollectionLink {
  documentId: string;
  collectionId: string;
}
