type Cycle = "monthly" | "yearly";

const ENV_MAP: Record<string, string | undefined> = {
  NEXT_PUBLIC_LEMONSQUEEZY_STARTER_MONTHLY_URL:
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_MONTHLY_URL,
  NEXT_PUBLIC_LEMONSQUEEZY_PRO_MONTHLY_URL:
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_MONTHLY_URL,
  NEXT_PUBLIC_LEMONSQUEEZY_STARTER_YEARLY_URL:
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_YEARLY_URL,
  NEXT_PUBLIC_LEMONSQUEEZY_PRO_YEARLY_URL:
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_YEARLY_URL,
};

export function resolveCheckoutUrl(
  checkoutEnv: { monthly: string; yearly: string } | null,
  cycle: Cycle
): string | null {
  if (!checkoutEnv) return null;
  const envKey = checkoutEnv[cycle];
  const url = ENV_MAP[envKey];
  return url && url.trim().length > 0 ? url : null;
}
