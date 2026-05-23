<?php
/**
 * Upgrade / Billing page — 3 pricing tiers + direct Lemon Squeezy buy URLs.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$current_plan = Quoted_License::current_plan();
$license      = new Quoted_License();
$is_connected = $license->is_connected();

$solo_url     = Quoted_Billing::buy_url( 'solo' );
$pro_plus_url = Quoted_Billing::buy_url( 'pro_plus' );
$portal_url   = Quoted_Billing::customer_portal_url();
?>
<div class="wrap quoted-billing">

	<div class="quoted-header">
		<h1><?php esc_html_e( 'Upgrade Quoted', 'quoted' ); ?></h1>
		<p class="subtitle"><?php esc_html_e( 'Pick the plan that fits your site.', 'quoted' ); ?></p>
	</div>

	<?php if ( ! Quoted_Billing::is_configured() ) : ?>
		<div class="notice notice-warning">
			<p>
				<strong><?php esc_html_e( 'Plugin not fully configured.', 'quoted' ); ?></strong>
				<?php esc_html_e( 'The Lemon Squeezy store / variant IDs in quoted.php still hold placeholder values. Buy buttons are disabled until those constants are updated.', 'quoted' ); ?>
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
				<?php echo esc_html( strtoupper( str_replace( '_', ' ', $current_plan ) ) ); ?>
			</span>
		</div>

		<?php if ( $current_plan !== 'free' && $is_connected ) : ?>
			<div class="quoted-current-plan-actions">
				<a href="<?php echo esc_url( $portal_url ); ?>" target="_blank" rel="noopener" class="button">
					<?php esc_html_e( 'Manage subscription on Lemon Squeezy ↗', 'quoted' ); ?>
				</a>
				<span class="description">
					<?php esc_html_e( '(Update card, cancel, view invoices)', 'quoted' ); ?>
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
				<li>✓ <?php esc_html_e( 'Up to 50 posts in llms.txt', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( '7 days of local bot history', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'AI Distribution Score (local)', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'llms.txt auto-generation', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Markdown endpoint per post', 'quoted' ); ?></li>
				<li class="muted">— <?php esc_html_e( '"Powered by Quoted" badge in footer', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'free' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php else : ?>
					<span class="description"><?php esc_html_e( 'Cancel your paid plan to revert to Free.', 'quoted' ); ?></span>
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
				<li>✓ <strong><?php esc_html_e( 'Unlimited posts in llms.txt', 'quoted' ); ?></strong></li>
				<li>✓ <strong><?php esc_html_e( '12 months of bot history', 'quoted' ); ?></strong></li>
				<li>✓ <strong><?php esc_html_e( 'Citation tracking', 'quoted' ); ?></strong> <?php esc_html_e( '(BYO Perplexity key)', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Live AI Test', 'quoted' ); ?> <?php esc_html_e( '(BYO key)', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Per-category configuration', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Up to 5 sites per license', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'No badge in footer', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'solo' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php elseif ( ! empty( $solo_url ) ) : ?>
					<a href="<?php echo esc_url( $solo_url ); ?>"
					   class="button button-primary button-hero"
					   target="_blank"
					   rel="noopener">
						<?php
						echo $current_plan === 'pro_plus'
							? esc_html__( 'Switch to Solo ↗', 'quoted' )
							: esc_html__( 'Upgrade to Solo ↗', 'quoted' );
						?>
					</a>
				<?php else : ?>
					<button class="button button-primary" disabled>
						<?php esc_html_e( 'Not configured', 'quoted' ); ?>
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
				<li>✓ <strong><?php esc_html_e( 'Niche benchmark', 'quoted' ); ?></strong> <?php esc_html_e( '(BYO key)', 'quoted' ); ?></li>
				<li>✓ <strong><?php esc_html_e( 'Priority support (24h SLA)', 'quoted' ); ?></strong></li>
				<li>✓ <?php esc_html_e( 'Custom citation prompts', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Bot whitelist / blocklist', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'Up to 30 sites per license', 'quoted' ); ?></li>
				<li>✓ <?php esc_html_e( 'White-label option', 'quoted' ); ?></li>
			</ul>
			<div class="quoted-pricing-cta">
				<?php if ( $current_plan === 'pro_plus' ) : ?>
					<span class="quoted-current-label"><?php esc_html_e( 'Current plan', 'quoted' ); ?></span>
				<?php elseif ( ! empty( $pro_plus_url ) ) : ?>
					<a href="<?php echo esc_url( $pro_plus_url ); ?>"
					   class="button button-primary button-hero"
					   target="_blank"
					   rel="noopener">
						<?php esc_html_e( 'Upgrade to Pro+ ↗', 'quoted' ); ?>
					</a>
				<?php else : ?>
					<button class="button button-primary" disabled>
						<?php esc_html_e( 'Not configured', 'quoted' ); ?>
					</button>
				<?php endif; ?>
			</div>
		</div>

	</div>

	<!-- License key entry — for customers who already bought -->
	<div class="quoted-license-entry">
		<h2><?php esc_html_e( 'Already have a license key?', 'quoted' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'After completing checkout, Lemon Squeezy sent you a license key by email. Paste it into Settings → Connection → License key.', 'quoted' ); ?>
		</p>
		<p>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-settings' ) ); ?>" class="button">
				<?php esc_html_e( 'Go to Settings →', 'quoted' ); ?>
			</a>
		</p>
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

	<div class="quoted-footer-info">
		<p>
			<?php esc_html_e( 'Payments processed by', 'quoted' ); ?>
			<a href="https://lemonsqueezy.com" target="_blank" rel="noopener">Lemon Squeezy</a>
			(<?php esc_html_e( 'Merchant of Record', 'quoted' ); ?>).
		</p>
	</div>

</div>
