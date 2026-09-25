export const MIN_BALANCE = 200;

export type RiderLite = {
  status?: string;
  wallet_balance: number | string;
  action_needed: boolean;
};

/** Same colour rules as the prototype: ok, warn, bad, mech (with mechanic), free (available). */
export function scooterStatus(sStatus: string, rider: RiderLite | null | undefined): [string, string] {
  if (!rider) return sStatus === "workshop" ? ["mech", "With mechanic"] : ["free", "Available"];
  if (sStatus === "workshop") return ["bad", "Breakdown"];
  const w = Number(rider.wallet_balance);
  if (rider.action_needed) return ["bad", "Action needed"];
  if (w < 0) return ["warn", "Paying late"];
  if (w < MIN_BALANCE) return ["warn", "Low balance"];
  return ["ok", "Running fine"];
}

export function riderTag(r: RiderLite): [string, string] {
  const w = Number(r.wallet_balance);
  if (r.action_needed) return ["bad", "Action needed"];
  if (w < 0) return ["bad", "Late"];
  if (w < MIN_BALANCE) return ["due", "Low balance"];
  return ["", "OK"];
}
