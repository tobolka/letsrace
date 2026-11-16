/**
 * The launch screens an iPhone shows while Let's Race opens from the home
 * screen: the icon and the wordmark on white. Safari only uses one whose size
 * matches the phone exactly, so there is one per screen size, portrait only.
 * The images are in `public/app-icons/splash/`, named by their pixel size.
 */
const SCREENS: [width: number, height: number, ratio: number][] = [
  [440, 956, 3],
  [420, 912, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
];

export const IPHONE_LAUNCH_SCREENS = SCREENS.map(([width, height, ratio]) => ({
  url: `/app-icons/splash/splash-${width * ratio}x${height * ratio}.png`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
}));
