<?php
/**
 * Billing module for WP plugin.
 *
 * Handles upgrade UI and AJAX checkout creation.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Billing {

	/**
	 * AJAX handler: create checkout via backend.
	 *
	 * Frontend calls this when user clicks "Upgrade to Solo/Pro+".
	 * Returns LS checkout URL for redirect.
	 */
	public function ajax_create_checkout() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}

		$tier = isset( $_POST['tier'] ) ? sanitize_key( wp_unslash( $_POST['tier'] ) ) : '';

		$allowed_tiers = array( 'solo', 'pro_plus' );
		if ( ! in_array( $tier, $allowed_tiers, true ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid tier selected.', 'quoted' ) ), 400 );
			return;
		}

		// Plugin must already be connected to backend to upgrade.
		$license = new Quoted_License();
		if ( ! $license->is_connected() ) {
			wp_send_json_error( array(
				'message' => __( 'Please connect to Quoted first before upgrading.', 'quoted' ),
			), 412 );
			return;
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'POST', '/api/v1/billing/checkout/create', array(
			'tier'        => $tier,
			'admin_email' => get_bloginfo( 'admin_email' ),
			'site_name'   => get_bloginfo( 'name' ),
			'site_url'    => home_url(),
		) );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			), 500 );
			return;
		}

		if ( empty( $result['checkout_url'] ) ) {
			wp_send_json_error( array(
				'message' => __( 'Backend did not return a checkout URL.', 'quoted' ),
			), 500 );
			return;
		}

		wp_send_json_success( array(
			'checkout_url' => esc_url_raw( $result['checkout_url'] ),
		) );
	}

	/**
	 * AJAX handler: get current subscription info from backend.
	 */
	public function ajax_get_subscription() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'GET', '/api/v1/billing/subscription' );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			), 500 );
			return;
		}

		wp_send_json_success( $result );
	}

	/**
	 * AJAX handler: get LS customer portal URL.
	 *
	 * Opens LS portal in new tab so customer can update card, cancel sub, etc.
	 */
	public function ajax_get_customer_portal() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'GET', '/api/v1/billing/customer-portal' );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			), 500 );
			return;
		}

		wp_send_json_success( array(
			'portal_url' => esc_url_raw( $result['portal_url'] ),
		) );
	}

	/**
	 * Auto-activate license after successful checkout.
	 *
	 * After payment, Lemon Squeezy redirects to:
	 *   /wp-admin/admin.php?page=quoted&checkout=success&license_key=qtd_xxx
	 *
	 * We intercept that URL, activate the license, and redirect to a clean URL.
	 */
	public function maybe_auto_activate_after_checkout() {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! isset( $_GET['page'], $_GET['checkout'] ) ) {
			return;
		}

		if ( $_GET['page'] !== 'quoted' || $_GET['checkout'] !== 'success' ) {
			return;
		}

		// LS appends license_key after redirect
		$license_key = isset( $_GET['license_key'] )
			? sanitize_text_field( wp_unslash( $_GET['license_key'] ) )
			: '';

		if ( empty( $license_key ) ) {
			// Payment succeeded but no key in URL — webhook will handle backend side.
			// Just show success message.
			add_action( 'admin_notices', function () {
				echo '<div class="notice notice-success is-dismissible"><p>';
				echo esc_html__( 'Payment successful! Your subscription will be active in a few seconds. Refresh this page if you don\'t see the upgrade reflected.', 'quoted' );
				echo '</p></div>';
			} );
			return;
		}

		// Try to activate. Quoted backend already linked tenant+sub via webhook,
		// so this re-activation should succeed instantly.
		$license = new Quoted_License();
		$result = $license->activate( $license_key, get_option( 'quoted_backend_url', '' ) );

		if ( is_wp_error( $result ) ) {
			// Edge case: webhook may not have arrived yet. Show retry message.
			add_action( 'admin_notices', function () use ( $result ) {
				echo '<div class="notice notice-warning is-dismissible"><p>';
				echo '<strong>' . esc_html__( 'Payment received. Activation pending.', 'quoted' ) . '</strong><br>';
				echo esc_html__( 'Wait a few seconds and refresh this page. Your subscription should activate shortly.', 'quoted' );
				echo '</p><p><small>' . esc_html( $result->get_error_message() ) . '</small></p></div>';
			} );
			return;
		}

		// Success. Redirect to clean URL.
		wp_safe_redirect( admin_url( 'admin.php?page=quoted&upgrade_success=1' ) );
		exit;
	}

	/**
	 * Show success notice after redirect.
	 */
	public function maybe_show_upgrade_success_notice() {
		if ( ! isset( $_GET['upgrade_success'] ) ) {
			return;
		}

		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-success is-dismissible"><p>';
			echo '🎉 <strong>' . esc_html__( 'Welcome to Quoted Pro!', 'quoted' ) . '</strong> ';
			echo esc_html__( 'Your subscription is now active. Citation tracking will begin within 24 hours.', 'quoted' );
			echo '</p></div>';
		} );
	}
}
