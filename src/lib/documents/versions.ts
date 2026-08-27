export const DOCUMENT_VERSION_SOURCES = [
  "manual",
  "export",
  "import",
  "restore",
  "copy_source",
  "system",
] as const;

export type DocumentVersionSource = (typeof DOCUMENT_VERSION_SOURCES)[number];

export const DOCUMENT_ASSET_TYPES = [
  "original_docx",
  "pdf_export",
  "uploaded_pdf",
  "image",
  "attachment",
] as const;

export type DocumentAssetType = (typeof DOCUMENT_ASSET_TYPES)[number];

export function shouldCreateNewVersion(
  workingHash: string,
  latestVersionHash: string | null | undefined
): boolean {
  return !latestVersionHash || latestVersionHash !== workingHash;
}

export function nextVersionNumber(latestVersionNumber: number | null | undefined): number {
  return (latestVersionNumber ?? 0) + 1;
}

export function fallbackVersionCaption(
  versionNumber: number,
  createdAt: string
): { title: string; subtitle: string } {
  const date = new Date(createdAt);
  return {
    title: `v${versionNumber}`,
    subtitle: Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
  };
}

export function displayVersionTitle(
  versionNumber: number,
  label: string | null | undefined
): string {
  const named = label?.trim();
  return named || `v${versionNumber}`;
}
