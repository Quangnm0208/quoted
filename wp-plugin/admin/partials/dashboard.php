<?php
/**
 * Dashboard — 3-row card layout per Quoted brand spec.
 * Data loaded async via AJAX (quoted-admin.js).
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap quoted-page quoted-dashboard">
	<?php Quoted_Admin::render_subnav( 'quoted' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Dashboard', 'quoted' ); ?></h1>
					<p class="lede">
						<?php esc_html_e( 'A quick read on how AI crawlers are seeing your site. All data lives locally on this WordPress install.', 'quoted' ); ?>
					</p>
				</div>
				<div class="q-page-header__actions">
					<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=quoted&q_regen=1' ), 'quoted_regen' ) ); ?>"
					   class="q-btn q-btn--secondary">
						<?php Quoted_Admin::icon( 'refresh', 14 ); ?>
						<?php esc_html_e( 'Regenerate llms.txt', 'quoted' ); ?>
					</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-setup' ) ); ?>"
					   class="q-btn q-btn--primary">
						<?php esc_html_e( 'Setup wizard', 'quoted' ); ?>
					</a>
				</div>
			</div>

			<?php
			// Optional manual regenerate trigger.
			if ( isset( $_GET['q_regen'] ) && check_admin_referer( 'quoted_regen' ) ) {
				Quoted_Llms_Txt::flush_cache();
				echo '<div class="q-alert q-alert--success"><div class="q-alert__body">' .
					esc_html__( 'llms.txt cache flushed.', 'quoted' ) .
					'</div></div>';
			}
			settings_errors( 'quoted' );
			?>

			<!-- ROW 1 — Score + llms.txt status + Markdown status -->
			<div class="q-grid q-grid--score q-mb-3">

				<div class="q-score">
					<div class="q-score__top">
						<div>
							<div class="q-score__label"><?php esc_html_e( 'AI Distribution Score', 'quoted' ); ?></div>
							<div class="q-score__big">
								<div><span class="q-score__number" id="q-score-number">—</span><span class="q-score__total">/100</span></div>
								<span id="q-score-delta" class="q-badge q-badge--muted" style="display:none;">
									<span class="q-badge__dot"></span><span class="label"></span>
								</span>
							</div>
							<p class="q-score__caption">
								<?php
								echo wp_kses(
									__( 'Estimates how widely AI crawlers are discovering your site based on local bot activity. <strong>Not a ranking score.</strong>', 'quoted' ),
									array( 'strong' => array() )
								);
								?>
							</p>
						</div>
						<div class="q-score__gauge">
							<canvas id="q-score-canvas" width="110" height="110"></canvas>
						</div>
					</div>
					<div class="q-score__stats">
						<div>
							<div class="q-stat__label"><?php esc_html_e( 'Bot visits / 7d', 'quoted' ); ?></div>
							<div class="q-stat__row">
								<span class="q-stat__value" id="q-stat-visits">—</span>
								<span class="q-stat__delta" id="q-stat-visits-delta"></span>
							</div>
						</div>
						<div>
							<div class="q-stat__label"><?php esc_html_e( 'Unique crawlers', 'quoted' ); ?></div>
							<div class="q-stat__row">
								<span class="q-stat__value" id="q-stat-unique">—</span>
							</div>
						</div>
						<div>
							<div class="q-stat__label"><?php esc_html_e( 'Posts indexed', 'quoted' ); ?></div>
							<div class="q-stat__row">
								<span class="q-stat__value" id="q-stat-posts">—</span>
							</div>
						</div>
					</div>
				</div>

				<?php
				$llms_url = esc_url( home_url( '/llms.txt' ) );
				?>
				<div class="q-status">
					<div class="q-status__head">
						<div class="q-status__title">
							<?php Quoted_Admin::icon( 'file', 16 ); ?>
							<?php esc_html_e( 'llms.txt', 'quoted' ); ?>
						</div>
						<span class="q-badge q-badge--success"><span class="q-badge__dot"></span><?php esc_html_e( 'Active', 'quoted' ); ?></span>
					</div>
					<div class="q-status__meta">
						<?php
						$post_count = wp_count_posts( 'post' )->publish;
						printf(
							/* translators: %d: number of posts */
							esc_html__( 'Auto-generated from %d published posts.', 'quoted' ),
							(int) $post_count
						);
						?>
					</div>
					<a href="<?php echo $llms_url; ?>" target="_blank" rel="noopener noreferrer" class="q-status__action">
						<?php esc_html_e( 'View file', 'quoted' ); ?> <?php Quoted_Admin::icon( 'chevronRight', 12 ); ?>
					</a>
				</div>

				<div class="q-status">
					<div class="q-status__head">
						<div class="q-status__title">
							<?php Quoted_Admin::icon( 'code', 16 ); ?>
							<?php esc_html_e( 'Markdown endpoints', 'quoted' ); ?>
						</div>
						<span class="q-badge q-badge--success"><span class="q-badge__dot"></span><?php esc_html_e( 'Enabled', 'quoted' ); ?></span>
					</div>
					<div class="q-status__meta">
						<?php esc_html_e( 'Clean Markdown per post at', 'quoted' ); ?>
						<code>/wp-json/quoted/v1/llm/{slug}</code>
					</div>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-llmstxt' ) ); ?>" class="q-status__action">
						<?php esc_html_e( 'Configure', 'quoted' ); ?> <?php Quoted_Admin::icon( 'chevronRight', 12 ); ?>
					</a>
				</div>

			</div>

			<!-- ROW 2 — Schema + Crawlers + Privacy -->
			<div class="q-grid q-grid--3 q-mb-3">

				<?php
				$schema_mode = get_option( 'quoted_schema_mode', 'auto' );
				$active_seo  = Quoted_Schema::conflicting_seo_plugin();
				?>
				<div class="q-status">
					<div class="q-status__head">
						<div class="q-status__title">
							<?php Quoted_Admin::icon( 'sparkle', 16 ); ?>
							<?php esc_html_e( 'Schema', 'quoted' ); ?>
						</div>
						<span class="q-badge q-badge--info"><span class="q-badge__dot"></span>
							<?php
							printf(
								/* translators: %s: schema mode */
								esc_html__( '%s · safe', 'quoted' ),
								esc_html( ucfirst( $schema_mode ) )
							);
							?>
						</span>
					</div>
					<div class="q-status__meta">
						<?php if ( $active_seo ) : ?>
							<?php
							printf(
								/* translators: %s: SEO plugin name */
								esc_html__( '%s detected — Article schema deferred to avoid duplicates. FAQ active.', 'quoted' ),
								esc_html( $active_seo )
							);
							?>
						<?php else : ?>
							<?php esc_html_e( 'No conflicting SEO plugin detected. Article + FAQ schema active.', 'quoted' ); ?>
						<?php endif; ?>
					</div>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-schema' ) ); ?>" class="q-status__action">
						<?php esc_html_e( 'Schema settings', 'quoted' ); ?> <?php Quoted_Admin::icon( 'chevronRight', 12 ); ?>
					</a>
				</div>

				<?php
				$allowlist = get_option( 'quoted_bot_allowlist', array() );
				$all_known = array_keys( Quoted_Bot_Detector::bot_metadata() );
				$blocked   = 0;
				foreach ( $all_known as $bot ) {
					if ( isset( $allowlist[ $bot ] ) && $allowlist[ $bot ] === 'block' ) {
						$blocked++;
					}
				}
				$allowed = count( $all_known ) - $blocked;
				?>
				<div class="q-status">
					<div class="q-status__head">
						<div class="q-status__title">
							<?php Quoted_Admin::icon( 'shield', 16 ); ?>
							<?php esc_html_e( 'Crawler controls', 'quoted' ); ?>
						</div>
						<span class="q-badge q-badge--neutral"><span class="q-badge__dot"></span>
							<?php echo $blocked === 0 ? esc_html__( 'Open to AI', 'quoted' ) : esc_html__( 'Some blocked', 'quoted' ); ?>
						</span>
					</div>
					<div class="q-status__meta">
						<?php
						printf(
							/* translators: 1: allowed count, 2: blocked count */
							esc_html__( '%1$d known crawlers allowed · %2$d blocked', 'quoted' ),
							(int) $allowed,
							(int) $blocked
						);
						?>
					</div>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-crawlers' ) ); ?>" class="q-status__action">
						<?php esc_html_e( 'Manage access', 'quoted' ); ?> <?php Quoted_Admin::icon( 'chevronRight', 12 ); ?>
					</a>
				</div>

				<?php
				$hash_ips = (bool) get_option( 'quoted_hash_ips', true );
				?>
				<div class="q-status">
					<div class="q-status__head">
						<div class="q-status__title">
							<?php Quoted_Admin::icon( 'lock', 16 ); ?>
							<?php esc_html_e( 'Privacy', 'quoted' ); ?>
						</div>
						<span class="q-badge q-badge--success"><span class="q-badge__dot"></span><?php esc_html_e( 'Local-first', 'quoted' ); ?></span>
					</div>
					<div class="q-status__meta">
						<?php if ( $hash_ips ) : ?>
							<?php esc_html_e( 'IPs hashed · No data sent off-site', 'quoted' ); ?>
						<?php else : ?>
							<?php esc_html_e( 'IPs stored raw · No data sent off-site', 'quoted' ); ?>
						<?php endif; ?>
					</div>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-privacy' ) ); ?>" class="q-status__action">
						<?php esc_html_e( 'Privacy settings', 'quoted' ); ?> <?php Quoted_Admin::icon( 'chevronRight', 12 ); ?>
					</a>
				</div>

			</div>

			<!-- ROW 3 — Top bots + Recent crawls -->
			<div class="q-grid q-grid--2">

				<div class="q-card q-card--flush">
					<div class="q-card__header">
						<div>
							<div style="font-size:14px;font-weight:600;color:var(--q-text);"><?php esc_html_e( 'Top AI crawlers', 'quoted' ); ?></div>
							<div style="font-size:12px;color:var(--q-text-muted);margin-top:1px;"><?php esc_html_e( 'Last 7 days', 'quoted' ); ?></div>
						</div>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-crawlers' ) ); ?>" style="font-size:12.5px;color:var(--q-primary);text-decoration:none;font-weight:500;"><?php esc_html_e( 'See all', 'quoted' ); ?></a>
					</div>
					<div id="q-bots-list"><p class="q-loading" style="padding:18px;"><?php esc_html_e( 'Loading…', 'quoted' ); ?></p></div>
				</div>

				<div class="q-card q-card--flush">
					<div class="q-card__header">
						<div>
							<div style="font-size:14px;font-weight:600;color:var(--q-text);"><?php esc_html_e( 'Recent crawls', 'quoted' ); ?></div>
							<div style="font-size:12px;color:var(--q-text-muted);margin-top:1px;"><?php esc_html_e( 'What AI fetched, just now', 'quoted' ); ?></div>
						</div>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-crawlers' ) ); ?>" style="font-size:12.5px;color:var(--q-primary);text-decoration:none;font-weight:500;"><?php esc_html_e( 'Activity log', 'quoted' ); ?></a>
					</div>
					<div id="q-recent-list" style="padding:0 20px;"><p class="q-loading" style="padding:18px 0;"><?php esc_html_e( 'Loading…', 'quoted' ); ?></p></div>
				</div>

			</div>

			<!-- ROW 4 — Next action callout (shown only when over quota) -->
			<div id="q-next-action" class="q-callout q-mt-4" style="display:none;">
				<div class="q-callout__icon"><?php Quoted_Admin::icon( 'arrowUp', 16 ); ?></div>
				<div class="q-callout__body">
					<div class="q-callout__title"><?php esc_html_e( 'Next recommended action', 'quoted' ); ?></div>
					<div class="q-callout__desc" id="q-next-action-desc"></div>
				</div>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-billing' ) ); ?>" class="q-btn q-btn--primary"><?php esc_html_e( 'See plans', 'quoted' ); ?></a>
			</div>

		</div>
	</div>
</div>
