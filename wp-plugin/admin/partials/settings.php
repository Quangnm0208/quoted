<?php
/**
 * Settings view.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$backend_url     = get_option( 'quoted_backend_url', '' );
$hash_ips        = (bool) get_option( 'quoted_hash_ips', true );
$show_badge      = (bool) get_option( 'quoted_show_badge', true );
$disable_logging = (bool) get_option( 'quoted_disable_logging', false );
$trust_proxy     = (bool) get_option( 'quoted_trust_proxy', false );
$tenant_id       = get_option( 'quoted_tenant_id', '' );
$plan            = get_option( 'quoted_plan', 'free' );
$niche           = get_option( 'quoted_niche', '' );

settings_errors( 'quoted' );
?>
<div class="wrap quoted-settings">

	<h1><?php esc_html_e( 'Quoted Settings', 'quoted' ); ?></h1>

	<form method="post" action="">
		<?php wp_nonce_field( 'quoted_settings_save' ); ?>
		<input type="hidden" name="quoted_settings_submit" value="1" />

		<h2><?php esc_html_e( 'Connection', 'quoted' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row">
					<label for="quoted_backend_url"><?php esc_html_e( 'Backend URL', 'quoted' ); ?></label>
				</th>
				<td>
					<input
						type="url"
						id="quoted_backend_url"
						name="quoted_backend_url"
						class="regular-text"
						value="<?php echo esc_attr( $backend_url ); ?>"
					/>
					<p class="description"><?php esc_html_e( 'Default: https://api.quoted.io', 'quoted' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Tenant ID', 'quoted' ); ?></th>
				<td><code><?php echo esc_html( $tenant_id ?: __( '(not connected)', 'quoted' ) ); ?></code></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Plan', 'quoted' ); ?></th>
				<td><strong><?php echo esc_html( strtoupper( $plan ) ); ?></strong></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Niche', 'quoted' ); ?></th>
				<td><?php echo esc_html( $niche ?: __( '(not set)', 'quoted' ) ); ?></td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Privacy', 'quoted' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Hash IPs', 'quoted' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quoted_hash_ips" value="1" <?php checked( $hash_ips ); ?> />
						<?php esc_html_e( 'Hash visitor IPs (SHA-256) before sending to Quoted backend', 'quoted' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Recommended ON. Raw IPs never leave your server.', 'quoted' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Disable bot logging', 'quoted' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quoted_disable_logging" value="1" <?php checked( $disable_logging ); ?> />
						<?php esc_html_e( 'Stop logging bot visits entirely (kills dashboard data)', 'quoted' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Use this if you need a hard kill switch. You can re-enable any time.', 'quoted' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Trust proxy headers', 'quoted' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quoted_trust_proxy" value="1" <?php checked( $trust_proxy ); ?> />
						<?php esc_html_e( 'Read client IP from CF-Connecting-IP / X-Forwarded-For (only enable if your site is behind Cloudflare or another trusted reverse proxy).', 'quoted' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'On a non-proxied install these headers are attacker-controlled. Leaving this off uses REMOTE_ADDR.', 'quoted' ); ?></p>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Display', 'quoted' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Powered-by badge', 'quoted' ); ?></th>
				<td>
					<label>
						<input
							type="checkbox"
							name="quoted_show_badge"
							value="1"
							<?php checked( $show_badge ); ?>
							<?php disabled( $plan === 'free' ); ?>
						/>
						<?php esc_html_e( 'Show "Powered by Quoted" badge in site footer', 'quoted' ); ?>
					</label>
					<?php if ( $plan === 'free' ) : ?>
						<p class="description">
							<?php esc_html_e( 'Free plan: badge is required. Upgrade to Pro to remove.', 'quoted' ); ?>
						</p>
					<?php endif; ?>
				</td>
			</tr>
		</table>

		<?php submit_button(); ?>
	</form>

	<hr/>

	<h2><?php esc_html_e( 'Danger zone', 'quoted' ); ?></h2>
	<p>
		<button type="button" class="button button-secondary button-link-delete" id="quoted-disconnect-btn">
			<?php esc_html_e( 'Disconnect from Quoted', 'quoted' ); ?>
		</button>
		<span class="description">
			<?php esc_html_e( 'Removes your JWT and license info from this site. Data on the backend is preserved.', 'quoted' ); ?>
		</span>
	</p>

</div>
