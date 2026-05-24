<?php
/**
 * Privacy — bot tracking + data flow + uninstall per Quoted brand spec.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$logging       = ! (bool) get_option( 'quoted_disable_logging', false );
$hash_ips      = (bool) get_option( 'quoted_hash_ips', true );
$trust_proxy   = (bool) get_option( 'quoted_trust_proxy', false );
$retention     = (int) get_option( 'quoted_retention_days', 7 );
$purge         = (bool) get_option( 'quoted_uninstall_purge', false );

global $wpdb;
$table        = $wpdb->prefix . 'quoted_bot_log';
// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
$log_rows     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
?>
<div class="wrap quoted-page quoted-privacy">
	<?php Quoted_Admin::render_subnav( 'quoted-privacy' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Privacy', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( "Quoted stores AI bot activity locally on your WordPress install. Free features don't send your data anywhere.", 'quoted' ); ?></p>
				</div>
			</div>

			<?php settings_errors( 'quoted' ); ?>

			<div class="q-alert q-alert--success">
				<div class="q-alert__icon"><?php Quoted_Admin::icon( 'shield', 16 ); ?></div>
				<div class="q-alert__body">
					<strong class="q-alert__title"><?php esc_html_e( 'Local-first by default', 'quoted' ); ?></strong>
					<?php esc_html_e( 'No data leaves your server unless you explicitly enable a future Pro feature that uses your own API keys.', 'quoted' ); ?>
				</div>
			</div>

			<form method="post" action="">
				<?php wp_nonce_field( 'quoted_privacy_save' ); ?>
				<input type="hidden" name="quoted_privacy_submit" value="1" />

				<div class="q-grid q-grid--2" style="margin-top:18px;">

					<div class="q-card q-card--flush">
						<div class="q-card__body">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'Bot activity tracking', 'quoted' ); ?></h2>
							</div>

							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Log bot visits', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'Records User-Agent, URL, and timestamp for known AI crawlers.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<label class="q-toggle">
										<input type="hidden" name="quoted_disable_logging" value="1" />
										<input type="checkbox" name="quoted_disable_logging_inverse" <?php checked( $logging ); ?> onchange="document.getElementsByName('quoted_disable_logging')[0].value = this.checked ? '' : '1';" />
										<span class="q-toggle__slider"></span>
									</label>
								</div>
							</div>

							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Hash visitor IPs', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'When on, IPs are SHA-256 hashed (with a per-site salt) before storage. When off, raw IPs are stored — you become the data controller. Recommended ON.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<label class="q-toggle">
										<input type="checkbox" name="quoted_hash_ips" <?php checked( $hash_ips ); ?> />
										<span class="q-toggle__slider"></span>
									</label>
								</div>
							</div>

							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Trust proxy headers', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'Use X-Forwarded-For when behind Cloudflare or a reverse proxy.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<label class="q-toggle">
										<input type="checkbox" name="quoted_trust_proxy" <?php checked( $trust_proxy ); ?> />
										<span class="q-toggle__slider"></span>
									</label>
								</div>
							</div>

							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Local data retention', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'How long bot activity is kept in the database.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<select name="quoted_retention_days" class="q-select" style="width:auto;">
										<option value="7"  <?php selected( $retention, 7 ); ?>><?php esc_html_e( '7 days (Free)', 'quoted' ); ?></option>
										<option value="30" <?php selected( $retention, 30 ); ?>><?php esc_html_e( '30 days (Solo)', 'quoted' ); ?></option>
										<option value="90" <?php selected( $retention, 90 ); ?>><?php esc_html_e( '90 days (Agency)', 'quoted' ); ?></option>
									</select>
								</div>
							</div>
						</div>
					</div>

					<div style="display:flex;flex-direction:column;gap:16px;">

						<div class="q-card">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'Data flow', 'quoted' ); ?></h2>
								<p class="hint"><?php esc_html_e( "Where data lives and what's kept.", 'quoted' ); ?></p>
							</div>
							<div class="q-info-block">
								<div>• <strong><?php esc_html_e( 'Bot logs:', 'quoted' ); ?></strong> <?php esc_html_e( 'stored in', 'quoted' ); ?> <code><?php echo esc_html( $table ); ?></code> (<?php printf( esc_html__( '%d rows', 'quoted' ), (int) $log_rows ); ?>)</div>
								<div>• <strong>/llms.txt:</strong> <?php esc_html_e( 'generated on-demand from your DB, 5-minute cache', 'quoted' ); ?></div>
								<div>• <strong><?php esc_html_e( 'Markdown:', 'quoted' ); ?></strong> <?php esc_html_e( 'rendered per post, 1-hour cache', 'quoted' ); ?></div>
								<div>• <strong><?php esc_html_e( 'External calls:', 'quoted' ); ?></strong> <?php esc_html_e( 'none on Free; Lemon Squeezy License API on Pro license activation/validation only', 'quoted' ); ?></div>
							</div>
						</div>

						<div class="q-card">
							<div class="q-section-title">
								<h2><?php esc_html_e( 'Uninstall', 'quoted' ); ?></h2>
								<p class="hint"><?php esc_html_e( 'What happens when you delete the plugin.', 'quoted' ); ?></p>
							</div>
							<div class="q-field">
								<div class="q-field__label">
									<span class="label"><?php esc_html_e( 'Remove all Quoted data on uninstall', 'quoted' ); ?></span>
									<div class="helper"><?php esc_html_e( 'Drops Quoted tables and options. Cannot be undone.', 'quoted' ); ?></div>
								</div>
								<div class="q-field__control">
									<label class="q-toggle">
										<input type="checkbox" name="quoted_uninstall_purge" <?php checked( $purge ); ?> />
										<span class="q-toggle__slider"></span>
									</label>
								</div>
							</div>
						</div>

					</div>
				</div>

				<div class="q-mt-4 q-flex q-gap-2">
					<button type="submit" class="q-btn q-btn--primary"><?php esc_html_e( 'Save changes', 'quoted' ); ?></button>
				</div>
			</form>

			<form method="post" action="" style="margin-top:8px;" onsubmit="return confirm('<?php echo esc_js( __( 'This will delete every row in your local bot log. Continue?', 'quoted' ) ); ?>');">
				<?php wp_nonce_field( 'quoted_privacy_clear' ); ?>
				<button type="submit" name="quoted_privacy_clear_log" class="q-btn q-btn--danger q-btn--sm">
					<?php Quoted_Admin::icon( 'x', 12 ); ?> <?php esc_html_e( 'Clear bot log now', 'quoted' ); ?>
				</button>
			</form>
		</div>
	</div>
</div>
