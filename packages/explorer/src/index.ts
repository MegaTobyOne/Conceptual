import { V0_1_COLLECTIONS, VERSION_AXES } from "@pspf/contracts";

export const explorerPublicationMode = {
  mode: "publication",
  supportedVersions: VERSION_AXES,
  requiredCollections: V0_1_COLLECTIONS
} as const;
