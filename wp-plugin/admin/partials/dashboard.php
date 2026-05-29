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
?>
<div class="wrap quoted-dashboard">

	<div class="quoted-header">
		<h1><?php esc_html_e( 'Quoted Dashboard', 'quotedeasy-ai-readiness' ); ?></h1>
	</div>

	<div class="quoted-dashboard-grid">

		<!-- AI Distribution Score -->
		<div class="quoted-card quoted-score-card">
			<h2><?php esc_html_e( 'AI Distribution Score', 'quotedeasy-ai-readiness' ); ?></h2>
			<div class="quoted-score-gauge">
				<canvas id="quoted-score-canvas" width="240" height="240"></canvas>
				<div class="quoted-score-number" id="quoted-score-number">—</div>
			</div>
			<p class="quoted-score-delta" id="quoted-score-delta"></p>
			<p class="quoted-score-explainer">
				<?php esc_html_e( 'Higher = AI bots are finding and reading more of your content.', 'quotedeasy-ai-readiness' ); ?>
			</p>
		</div>

		<!-- Next action -->
		<div class="quoted-card quoted-next-card">
			<h2><?php esc_html_e( 'Next action', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quoted-next-action">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<!-- Bot activity feed -->
		<div class="quoted-card quoted-feed-card">
			<h2>
				<?php esc_html_e( 'Recent AI bot visits', 'quotedeasy-ai-readiness' ); ?>
				<span class="quoted-period">(<?php esc_html_e( 'last 7 days', 'quotedeasy-ai-readiness' ); ?>)</span>
			</h2>
			<div id="quoted-bot-feed">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<!-- Top bots -->
		<div class="quoted-card quoted-top-bots-card">
			<h2><?php esc_html_e( 'Top AI bots this week', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quoted-top-bots">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<!-- Published content -->
		<div class="quoted-card quoted-quota-card">
			<h2><?php esc_html_e( 'Published content', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quoted-quota">
				<p class="quoted-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

	</div>

	<div class="quoted-footer">
		<p>
			<?php
			$llms_url = esc_url( home_url( '/llms.txt' ) );
			printf(
				/* translators: %s: llms.txt URL */
				wp_kses_post( __( 'AI sitemap: <a href="%1$s" target="_blank" rel="noopener"><code>%1$s</code></a>', 'quotedeasy-ai-readiness' ) ),
				$llms_url
			);
			?>
			·
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-settings' ) ); ?>">
				<?php esc_html_e( 'Settings', 'quotedeasy-ai-readiness' ); ?>
			</a>
		</p>
	</div>

</div>
