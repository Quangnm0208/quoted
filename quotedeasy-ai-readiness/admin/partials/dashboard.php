<?php
/**
 * Dashboard view.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap quotedeasy-ai-readiness-dashboard">

	<div class="quotedeasy-ai-readiness-header">
		<h1><?php esc_html_e( 'QuotedEasy AI Readiness Dashboard', 'quotedeasy-ai-readiness' ); ?></h1>
	</div>

	<div class="quotedeasy-ai-readiness-dashboard-grid">

		<div class="quotedeasy-ai-readiness-card quotedeasy-ai-readiness-score-card">
			<h2><?php esc_html_e( 'AI Distribution Score', 'quotedeasy-ai-readiness' ); ?></h2>
			<div class="quotedeasy-ai-readiness-score-gauge">
				<canvas id="quotedeasy-ai-readiness-score-canvas" width="240" height="240"></canvas>
				<div class="quotedeasy-ai-readiness-score-number" id="quotedeasy-ai-readiness-score-number">&mdash;</div>
			</div>
			<p class="quotedeasy-ai-readiness-score-delta" id="quotedeasy-ai-readiness-score-delta"></p>
			<p class="quotedeasy-ai-readiness-score-explainer">
				<?php esc_html_e( 'Higher = AI bots are finding and reading more of your content.', 'quotedeasy-ai-readiness' ); ?>
			</p>
		</div>

		<div class="quotedeasy-ai-readiness-card quotedeasy-ai-readiness-next-card">
			<h2><?php esc_html_e( 'Next action', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quotedeasy-ai-readiness-next-action">
				<p class="quotedeasy-ai-readiness-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<div class="quotedeasy-ai-readiness-card quotedeasy-ai-readiness-feed-card">
			<h2>
				<?php esc_html_e( 'Recent AI bot visits', 'quotedeasy-ai-readiness' ); ?>
				<span class="quotedeasy-ai-readiness-period">(<?php esc_html_e( 'last 7 days', 'quotedeasy-ai-readiness' ); ?>)</span>
			</h2>
			<div id="quotedeasy-ai-readiness-bot-feed">
				<p class="quotedeasy-ai-readiness-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<div class="quotedeasy-ai-readiness-card quotedeasy-ai-readiness-top-bots-card">
			<h2><?php esc_html_e( 'Top AI bots this week', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quotedeasy-ai-readiness-top-bots">
				<p class="quotedeasy-ai-readiness-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

		<div class="quotedeasy-ai-readiness-card quotedeasy-ai-readiness-quota-card">
			<h2><?php esc_html_e( 'Published content', 'quotedeasy-ai-readiness' ); ?></h2>
			<div id="quotedeasy-ai-readiness-quota">
				<p class="quotedeasy-ai-readiness-loading"><?php esc_html_e( 'Loading...', 'quotedeasy-ai-readiness' ); ?></p>
			</div>
		</div>

	</div>

	<div class="quotedeasy-ai-readiness-footer">
		<p>
			<?php
			$llms_url = esc_url( home_url( '/llms.txt' ) );
			printf(
				/* translators: %s: llms.txt URL */
				wp_kses_post( __( 'AI sitemap: <a href="%1$s" target="_blank" rel="noopener"><code>%1$s</code></a>', 'quotedeasy-ai-readiness' ) ),
				$llms_url
			);
			?>
			&middot;
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quotedeasy-ai-readiness-settings' ) ); ?>">
				<?php esc_html_e( 'Settings', 'quotedeasy-ai-readiness' ); ?>
			</a>
		</p>
	</div>

</div>
