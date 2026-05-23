<?php
/**
 * Core plugin orchestrator.
 *
 * Loads dependencies, defines locale, sets hooks for admin + public areas.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Core {

	/**
	 * Hook registrar.
	 *
	 * @var Quoted_Loader
	 */
	protected $loader;

	public function __construct() {
		$this->loader = new Quoted_Loader();

		$this->set_locale();
		$this->define_admin_hooks();
		$this->define_public_hooks();
		$this->define_cron_hooks();
		$this->define_rest_hooks();
	}

	/**
	 * Load translations.
	 *
	 * Hooked on `init` (not `plugins_loaded`). Quoted_Core itself is
	 * instantiated *during* the `plugins_loaded` action at the same priority,
	 * so a `plugins_loaded` registration could miss its own firing window.
	 * WP 6.7+ also expects translations on `init`.
	 */
	private function set_locale() {
		$this->loader->add_action( 'init', $this, 'load_plugin_textdomain' );
	}

	public function load_plugin_textdomain() {
		load_plugin_textdomain(
			'quoted',
			false,
			dirname( QUOTED_PLUGIN_BASENAME ) . '/languages/'
		);
	}

	/**
	 * Admin-side hooks: menu, scripts, styles, AJAX.
	 */
	private function define_admin_hooks() {
		$admin = new Quoted_Admin();

		$this->loader->add_action( 'admin_menu', $admin, 'add_menu_pages' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_assets' );
		$this->loader->add_action( 'admin_init', $admin, 'maybe_redirect_to_onboarding' );

		// AJAX handlers — capability-checked inside each handler.
		$this->loader->add_action( 'wp_ajax_quoted_connect_backend', $admin, 'ajax_connect_backend' );
		$this->loader->add_action( 'wp_ajax_quoted_save_niche', $admin, 'ajax_save_niche' );
		$this->loader->add_action( 'wp_ajax_quoted_sync_posts', $admin, 'ajax_sync_posts' );
		$this->loader->add_action( 'wp_ajax_quoted_dashboard_data', $admin, 'ajax_dashboard_data' );
		$this->loader->add_action( 'wp_ajax_quoted_disconnect', $admin, 'ajax_disconnect' );

		// Plugin row links.
		$this->loader->add_filter( 'plugin_action_links_' . QUOTED_PLUGIN_BASENAME, $admin, 'plugin_action_links' );
	}

	/**
	 * Public-side hooks: bot detection, frontend badge.
	 */
	private function define_public_hooks() {
		$public = new Quoted_Public();

		// Bot detector runs early but cheap.
		$this->loader->add_action( 'init', $public, 'detect_bot_visit', 1 );

		// "Powered by Quoted" badge (free tier only).
		$this->loader->add_action( 'wp_footer', $public, 'render_powered_by_badge' );

		// llms.txt rewrite rule.
		$this->loader->add_action( 'init', $public, 'add_rewrite_rules' );
		$this->loader->add_filter( 'query_vars', $public, 'add_query_vars' );
		$this->loader->add_action( 'template_redirect', $public, 'maybe_serve_llms_txt' );
	}

	/**
	 * Cron jobs.
	 */
	private function define_cron_hooks() {
		$sync = new Quoted_Sync();

		$this->loader->add_action( 'quoted_cron_sync_crawls', $sync, 'sync_bot_crawls' );
		$this->loader->add_action( 'quoted_cron_sync_posts', $sync, 'sync_posts' );
		$this->loader->add_action( 'quoted_cron_refresh_token', $sync, 'refresh_token_if_needed' );
	}

	/**
	 * REST endpoints.
	 */
	private function define_rest_hooks() {
		$rest = new Quoted_Rest();

		$this->loader->add_action( 'rest_api_init', $rest, 'register_routes' );

		// Invalidate the per-post markdown transient whenever a post is
		// saved or deleted. Without this, every edit orphans the previous
		// transient row in wp_options forever (post_modified_gmt changes
		// → cache_key changes → old key is unreachable).
		$this->loader->add_action( 'save_post', 'Quoted_Rest', 'invalidate_post_cache' );
		$this->loader->add_action( 'before_delete_post', 'Quoted_Rest', 'invalidate_post_cache' );
	}

	public function run() {
		$this->loader->run();
	}
}
