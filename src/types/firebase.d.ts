import type { Persistence } from "firebase/auth";

// `getReactNativePersistence` is only present in the React Native build of
// `@firebase/auth` (resolved via the "react-native" package export condition
// at bundle time), so it isn't included in the default TypeScript types that
// `firebase/auth` resolves to. It IS available at runtime on native platforms
// (Metro resolves the "react-native" condition), so we augment the module's
// types here to make it usable without disabling type checking.
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
