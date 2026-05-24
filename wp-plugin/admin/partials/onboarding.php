<?php
/**
 * Onboarding wizard — 4-step flow.
 *
 * Step 1: License activation (or "Welcome to Free" when LS isn't configured)
 * Step 2: Auto-scan — refresh local llms.txt cache + show post count
 * Step 3: "Coming soon" preview for the Pro Live AI Test
 * Step 4: Done — link to dashboard + show /llms.txt URL
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap quoted-onboarding">

	<div class="quoted-header">
		<h1><?php esc_html_e( 'Welcome to Quoted', 'quoted' ); ?></h1>
		<p class="subtitle"><?php esc_html_e( 'Make your site AI-readable. See when ChatGPT, Claude, and Perplexity quote you.', 'quoted' ); ?></p>
	</div>

	<div class="quoted-progress">
		<ol>
			<li class="step-1 active"><?php esc_html_e( 'Start', 'quoted' ); ?></li>
			<li class="step-2"><?php esc_html_e( 'Scan', 'quoted' ); ?></li>
			<li class="step-3"><?php esc_html_e( 'Preview', 'quoted' ); ?></li>
			<li class="step-4"><?php esc_html_e( 'Done', 'quoted' ); ?></li>
		</ol>
	</div>

	<!-- Step 1: License activation (or Free intro) -->
	<section class="quoted-step quoted-step-1 active">
		<?php if ( Quoted_Billing::is_configured() ) : ?>
			<h2><?php esc_html_e( 'Step 1 — Activate your license', 'quoted' ); ?></h2>
			<p class="description">
				<?php
				printf(
					/* translators: %s: Upgrade page link */
					esc_html__( "Paste the license key Lemon Squeezy emailed you after checkout. Don't have one? %s", 'quoted' ),
					'<a href="' . esc_url( admin_url( 'admin.php?page=quoted-billing' ) ) . '">' . esc_html__( 'See pricing →', 'quoted' ) . '</a>'
				);
				?>
			</p>

			<form id="quoted-connect-form" autocomplete="off">
				<table class="form-table">
					<tr>
						<th scope="row">
							<label for="quoted-license-key"><?php esc_html_e( 'License key', 'quoted' ); ?></label>
						</th>
						<td>
							<input type="text"
							       id="quoted-license-key"
							       name="license_key"
							       class="regular-text"
							       placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							       autocomplete="off"
							       required />
						</td>
					</tr>
				</table>

				<p class="submit">
					<button type="submit" class="button button-primary button-hero" id="quoted-connect-btn">
						<?php esc_html_e( 'Activate', 'quoted' ); ?>
					</button>
					<span class="quoted-status" id="quoted-connect-status"></span>
				</p>
				<p class="description">
					<?php esc_html_e( 'Or skip this step — Quoted Free works without a license. You can activate later in Settings.', 'quoted' ); ?>
					<br>
					<a href="#" id="quoted-skip-license"><?php esc_html_e( 'Continue on the Free plan →', 'quoted' ); ?></a>
				</p>
			</form>
		<?php else : ?>
			<h2><?php esc_html_e( 'Welcome to Quoted Free', 'quoted' ); ?></h2>
			<p class="description"><?php esc_html_e( "Your site is about to become AI-readable. The Free tier ships everything you need to start: llms.txt at /llms.txt, clean Markdown endpoints, AI bot detection, allowlist, schema markup.", 'quoted' ); ?></p>
			<p class="description"><?php esc_html_e( 'Pro features (citation tracking, Live AI Test, niche benchmark) are in active development. Free will always be free.', 'quoted' ); ?></p>
			<p class="submit">
				<a href="#" class="button button-primary button-hero" id="quoted-skip-license"><?php esc_html_e( "Let's go →", 'quoted' ); ?></a>
			</p>
		<?php endif; ?>
	</section>

	<!-- Step 2: Auto-scan (refresh llms.txt cache) -->
	<section class="quoted-step quoted-step-2" style="display:none;">
		<h2><?php esc_html_e( 'Step 2 — Generate your AI sitemap', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( "We'll build your llms.txt right now from your published posts. Takes about a second.", 'quoted' ); ?></p>

		<div class="quoted-scan-box">
			<button type="button" class="button button-primary button-hero" id="quoted-scan-btn">
				<?php esc_html_e( 'Generate now', 'quoted' ); ?>
			</button>
			<div class="quoted-scan-result" id="quoted-scan-result" style="display:none;"></div>
		</div>
	</section>

	<!-- Step 3: Live AI Test preview (Pro stub) -->
	<section class="quoted-step quoted-step-3" style="display:none;">
		<h2><?php esc_html_e( 'Step 3 — Preview what comes next', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( "Once your site has been crawled, Pro will let you ask an AI a question about your content and see whether it cites you.", 'quoted' ); ?></p>

		<div class="quoted-test-box">
			<button type="button" class="button button-primary button-hero" id="quoted-test-btn">
				<?php esc_html_e( 'Continue', 'quoted' ); ?>
			</button>

			<div class="quoted-test-result" id="quoted-test-result" style="display:none;">
				<div class="quoted-test-placeholder">
					<p><strong><?php esc_html_e( 'Live AI Test arrives with Pro.', 'quoted' ); ?></strong></p>
					<p><?php esc_html_e( 'For now, ClaudeBot and GPTBot will start finding your llms.txt file within 24 hours. Your dashboard will show every visit.', 'quoted' ); ?></p>
				</div>
			</div>
		</div>
	</section>

	<!-- Step 4: Done -->
	<section class="quoted-step quoted-step-4" style="display:none;">
		<h2>🎉 <?php esc_html_e( "You're all set", 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( 'Quoted is now monitoring your site. Check your dashboard daily to see AI bot visits.', 'quoted' ); ?></p>

		<div class="quoted-done-box">
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted' ) ); ?>" class="button button-primary button-hero">
				<?php esc_html_e( 'Go to dashboard', 'quoted' ); ?>
			</a>
		</div>

		<div class="quoted-next-tips">
			<h3><?php esc_html_e( "What's next:", 'quoted' ); ?></h3>
			<ul>
				<li><?php
					$llms_url = esc_url( home_url( '/llms.txt' ) );
					printf(
						/* translators: %s: llms.txt URL */
						wp_kses_post( __( 'Your AI sitemap is live at <a href="%1$s" target="_blank">%1$s</a>', 'quoted' ) ),
						$llms_url
					);
				?></li>
				<li><?php esc_html_e( 'AI bots will start crawling within 24 hours', 'quoted' ); ?></li>
				<li><?php esc_html_e( 'Check the dashboard once a week to see which AI bots find you', 'quoted' ); ?></li>
			</ul>
		</div>
	</section>

</div>
