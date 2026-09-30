import { ShellAccountMenu } from "@/components/shell/shell-account-menu";

/**
 * The top of a page in the frame: the name of the section, and the account
 * menu where the map keeps it. The logo is the map's alone — every other page
 * says where you are instead of who we are.
 */
export function SectionHeader({
  locale,
  title,
  meta,
  children,
}: {
  locale: string;
  title: string;
  /** Small text beside the title: a count, a month. */
  meta?: React.ReactNode;
  /** A row of controls under the title — the filters. */
  children?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {meta ? <div className="min-w-0 text-sm text-muted-foreground">{meta}</div> : null}
        <div className="ml-auto">
          <ShellAccountMenu locale={locale} />
        </div>
      </div>
      {children ? <div className="px-4 pb-3 md:px-6">{children}</div> : null}
    </header>
  );
}
