import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { RootDocument, rootMetadata, rootViewport } from "@/components/shell/root-document";

export const viewport = rootViewport;

export const metadata: Metadata = {
  ...rootMetadata,
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // A root layout of its own, outside the language segment.
  return (
    <RootDocument lang="en">
      <AdminShell>{children}</AdminShell>
    </RootDocument>
  );
}
