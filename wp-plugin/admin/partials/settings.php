<?php
/**
 * Settings page — License activation, Pro feature API keys, Privacy, Display.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$plan                = Quoted_License::current_plan();
$is_paid             = ( $plan !== 'free' );
$license_key         = get_option( 'quoted_license_key', '' );
$license_status      = get_option( 'quoted_license_status', '' );
$license_expires_at  = (int) get_option( 'quoted_license_expires_at', 0 );
$license_validated_at = (int) get_option( 'quoted_license_validated_at', 0 );
$variant_name        = get_option( 'quoted_variant_name', '' );
$customer_email      = get_option( 'quoted_customer_email', '' );

$hash_ips            = (bool) get_option( 'quoted_hash_ips', true );
$show_badge          = (bool) get_option( 'quoted_show_badge', true );
$disable_logging     = (bool) get_option( 'quoted_disable_logging', false );
$trust_proxy         = (bool) get_option( 'quoted_trust_proxy', false );

$perplexity_api_key  = get_option( 'quoted_perplexity_api_key', '' );
$tavily_api_key      = get_option( 'quoted_tavily_api_key', '' );
$bot_allowlist       = get_option( 'quoted_bot_allowlist', array() );
if ( ! is_array( $bot_allowlist ) ) { $bot_allowlist = array(); }
$bot_meta            = Quoted_Bot_Detector::bot_metadata();

$schema_enabled      = (bool) get_option( 'quoted_schema_enabled', true );
$schema_mode         = get_option( 'quoted_schema_mode', 'auto' );
$conflicting_seo     = Quoted_Schema::conflicting_seo_plugin();

$pro_available       = Quoted_Billing::is_configured();

settings_errors( 'quoted' );
?>
<div class="wrap quoted-settings">

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
				<h1><?php esc_html_e( 'Quoted Settings', 'quoted' ); ?></h1>
				<p class="subtitle"><?php esc_html_e( 'License, AI crawler controls, schema engine, and privacy.', 'quoted' ); ?></p>
			</div>
		</div>
	</div>

	<?php if ( $pro_available ) : ?>
	<!-- ────────────── License section (separate form for activate/deactivate) ────────────── -->
	<h2><?php esc_html_e( 'License', 'quoted' ); ?></h2>

	<form method="post" action="">
		<?php wp_nonce_field( 'quoted_license_action' ); ?>

		<table class="form-table">
			<tr>
				<th scope="row">
					<label for="quoted_license_key"><?php esc_html_e( 'License key', 'quoted' ); ?></label>
				</th>
				<td>
					<input
						type="text"
						id="quoted_license_key"
						name="quoted_license_key"
						class="regular-text"
						placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
						value="<?php echo esc_attr( $license_key ); ?>"
						<?php echo $is_paid ? 'readonly' : ''; ?>
					/>
					<p class="description">
						<?php
						if ( $is_paid ) {
							esc_html_e( 'Currently active. Use "Deactivate" to free this seat and unbind the key from this site.', 'quoted' );
						} else {
							printf(
								/* translators: %s: Upgrade page URL */
								esc_html__( 'Paste the UUID we emailed you after purchase. No license yet? %s', 'quoted' ),
								'<a href="' . esc_url( admin_url( 'admin.php?page=quoted-billing' ) ) . '">' . esc_html__( 'See pricing →', 'quoted' ) . '</a>'
							);
						}
						?>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Status', 'quoted' ); ?></th>
				<td>
					<?php if ( $is_paid && $license_status === 'active' ) : ?>
						<span style="color:#00a32a;font-weight:600">✓ <?php esc_html_e( 'Active', 'quoted' ); ?></span>
						<?php if ( $variant_name ) : ?>
							— <?php echo esc_html( $variant_name ); ?>
						<?php endif; ?>
						<?php if ( $license_expires_at ) : ?>
							<br><small><?php
							printf(
								/* translators: %s: human-readable date */
								esc_html__( 'Renews / expires %s', 'quoted' ),
								esc_html( date_i18n( get_option( 'date_format' ), $license_expires_at ) )
							);
							?></small>
						<?php endif; ?>
						<?php if ( $customer_email ) : ?>
							<br><small><?php esc_html_e( 'Billed to:', 'quoted' ); ?> <code><?php echo esc_html( $customer_email ); ?></code></small>
						<?php endif; ?>
					<?php elseif ( $license_status === 'expired' ) : ?>
						<span style="color:#d63638;font-weight:600">✗ <?php esc_html_e( 'Expired', 'quoted' ); ?></span>
					<?php elseif ( $license_status === 'disabled' ) : ?>
						<span style="color:#d63638;font-weight:600">✗ <?php esc_html_e( 'Disabled', 'quoted' ); ?></span>
					<?php else : ?>
						<span style="color:#8c8f94"><?php esc_html_e( 'Free plan', 'quoted' ); ?></span>
					<?php endif; ?>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Plan', 'quoted' ); ?></th>
				<td>
					<strong><?php echo esc_html( strtoupper( str_replace( '_', ' ', $plan ) ) ); ?></strong>
					<?php if ( ! $is_paid ) : ?>
						— <a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-billing' ) ); ?>"><?php esc_html_e( 'See plans →', 'quoted' ); ?></a>
					<?php endif; ?>
				</td>
			</tr>
		</table>

		<p>
			<?php if ( $is_paid ) : ?>
				<button type="submit" name="quoted_license_deactivate" class="button button-secondary"
				        onclick="return confirm('<?php echo esc_js( __( 'Deactivate this license? You can re-activate any time using the same key.', 'quoted' ) ); ?>');">
					<?php esc_html_e( 'Deactivate license', 'quoted' ); ?>
				</button>
			<?php else : ?>
				<button type="submit" name="quoted_license_activate" class="button button-primary">
					<?php esc_html_e( 'Activate license', 'quoted' ); ?>
				</button>
			<?php endif; ?>
		</p>
	</form>

	<hr/>
	<?php endif; // pro_available — closes the License section ?>

	<!-- ────────────── Main settings form ────────────── -->
	<form method="post" action="">
		<?php wp_nonce_field( 'quoted_settings_save' ); ?>
		<input type="hidden" name="quoted_settings_submit" value="1" />

		<?php if ( $pro_available ) : ?>
		<!-- AI provider API keys (Pro features) — only shown once LS is configured. -->
		<h2><?php esc_html_e( 'Pro feature API keys', 'quoted' ); ?></h2>
		<p class="description" style="margin-bottom:1em">
			<?php esc_html_e( 'Citation tracking and Live AI Test call third-party APIs. Bring your own keys — Quoted never proxies your queries through a backend, and your spend stays on your own provider account.', 'quoted' ); ?>
		</p>
		<table class="form-table">
			<tr>
				<th scope="row">
					<label for="quoted_perplexity_api_key"><?php esc_html_e( 'Perplexity API key', 'quoted' ); ?></label>
				</th>
				<td>
					<input
						type="password"
						id="quoted_perplexity_api_key"
						name="quoted_perplexity_api_key"
						class="regular-text"
						value="<?php echo esc_attr( $perplexity_api_key ); ?>"
						placeholder="pplx-..."
						autocomplete="off"
						<?php disabled( ! $is_paid ); ?>
					/>
					<p class="description">
						<?php if ( $is_paid ) : ?>
							<?php
							printf(
								/* translators: %s: Perplexity dashboard URL */
								esc_html__( 'Get one at %s. Stored locally, never sent to Quoted.', 'quoted' ),
								'<a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener">perplexity.ai/settings/api ↗</a>'
							);
							?>
						<?php else : ?>
							🔒 <?php esc_html_e( 'Requires Solo or Pro+ license.', 'quoted' ); ?>
						<?php endif; ?>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row">
					<label for="quoted_tavily_api_key"><?php esc_html_e( 'Tavily API key', 'quoted' ); ?></label>
				</th>
				<td>
					<input
						type="password"
						id="quoted_tavily_api_key"
						name="quoted_tavily_api_key"
						class="regular-text"
						value="<?php echo esc_attr( $tavily_api_key ); ?>"
						placeholder="tvly-..."
						autocomplete="off"
						<?php disabled( ! $is_paid ); ?>
					/>
					<p class="description">
						<?php if ( $is_paid ) : ?>
							<?php esc_html_e( 'Optional alternative search-grounded LLM. Use either Perplexity or Tavily.', 'quoted' ); ?>
						<?php else : ?>
							🔒 <?php esc_html_e( 'Requires Solo or Pro+ license.', 'quoted' ); ?>
						<?php endif; ?>
					</p>
				</td>
			</tr>
		</table>
		<?php endif; // pro_available — closes the Pro API keys section ?>

		<h2><?php esc_html_e( 'Privacy', 'quoted' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Hash IPs', 'quoted' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quoted_hash_ips" value="1" <?php checked( $hash_ips ); ?> />
						<?php esc_html_e( 'Hash visitor IPs (SHA-256) before storing in the bot log', 'quoted' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Recommended ON. With this on, raw IPs are never written to the database.', 'quoted' ); ?></p>
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

		<h2><?php esc_html_e( 'AI crawler allowlist', 'quoted' ); ?></h2>
		<p class="description" style="margin-bottom:1em">
			<?php esc_html_e( 'Decide which AI bots are allowed to use your content. Allowed = bot gets the full page. Blocked = bot gets HTTP 403 and a Disallow rule in /robots.txt. Bots that respect robots.txt will stop crawling on their own; the 403 covers the ones that don\'t.', 'quoted' ); ?>
		</p>
		<table class="form-table">
			<?php foreach ( $bot_meta as $bot_id => $meta ) :
				$label    = $meta[0];
				$operator = $meta[1];
				$state    = isset( $bot_allowlist[ $bot_id ] ) ? $bot_allowlist[ $bot_id ] : 'allow';
			?>
				<tr>
					<th scope="row">
						<strong><?php echo esc_html( $label ); ?></strong>
						<br><small style="color:#8c8f94;font-weight:400"><?php echo esc_html( $operator ); ?></small>
					</th>
					<td>
						<label style="margin-right:24px">
							<input type="radio" name="quoted_bot_allowlist[<?php echo esc_attr( $bot_id ); ?>]" value="allow" <?php checked( $state, 'allow' ); ?> />
							<?php esc_html_e( 'Allow', 'quoted' ); ?>
						</label>
						<label>
							<input type="radio" name="quoted_bot_allowlist[<?php echo esc_attr( $bot_id ); ?>]" value="block" <?php checked( $state, 'block' ); ?> />
							<span style="color:#d63638"><?php esc_html_e( 'Block', 'quoted' ); ?></span>
						</label>
					</td>
				</tr>
			<?php endforeach; ?>
		</table>

		<h2><?php esc_html_e( 'Schema markup', 'quoted' ); ?></h2>
		<p class="description" style="margin-bottom:1em">
			<?php esc_html_e( 'Quoted ships Article and FAQPage JSON-LD on single posts and pages. AI engines use schema to identify what each page is and which sections are quote-worthy.', 'quoted' ); ?>
		</p>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Enable schema output', 'quoted' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quoted_schema_enabled" value="1" <?php checked( $schema_enabled ); ?> />
						<?php esc_html_e( 'Output Article + FAQPage JSON-LD on single posts and pages', 'quoted' ); ?>
					</label>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Mode', 'quoted' ); ?></th>
				<td>
					<fieldset>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="quoted_schema_mode" value="auto" <?php checked( $schema_mode, 'auto' ); ?> />
							<strong><?php esc_html_e( 'Auto (recommended)', 'quoted' ); ?></strong>
							<?php if ( $conflicting_seo ) : ?>
								<br><small style="color:#996600">⚠
									<?php
									/* translators: %s: name of the active SEO plugin */
									printf( esc_html__( 'Detected %s — Article schema will be skipped to avoid duplicates. FAQ schema still emitted.', 'quoted' ), '<strong>' . esc_html( $conflicting_seo ) . '</strong>' );
									?>
								</small>
							<?php else : ?>
								<br><small><?php esc_html_e( 'No conflicting SEO plugin detected — both Article and FAQ schemas will be output.', 'quoted' ); ?></small>
							<?php endif; ?>
						</label>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="quoted_schema_mode" value="always" <?php checked( $schema_mode, 'always' ); ?> />
							<strong><?php esc_html_e( 'Always', 'quoted' ); ?></strong>
							<br><small><?php esc_html_e( 'Output our schema even if Yoast / Rank Math / SEOPress are active. May produce duplicate JSON-LD; verify with Google Rich Results test.', 'quoted' ); ?></small>
						</label>
						<label style="display:block">
							<input type="radio" name="quoted_schema_mode" value="never" <?php checked( $schema_mode, 'never' ); ?> />
							<strong><?php esc_html_e( 'Never', 'quoted' ); ?></strong>
							<br><small><?php esc_html_e( 'Suppress Article schema entirely. FAQ schema is still emitted from [faq] shortcodes and question-shaped headings — disable the master toggle above to suppress everything.', 'quoted' ); ?></small>
						</label>
					</fieldset>
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
							<?php disabled( ! $is_paid ); ?>
						/>
						<?php esc_html_e( 'Show "Powered by Quoted" badge in site footer', 'quoted' ); ?>
					</label>
					<?php if ( ! $is_paid ) : ?>
						<p class="description">
							<?php esc_html_e( 'Free plan: badge is required. Upgrade to Solo to remove.', 'quoted' ); ?>
						</p>
					<?php endif; ?>
				</td>
			</tr>
		</table>

		<?php submit_button(); ?>
	</form>

</div>
