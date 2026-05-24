<?php
/**
 * Schema — Article mode + Conflict detection + FAQ toggle per Quoted brand spec.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$mode        = get_option( 'quoted_schema_mode', 'auto' );
$faq_enabled = (bool) get_option( 'quoted_schema_faq', true );
$active_seo  = Quoted_Schema::conflicting_seo_plugin();

// Build a compact list of "the big four" SEO plugins with their detection state.
$detected_map = array(
	'wordpress-seo/wp-seo.php'                        => 'Yoast SEO',
	'seo-by-rank-math/rank-math.php'                  => 'Rank Math',
	'all-in-one-seo-pack/all_in_one_seo_pack.php'     => 'All in One SEO (AIOSEO)',
	'wp-seopress/seopress.php'                        => 'SEOPress',
);
if ( ! function_exists( 'is_plugin_active' ) ) {
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
}
$detection = array();
foreach ( $detected_map as $plugin_path => $name ) {
	$detection[] = array(
		'name'   => $name,
		'active' => is_plugin_active( $plugin_path ),
	);
}

// Estimate FAQ-schema-emitting post count: cheap heuristic — count posts with
// "?" in any H2/H3 in content (good enough for the "14 posts include FAQ" UI).
$faq_count = (int) get_transient( 'quoted_faq_post_count' );
if ( $faq_count === 0 ) {
	global $wpdb;
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
	$faq_count = (int) $wpdb->get_var(
		"SELECT COUNT(*) FROM {$wpdb->posts}
		  WHERE post_status = 'publish'
		    AND post_type IN ('post','page')
		    AND ( post_content LIKE '%[faq_item%' OR post_content REGEXP '<h[23][^>]*>[^<]*\\?</h[23]>' )"
	);
	set_transient( 'quoted_faq_post_count', $faq_count, HOUR_IN_SECONDS );
}
?>
<div class="wrap quoted-page quoted-schema">
	<?php Quoted_Admin::render_subnav( 'quoted-schema' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Schema', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( 'Structured data that helps AI systems understand your content. Quoted plays nicely with other SEO plugins.', 'quoted' ); ?></p>
				</div>
			</div>

			<?php settings_errors( 'quoted' ); ?>

			<?php if ( $active_seo ) : ?>
				<div class="q-alert q-alert--success">
					<div class="q-alert__icon"><?php Quoted_Admin::icon( 'shield', 16 ); ?></div>
					<div class="q-alert__body">
						<strong class="q-alert__title"><?php esc_html_e( 'No duplicate schema risk', 'quoted' ); ?></strong>
						<?php
						printf(
							/* translators: %s: SEO plugin name */
							esc_html__( '%s detected. In Auto mode, Quoted skips Article schema to avoid duplicates. FAQ schema is active because most SEO plugins do not output FAQPage on shortcode-based content.', 'quoted' ),
							esc_html( $active_seo )
						);
						?>
					</div>
				</div>
			<?php else : ?>
				<div class="q-alert q-alert--info">
					<div class="q-alert__body">
						<strong class="q-alert__title"><?php esc_html_e( 'No conflicting SEO plugin detected', 'quoted' ); ?></strong>
						<?php esc_html_e( 'Quoted will output both Article and FAQPage schema in Auto mode.', 'quoted' ); ?>
					</div>
				</div>
			<?php endif; ?>

			<form method="post" action="">
				<?php wp_nonce_field( 'quoted_schema_save' ); ?>
				<input type="hidden" name="quoted_schema_submit" value="1" />
				<input type="hidden" name="quoted_schema_enabled" value="1" /><!-- enabled is implicit when this page is used -->

				<div class="q-grid q-grid--2">

					<!-- Article schema radio cards -->
					<div class="q-card q-card--flush">
						<div class="q-card__body">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'Article schema', 'quoted' ); ?></h2>
								<p class="hint"><?php esc_html_e( 'When should Quoted output Article schema?', 'quoted' ); ?></p>
							</div>

							<?php
							$opts = array(
								'auto'   => array( __( 'Auto', 'quoted' ),   __( 'Output Article schema only when no other SEO plugin already provides it. Recommended.', 'quoted' ) ),
								'always' => array( __( 'Always', 'quoted' ), __( "Always output Quoted's Article schema. May duplicate if another SEO plugin outputs it.", 'quoted' ) ),
								'never'  => array( __( 'Never', 'quoted' ),  __( "Don't output Article schema. Use this if you handle it elsewhere.", 'quoted' ) ),
							);
							?>
							<div style="margin-top:12px;">
								<?php foreach ( $opts as $val => $row ) : ?>
									<label class="q-radio-card <?php echo $mode === $val ? 'is-active' : ''; ?>">
										<input type="radio" name="quoted_schema_mode" value="<?php echo esc_attr( $val ); ?>" <?php checked( $mode, $val ); ?> onchange="this.closest('div').querySelectorAll('.q-radio-card').forEach(function(el){el.classList.remove('is-active');});this.closest('.q-radio-card').classList.add('is-active');" />
										<div>
											<div class="q-radio-card__title"><?php echo esc_html( $row[0] ); ?></div>
											<div class="q-radio-card__desc"><?php echo esc_html( $row[1] ); ?></div>
										</div>
									</label>
								<?php endforeach; ?>
							</div>
						</div>
					</div>

					<!-- Conflict detection + FAQ schema -->
					<div style="display:flex;flex-direction:column;gap:16px;">

						<div class="q-card">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'Conflict detection', 'quoted' ); ?></h2>
								<p class="hint"><?php esc_html_e( 'Detected SEO plugins on this WordPress install.', 'quoted' ); ?></p>
							</div>
							<div style="margin-top:8px;">
								<?php foreach ( $detection as $row ) : ?>
									<div class="q-conflict-row">
										<span class="name"><?php echo esc_html( $row['name'] ); ?></span>
										<?php if ( $row['active'] ) : ?>
											<span class="q-badge q-badge--warning"><span class="q-badge__dot"></span><?php esc_html_e( 'Article schema deferred', 'quoted' ); ?></span>
										<?php else : ?>
											<span class="q-badge q-badge--muted"><?php esc_html_e( 'Not installed', 'quoted' ); ?></span>
										<?php endif; ?>
									</div>
								<?php endforeach; ?>
							</div>
						</div>

						<div class="q-card">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'FAQ schema', 'quoted' ); ?></h2>
								<p class="hint"><?php esc_html_e( 'FAQ-formatted blocks become FAQPage schema.', 'quoted' ); ?></p>
							</div>
							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Auto-detect FAQ blocks', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'Quoted scans for FAQ blocks and outputs FAQPage schema on those posts.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<label class="q-toggle">
										<input type="checkbox" name="quoted_schema_faq" <?php checked( $faq_enabled ); ?> />
										<span class="q-toggle__slider"></span>
									</label>
								</div>
							</div>
							<div style="padding-top:8px;font-size:12.5px;color:var(--q-text-muted);">
								<strong style="color:var(--q-text);font-weight:500;"><?php echo (int) $faq_count; ?> <?php esc_html_e( 'posts', 'quoted' ); ?></strong>
								<?php esc_html_e( 'currently include FAQ schema.', 'quoted' ); ?>
							</div>
						</div>

					</div>
				</div>

				<div class="q-mt-4">
					<button type="submit" class="q-btn q-btn--primary"><?php esc_html_e( 'Save changes', 'quoted' ); ?></button>
				</div>
			</form>
		</div>
	</div>
</div>
