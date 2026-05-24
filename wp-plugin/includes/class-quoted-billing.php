<?php
/**
 * Billing module — Lemon Squeezy direct buy URLs.
 *
 * Standalone plugin. There is no backend creating dynamic checkout sessions.
 * Each tier has a static buy URL configured via QUOTED_LS_* constants in
 * quoted.php. Clicking "Upgrade" is a normal anchor redirect to LS hosted
 * checkout — no AJAX, no nonces, no server-side proxy.
 *
 * After payment, LS emails the customer their license key. The customer
 * pastes that key into Quoted → Settings → Activate license. No automated
 * post-checkout redirect; LS doesn't reliably support per-product return URLs
 * without a hosted "thank you" page that we don't have.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Billing {

	/**
	 * Public buy URL for a given tier.
	 *
	 * Returns empty string if the constant is still the placeholder, so the
	 * UI can disable the button rather than redirect to a broken URL.
	 *
	 * @param string $tier 'solo' | 'pro_plus'
	 * @return string Absolute URL or '' if not configured.
	 */
	public static function buy_url( $tier ) {
		$variant = '';
		switch ( $tier ) {
			case 'solo':
				$variant = QUOTED_LS_VARIANT_SOLO;
				break;
			case 'pro_plus':
				$variant = QUOTED_LS_VARIANT_PRO_PLUS;
				break;
		}

		if ( empty( $variant ) || strpos( $variant, 'PLACEHOLDER' ) === 0 ) {
			return '';
		}

		$store = QUOTED_LS_STORE_SLUG;
		if ( empty( $store ) || strpos( $store, 'YOUR-' ) === 0 ) {
			return '';
		}

		// Append email + site host as prefill so the customer doesn't retype.
		$query = http_build_query( array(
			'checkout[email]'                    => get_bloginfo( 'admin_email' ),
			'checkout[custom][source_site_url]'  => home_url(),
			'checkout[custom][source_site_name]' => get_bloginfo( 'name' ),
		) );

		return sprintf( 'https://%s.lemonsqueezy.com/buy/%s?%s', $store, $variant, $query );
	}

	/**
	 * URL to the LS customer portal — where the buyer manages card / cancels.
	 *
	 * LS doesn't expose a per-customer portal URL without the secret API key.
	 * We send people to the global /my-orders flow which prompts for the
	 * email on the order; that's the supported low-friction path for plugins
	 * that don't host an LS API key themselves.
	 */
	public static function customer_portal_url() {
		return QUOTED_LS_CUSTOMER_PORTAL_URL;
	}

	/**
	 * True when AT LEAST ONE tier variant is configured (Solo OR Pro+).
	 *
	 * A partially-configured install (e.g. only Solo wired in Lemon Squeezy
	 * during a soft launch) still shows the Upgrade page so customers can
	 * buy what's available. The pricing partial individually disables any
	 * tier whose buy URL is still the placeholder.
	 */
	public static function is_configured() {
		return self::buy_url( 'solo' ) !== '' || self::buy_url( 'pro_plus' ) !== '';
	}
}
