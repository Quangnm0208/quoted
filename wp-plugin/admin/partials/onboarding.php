<?php
/**
 * Onboarding wizard — 8-click flow.
 *
 * Click count:
 *  1. Install plugin (outside this UI)
 *  2. Activate (outside this UI)
 *  3. "Connect" button on step 1 (after license + URL entered)
 *  4. "Continue" button on step 2 (niche selected)
 *  5. "Auto-scan now" button on step 3
 *  6. "Test it live" button on step 4 (shows live AI Test stub for Phase 1)
 *  7. (passive — AI response renders)
 *  8. "Go to dashboard" button on step 5
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$niches = array(
	'outdoor-gear'              => __( 'Outdoor gear & hiking', 'quoted' ),
	'fitness-equipment'         => __( 'Fitness & gym equipment', 'quoted' ),
	'supplements'               => __( 'Supplements & nutrition', 'quoted' ),
	'cooking'                   => __( 'Cooking & recipes', 'quoted' ),
	'kitchen-gadgets'           => __( 'Kitchen gadgets', 'quoted' ),
	'travel'                    => __( 'Travel & destinations', 'quoted' ),
	'hotels'                    => __( 'Hotels & accommodation', 'quoted' ),
	'parenting'                 => __( 'Parenting', 'quoted' ),
	'baby-gear'                 => __( 'Baby gear', 'quoted' ),
	'finance-personal'          => __( 'Personal finance', 'quoted' ),
	'investing'                 => __( 'Investing', 'quoted' ),
	'crypto'                    => __( 'Crypto', 'quoted' ),
	'real-estate'               => __( 'Real estate', 'quoted' ),
	'software-saas'             => __( 'Software & SaaS reviews', 'quoted' ),
	'productivity-tools'        => __( 'Productivity tools', 'quoted' ),
	'ai-tools'                  => __( 'AI tools', 'quoted' ),
	'marketing'                 => __( 'Marketing', 'quoted' ),
	'seo'                       => __( 'SEO', 'quoted' ),
	'web-dev'                   => __( 'Web development', 'quoted' ),
	'gardening'                 => __( 'Gardening', 'quoted' ),
	'home-improvement'          => __( 'Home improvement', 'quoted' ),
	'smart-home'                => __( 'Smart home', 'quoted' ),
	'pets'                      => __( 'Pets', 'quoted' ),
	'automotive'                => __( 'Automotive', 'quoted' ),
	'ev-cars'                   => __( 'EV / electric cars', 'quoted' ),
	'photography'               => __( 'Photography', 'quoted' ),
	'gaming'                    => __( 'Gaming', 'quoted' ),
	'books-reviews'             => __( 'Book reviews', 'quoted' ),
	'education-online-courses'  => __( 'Online courses & education', 'quoted' ),
	'wellness-mental-health'    => __( 'Wellness & mental health', 'quoted' ),
	'other'                     => __( 'Other / general', 'quoted' ),
);

?>
<div class="wrap quoted-onboarding">

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
				<h1><?php esc_html_e( 'Welcome to Quoted', 'quoted' ); ?></h1>
				<p class="subtitle"><?php esc_html_e( 'Make your site AI-readable. See when ChatGPT, Claude, and Perplexity quote you.', 'quoted' ); ?></p>
			</div>
		</div>
	</div>

	<div class="quoted-progress">
		<ol>
			<li class="step-1 active"><?php esc_html_e( 'Connect', 'quoted' ); ?></li>
			<li class="step-2"><?php esc_html_e( 'Niche', 'quoted' ); ?></li>
			<li class="step-3"><?php esc_html_e( 'Scan', 'quoted' ); ?></li>
			<li class="step-4"><?php esc_html_e( 'Test', 'quoted' ); ?></li>
			<li class="step-5"><?php esc_html_e( 'Done', 'quoted' ); ?></li>
		</ol>
	</div>

	<!-- Step 1: Welcome (varies by whether Pro / LS is configured) -->
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
							<input
								type="text"
								id="quoted-license-key"
								name="license_key"
								class="regular-text"
								placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
								autocomplete="off"
								required
							/>
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

	<!-- Step 2: Niche -->
	<section class="quoted-step quoted-step-2" style="display:none;">
		<h2><?php esc_html_e( 'Step 2 — What does your site cover?', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( 'This tells Quoted which AI prompts to test you on later. Pick the closest match.', 'quoted' ); ?></p>

		<form id="quoted-niche-form">
			<table class="form-table">
				<tr>
					<th scope="row">
						<label for="quoted-niche"><?php esc_html_e( 'Site niche', 'quoted' ); ?></label>
					</th>
					<td>
						<select id="quoted-niche" name="niche" required>
							<option value=""><?php esc_html_e( '— Select —', 'quoted' ); ?></option>
							<?php foreach ( $niches as $slug => $label ) : ?>
								<option value="<?php echo esc_attr( $slug ); ?>"><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
			</table>

			<p class="submit">
				<button type="submit" class="button button-primary button-hero" id="quoted-niche-btn">
					<?php esc_html_e( 'Continue', 'quoted' ); ?>
				</button>
				<span class="quoted-status" id="quoted-niche-status"></span>
			</p>
		</form>
	</section>

	<!-- Step 3: Auto-scan -->
	<section class="quoted-step quoted-step-3" style="display:none;">
		<h2><?php esc_html_e( 'Step 3 — Auto-scan your top posts', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( "We'll scan your 20 most-recent posts and prepare them for AI bots. Takes about 30 seconds.", 'quoted' ); ?></p>

		<div class="quoted-scan-box">
			<button type="button" class="button button-primary button-hero" id="quoted-scan-btn">
				<?php esc_html_e( 'Auto-scan now', 'quoted' ); ?>
			</button>
			<div class="quoted-scan-result" id="quoted-scan-result" style="display:none;"></div>
		</div>
	</section>

	<!-- Step 4: Test it live -->
	<section class="quoted-step quoted-step-4" style="display:none;">
		<h2><?php esc_html_e( 'Step 4 — See AI read your site', 'quoted' ); ?></h2>
		<p class="description"><?php esc_html_e( "Quoted will ask an AI a question about your niche and show you the live answer.", 'quoted' ); ?></p>

		<div class="quoted-test-box">
			<button type="button" class="button button-primary button-hero" id="quoted-test-btn">
				<?php esc_html_e( 'Test it live', 'quoted' ); ?>
			</button>

			<div class="quoted-test-result" id="quoted-test-result" style="display:none;">
				<!--
					Phase 0 stub: Live AI Test ships in Phase 1.
					For Phase 0, this just shows a static "coming soon" message
					so the onboarding completes cleanly.
				-->
				<div class="quoted-test-placeholder">
					<p><strong><?php esc_html_e( 'Live AI Test will arrive in the next update.', 'quoted' ); ?></strong></p>
					<p><?php esc_html_e( 'For now, ClaudeBot and GPTBot will start finding your llms.txt file within 24 hours. Your dashboard will show every visit.', 'quoted' ); ?></p>
				</div>
			</div>
		</div>
	</section>

	<!-- Step 5: Done -->
	<section class="quoted-step quoted-step-5" style="display:none;">
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
