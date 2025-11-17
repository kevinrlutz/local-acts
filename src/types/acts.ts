import type { UserLocationPayload } from "@/src/services/userProfile";

export type ActCategory = "Musician" | "Rapper" | "Comedian" | "Other";

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
  links?: ActSocialLinks;
  location: UserLocationPayload;
};
