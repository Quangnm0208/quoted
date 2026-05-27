<?php
/**
 * Settings page.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$hash_ips        = (bool) get_option( 'quotedeasy_ai_readiness_hash_ips', true );
$show_badge      = (bool) get_option( 'quotedeasy_ai_readiness_show_badge', false );
$disable_logging = (bool) get_option( 'quotedeasy_ai_readiness_disable_logging', false );
$trust_proxy     = (bool) get_option( 'quotedeasy_ai_readiness_trust_proxy', false );

$bot_allowlist = get_option( 'quotedeasy_ai_readiness_bot_allowlist', array() );
if ( ! is_array( $bot_allowlist ) ) {
	$bot_allowlist = array();
}
$bot_meta = QuotedEasy_AI_Readiness_Bot_Detector::bot_metadata();

$schema_enabled  = (bool) get_option( 'quotedeasy_ai_readiness_schema_enabled', true );
$schema_mode     = get_option( 'quotedeasy_ai_readiness_schema_mode', 'auto' );
$conflicting_seo = QuotedEasy_AI_Readiness_Schema::conflicting_seo_plugin();

settings_errors( 'quotedeasy-ai-readiness' );
?>
<div class="wrap quotedeasy-ai-readiness-settings">

	<h1><?php esc_html_e( 'QuotedEasy AI Readiness Settings', 'quotedeasy-ai-readiness' ); ?></h1>

	<form method="post" action="">
		<?php wp_nonce_field( 'quotedeasy_ai_readiness_settings_save' ); ?>
		<input type="hidden" name="quotedeasy_ai_readiness_settings_submit" value="1" />

		<h2><?php esc_html_e( 'Privacy', 'quotedeasy-ai-readiness' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Hash IPs', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quotedeasy_ai_readiness_hash_ips" value="1" <?php checked( $hash_ips ); ?> />
						<?php esc_html_e( 'Hash visitor IPs (SHA-256) before storing in the bot log', 'quotedeasy-ai-readiness' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Recommended ON. With this on, raw IPs are never written to the database.', 'quotedeasy-ai-readiness' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Disable bot logging', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quotedeasy_ai_readiness_disable_logging" value="1" <?php checked( $disable_logging ); ?> />
						<?php esc_html_e( 'Stop logging bot visits entirely (kills dashboard data)', 'quotedeasy-ai-readiness' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Use this if you need a hard kill switch. You can re-enable any time.', 'quotedeasy-ai-readiness' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Trust proxy headers', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quotedeasy_ai_readiness_trust_proxy" value="1" <?php checked( $trust_proxy ); ?> />
						<?php esc_html_e( 'Read client IP from CF-Connecting-IP / X-Forwarded-For (only enable if your site is behind Cloudflare or another trusted reverse proxy).', 'quotedeasy-ai-readiness' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'On a non-proxied install these headers are attacker-controlled. Leaving this off uses REMOTE_ADDR.', 'quotedeasy-ai-readiness' ); ?></p>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'AI crawler allowlist', 'quotedeasy-ai-readiness' ); ?></h2>
		<p class="description" style="margin-bottom:1em">
			<?php esc_html_e( 'Decide which AI bots are allowed to use your content. Allowed = bot gets the full page. Blocked = bot gets HTTP 403 and a Disallow rule in /robots.txt.', 'quotedeasy-ai-readiness' ); ?>
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
							<input type="radio" name="quotedeasy_ai_readiness_bot_allowlist[<?php echo esc_attr( $bot_id ); ?>]" value="allow" <?php checked( $state, 'allow' ); ?> />
							<?php esc_html_e( 'Allow', 'quotedeasy-ai-readiness' ); ?>
						</label>
						<label>
							<input type="radio" name="quotedeasy_ai_readiness_bot_allowlist[<?php echo esc_attr( $bot_id ); ?>]" value="block" <?php checked( $state, 'block' ); ?> />
							<span style="color:#d63638"><?php esc_html_e( 'Block', 'quotedeasy-ai-readiness' ); ?></span>
						</label>
					</td>
				</tr>
			<?php endforeach; ?>
		</table>

		<h2><?php esc_html_e( 'Schema markup', 'quotedeasy-ai-readiness' ); ?></h2>
		<p class="description" style="margin-bottom:1em">
			<?php esc_html_e( 'Outputs Article and FAQPage JSON-LD on single posts and pages.', 'quotedeasy-ai-readiness' ); ?>
		</p>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Enable schema output', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quotedeasy_ai_readiness_schema_enabled" value="1" <?php checked( $schema_enabled ); ?> />
						<?php esc_html_e( 'Output Article + FAQPage JSON-LD on single posts and pages', 'quotedeasy-ai-readiness' ); ?>
					</label>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Mode', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<fieldset>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="quotedeasy_ai_readiness_schema_mode" value="auto" <?php checked( $schema_mode, 'auto' ); ?> />
							<strong><?php esc_html_e( 'Auto (recommended)', 'quotedeasy-ai-readiness' ); ?></strong>
							<?php if ( $conflicting_seo ) : ?>
								<br><small style="color:#996600">
									<?php
									/* translators: %s: name of the active SEO plugin */
									printf( esc_html__( 'Detected %s - Article schema will be skipped to avoid duplicates. FAQ schema still emitted.', 'quotedeasy-ai-readiness' ), '<strong>' . esc_html( $conflicting_seo ) . '</strong>' );
									?>
								</small>
							<?php else : ?>
								<br><small><?php esc_html_e( 'No conflicting SEO plugin detected - both Article and FAQ schemas will be output.', 'quotedeasy-ai-readiness' ); ?></small>
							<?php endif; ?>
						</label>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="quotedeasy_ai_readiness_schema_mode" value="always" <?php checked( $schema_mode, 'always' ); ?> />
							<strong><?php esc_html_e( 'Always', 'quotedeasy-ai-readiness' ); ?></strong>
							<br><small><?php esc_html_e( 'Output schema even if Yoast / Rank Math / SEOPress are active. May produce duplicate JSON-LD.', 'quotedeasy-ai-readiness' ); ?></small>
						</label>
						<label style="display:block">
							<input type="radio" name="quotedeasy_ai_readiness_schema_mode" value="never" <?php checked( $schema_mode, 'never' ); ?> />
							<strong><?php esc_html_e( 'Never', 'quotedeasy-ai-readiness' ); ?></strong>
							<br><small><?php esc_html_e( 'Suppress Article schema entirely. FAQ schema is still emitted from [faq_item] shortcodes and question-shaped headings.', 'quotedeasy-ai-readiness' ); ?></small>
						</label>
					</fieldset>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Display', 'quotedeasy-ai-readiness' ); ?></h2>
		<table class="form-table">
			<tr>
				<th scope="row"><?php esc_html_e( 'Credit in footer', 'quotedeasy-ai-readiness' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="quotedeasy_ai_readiness_show_badge" value="1" <?php checked( $show_badge ); ?> />
						<?php esc_html_e( 'Show "AI-ready via QuotedEasy" link in site footer', 'quotedeasy-ai-readiness' ); ?>
					</label>
					<p class="description">
						<?php esc_html_e( 'Off by default. Optional, only displayed when you turn it on.', 'quotedeasy-ai-readiness' ); ?>
					</p>
				</td>
			</tr>
		</table>

		<?php submit_button(); ?>
	</form>

</div>
