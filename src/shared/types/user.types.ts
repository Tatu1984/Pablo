export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Org {
  id: string;
  name: string;
  plan: "starter" | "pro" | "enterprise";
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
}

export interface SessionUser {
  user_id: string;
  org_id: string;
  email: string;
}
