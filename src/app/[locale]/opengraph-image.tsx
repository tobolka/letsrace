import HomeOpenGraphImage, {
  contentType,
  homeOgAlt,
  resolveOgLocale,
  size,
} from "@/lib/og/home-opengraph-image";

export { contentType, size };
export default HomeOpenGraphImage;

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = resolveOgLocale(raw);

  return [
    {
      id: "default",
      contentType,
      size,
      alt: homeOgAlt(locale),
    },
  ];
}
