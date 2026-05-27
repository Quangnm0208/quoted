<?php
/**
 * Admin orchestrator: menu, assets, AJAX handlers, settings.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Admin {

	public function add_menu_pages() {
		add_menu_page(
			__( 'QuotedEasy AI Readiness', 'quotedeasy-ai-readiness' ),
			__( 'QuotedEasy', 'quotedeasy-ai-readiness' ),
			'manage_options',
			'quotedeasy-ai-readiness',
			array( $this, 'render_dashboard_or_onboarding' ),
			'dashicons-format-quote',
			81
		);

		add_submenu_page(
			'quotedeasy-ai-readiness',
			__( 'Dashboard', 'quotedeasy-ai-readiness' ),
			__( 'Dashboard', 'quotedeasy-ai-readiness' ),
			'manage_options',
			'quotedeasy-ai-readiness',
			array( $this, 'render_dashboard_or_onboarding' )
		);

		add_submenu_page(
			'quotedeasy-ai-readiness',
			__( 'Settings', 'quotedeasy-ai-readiness' ),
			__( 'Settings', 'quotedeasy-ai-readiness' ),
			'manage_options',
			'quotedeasy-ai-readiness-settings',
			array( $this, 'render_settings' )
		);
	}

	public function enqueue_assets( $hook ) {
		if ( strpos( $hook, 'quotedeasy-ai-readiness' ) === false ) {
			return;
		}

		wp_enqueue_style(
			'quotedeasy-ai-readiness-admin',
			QUOTEDEASY_AI_READINESS_PLUGIN_URL . 'admin/css/quotedeasy-ai-readiness-admin.css',
			array(),
			QUOTEDEASY_AI_READINESS_VERSION
		);

		wp_enqueue_script(
			'quotedeasy-ai-readiness-chartjs',
			QUOTEDEASY_AI_READINESS_PLUGIN_URL . 'admin/js/chart.umd.min.js',
			array(),
			'4.4.0',
			true
		);

		wp_enqueue_script(
			'quotedeasy-ai-readiness-admin',
			QUOTEDEASY_AI_READINESS_PLUGIN_URL . 'admin/js/quotedeasy-ai-readiness-admin.js',
			array( 'jquery', 'quotedeasy-ai-readiness-chartjs' ),
			QUOTEDEASY_AI_READINESS_VERSION,
			true
		);

		wp_localize_script( 'quotedeasy-ai-readiness-admin', 'QuotedEasyAIReadinessAdmin', array(
			'ajax_url'   => admin_url( 'admin-ajax.php' ),
			'nonce'      => wp_create_nonce( 'quotedeasy_ai_readiness_admin_nonce' ),
			'plugin_url' => QUOTEDEASY_AI_READINESS_PLUGIN_URL,
			'site_url'   => home_url(),
			'i18n'       => array(
				'connecting'    => __( 'Working...', 'quotedeasy-ai-readiness' ),
				'error_generic' => __( 'Something went wrong. Please try again.', 'quotedeasy-ai-readiness' ),
				'success'       => __( 'Done!', 'quotedeasy-ai-readiness' ),
			),
		) );
	}

	public function maybe_redirect_to_onboarding() {
		if ( ! get_transient( 'quotedeasy_ai_readiness_activation_redirect' ) ) {
			return;
		}
		delete_transient( 'quotedeasy_ai_readiness_activation_redirect' );

		// Skip on bulk activations so we don't interrupt admin notices.
		$bulk_keys = array( 'activate-multi', 'activate-selected' );
		foreach ( $bulk_keys as $k ) {
			if ( isset( $_GET[ $k ] ) ) {
				return;
			}
		}

		wp_safe_redirect( admin_url( 'admin.php?page=quotedeasy-ai-readiness' ) );
		exit;
	}

	public function render_dashboard_or_onboarding() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quotedeasy-ai-readiness' ) );
		}

		if ( ! get_option( 'quotedeasy_ai_readiness_onboarded', false ) ) {
			require_once QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'admin/partials/onboarding.php';
		} else {
			require_once QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'admin/partials/dashboard.php';
		}
	}

	public function render_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quotedeasy-ai-readiness' ) );
		}

		if ( isset( $_POST['quotedeasy_ai_readiness_settings_submit'] ) ) {
			check_admin_referer( 'quotedeasy_ai_readiness_settings_save' );
			$this->save_settings();
		}

		require_once QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	private function save_settings() {
		update_option( 'quotedeasy_ai_readiness_hash_ips',        isset( $_POST['quotedeasy_ai_readiness_hash_ips'] ) );
		update_option( 'quotedeasy_ai_readiness_show_badge',      isset( $_POST['quotedeasy_ai_readiness_show_badge'] ) );
		update_option( 'quotedeasy_ai_readiness_disable_logging', isset( $_POST['quotedeasy_ai_readiness_disable_logging'] ) );
		update_option( 'quotedeasy_ai_readiness_trust_proxy',     isset( $_POST['quotedeasy_ai_readiness_trust_proxy'] ) );
		update_option( 'quotedeasy_ai_readiness_schema_enabled',  isset( $_POST['quotedeasy_ai_readiness_schema_enabled'] ) );

		if ( isset( $_POST['quotedeasy_ai_readiness_schema_mode'] ) ) {
			$mode = sanitize_key( wp_unslash( $_POST['quotedeasy_ai_readiness_schema_mode'] ) );
			if ( ! in_array( $mode, array( 'auto', 'always', 'never' ), true ) ) {
				$mode = 'auto';
			}
			update_option( 'quotedeasy_ai_readiness_schema_mode', $mode );
		}

		if ( isset( $_POST['quotedeasy_ai_readiness_bot_allowlist'] ) && is_array( $_POST['quotedeasy_ai_readiness_bot_allowlist'] ) ) {
			$known   = array_keys( QuotedEasy_AI_Readiness_Bot_Detector::bot_metadata() );
			$cleaned = array();
			$raw     = wp_unslash( $_POST['quotedeasy_ai_readiness_bot_allowlist'] );
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
			update_option( 'quotedeasy_ai_readiness_bot_allowlist', $cleaned );
		}

		add_settings_error(
			'quotedeasy-ai-readiness',
			'quotedeasy_ai_readiness_saved',
			__( 'Settings saved.', 'quotedeasy-ai-readiness' ),
			'updated'
		);
	}

	public function plugin_action_links( $links ) {
		$custom = array(
			'<a href="' . esc_url( admin_url( 'admin.php?page=quotedeasy-ai-readiness' ) ) . '">' . esc_html__( 'Dashboard', 'quotedeasy-ai-readiness' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=quotedeasy-ai-readiness-settings' ) ) . '">' . esc_html__( 'Settings', 'quotedeasy-ai-readiness' ) . '</a>',
		);
		return array_merge( $custom, $links );
	}

	public function ajax_sync_posts() {
		check_ajax_referer( 'quotedeasy_ai_readiness_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quotedeasy-ai-readiness' ) ), 403 );
			return;
		}

		QuotedEasy_AI_Readiness_Llms_Txt::flush_cache();

		$count = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;

		update_option( 'quotedeasy_ai_readiness_onboarded', true );

		wp_send_json_success( array(
			'synced' => $count,
			'errors' => array(),
		) );
	}

	public function ajax_dashboard_data() {
		check_ajax_referer( 'quotedeasy_ai_readiness_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quotedeasy-ai-readiness' ) ), 403 );
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'quotedeasy_ai_readiness_bot_log';

		$window_days  = 7;
		$window_start = gmdate( 'Y-m-d H:i:s', time() - ( $window_days * DAY_IN_SECONDS ) );
		$prev_start   = gmdate( 'Y-m-d H:i:s', time() - ( 2 * $window_days * DAY_IN_SECONDS ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$total_this = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s",
			$window_start
		) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$total_prev = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s",
			$prev_start, $window_start
		) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$distinct_bots = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT bot_name) FROM {$table} WHERE crawled_at >= %s",
			$window_start
		) );
		$score      = min( 100, $distinct_bots * 10 );
		$prev_score = 0;
		if ( $total_prev > 0 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
			$prev_distinct = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(DISTINCT bot_name) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s",
				$prev_start, $window_start
			) );
			$prev_score = min( 100, $prev_distinct * 10 );
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
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

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
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

		$next_action  = null;
		$installed_at = (int) get_option( 'quotedeasy_ai_readiness_installed_at', time() );
		$days_since   = max( 0, (int) floor( ( time() - $installed_at ) / DAY_IN_SECONDS ) );

		if ( $total_this === 0 && $days_since >= 7 ) {
			$next_action = array(
				'title'       => __( 'No AI bot visits in 7+ days - check your firewall', 'quotedeasy-ai-readiness' ),
				'description' => __( 'ClaudeBot and GPTBot should have discovered /llms.txt by now. If you run Wordfence, Sucuri, or iThemes Security, their default WAF rules often block AI bot user-agents. Whitelist ClaudeBot, GPTBot, PerplexityBot, Google-Extended in your security plugin, or ask your host to allow them at the server level.', 'quotedeasy-ai-readiness' ),
				'action_url'  => '',
			);
		} elseif ( $total_this === 0 ) {
			$next_action = array(
				'title'       => __( 'Waiting for AI bots', 'quotedeasy-ai-readiness' ),
				'description' => __( 'No crawls yet. ClaudeBot and GPTBot usually discover new /llms.txt files within 24 hours. Share your llms.txt URL to speed things up.', 'quotedeasy-ai-readiness' ),
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
