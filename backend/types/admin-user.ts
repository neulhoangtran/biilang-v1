export type AdminUser = {
  id: number;

  username?: string;
  email?: string;

  role?: {
    id?: number;
    type?: string;
    name?: string;
  } | null;

  Branch?: {
    id?: number;
    documentId?: string;
    Name?: string;
  } | null;
};