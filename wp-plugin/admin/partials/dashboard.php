<?php
/**
 * Dashboard view — main screen after onboarding.
 *
 * Renders shell. Data is loaded async via AJAX in quoted-admin.js.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$plan = get_option( 'quoted_plan', 'free' );
$tenant_id = get_option( 'quoted_tenant_id', '' );
?>
<div class="wrap quoted-dashboard">

	<div class="quoted-header">
		<div class="quoted-header-brand">
			<img
				src="<?php echo esc_url( plugin_dir_url( QUOTED_PLUGIN_FILE ) . 'admin/images/logo-mark.svg' ); ?>"
				alt=""
				class="quoted-logo-mark"
				width="32"
				height="32"
			/>
			<div>
				<h1><?php esc_html_e( 'Quoted Dashboard', 'quoted' ); ?></h1>
				<p class="subtitle">
					<?php esc_html_e( 'How AI crawlers see your site. All data lives locally on this WordPress install.', 'quoted' ); ?>
				</p>
			</div>
		</div>
		<div class="quoted-plan-badge plan-<?php echo esc_attr( $plan ); ?>">
			<?php echo esc_html( ucfirst( str_replace( '_', ' ', $plan ) ) ); ?>
		</div>
	</div>

	<div class="quoted-dashboard-grid">

		<!-- AI Distribution Score -->
		<div class="quoted-card quoted-score-card">
			<h2><?php esc_html_e( 'AI Distribution Score', 'quoted' ); ?></h2>
			<div class="quoted-score-gauge">
				<canvas id="quoted-score-canvas" width="240" height="240"></canvas>
				<div class="quoted-score-number" id="quoted-score-number">—</div>
			</div>
			<p class="quoted-score-delta" id="quoted-score-delta"></p>
			<p class="quoted-score-explainer">
				<?php esc_html_e( 'Higher = AI bots are finding and reading more of your content.', 'quoted' ); ?>
			</p>
		</div>

		<!-- Next action -->
		<div class="quoted-card quoted-next-card">
			<h2><?php esc_html_e( 'Next action', 'quoted' ); ?></h2>
			<div id="quoted-next-action">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quoted' ); ?></p>
			</div>
		</div>

		<!-- Bot activity feed -->
		<div class="quoted-card quoted-feed-card">
			<h2>
				<?php esc_html_e( 'Recent AI bot visits', 'quoted' ); ?>
				<span class="quoted-period">(<?php esc_html_e( 'last 7 days', 'quoted' ); ?>)</span>
			</h2>
			<div id="quoted-bot-feed">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quoted' ); ?></p>
			</div>
		</div>

		<!-- Top bots -->
		<div class="quoted-card quoted-top-bots-card">
			<h2><?php esc_html_e( 'Top AI bots this week', 'quoted' ); ?></h2>
			<div id="quoted-top-bots">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quoted' ); ?></p>
			</div>
		</div>

		<!-- Citations (Phase 2 teaser for free tier) -->
		<div class="quoted-card quoted-citations-card">
			<h2><?php esc_html_e( 'Citations', 'quoted' ); ?></h2>
			<?php if ( $plan === 'free' ) : ?>
				<div class="quoted-paywall-teaser">
					<p class="quoted-locked-icon">🔒</p>
					<?php if ( Quoted_Billing::is_configured() ) : ?>
						<p><?php esc_html_e( 'Citation tracking arrives in the Solo plan. See exactly when ChatGPT, Claude, and Perplexity quote your content.', 'quoted' ); ?></p>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-billing' ) ); ?>" class="button button-primary">
							<?php esc_html_e( 'Upgrade to Solo', 'quoted' ); ?>
						</a>
					<?php else : ?>
						<p><strong><?php esc_html_e( 'Pro features coming soon.', 'quoted' ); ?></strong></p>
						<p><?php esc_html_e( 'Citation tracking, Live AI Test, and Niche Benchmark are in active development. The Free tier (llms.txt, Markdown endpoints, bot detection, allowlist, schema) is fully functional.', 'quoted' ); ?></p>
					<?php endif; ?>
				</div>
			<?php else : ?>
				<div id="quoted-citations-list">
					<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quoted' ); ?></p>
				</div>
			<?php endif; ?>
		</div>

		<!-- Quota -->
		<div class="quoted-card quoted-quota-card">
			<h2><?php esc_html_e( 'Posts synced', 'quoted' ); ?></h2>
			<div id="quoted-quota">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quoted' ); ?></p>
			</div>
		</div>

	</div>

	<div class="quoted-footer">
		<img
			src="<?php echo esc_url( plugin_dir_url( QUOTED_PLUGIN_FILE ) . 'admin/images/logo-mark.svg' ); ?>"
			alt=""
			class="quoted-logo-mark"
			width="16"
			height="16"
		/>
		<p style="margin:0;">
			<?php
			$llms_url = esc_url( home_url( '/llms.txt' ) );
			printf(
				/* translators: %s: llms.txt URL */
				wp_kses_post( __( 'AI sitemap: <a href="%1$s" target="_blank"><code>%1$s</code></a>', 'quoted' ) ),
				$llms_url
			);
			?>
			·
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-settings' ) ); ?>">
				<?php esc_html_e( 'Settings', 'quoted' ); ?>
			</a>
		</p>
	</div>

</div>
