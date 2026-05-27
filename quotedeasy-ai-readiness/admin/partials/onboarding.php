<?php
/**
 * Onboarding wizard.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap quotedeasy-ai-readiness-onboarding">

	<div class="quotedeasy-ai-readiness-header">
		<h1><?php esc_html_e( 'Welcome to QuotedEasy AI Readiness', 'quotedeasy-ai-readiness' ); ?></h1>
		<p class="subtitle"><?php esc_html_e( 'Make your site AI-readable. See when ChatGPT, Claude, and Perplexity quote you.', 'quotedeasy-ai-readiness' ); ?></p>
	</div>

	<div class="quotedeasy-ai-readiness-progress">
		<ol>
			<li class="step-1 active"><?php esc_html_e( 'Start', 'quotedeasy-ai-readiness' ); ?></li>
			<li class="step-2"><?php esc_html_e( 'Generate', 'quotedeasy-ai-readiness' ); ?></li>
			<li class="step-3"><?php esc_html_e( 'Done', 'quotedeasy-ai-readiness' ); ?></li>
		</ol>
	</div>

	<section class="quotedeasy-ai-readiness-step quotedeasy-ai-readiness-step-1 active">
		<h2><?php esc_html_e( 'Welcome', 'quotedeasy-ai-readiness' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'Your site is about to become AI-readable. This plugin ships everything you need: llms.txt at /llms.txt, clean Markdown endpoints, AI bot detection, allowlist, and schema markup. Nothing leaves your server.', 'quotedeasy-ai-readiness' ); ?>
		</p>
		<p class="submit">
			<a href="#" class="button button-primary button-hero" id="quotedeasy-ai-readiness-start-btn"><?php esc_html_e( 'Let\'s go', 'quotedeasy-ai-readiness' ); ?></a>
		</p>
	</section>

	<section class="quotedeasy-ai-readiness-step quotedeasy-ai-readiness-step-2" style="display:none;">
		<h2><?php esc_html_e( 'Generate your AI sitemap', 'quotedeasy-ai-readiness' ); ?></h2>
		<p class="description"><?php esc_html_e( 'We will build your llms.txt right now from your published posts.', 'quotedeasy-ai-readiness' ); ?></p>

		<div class="quotedeasy-ai-readiness-scan-box">
			<button type="button" class="button button-primary button-hero" id="quotedeasy-ai-readiness-scan-btn">
				<?php esc_html_e( 'Generate now', 'quotedeasy-ai-readiness' ); ?>
			</button>
			<div class="quotedeasy-ai-readiness-scan-result" id="quotedeasy-ai-readiness-scan-result" style="display:none;"></div>
		</div>
	</section>

	<section class="quotedeasy-ai-readiness-step quotedeasy-ai-readiness-step-3" style="display:none;">
		<h2><?php esc_html_e( 'You\'re all set', 'quotedeasy-ai-readiness' ); ?></h2>
		<p class="description"><?php esc_html_e( 'The plugin is now monitoring your site. Check your dashboard to see AI bot visits.', 'quotedeasy-ai-readiness' ); ?></p>

		<div class="quotedeasy-ai-readiness-done-box">
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=quotedeasy-ai-readiness' ) ); ?>" class="button button-primary button-hero">
				<?php esc_html_e( 'Go to dashboard', 'quotedeasy-ai-readiness' ); ?>
			</a>
		</div>

		<div class="quotedeasy-ai-readiness-next-tips">
			<h3><?php esc_html_e( 'What is next:', 'quotedeasy-ai-readiness' ); ?></h3>
			<ul>
				<li><?php
					$llms_url = esc_url( home_url( '/llms.txt' ) );
					printf(
						/* translators: %s: llms.txt URL */
						wp_kses_post( __( 'Your AI sitemap is live at <a href="%1$s" target="_blank" rel="noopener">%1$s</a>', 'quotedeasy-ai-readiness' ) ),
						$llms_url
					);
				?></li>
				<li><?php esc_html_e( 'AI bots will start crawling within 24 hours', 'quotedeasy-ai-readiness' ); ?></li>
				<li><?php esc_html_e( 'Check the dashboard once a week to see which AI bots find you', 'quotedeasy-ai-readiness' ); ?></li>
			</ul>
		</div>
	</section>

</div>
