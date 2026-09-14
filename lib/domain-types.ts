export type Role = "payer" | "earner" | "verifier";
export type Evidence = {
  version: number;
  notes: string;
  files: string[];
  digest: string;
  at: string;
};
export type Milestone = {
  title: string;
  criteria: string;
  amount: number;
  fee: number;
  approver: "payer" | "verifier";
  status: "waiting" | "submitted" | "changes" | "approved";
  evidence: Evidence[];
  feedback?: string;
};
export type Entry = {
  id: string;
  at: string;
  actor: Role;
  action: string;
  message: string;
  amount: number;
  digest?: string;
};
export type Agreement = {
  id: string;
  payerId: string;
  version: number;
  title: string;
  scope: string;
  earner: string;
  verifier: string;
  expiry: string;
  createdAt: string;
  accepted: Role[];
  status:
    | "awaiting"
    | "ready"
    | "active"
    | "cancelled"
    | "expired"
    | "complete";
  milestones: Milestone[];
  funded: number;
  reserved: number;
  earned: { earner: number; verifier: number };
  withdrawn: { earner: number; verifier: number };
  refunded: number;
  cancelVotes: Role[];
  operations: string[];
  timeline: Entry[];
};
export type Action = {
  type:
    | "accept"
    | "fund"
    | "submit"
    | "approve"
    | "changes"
    | "withdraw"
    | "refund"
    | "cancel"
    | "correct";
  role: Role;
  operationId: string;
  milestone?: number;
  notes?: string;
  files?: string[];
  digest?: string;
};
export type Draft = Pick<
  Agreement,
  "title" | "scope" | "earner" | "verifier" | "expiry"
> & {
  milestones: Pick<
    Milestone,
    "title" | "criteria" | "amount" | "fee" | "approver"
  >[];
};

