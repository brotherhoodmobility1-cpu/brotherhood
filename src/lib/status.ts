/** Kept only for older agreement text that mentions a minimum; no longer used for alerts. */
export const MIN_BALANCE = 0;

export type RiderLite = {
  status?: string;
  wallet_balance: number | string;
  action_needed: boolean;
};

/** Colour rules: ok, warn (paying late), bad (action needed / breakdown), mech (with mechanic), free (available). */
export function scooterStatus(sStatus: string, rider: RiderLite | null | undefined): [string, string] {
  if (!rider) return sStatus === "workshop" ? ["mech", "With mechanic"] : ["free", "Available"];
  if (sStatus === "workshop") return ["bad", "Breakdown"];
  if (rider.action_needed) return ["bad", "Action needed"];
  if (Number(rider.wallet_balance) < 0) return ["warn", "Paying late"];
  return ["ok", "Running fine"];
}

export function riderTag(r: RiderLite): [string, string] {
  if (r.action_needed) return ["bad", "Action needed"];
  if (Number(r.wallet_balance) < 0) return ["bad", "Late"];
  return ["", "OK"];
}
