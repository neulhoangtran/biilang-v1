export type AdminMessage = {
  id: number;

  documentId?: string;

  Title?: string;
  Content?: string;

  Schedule?: string | null;

  createdAt?: string;
  updatedAt?: string;

  Branches?: {
    id?: number;
    documentId?: string;
    Name?: string;
  }[];

  User?: {
    id?: number;
    username?: string;
    email?: string;
  }[];

  Author?: {
    id?: number;
    username?: string;
    email?: string;
  } | null;
};