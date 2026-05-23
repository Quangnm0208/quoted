<?php
/**
 * Admin orchestrator — menu, assets, AJAX handlers.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Admin {

	public function add_menu_pages() {
		add_menu_page(
			__( 'Quoted', 'quoted' ),
			__( 'Quoted', 'quoted' ),
			'manage_options',
			'quoted',
			array( $this, 'render_dashboard_or_onboarding' ),
			'dashicons-format-quote',
			81
		);

		add_submenu_page(
			'quoted',
			__( 'Dashboard', 'quoted' ),
			__( 'Dashboard', 'quoted' ),
			'manage_options',
			'quoted',
			array( $this, 'render_dashboard_or_onboarding' )
		);

		add_submenu_page(
			'quoted',
			__( 'Settings', 'quoted' ),
			__( 'Settings', 'quoted' ),
			'manage_options',
			'quoted-settings',
			array( $this, 'render_settings' )
		);
	}

	public function enqueue_assets( $hook ) {
		if ( strpos( $hook, 'quoted' ) === false ) {
			return;
		}

		wp_enqueue_style(
			'quoted-admin',
			QUOTED_PLUGIN_URL . 'admin/css/quoted-admin.css',
			array(),
			QUOTED_VERSION
		);

		// Chart.js bundled locally (no CDN dependency in admin).
		wp_enqueue_script(
			'quoted-chartjs',
			QUOTED_PLUGIN_URL . 'admin/js/chart.umd.min.js',
			array(),
			'4.4.0',
			true
		);

		wp_enqueue_script(
			'quoted-admin',
			QUOTED_PLUGIN_URL . 'admin/js/quoted-admin.js',
			array( 'jquery', 'quoted-chartjs' ),
			QUOTED_VERSION,
			true
		);

		wp_localize_script( 'quoted-admin', 'QuotedAdmin', array(
			'ajax_url'    => admin_url( 'admin-ajax.php' ),
			'nonce'       => wp_create_nonce( 'quoted_admin_nonce' ),
			'plugin_url'  => QUOTED_PLUGIN_URL,
			'site_url'    => home_url(),
			'is_connected' => ( new Quoted_License() )->is_connected(),
			'i18n'        => array(
				'connecting'   => __( 'Connecting...', 'quoted' ),
				'syncing'      => __( 'Syncing posts...', 'quoted' ),
				'error_generic' => __( 'Something went wrong. Please try again.', 'quoted' ),
				'success'      => __( 'Done!', 'quoted' ),
			),
		) );
	}

	public function maybe_redirect_to_onboarding() {
		if ( get_transient( 'quoted_activation_redirect' ) ) {
			delete_transient( 'quoted_activation_redirect' );
			if ( ! isset( $_GET['activate-multi'] ) ) {
				wp_safe_redirect( admin_url( 'admin.php?page=quoted' ) );
				exit;
			}
		}
	}

	public function render_dashboard_or_onboarding() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quoted' ) );
		}

		$license = new Quoted_License();
		$onboarded = get_option( 'quoted_onboarded', false );

		if ( ! $license->is_connected() || ! $onboarded ) {
			require_once QUOTED_PLUGIN_DIR . 'admin/partials/onboarding.php';
		} else {
			require_once QUOTED_PLUGIN_DIR . 'admin/partials/dashboard.php';
		}
	}

	public function render_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quoted' ) );
		}

		// Save settings on POST. Gate on an explicit submit marker so a stray
		// POST (e.g. from another plugin's form on the same screen) doesn't
		// trigger check_admin_referer() and the "link expired" interstitial.
		if ( isset( $_POST['quoted_settings_submit'] ) ) {
			check_admin_referer( 'quoted_settings_save' );
			$this->save_settings();
		}

		require_once QUOTED_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	private function save_settings() {
		$hash_ips = isset( $_POST['quoted_hash_ips'] ) ? 1 : 0;
		$show_badge = isset( $_POST['quoted_show_badge'] ) ? 1 : 0;
		$disable_logging = isset( $_POST['quoted_disable_logging'] ) ? 1 : 0;

		update_option( 'quoted_hash_ips', (bool) $hash_ips );
		update_option( 'quoted_show_badge', (bool) $show_badge );
		update_option( 'quoted_disable_logging', (bool) $disable_logging );

		if ( isset( $_POST['quoted_backend_url'] ) ) {
			$url = esc_url_raw( wp_unslash( $_POST['quoted_backend_url'] ) );
			update_option( 'quoted_backend_url', $url );
		}

		add_settings_error(
			'quoted',
			'quoted_saved',
			__( 'Settings saved.', 'quoted' ),
			'updated'
		);
	}

	public function plugin_action_links( $links ) {
		$custom = array(
			'<a href="' . esc_url( admin_url( 'admin.php?page=quoted' ) ) . '">' . esc_html__( 'Dashboard', 'quoted' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=quoted-settings' ) ) . '">' . esc_html__( 'Settings', 'quoted' ) . '</a>',
		);
		return array_merge( $custom, $links );
	}

	// ─── AJAX handlers ────────────────────────────────────────────────

	public function ajax_connect_backend() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
		}

		$license_key = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : '';
		$backend_url = isset( $_POST['backend_url'] ) ? esc_url_raw( wp_unslash( $_POST['backend_url'] ) ) : '';

		$license = new Quoted_License();
		$result = $license->activate( $license_key, $backend_url );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
				'details' => $result->get_error_data(),
			), 400 );
		}

		wp_send_json_success( array(
			'tenant_id' => $result['tenant_id'],
			'plan'      => $result['plan'],
			'quota'     => isset( $result['quota'] ) ? $result['quota'] : array(),
		) );
	}

	public function ajax_save_niche() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
		}

		$niche = isset( $_POST['niche'] ) ? sanitize_key( wp_unslash( $_POST['niche'] ) ) : '';

		if ( empty( $niche ) ) {
			wp_send_json_error( array( 'message' => __( 'Please select a niche.', 'quoted' ) ), 400 );
		}

		update_option( 'quoted_niche', $niche );

		wp_send_json_success( array( 'niche' => $niche ) );
	}

	public function ajax_sync_posts() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
		}

		$sync = new Quoted_Sync();
		$result = $sync->initial_sync( 20 );

		if ( ! empty( $result['errors'] ) && empty( $result['synced'] ) ) {
			wp_send_json_error( array(
				'message' => __( 'Sync failed.', 'quoted' ),
				'errors'  => $result['errors'],
			), 500 );
		}

		// Mark onboarded after first successful sync.
		update_option( 'quoted_onboarded', true );

		wp_send_json_success( array(
			'synced' => $result['synced'],
			'errors' => $result['errors'],
		) );
	}

	public function ajax_dashboard_data() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'GET', '/api/v1/dashboard/summary?days=7' );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			), 500 );
		}

		wp_send_json_success( $result );
	}

	public function ajax_disconnect() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
		}

		$license = new Quoted_License();
		$license->disconnect();

		wp_send_json_success( array( 'message' => __( 'Disconnected.', 'quoted' ) ) );
	}
}
