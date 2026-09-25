export type Part = { id: number; name: string; cost: number };
export type Job = {
  id: number; ticket: string; scooter_id: number; reason: string; issue: string | null; note: string | null;
  lat: number | null; lng: number | null; status: string; work: string | null; labour: number; washed: boolean;
  photos: string[]; charged: number | null; created_at: string; closed_at: string | null; rider_id: string | null;
  scooters: { code: string; chassis_no: string | null } | null;
  riders: { full_name: string; mobile: string | null; status: string; scooter_id: number | null } | null;
  job_parts: Part[];
};

export const JOB_SELECT =
  "id, ticket, scooter_id, reason, issue, note, lat, lng, status, work, labour, washed, photos, charged, created_at, closed_at, rider_id, scooters(code, chassis_no), riders(full_name, mobile, status, scooter_id), job_parts(id, name, cost)";

export const jobCost = (j: Pick<Job, "labour" | "job_parts">) => Number(j.labour) + j.job_parts.reduce((a, p) => a + Number(p.cost), 0);

export const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
