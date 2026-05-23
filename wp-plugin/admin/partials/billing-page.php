<?php
/**
 * Billing / Upgrade page in WP admin.
 *
 * Shows 3 pricing tiers + current subscription state.
 * Allows upgrade / manage subscription.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$current_plan = get_option( 'quoted_plan', 'free' );
$license = new Quoted_License();
$is_connected = $license->is_connected();
?>
<div class="wrap quoted-billing">

	<div class="quoted-header">
		<h1><?php esc_html_e( 'Upgrade Quoted', 'quoted' ); ?></h1>
		<p class="subtitle"><?php esc_html_e( 'Pick the plan that fits your site.', 'quoted' ); ?></p>
	</div>

	<?php if ( ! $is_connected ) : ?>
		<div class="notice notice-warning">
			<p>
				<strong><?php esc_html_e( 'Please connect to Quoted first.', 'quoted' ); ?></strong>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted' ) ); ?>">
					<?php esc_html_e( 'Complete onboarding →', 'quoted' ); ?>
				</a>
			</p>
		</div>
	<?php endif; ?>

	<!-- Current plan badge -->
	<div class="quoted-current-plan-card">
		<div class="quoted-current-plan-label">
			<?php esc_html_e( 'Your current plan:', 'quoted' ); ?>
		</div>
		<div class="quoted-current-plan-value">
			<span class="quoted-plan-badge plan-<?php echo esc_attr( $current_plan ); ?>">
				<?php
				echo esc_html( strtoupper( str_replace( '_', ' ', $current_plan ) ) );
				?>
			</span>
		</div>

		<?php if ( $current_plan !== 'free' ) : ?>
			<div class="quoted-current-plan-actions">
				<button type="button" class="button" id="quoted-open-portal-btn">
					<?php esc_html_e( 'Manage subscription', 'quoted' ); ?>
				</button>
				<span class="description">
					<?php esc_html_e( '(Update card, cancel, view invoices — opens in new tab)', 'quoted' ); ?>
				</span>
			</div>
		<?php endif; ?>
	</div>

	<!-- Pricing tiers -->
	<div class="quoted-pricing-grid">

		<!-- FREE -->
		<div class="quoted-pricing-card <?php echo $current_plan === 'free' ? 'current' : ''; ?>">
			<div class="quoted-pricing-header">
				<h2><?php esc_html_e( 'Free', 'quoted' ); ?></h2>
				<div class="quoted-price">
					<span class="amount">$0</span>
					<span class="period">/<?php esc_html_e( 'forever', 'quoted' ); ?></span>
				</div>
			</div>
			<ul class="quoted-features">
				<li>✓ <?php esc_html_e( 'Up to 50 posts synced', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( '7 days of bot history', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'AI Distribution Score', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'llms.txt auto-generation', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( '3 Live AI Tests per month', 'quoted' ); ?></li>
				<li class="muted">— <?php esc_html_e( '"Powered by Quoted" badge in footer', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'free' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php else : ?>
					<button type="button" class="button" disabled>
						<?php esc_html_e( 'Downgrade via support', 'quoted' ); ?>
					</button>
				<?php endif; ?>
			</div>
		</div>

		<!-- SOLO $19 -->
		<div class="quoted-pricing-card featured <?php echo $current_plan === 'solo' ? 'current' : ''; ?>">
			<div class="quoted-pricing-badge"><?php esc_html_e( 'MOST POPULAR', 'quoted' ); ?></div>
			<div class="quoted-pricing-header">
				<h2><?php esc_html_e( 'Solo', 'quoted' ); ?></h2>
				<div class="quoted-price">
					<span class="amount">$19</span>
					<span class="period">/<?php esc_html_e( 'month', 'quoted' ); ?></span>
				</div>
				<p class="quoted-billed">
					<?php esc_html_e( 'Billed monthly · Cancel anytime', 'quoted' ); ?>
				</p>
			</div>
			<ul class="quoted-features">
				<li>✓ <strong><?php esc_html_e( 'Unlimited posts', 'quoted' ); ?></strong></li>
				<li>✓ <strong><?php esc_html_e( '12 months of bot history', 'quoted' ); ?></strong></li>
				<li>✓ <strong><?php esc_html_e( 'Citation tracking', 'quoted' ); ?></strong> <?php esc_html_e( '(Perplexity + Tavily)', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( '20 Live AI Tests per month', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Per-category configuration', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Email weekly digest', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Up to 5 sites per license', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'No badge in footer', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'solo' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php else : ?>
					<button type="button"
					        class="button button-primary button-hero quoted-upgrade-btn"
					        data-tier="solo"
					        <?php disabled( ! $is_connected ); ?>>
						<?php
						if ( $current_plan === 'pro_plus' ) {
							esc_html_e( 'Downgrade to Solo', 'quoted' );
						} else {
							esc_html_e( 'Upgrade to Solo', 'quoted' );
						}
						?>
					</button>
				<?php endif; ?>
			</div>
		</div>

		<!-- PRO+ $39 -->
		<div class="quoted-pricing-card <?php echo $current_plan === 'pro_plus' ? 'current' : ''; ?>">
			<div class="quoted-pricing-header">
				<h2><?php esc_html_e( 'Pro+', 'quoted' ); ?></h2>
				<div class="quoted-price">
					<span class="amount">$39</span>
					<span class="period">/<?php esc_html_e( 'month', 'quoted' ); ?></span>
				</div>
				<p class="quoted-billed">
					<?php esc_html_e( 'Billed monthly · Cancel anytime', 'quoted' ); ?>
				</p>
			</div>
			<ul class="quoted-features">
				<li>✓ <?php esc_html_e( 'Everything in Solo', 'quoted' ); ?></li>
				<li>✓ <strong><?php esc_html_e( 'Niche benchmark', 'quoted' ); ?></strong> <?php esc_html_e( '(see vs competitors)', 'quoted' ); ?></li>
				<li>✓ <strong><?php esc_html_e( '100 Live AI Tests per month', 'quoted' ); ?></strong></li>
				<li>✓ <strong><?php esc_html_e( 'Priority support', 'quoted' ); ?></strong> <?php esc_html_e( '(24h SLA)', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Custom citation prompts', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'API access', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Up to 30 sites per license', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'White-label option', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'pro_plus' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php else : ?>
					<button type="button"
					        class="button button-primary button-hero quoted-upgrade-btn"
					        data-tier="pro_plus"
					        <?php disabled( ! $is_connected ); ?>>
						<?php esc_html_e( 'Upgrade to Pro+', 'quoted' ); ?>
					</button>
				<?php endif; ?>
			</div>
		</div>

	</div>

	<!-- Trust signals -->
	<div class="quoted-trust">
		<div class="quoted-trust-item">
			<strong>🔒 <?php esc_html_e( 'Secure payment', 'quoted' ); ?></strong>
			<small><?php esc_html_e( 'Powered by Lemon Squeezy. SSL encrypted. PCI compliant.', 'quoted' ); ?></small>
		</div>
		<div class="quoted-trust-item">
			<strong>💸 <?php esc_html_e( '14-day money-back', 'quoted' ); ?></strong>
			<small><?php esc_html_e( 'Not satisfied? Full refund within 14 days. No questions asked.', 'quoted' ); ?></small>
		</div>
		<div class="quoted-trust-item">
			<strong>📄 <?php esc_html_e( 'No commitment', 'quoted' ); ?></strong>
			<small><?php esc_html_e( 'Cancel anytime. Keep access until end of paid period.', 'quoted' ); ?></small>
		</div>
		<div class="quoted-trust-item">
			<strong>🌍 <?php esc_html_e( 'Global tax handled', 'quoted' ); ?></strong>
			<small><?php esc_html_e( 'VAT, GST, sales tax — all calculated and remitted for you.', 'quoted' ); ?></small>
		</div>
	</div>

	<!-- FAQ -->
	<div class="quoted-faq">
		<h2><?php esc_html_e( 'Common questions', 'quoted' ); ?></h2>

		<details>
			<summary><?php esc_html_e( 'What payment methods do you accept?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'Visa, MasterCard, American Express, Discover, JCB, Diners Club, PayPal, and more. Local payment methods in 20+ countries via Lemon Squeezy.', 'quoted' ); ?></p>
		</details>

		<details>
			<summary><?php esc_html_e( 'Can I upgrade or downgrade anytime?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'Yes. Upgrades are pro-rated — you only pay the difference. Downgrades take effect at the end of your current billing period.', 'quoted' ); ?></p>
		</details>

		<details>
			<summary><?php esc_html_e( 'What happens if I cancel?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'You keep access until the end of your paid period. After that, your account reverts to Free plan. Your data is preserved.', 'quoted' ); ?></p>
		</details>

		<details>
			<summary><?php esc_html_e( 'How does the 14-day guarantee work?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'Email support@quoted.io within 14 days of your first payment. We refund 100%, no questions asked.', 'quoted' ); ?></p>
		</details>

		<details>
			<summary><?php esc_html_e( 'Do you offer team or agency plans?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'Pro+ supports up to 30 sites per license. Need more? Email support@quoted.io for custom agency pricing.', 'quoted' ); ?></p>
		</details>

		<details>
			<summary><?php esc_html_e( 'Will my data be lost if I downgrade?', 'quoted' ); ?></summary>
			<p><?php esc_html_e( 'No. Your data stays. Only certain features become limited (e.g., 7-day vs 12-month history). Re-upgrade anytime to restore full access.', 'quoted' ); ?></p>
		</details>

	</div>

	<div class="quoted-footer-info">
		<p>
			<?php esc_html_e( 'Payments processed by', 'quoted' ); ?>
			<a href="https://lemonsqueezy.com" target="_blank" rel="noopener">Lemon Squeezy</a>
			(<?php esc_html_e( 'Merchant of Record', 'quoted' ); ?>).
			<?php esc_html_e( 'See our', 'quoted' ); ?>
			<a href="https://quoted.io/terms" target="_blank"><?php esc_html_e( 'Terms', 'quoted' ); ?></a>,
			<a href="https://quoted.io/privacy" target="_blank"><?php esc_html_e( 'Privacy Policy', 'quoted' ); ?></a>,
			<a href="https://quoted.io/refund-policy" target="_blank"><?php esc_html_e( 'Refund Policy', 'quoted' ); ?></a>.
		</p>
	</div>

</div>
