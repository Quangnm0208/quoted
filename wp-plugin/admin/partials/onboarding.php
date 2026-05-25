<?php
/**
 * Onboarding wizard — 3-step Free welcome.
 *
 * Step 1: Welcome / Free intro
 * Step 2: Generate llms.txt (refresh local cache + show post count)
 * Step 3: Done — link to dashboard + show /llms.txt URL
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
			<li class="step-2"><?php esc_html_e( 'Generate', 'quoted' ); ?></li>
			<li class="step-3"><?php esc_html_e( 'Done', 'quoted' ); ?></li>
		</ol>
	</div>

	<!-- Step 1: Welcome -->
	<section class="quoted-step quoted-step-1 active">
		<h2><?php esc_html_e( 'Welcome', 'quoted' ); ?></h2>
		<p class="description">
			<?php esc_html_e( "Your site is about to become AI-readable. Quoted ships everything you need: llms.txt at /llms.txt, clean Markdown endpoints, AI bot detection, allowlist, and schema markup. Nothing leaves your server.", 'quoted' ); ?>
		</p>
		<p class="submit">
			<a href="#" class="button button-primary button-hero" id="quoted-start-btn"><?php esc_html_e( "Let's go →", 'quoted' ); ?></a>
		</p>
	</section>

	<!-- Step 2: Generate llms.txt -->
	<section class="quoted-step quoted-step-2" style="display:none;">
		<h2><?php esc_html_e( 'Generate your AI sitemap', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( "We'll build your llms.txt right now from your published posts. Takes about a second.", 'quoted' ); ?></p>

		<div class="quoted-scan-box">
			<button type="button" class="button button-primary button-hero" id="quoted-scan-btn">
				<?php esc_html_e( 'Generate now', 'quoted' ); ?>
			</button>
			<div class="quoted-scan-result" id="quoted-scan-result" style="display:none;"></div>
		</div>
	</section>

	<!-- Step 3: Done -->
	<section class="quoted-step quoted-step-3" style="display:none;">
		<h2><?php esc_html_e( "You're all set", 'quoted' ); ?></h2>
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
						wp_kses_post( __( 'Your AI sitemap is live at <a href="%1$s" target="_blank" rel="noopener">%1$s</a>', 'quoted' ) ),
						$llms_url
					);
				?></li>
				<li><?php esc_html_e( 'AI bots will start crawling within 24 hours', 'quoted' ); ?></li>
				<li><?php esc_html_e( 'Check the dashboard once a week to see which AI bots find you', 'quoted' ); ?></li>
			</ul>
		</div>
	</section>

</div>
