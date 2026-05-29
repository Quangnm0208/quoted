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
			'quotedeasy-ai-readiness',
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
		$this->loader->add_action( 'wp_ajax_quoted_sync_posts', $admin, 'ajax_sync_posts' );
		$this->loader->add_action( 'wp_ajax_quoted_dashboard_data', $admin, 'ajax_dashboard_data' );

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

		// "Powered by Quoted" credit — opt-in. The hook is only registered
		// when the admin has explicitly enabled the credit in Settings.
		// WP.org Guideline 10: no public branding without admin consent.
		if ( get_option( 'quoted_show_badge', false ) ) {
			$this->loader->add_action( 'wp_footer', $public, 'render_powered_by_badge' );
		}

		// llms.txt rewrite rule. Serve at template_redirect priority 1 so we
		// run before redirect_canonical (priority 10) and emit the body
		// instead of getting 301'd to a trailing-slash variant.
		$this->loader->add_action( 'init', $public, 'add_rewrite_rules' );
		$this->loader->add_filter( 'query_vars', $public, 'add_query_vars' );
		$this->loader->add_action( 'template_redirect', $public, 'maybe_serve_llms_txt', 1 );

		// Robots.txt — append Disallow rules for any bots the operator has
		// blocked in the AI Crawler Allowlist. Two accepted_args because WP
		// passes the existing body + the "is public" flag.
		$this->loader->add_filter( 'robots_txt', $public, 'filter_robots_txt', 10, 2 );

		// Schema engine — output JSON-LD (Article + FAQ) in wp_head. Late
		// priority so SEO plugins emit theirs first and we can defer to them
		// in auto mode. See Quoted_Schema::conflicting_seo_plugin().
		$schema = new Quoted_Schema();
		$this->loader->add_action( 'wp_head', $schema, 'maybe_output', 20 );
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
