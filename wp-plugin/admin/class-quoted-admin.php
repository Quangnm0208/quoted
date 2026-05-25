<?php
/**
 * Admin orchestrator — menu, assets, AJAX handlers.
 *
 * This is the v0.5.0 free-only build: no license code, no backend client,
 * no Upgrade page. All Pro/license surfaces were removed for WordPress.org
 * Plugin Directory submission (Guideline 5 — no trialware).
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
			'i18n'        => array(
				'connecting'    => __( 'Working...', 'quoted' ),
				'error_generic' => __( 'Something went wrong. Please try again.', 'quoted' ),
				'success'       => __( 'Done!', 'quoted' ),
			),
		) );
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

		if ( ! get_option( 'quoted_onboarded', false ) ) {
			require_once QUOTED_PLUGIN_DIR . 'admin/partials/onboarding.php';
		} else {
			require_once QUOTED_PLUGIN_DIR . 'admin/partials/dashboard.php';
		}
	}

	public function render_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quoted' ) );
		}

		// Gate the save on an explicit submit marker so a stray POST (e.g.
		// from another plugin's form on the same screen) doesn't trigger
		// check_admin_referer() and the "link expired" interstitial.
		if ( isset( $_POST['quoted_settings_submit'] ) ) {
			check_admin_referer( 'quoted_settings_save' );
			$this->save_settings();
		}

		require_once QUOTED_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	private function save_settings() {
		// Boolean toggles. isset() is the boolean — unchecked checkboxes are
		// absent from $_POST, so isset() === false handles the "uncheck" case.
		update_option( 'quoted_hash_ips',        isset( $_POST['quoted_hash_ips'] ) );
		update_option( 'quoted_show_badge',      isset( $_POST['quoted_show_badge'] ) );
		update_option( 'quoted_disable_logging', isset( $_POST['quoted_disable_logging'] ) );
		update_option( 'quoted_trust_proxy',     isset( $_POST['quoted_trust_proxy'] ) );
		update_option( 'quoted_schema_enabled',  isset( $_POST['quoted_schema_enabled'] ) );

		// Schema mode — whitelist 'auto', 'always', 'never'.
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
			// Unslash + sanitize the entire array up front so each key/value is
			// safe before we iterate.
			$raw = wp_unslash( $_POST['quoted_bot_allowlist'] );
			foreach ( $raw as $bot => $state ) {
				$bot = sanitize_key( (string) $bot );
				if ( ! in_array( $bot, $known, true ) ) {
					continue;
				}
				$state = sanitize_key( (string) $state );
				if ( $state !== 'allow' && $state !== 'block' ) {
					$state = 'allow';
				}
				$cleaned[ $bot ] = $state;
			}
			update_option( 'quoted_bot_allowlist', $cleaned );
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

	public function ajax_sync_posts() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return; // Defensive — wp_send_json_error calls wp_die(), but a custom wp_die handler could resume execution.
		}

		// "Generate now" in the wizard refreshes the local llms.txt cache so
		// it picks up any new posts. Nothing leaves the server.
		Quoted_Llms_Txt::flush_cache();

		$count = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;

		// Mark onboarded after the refresh.
		update_option( 'quoted_onboarded', true );

		wp_send_json_success( array(
			'synced' => $count,
			'errors' => array(),
		) );
	}

	public function ajax_dashboard_data() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'quoted_bot_log';

		// Single 7-day window. The plugin is fully functional with no tier
		// distinction — every install reads the same window from its own log.
		$window_days  = 7;
		$window_start = gmdate( 'Y-m-d H:i:s', time() - ( $window_days * DAY_IN_SECONDS ) );
		$prev_start   = gmdate( 'Y-m-d H:i:s', time() - ( 2 * $window_days * DAY_IN_SECONDS ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$total_this = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s",
			$window_start
		) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery -- $table from $wpdb->prefix.
		$total_prev = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s",
			$prev_start, $window_start
		) );

		// AI Distribution Score = local heuristic: count of distinct bots seen
		// in the window × 10, capped at 100.
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

		$published = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;

		// Next action — simple empty-state guidance. No upgrade prompts.
		$next_action  = null;
		$installed_at = (int) get_option( 'quoted_installed_at', time() );
		$days_since   = max( 0, (int) floor( ( time() - $installed_at ) / DAY_IN_SECONDS ) );

		if ( $total_this === 0 && $days_since >= 7 ) {
			$next_action = array(
				'title'       => __( 'No AI bot visits in 7+ days — check your firewall', 'quoted' ),
				'description' => __( "ClaudeBot and GPTBot should have discovered /llms.txt by now. If you run Wordfence, Sucuri, or iThemes Security, their default WAF rules often block AI bot user-agents. Whitelist ClaudeBot, GPTBot, PerplexityBot, Google-Extended in your security plugin, or ask your host to allow them at the server level.", 'quoted' ),
				'action_url'  => '',
			);
		} elseif ( $total_this === 0 ) {
			$next_action = array(
				'title'       => __( 'Waiting for AI bots', 'quoted' ),
				'description' => __( 'No crawls yet. ClaudeBot and GPTBot usually discover new /llms.txt files within 24 hours. Share your llms.txt URL to speed things up.', 'quoted' ),
				'action_url'  => home_url( '/llms.txt' ),
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
				'published' => $published,
			),
			'next_action'           => $next_action,
		) );
	}
}
