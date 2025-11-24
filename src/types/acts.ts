import type { UserLocationPayload } from "@/src/services/userProfile";

export type ActCategory = "Musician" | "Comedian" | "Other";

export type ActSocialLinks = {
  spotify?: string;
  appleMusic?: string;
  instagram?: string;
};

export type ActProfile = {
  id: string;
  ownerUid: string;
  name: string;
  category: ActCategory;
  profileImageRef: string;
  description?: string | null;
  links?: ActSocialLinks | null;
  location: UserLocationPayload;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateActProfilePayload = {
  ownerUid: string;
  name: string;
  category: ActCategory;
  profileImageRef: string;
  description?: string | null;
  links?: ActSocialLinks;
  location: UserLocationPayload;
};
