import { RootDocument, rootMetadata, rootViewport } from "@/components/shell/root-document";

export const metadata = rootMetadata;
export const viewport = rootViewport;

/** The API reference sits outside the language segment, so it needs its own root. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
