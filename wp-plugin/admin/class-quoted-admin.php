<?php
/**
 * Admin orchestrator — menu, assets, AJAX, page renderers.
 *
 * v0.4.0: 8-page sub-nav admin (Dashboard / Setup / llms.txt / Crawler controls /
 * Schema / Privacy / Plans & billing / Brand identity) per Quoted brand spec.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Admin {

	/**
	 * The 8 admin sub-pages, in display order.
	 * Each entry: slug, label, icon name (matches Quoted_Admin::icon()).
	 */
	public static function nav() {
		return array(
			array( 'slug' => 'quoted',                 'label' => __( 'Dashboard',        'quoted' ), 'icon' => 'home' ),
			array( 'slug' => 'quoted-setup',           'label' => __( 'Setup',            'quoted' ), 'icon' => 'sparkle' ),
			array( 'slug' => 'quoted-llmstxt',         'label' => __( 'llms.txt',         'quoted' ), 'icon' => 'file' ),
			array( 'slug' => 'quoted-crawlers',        'label' => __( 'Crawler controls', 'quoted' ), 'icon' => 'shield' ),
			array( 'slug' => 'quoted-schema',          'label' => __( 'Schema',           'quoted' ), 'icon' => 'code' ),
			array( 'slug' => 'quoted-privacy',         'label' => __( 'Privacy',          'quoted' ), 'icon' => 'lock' ),
			array( 'slug' => 'quoted-billing',         'label' => __( 'Plans & billing',  'quoted' ), 'icon' => 'card' ),
			array( 'slug' => 'quoted-brand',           'label' => __( 'Brand identity',   'quoted' ), 'icon' => 'palette' ),
		);
	}

	public function add_menu_pages() {
		add_menu_page(
			__( 'Quoted', 'quoted' ),
			__( 'Quoted', 'quoted' ),
			'manage_options',
			'quoted',
			array( $this, 'render_dashboard' ),
			'dashicons-format-quote',
			81
		);

		$pages = array(
			'quoted'          => array( __( 'Dashboard',        'quoted' ), 'render_dashboard' ),
			'quoted-setup'    => array( __( 'Setup',            'quoted' ), 'render_setup' ),
			'quoted-llmstxt'  => array( __( 'llms.txt',         'quoted' ), 'render_llmstxt' ),
			'quoted-crawlers' => array( __( 'Crawler controls', 'quoted' ), 'render_crawlers' ),
			'quoted-schema'   => array( __( 'Schema',           'quoted' ), 'render_schema' ),
			'quoted-privacy'  => array( __( 'Privacy',          'quoted' ), 'render_privacy' ),
			'quoted-billing'  => array( __( 'Plans & billing',  'quoted' ), 'render_billing' ),
			'quoted-brand'    => array( __( 'Brand identity',   'quoted' ), 'render_brand' ),
		);

		foreach ( $pages as $slug => $cfg ) {
			add_submenu_page(
				'quoted',
				$cfg[0],
				$cfg[0],
				'manage_options',
				$slug,
				array( $this, $cfg[1] )
			);
		}

		// Legacy /admin.php?page=quoted-settings -> redirect to crawlers
		// (the old monolithic settings split into crawlers/schema/privacy in v0.4.0).
		add_submenu_page(
			null,
			__( 'Settings', 'quoted' ),
			__( 'Settings', 'quoted' ),
			'manage_options',
			'quoted-settings',
			array( $this, 'render_legacy_settings_redirect' )
		);
	}

	public function render_legacy_settings_redirect() {
		wp_safe_redirect( admin_url( 'admin.php?page=quoted-crawlers' ) );
		exit;
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
				'connecting'    => __( 'Connecting...', 'quoted' ),
				'syncing'       => __( 'Syncing posts...', 'quoted' ),
				'error_generic' => __( 'Something went wrong. Please try again.', 'quoted' ),
				'success'       => __( 'Done!', 'quoted' ),
				'copied'        => __( 'Copied', 'quoted' ),
				'copy'          => __( 'Copy', 'quoted' ),
			),
		) );

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

		$bulk_keys = array( 'activate-multi', 'activate-selected' );
		foreach ( $bulk_keys as $k ) {
			if ( isset( $_GET[ $k ] ) ) {
				return;
			}
		}

		wp_safe_redirect( admin_url( 'admin.php?page=quoted-setup' ) );
		exit;
	}

	// ─── Page renderers ───────────────────────────────────────────────

	public function render_dashboard() {
		$this->guard();
		$onboarded = get_option( 'quoted_onboarded', false );
		if ( ! $onboarded && ! isset( $_GET['force'] ) ) {
			wp_safe_redirect( admin_url( 'admin.php?page=quoted-setup' ) );
			exit;
		}
		require QUOTED_PLUGIN_DIR . 'admin/partials/dashboard.php';
	}

	public function render_setup() {
		$this->guard();
		require QUOTED_PLUGIN_DIR . 'admin/partials/setup.php';
	}

	public function render_llmstxt() {
		$this->guard();
		$this->maybe_save_llmstxt();
		require QUOTED_PLUGIN_DIR . 'admin/partials/llmstxt.php';
	}

	public function render_crawlers() {
		$this->guard();
		$this->maybe_save_crawlers();
		require QUOTED_PLUGIN_DIR . 'admin/partials/crawlers.php';
	}

	public function render_schema() {
		$this->guard();
		$this->maybe_save_schema();
		require QUOTED_PLUGIN_DIR . 'admin/partials/schema.php';
	}

	public function render_privacy() {
		$this->guard();
		$this->maybe_save_privacy();
		require QUOTED_PLUGIN_DIR . 'admin/partials/privacy.php';
	}

	public function render_billing() {
		$this->guard();
		$this->maybe_handle_license();
		require QUOTED_PLUGIN_DIR . 'admin/partials/billing-page.php';
	}

	public function render_brand() {
		$this->guard();
		require QUOTED_PLUGIN_DIR . 'admin/partials/brand-identity.php';
	}

	private function guard() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'quoted' ) );
		}
	}

	// ─── Settings save handlers (split from old monolithic save_settings) ─────

	private function maybe_save_llmstxt() {
		if ( ! isset( $_POST['quoted_llmstxt_submit'] ) ) {
			return;
		}
		check_admin_referer( 'quoted_llmstxt_save' );

		update_option( 'quoted_llmstxt_enabled',          isset( $_POST['quoted_llmstxt_enabled'] ) );
		update_option( 'quoted_llmstxt_include_posts',    isset( $_POST['quoted_llmstxt_include_posts'] ) );
		update_option( 'quoted_llmstxt_include_pages',    isset( $_POST['quoted_llmstxt_include_pages'] ) );
		update_option( 'quoted_llmstxt_include_products', isset( $_POST['quoted_llmstxt_include_products'] ) );

		$summary = isset( $_POST['quoted_llmstxt_summary'] )
			? sanitize_textarea_field( wp_unslash( $_POST['quoted_llmstxt_summary'] ) )
			: '';
		$summary = mb_substr( $summary, 0, 240 );
		update_option( 'quoted_llmstxt_summary', $summary );

		$excluded_raw = isset( $_POST['quoted_llmstxt_excluded'] )
			? sanitize_textarea_field( wp_unslash( $_POST['quoted_llmstxt_excluded'] ) )
			: '';
		$excluded = array_values( array_filter( array_map( 'trim', explode( "\n", $excluded_raw ) ) ) );
		update_option( 'quoted_llmstxt_excluded', $excluded );

		Quoted_Llms_Txt::flush_cache();
		add_settings_error( 'quoted', 'quoted_saved', __( 'llms.txt settings saved.', 'quoted' ), 'updated' );
	}

	private function maybe_save_crawlers() {
		if ( ! isset( $_POST['quoted_crawlers_submit'] ) ) {
			return;
		}
		check_admin_referer( 'quoted_crawlers_save' );

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

		add_settings_error( 'quoted', 'quoted_saved', __( 'Crawler controls saved.', 'quoted' ), 'updated' );
	}

	private function maybe_save_schema() {
		if ( ! isset( $_POST['quoted_schema_submit'] ) ) {
			return;
		}
		check_admin_referer( 'quoted_schema_save' );

		update_option( 'quoted_schema_enabled', isset( $_POST['quoted_schema_enabled'] ) );
		update_option( 'quoted_schema_faq',     isset( $_POST['quoted_schema_faq'] ) );
		if ( isset( $_POST['quoted_schema_mode'] ) ) {
			$mode = sanitize_key( wp_unslash( $_POST['quoted_schema_mode'] ) );
			if ( ! in_array( $mode, array( 'auto', 'always', 'never' ), true ) ) {
				$mode = 'auto';
			}
			update_option( 'quoted_schema_mode', $mode );
		}
		add_settings_error( 'quoted', 'quoted_saved', __( 'Schema settings saved.', 'quoted' ), 'updated' );
	}

	private function maybe_save_privacy() {
		if ( isset( $_POST['quoted_privacy_clear_log'] ) ) {
			check_admin_referer( 'quoted_privacy_clear' );
			global $wpdb;
			$table = $wpdb->prefix . 'quoted_bot_log';
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "TRUNCATE TABLE {$table}" );
			add_settings_error( 'quoted', 'quoted_cleared', __( 'Local bot log cleared.', 'quoted' ), 'updated' );
			return;
		}

		if ( ! isset( $_POST['quoted_privacy_submit'] ) ) {
			return;
		}
		check_admin_referer( 'quoted_privacy_save' );

		update_option( 'quoted_hash_ips',        isset( $_POST['quoted_hash_ips'] ) );
		update_option( 'quoted_disable_logging', isset( $_POST['quoted_disable_logging'] ) );
		update_option( 'quoted_trust_proxy',     isset( $_POST['quoted_trust_proxy'] ) );
		update_option( 'quoted_uninstall_purge', isset( $_POST['quoted_uninstall_purge'] ) );

		$retention = isset( $_POST['quoted_retention_days'] ) ? (int) $_POST['quoted_retention_days'] : 7;
		if ( ! in_array( $retention, array( 7, 30, 90 ), true ) ) {
			$retention = 7;
		}
		update_option( 'quoted_retention_days', $retention );

		add_settings_error( 'quoted', 'quoted_saved', __( 'Privacy settings saved.', 'quoted' ), 'updated' );
	}

	private function maybe_handle_license() {
		if ( ! ( isset( $_POST['quoted_license_activate'] ) || isset( $_POST['quoted_license_deactivate'] ) ) ) {
			return;
		}
		check_admin_referer( 'quoted_license_action' );

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
				esc_html( ucfirst( str_replace( '_', ' ', $result['plan'] ) ) )
			),
			'updated' );
	}

	public function plugin_action_links( $links ) {
		$custom = array(
			'<a href="' . esc_url( admin_url( 'admin.php?page=quoted' ) ) . '">' . esc_html__( 'Dashboard', 'quoted' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=quoted-crawlers' ) ) . '">' . esc_html__( 'Settings', 'quoted' ) . '</a>',
		);
		return array_merge( $custom, $links );
	}

	// ─── Sub-nav strip — rendered at the top of every Quoted admin page ─────

	public static function render_subnav( $current_slug ) {
		$nav      = self::nav();
		$logo_url = plugin_dir_url( QUOTED_PLUGIN_FILE ) . 'admin/images/logo-mark.svg';
		?>
		<div class="q-subnav">
			<div class="q-subnav__top">
				<div class="q-subnav__brand">
					<img src="<?php echo esc_url( $logo_url ); ?>" alt="" width="24" height="24" class="q-subnav__mark" />
					<span class="q-subnav__name">Quoted</span>
					<span class="q-badge q-badge--muted">v<?php echo esc_html( QUOTED_VERSION ); ?></span>
				</div>
				<div class="q-subnav__meta">
					<?php self::icon( 'help', 14 ); ?>
					<a href="https://quotedeasy.com/docs" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Docs', 'quoted' ); ?></a>
					<span class="q-subnav__sep" aria-hidden="true">·</span>
					<a href="https://quotedeasy.com/support" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Support', 'quoted' ); ?></a>
				</div>
			</div>
			<nav class="q-subnav__tabs" aria-label="<?php esc_attr_e( 'Quoted sections', 'quoted' ); ?>">
				<?php foreach ( $nav as $item ) : ?>
					<a
						href="<?php echo esc_url( admin_url( 'admin.php?page=' . $item['slug'] ) ); ?>"
						class="q-subnav__tab <?php echo $current_slug === $item['slug'] ? 'is-active' : ''; ?>"
					>
						<?php self::icon( $item['icon'], 13 ); ?>
						<span><?php echo esc_html( $item['label'] ); ?></span>
					</a>
				<?php endforeach; ?>
			</nav>
		</div>
		<?php
	}

	/**
	 * Inline SVG icon helper. 24 named stroke icons matching the brand kit.
	 * Echoes directly — call inside partials.
	 */
	public static function icon( $name, $size = 16, $stroke_width = 1.75 ) {
		$paths = array(
			'home'         => '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
			'file'         => '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
			'sparkle'      => '<path d="M12 3l1.5 5L18 9.5 13.5 11 12 16l-1.5-5L6 9.5 10.5 8z"/>',
			'shield'       => '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
			'code'         => '<polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/>',
			'lock'         => '<rect x="4" y="11" width="16" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
			'card'         => '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
			'palette'      => '<path d="M12 3a9 9 0 1 0 4 17c1 0 1.5-.5 1.5-1.3 0-.6-.4-1-.4-1.5 0-1 .8-1.7 1.8-1.7H21a3 3 0 0 0 0-6c-3 0-7-3-7-6.5C14 3.5 13 3 12 3z"/><circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none"/>',
			'settings'     => '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>',
			'check'        => '<polyline points="5 12 10 17 19 7"/>',
			'x'            => '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
			'external'     => '<path d="M14 4h6v6"/><path d="M10 14l10-10"/><path d="M20 14v6H4V4h6"/>',
			'download'     => '<path d="M12 4v12"/><polyline points="6 11 12 17 18 11"/><path d="M4 21h16"/>',
			'refresh'      => '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 9 16 9"/>',
			'plus'         => '<path d="M12 5v14"/><path d="M5 12h14"/>',
			'eye'          => '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
			'bot'          => '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 4v4"/><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/>',
			'arrowRight'   => '<path d="M5 12h14"/><polyline points="13 6 19 12 13 18"/>',
			'arrowUp'      => '<path d="M12 19V5"/><polyline points="6 11 12 5 18 11"/>',
			'book'         => '<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5zm2 15h12"/>',
			'help'         => '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.4-1 1.7"/><circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none"/>',
			'chevronRight' => '<polyline points="9 6 15 12 9 18"/>',
			'chevronDown'  => '<polyline points="6 9 12 15 18 9"/>',
			'activity'     => '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"/>',
		);
		$path = isset( $paths[ $name ] ) ? $paths[ $name ] : '';
		printf(
			'<svg class="q-icon" width="%1$d" height="%1$d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%2$s" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%3$s</svg>',
			(int) $size,
			esc_attr( (string) $stroke_width ),
			// SVG path source is a hard-coded internal whitelist (see $paths above) — safe to render.
			$path // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		);
	}

	// ─── AJAX handlers ────────────────────────────────────────────────

	public function ajax_connect_backend() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
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
			return;
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
			return;
		}
		Quoted_Llms_Txt::flush_cache();
		$count = (int) wp_count_posts( 'post' )->publish + (int) wp_count_posts( 'page' )->publish;
		update_option( 'quoted_onboarded', true );
		wp_send_json_success( array( 'synced' => $count, 'errors' => array() ) );
	}

	public function ajax_disconnect() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}
		( new Quoted_License() )->deactivate();
		wp_send_json_success();
	}

	public function ajax_dashboard_data() {
		check_ajax_referer( 'quoted_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'quoted' ) ), 403 );
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'quoted_bot_log';

		$plan         = Quoted_License::current_plan();
		$window_days  = ( $plan === 'free' ) ? 7 : 90;
		$window_start = gmdate( 'Y-m-d H:i:s', time() - ( $window_days * DAY_IN_SECONDS ) );
		$prev_start   = gmdate( 'Y-m-d H:i:s', time() - ( 2 * $window_days * DAY_IN_SECONDS ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$total_this = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s", $window_start
		) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$total_prev = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE crawled_at >= %s AND crawled_at < %s", $prev_start, $window_start
		) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$distinct_bots = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT bot_name) FROM {$table} WHERE crawled_at >= %s", $window_start
		) );
		$score = min( 100, $distinct_bots * 10 );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$top_bots = $wpdb->get_results( $wpdb->prepare(
			"SELECT bot_name, COUNT(*) AS visits, MAX(crawled_at) AS last
			   FROM {$table}
			  WHERE crawled_at >= %s
			  GROUP BY bot_name
			  ORDER BY visits DESC
			  LIMIT 5",
			$window_start
		), ARRAY_A );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
		$recent = $wpdb->get_results( $wpdb->prepare(
			"SELECT bot_name, url_path, crawled_at FROM {$table}
			  WHERE crawled_at >= %s ORDER BY crawled_at DESC LIMIT 8",
			$window_start
		), ARRAY_A );

		$delta       = $total_prev > 0 ? round( ( ( $total_this - $total_prev ) / $total_prev ) * 100 ) : 0;
		$posts_count = (int) wp_count_posts( 'post' )->publish;
		$post_cap    = (int) ( $plan === 'free' ? 50 : 0 ); // 0 means unlimited

		wp_send_json_success( array(
			'score'         => $score,
			'score_delta'   => $delta,
			'window_days'   => $window_days,
			'total_visits'  => $total_this,
			'visits_delta'  => $delta,
			'unique_bots'   => $distinct_bots,
			'posts_indexed' => $post_cap === 0 ? $posts_count : min( $posts_count, $post_cap ),
			'post_cap'      => $post_cap,
			'top_bots'      => $top_bots ?: array(),
			'recent'        => $recent ?: array(),
			'over_quota'    => $post_cap > 0 && $posts_count > $post_cap,
			'posts_total'   => $posts_count,
		) );
	}
}
