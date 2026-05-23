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

		add_submenu_page(
			'quoted',
			__( 'Upgrade', 'quoted' ),
			__( 'Upgrade', 'quoted' ),
			'manage_options',
			'quoted-billing',
			array( $this, 'render_billing' )
		);
	}

	public function render_billing() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quoted' ) );
		}
		require_once QUOTED_PLUGIN_DIR . 'admin/partials/billing-page.php';
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

		// Billing CSS only on the Upgrade page. No JS needed — buy buttons
		// are plain anchor tags to the Lemon Squeezy hosted checkout.
		if ( strpos( $hook, 'quoted-billing' ) !== false ) {
			wp_enqueue_style(
				'quoted-billing',
				QUOTED_PLUGIN_URL . 'admin/css/billing.css',
				array( 'quoted-admin' ),
				QUOTED_VERSION
			);
		}
	}

	public function maybe_redirect_to_onboarding() {
		if ( ! get_transient( 'quoted_activation_redirect' ) ) {
			return;
		}
		delete_transient( 'quoted_activation_redirect' );

		// Skip the redirect on any kind of bulk activation — single-site
		// ("activate-selected" from /plugins.php), network ("activate-multi"),
		// or anything that produced an activation notice we'd interrupt.
		$bulk_keys = array( 'activate-multi', 'activate-selected' );
		foreach ( $bulk_keys as $k ) {
			if ( isset( $_GET[ $k ] ) ) {
				return;
			}
		}

		wp_safe_redirect( admin_url( 'admin.php?page=quoted' ) );
		exit;
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

		// 1. License activate / deactivate (separate form with its own nonce).
		if ( isset( $_POST['quoted_license_activate'] ) || isset( $_POST['quoted_license_deactivate'] ) ) {
			check_admin_referer( 'quoted_license_action' );
			$this->handle_license_action();
		}

		// 2. Main settings form. Gate on an explicit submit marker so a stray
		// POST (e.g. from another plugin's form on the same screen) doesn't
		// trigger check_admin_referer() and the "link expired" interstitial.
		if ( isset( $_POST['quoted_settings_submit'] ) ) {
			check_admin_referer( 'quoted_settings_save' );
			$this->save_settings();
		}

		require_once QUOTED_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	private function handle_license_action() {
		$license = new Quoted_License();

		if ( isset( $_POST['quoted_license_deactivate'] ) ) {
			$license->deactivate();
			add_settings_error( 'quoted', 'quoted_deactivated',
				__( 'License deactivated. This seat has been freed.', 'quoted' ), 'updated' );
			return;
		}

		$key = isset( $_POST['quoted_license_key'] )
			? sanitize_text_field( wp_unslash( $_POST['quoted_license_key'] ) )
			: '';

		$result = $license->activate( $key );
		if ( is_wp_error( $result ) ) {
			add_settings_error( 'quoted', $result->get_error_code(),
				$result->get_error_message(), 'error' );
			return;
		}

		add_settings_error( 'quoted', 'quoted_activated',
			sprintf(
				/* translators: %s: plan name */
				__( 'License activated. Plan: %s.', 'quoted' ),
				esc_html( strtoupper( str_replace( '_', ' ', $result['plan'] ) ) )
			),
			'updated' );
	}

	private function save_settings() {
		update_option( 'quoted_hash_ips',        isset( $_POST['quoted_hash_ips'] ) );
		update_option( 'quoted_show_badge',      isset( $_POST['quoted_show_badge'] ) );
		update_option( 'quoted_disable_logging', isset( $_POST['quoted_disable_logging'] ) );
		update_option( 'quoted_trust_proxy',     isset( $_POST['quoted_trust_proxy'] ) );

		// Schema engine — boolean enable + 3-state mode (auto/always/never).
		update_option( 'quoted_schema_enabled', isset( $_POST['quoted_schema_enabled'] ) );
		if ( isset( $_POST['quoted_schema_mode'] ) ) {
			$mode = sanitize_key( wp_unslash( $_POST['quoted_schema_mode'] ) );
			if ( ! in_array( $mode, array( 'auto', 'always', 'never' ), true ) ) {
				$mode = 'auto';
			}
			update_option( 'quoted_schema_mode', $mode );
		}

		// AI Crawler Allowlist — only accept bot IDs we know about, and only
		// 'allow' / 'block' as values. Anything else is silently ignored.
		if ( isset( $_POST['quoted_bot_allowlist'] ) && is_array( $_POST['quoted_bot_allowlist'] ) ) {
			$known   = array_keys( Quoted_Bot_Detector::bot_metadata() );
			$cleaned = array();
			foreach ( $_POST['quoted_bot_allowlist'] as $bot => $state ) {
				if ( ! in_array( $bot, $known, true ) ) {
					continue;
				}
				$state = sanitize_key( wp_unslash( $state ) );
				if ( $state !== 'allow' && $state !== 'block' ) {
					$state = 'allow';
				}
				$cleaned[ $bot ] = $state;
			}
			update_option( 'quoted_bot_allowlist', $cleaned );
		}

		// BYO API keys — only saved when the user has a paid plan that unlocks
		// the fields. Stored as-is (no transforms). Empty string clears.
		$is_paid = ( Quoted_License::current_plan() !== 'free' );
		if ( $is_paid ) {
			if ( isset( $_POST['quoted_perplexity_api_key'] ) ) {
				$key = sanitize_text_field( wp_unslash( $_POST['quoted_perplexity_api_key'] ) );
				update_option( 'quoted_perplexity_api_key', $key );
			}
			if ( isset( $_POST['quoted_tavily_api_key'] ) ) {
				$key = sanitize_text_field( wp_unslash( $_POST['quoted_tavily_api_key'] ) );
				update_option( 'quoted_tavily_api_key', $key );
			}
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

	/**
	 * AJAX handler for license activation (called from the onboarding flow).
	 *
	 * The handler name is still ajax_connect_backend for back-compat with the
	 * existing onboarding JS, but the implementation now talks to Lemon
	 * Squeezy directly via Quoted_License::activate(). No backend_url needed.
	 */
	public function ajax_connect_backend() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		$license_key = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : '';

		$license = new Quoted_License();
		$result  = $license->activate( $license_key );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			), 400 );
			return;
		}

		wp_send_json_success( array(
			'plan'         => $result['plan'],
			'variant_name' => $result['variant_name'],
			'expires_at'   => $result['expires_at'],
		) );
	}

	public function ajax_save_niche() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		$niche = isset( $_POST['niche'] ) ? sanitize_key( wp_unslash( $_POST['niche'] ) ) : '';

		if ( empty( $niche ) ) {
			wp_send_json_error( array( 'message' => __( 'Please select a niche.', 'quoted' ) ), 400 );
			return;
		}

		update_option( 'quoted_niche', $niche );

		wp_send_json_success( array( 'niche' => $niche ) );
	}

	public function ajax_sync_posts() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		// Standalone plugin — there is no backend to sync to. The onboarding
		// "Auto-scan now" step now just refreshes the local llms.txt cache so
		// it picks up any new posts on this site. Kept under the existing
		// AJAX action name so the onboarding JS doesn't need to change.
		Quoted_Llms_Txt::flush_cache();

		$count = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;
		$result = array(
			'synced' => $count,
			'errors' => array(),
		);

		// Mark onboarded after the refresh.
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
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		// Standalone plugin — read everything from the local bot log table.
		global $wpdb;
		$table = $wpdb->prefix . 'quoted_bot_log';

		// Free tier: 7-day window. Paid tier: 90-day window for dashboard widgets.
		$plan         = Quoted_License::current_plan();
		$window_days  = ( $plan === 'free' ) ? 7 : 90;
		$window_start = gmdate( 'Y-m-d H:i:s', time() - ( $window_days * DAY_IN_SECONDS ) );

		// Total crawls in window + previous window (for delta).
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$total_this = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s",
			$window_start
		) );
		$prev_start = gmdate( 'Y-m-d H:i:s', time() - ( 2 * $window_days * DAY_IN_SECONDS ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$total_prev = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s",
			$prev_start, $window_start
		) );

		// AI Distribution Score = local heuristic: count of distinct bots seen
		// in the window × 10, capped at 100. (A site reached by 10+ different
		// AI bots is treated as "well distributed".)
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$distinct_bots = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT bot_name) FROM {$table} WHERE crawled_at >= %s",
			$window_start
		) );
		$score      = min( 100, $distinct_bots * 10 );
		$prev_score = 0;
		if ( $total_prev > 0 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
			$prev_distinct = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(DISTINCT bot_name) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s",
				$prev_start, $window_start
			) );
			$prev_score = min( 100, $prev_distinct * 10 );
		}

		// Recent crawls feed (latest 10).
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$recent = $wpdb->get_results(
			"SELECT bot_name, url_path, crawled_at FROM {$table} ORDER BY id DESC LIMIT 10"
		);
		$recent_crawls = array();
		foreach ( $recent as $r ) {
			$recent_crawls[] = array(
				'bot_name'   => $r->bot_name,
				'url_path'   => $r->url_path,
				'crawled_at' => $r->crawled_at,
				'human_time' => human_time_diff( strtotime( $r->crawled_at . ' UTC' ), time() ) . ' ago',
			);
		}

		// Top bots in window.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$top = $wpdb->get_results( $wpdb->prepare(
			"SELECT bot_name, COUNT(*) AS c FROM {$table} WHERE crawled_at >= %s GROUP BY bot_name ORDER BY c DESC LIMIT 8",
			$window_start
		) );
		$top_bots = array();
		foreach ( $top as $t ) {
			$top_bots[] = array(
				'bot_name' => $t->bot_name,
				'count'    => (int) $t->c,
			);
		}

		// Quota — Free tier capped at 50 published posts in llms.txt.
		$published = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;
		$quota     = ( $plan === 'free' ) ? 50 : 0; // 0 = unlimited

		// Next action — simple heuristic for empty-state guidance.
		$next_action = null;
		if ( $total_this === 0 ) {
			$next_action = array(
				'title'       => __( 'Waiting for AI bots', 'quoted' ),
				'description' => __( 'No crawls yet. ClaudeBot and GPTBot usually discover new /llms.txt files within 24 hours. Share your llms.txt URL to speed things up.', 'quoted' ),
				'action_url'  => home_url( '/llms.txt' ),
			);
		} elseif ( $plan === 'free' && $published >= 45 ) {
			$next_action = array(
				'title'       => __( 'Approaching the 50-post Free cap', 'quoted' ),
				'description' => __( 'Your llms.txt will only include the 50 most-recent posts on the Free tier. Upgrade to Solo for unlimited.', 'quoted' ),
				'action_url'  => admin_url( 'admin.php?page=quoted-billing' ),
			);
		}

		wp_send_json_success( array(
			'ai_distribution_score' => $score,
			'score_delta_7d'        => $score - $prev_score,
			'window_days'           => $window_days,
			'bot_activity'          => array(
				'total_crawls_7d' => $total_this,
				'recent_crawls'   => $recent_crawls,
				'top_bots'        => $top_bots,
			),
			'posts'                 => array(
				'synced' => $published,
				'quota'  => $quota,
			),
			'next_action'           => $next_action,
		) );
	}

	public function ajax_disconnect() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		$license = new Quoted_License();
		$license->deactivate();

		wp_send_json_success( array( 'message' => __( 'License deactivated.', 'quoted' ) ) );
	}
}
