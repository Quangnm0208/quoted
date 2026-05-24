<?php
/**
 * llms.txt — Settings / Preview / Excluded URLs tabs per Quoted brand spec.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$enabled       = (bool) get_option( 'quoted_llmstxt_enabled', true );
$inc_posts     = (bool) get_option( 'quoted_llmstxt_include_posts', true );
$inc_pages     = (bool) get_option( 'quoted_llmstxt_include_pages', true );
$inc_products  = (bool) get_option( 'quoted_llmstxt_include_products', false );
$summary       = (string) get_option( 'quoted_llmstxt_summary', '' );
$excluded      = (array) get_option( 'quoted_llmstxt_excluded', array() );
$post_count    = (int) wp_count_posts( 'post' )->publish;
$page_count    = (int) wp_count_posts( 'page' )->publish;
$cap           = Quoted_Llms_Txt::effective_cap();
$included_now  = $cap > 0 ? min( $post_count, $cap ) : $post_count;
$pct           = ( $cap > 0 && $post_count > 0 ) ? min( 100, round( ( $included_now / $post_count ) * 100 ) ) : 100;
$has_woo       = post_type_exists( 'product' );

// Pre-compute preview content (uses current saved options).
$preview_text  = ( new Quoted_Llms_Txt() )->get_content();
?>
<div class="wrap quoted-page quoted-llmstxt">
	<?php Quoted_Admin::render_subnav( 'quoted-llmstxt' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'llms.txt', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( 'A clean guide that helps AI tools understand the important parts of your website.', 'quoted' ); ?></p>
				</div>
				<div class="q-page-header__actions">
					<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=quoted-llmstxt&q_regen=1' ), 'quoted_regen' ) ); ?>" class="q-btn q-btn--secondary">
						<?php Quoted_Admin::icon( 'refresh', 14 ); ?> <?php esc_html_e( 'Regenerate', 'quoted' ); ?>
					</a>
					<a href="<?php echo esc_url( home_url( '/llms.txt' ) ); ?>" target="_blank" rel="noopener noreferrer" class="q-btn q-btn--primary">
						<?php Quoted_Admin::icon( 'external', 14 ); ?> <?php esc_html_e( 'Open /llms.txt', 'quoted' ); ?>
					</a>
				</div>
			</div>

			<?php
			if ( isset( $_GET['q_regen'] ) && check_admin_referer( 'quoted_regen' ) ) {
				Quoted_Llms_Txt::flush_cache();
				echo '<div class="q-alert q-alert--success"><div class="q-alert__body">' .
					esc_html__( 'llms.txt cache flushed. The next request will rebuild it.', 'quoted' ) .
					'</div></div>';
			}
			settings_errors( 'quoted' );
			?>

			<!-- Tabs -->
			<div class="q-mb-3">
				<div class="q-seg" role="tablist">
					<button type="button" class="q-seg__btn q-tab-trigger is-active" data-target="llms-settings" data-group="llms"><?php esc_html_e( 'Settings', 'quoted' ); ?></button>
					<button type="button" class="q-seg__btn q-tab-trigger" data-target="llms-preview" data-group="llms"><?php esc_html_e( 'Preview', 'quoted' ); ?></button>
					<button type="button" class="q-seg__btn q-tab-trigger" data-target="llms-excluded" data-group="llms"><?php esc_html_e( 'Excluded URLs', 'quoted' ); ?></button>
				</div>
			</div>

			<!-- SETTINGS panel -->
			<div class="q-tab-panel is-active" data-target="llms-settings" data-group="llms">
				<form method="post" action="">
					<?php wp_nonce_field( 'quoted_llmstxt_save' ); ?>
					<input type="hidden" name="quoted_llmstxt_submit" value="1" />

					<div class="q-grid q-grid--2">

						<div class="q-card q-card--flush">
							<div class="q-card__body">
								<div class="q-section-title">
									<h2><?php esc_html_e( 'Generation', 'quoted' ); ?></h2>
									<p class="hint"><?php esc_html_e( 'Controls whether AI tools can fetch /llms.txt from your site.', 'quoted' ); ?></p>
								</div>

								<div class="q-field">
									<div class="q-field__label">
										<span class="label"><?php esc_html_e( 'Generate llms.txt', 'quoted' ); ?></span>
										<div class="helper"><?php esc_html_e( 'When enabled, Quoted serves /llms.txt with your index of important pages.', 'quoted' ); ?></div>
									</div>
									<div class="q-field__control">
										<label class="q-toggle">
											<input type="checkbox" name="quoted_llmstxt_enabled" <?php checked( $enabled ); ?> />
											<span class="q-toggle__slider"></span>
										</label>
									</div>
								</div>

								<div class="q-field" style="flex-direction:column;align-items:stretch;">
									<div class="q-field__label">
										<span class="label"><?php esc_html_e( 'Content types', 'quoted' ); ?></span>
										<div class="helper"><?php esc_html_e( 'Which kinds of content should be included in the index.', 'quoted' ); ?></div>
									</div>
									<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
										<label class="q-check-row">
											<input type="checkbox" name="quoted_llmstxt_include_posts" <?php checked( $inc_posts ); ?> />
											<div class="q-check-row__main">
												<div class="q-check-row__title"><?php esc_html_e( 'Posts', 'quoted' ); ?></div>
												<div class="q-check-row__sub">
													<?php
													printf(
														/* translators: 1: posts count, 2: free-tier cap */
														esc_html__( '%1$d published · %2$s included on Free', 'quoted' ),
														(int) $post_count,
														$cap > 0 ? (string) $cap : esc_html__( 'all', 'quoted' )
													);
													?>
												</div>
											</div>
										</label>
										<label class="q-check-row">
											<input type="checkbox" name="quoted_llmstxt_include_pages" <?php checked( $inc_pages ); ?> />
											<div class="q-check-row__main">
												<div class="q-check-row__title"><?php esc_html_e( 'Pages', 'quoted' ); ?></div>
												<div class="q-check-row__sub">
													<?php
													printf(
														/* translators: %d: page count */
														esc_html__( '%d published', 'quoted' ),
														(int) $page_count
													);
													?>
												</div>
											</div>
										</label>
										<label class="q-check-row">
											<input type="checkbox" name="quoted_llmstxt_include_products" <?php checked( $inc_products ); ?> <?php disabled( ! $has_woo ); ?> />
											<div class="q-check-row__main">
												<div class="q-check-row__title">
													<?php esc_html_e( 'WooCommerce products', 'quoted' ); ?>
													<span class="q-badge q-badge--info"><?php esc_html_e( 'Pro', 'quoted' ); ?></span>
												</div>
												<div class="q-check-row__sub">
													<?php echo $has_woo ? esc_html__( 'Detected — toggle to include in /llms.txt.', 'quoted' ) : esc_html__( 'WooCommerce not active — install it to enable.', 'quoted' ); ?>
												</div>
											</div>
										</label>
									</div>
								</div>

								<div class="q-field">
									<div class="q-field__label">
										<span class="label"><?php esc_html_e( 'Free quota', 'quoted' ); ?></span>
										<div class="helper">
											<?php
											if ( $cap > 0 ) {
												printf(
													/* translators: 1: included, 2: total */
													esc_html__( '%1$d of %2$d posts included. Upgrade for unlimited.', 'quoted' ),
													(int) $included_now,
													(int) $post_count
												);
											} else {
												esc_html_e( 'Unlimited posts included on your plan.', 'quoted' );
											}
											?>
										</div>
									</div>
									<div class="q-field__control">
										<div class="q-quota">
											<div class="q-quota__bar"><div class="q-quota__fill" style="width:<?php echo (int) $pct; ?>%;"></div></div>
											<span class="q-quota__count"><?php echo (int) $included_now; ?> / <?php echo $cap > 0 ? (int) $post_count : '∞'; ?></span>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="q-card q-card--flush">
							<div class="q-card__body">
								<div class="q-section-title">
									<h2><?php esc_html_e( 'Site summary', 'quoted' ); ?></h2>
									<p class="hint"><?php esc_html_e( 'Appears at the top of /llms.txt — one paragraph describing your site.', 'quoted' ); ?></p>
								</div>

								<textarea name="quoted_llmstxt_summary" class="q-textarea" rows="3" maxlength="240" placeholder="<?php esc_attr_e( 'Quoted is a WordPress plugin that helps sites become AI-readable.', 'quoted' ); ?>"><?php echo esc_textarea( $summary ); ?></textarea>
								<div style="font-size:12px;color:var(--q-text-muted);margin-top:6px;">
									<span id="q-summary-count"><?php echo mb_strlen( $summary ); ?></span> / 240 <?php esc_html_e( 'characters', 'quoted' ); ?>
								</div>

								<div style="margin-top:22px;margin-bottom:10px;font-size:12px;color:var(--q-text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.04em;"><?php esc_html_e( 'Public URL', 'quoted' ); ?></div>
								<div class="q-copy">
									<span class="q-copy__value"><?php echo esc_html( home_url( '/llms.txt' ) ); ?></span>
									<button type="button" class="q-copy__btn"><?php esc_html_e( 'Copy', 'quoted' ); ?></button>
								</div>
							</div>
						</div>

					</div>

					<div class="q-mt-4">
						<button type="submit" class="q-btn q-btn--primary"><?php esc_html_e( 'Save changes', 'quoted' ); ?></button>
					</div>
				</form>
			</div>

			<!-- PREVIEW panel -->
			<div class="q-tab-panel" data-target="llms-preview" data-group="llms">
				<div class="q-preview">
					<div class="q-preview__head">
						<div class="left"><?php Quoted_Admin::icon( 'file', 13 ); ?> <?php echo esc_html( home_url( '/llms.txt' ) ); ?></div>
						<a href="<?php echo esc_url( home_url( '/llms.txt' ) ); ?>" download="llms.txt" class="q-btn q-btn--ghost q-btn--sm">
							<?php Quoted_Admin::icon( 'download', 12 ); ?> <?php esc_html_e( 'Download', 'quoted' ); ?>
						</a>
					</div>
					<pre><?php echo esc_html( $preview_text ); ?></pre>
				</div>
			</div>

			<!-- EXCLUDED panel -->
			<div class="q-tab-panel" data-target="llms-excluded" data-group="llms">
				<form method="post" action="">
					<?php wp_nonce_field( 'quoted_llmstxt_save' ); ?>
					<input type="hidden" name="quoted_llmstxt_submit" value="1" />
					<input type="hidden" name="quoted_llmstxt_enabled" value="<?php echo $enabled ? '1' : ''; ?>" />
					<input type="hidden" name="quoted_llmstxt_include_posts" value="<?php echo $inc_posts ? '1' : ''; ?>" />
					<input type="hidden" name="quoted_llmstxt_include_pages" value="<?php echo $inc_pages ? '1' : ''; ?>" />
					<input type="hidden" name="quoted_llmstxt_include_products" value="<?php echo $inc_products ? '1' : ''; ?>" />
					<input type="hidden" name="quoted_llmstxt_summary" value="<?php echo esc_attr( $summary ); ?>" />

					<div class="q-card">
						<div class="q-section-title">
							<h2><?php esc_html_e( 'Excluded URLs', 'quoted' ); ?></h2>
							<p class="hint"><?php esc_html_e( "URLs and slugs that won't appear in /llms.txt. One per line. Match by path, partial path, or post slug.", 'quoted' ); ?></p>
						</div>
						<textarea name="quoted_llmstxt_excluded" class="q-textarea q-textarea--mono" rows="8" placeholder="/blog/legacy-old-post&#10;/thank-you&#10;internal-only-draft"><?php
							echo esc_textarea( implode( "\n", array_map( 'strval', $excluded ) ) );
						?></textarea>
						<div class="q-mt-3">
							<button type="submit" class="q-btn q-btn--primary"><?php esc_html_e( 'Save excluded URLs', 'quoted' ); ?></button>
						</div>
					</div>
				</form>
			</div>

		</div>
	</div>
</div>

<script>
(function(){
	var ta = document.querySelector('textarea[name="quoted_llmstxt_summary"]');
	var count = document.getElementById('q-summary-count');
	if (ta && count) {
		ta.addEventListener('input', function(){ count.textContent = ta.value.length; });
	}
})();
</script>
