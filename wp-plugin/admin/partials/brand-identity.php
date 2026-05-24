<?php
/**
 * Brand identity — color palette + logo variants showcase.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$logos_url = plugin_dir_url( QUOTED_PLUGIN_FILE ) . 'admin/images/';

$palette = array(
	array( 'name' => __( 'Primary',       'quoted' ), 'hex' => '#3b3fbf', 'token' => '--q-primary' ),
	array( 'name' => __( 'Primary hover', 'quoted' ), 'hex' => '#2f33a3', 'token' => '--q-primary-hover' ),
	array( 'name' => __( 'Primary soft',  'quoted' ), 'hex' => '#eef0fb', 'token' => '--q-primary-soft' ),
	array( 'name' => __( 'Primary ink',   'quoted' ), 'hex' => '#1b1e6b', 'token' => '--q-primary-ink' ),
	array( 'name' => __( 'Text',          'quoted' ), 'hex' => '#15151b', 'token' => '--q-text' ),
	array( 'name' => __( 'Text muted',    'quoted' ), 'hex' => '#5b6678', 'token' => '--q-text-muted' ),
	array( 'name' => __( 'Surface',       'quoted' ), 'hex' => '#ffffff', 'token' => '--q-surface' ),
	array( 'name' => __( 'Border',        'quoted' ), 'hex' => '#e4e7ec', 'token' => '--q-border' ),
	array( 'name' => __( 'Success',       'quoted' ), 'hex' => '#10b981', 'token' => '--q-success' ),
	array( 'name' => __( 'Warning',       'quoted' ), 'hex' => '#eab308', 'token' => '--q-warning' ),
	array( 'name' => __( 'Danger',        'quoted' ), 'hex' => '#dc2626', 'token' => '--q-danger' ),
);

$logo_files = array(
	'logo-mark.svg' => __( 'Primary mark (Q-quote)', 'quoted' ),
	'favicon.svg'   => __( 'Favicon variant',         'quoted' ),
);
?>
<div class="wrap quoted-page quoted-brand">
	<?php Quoted_Admin::render_subnav( 'quoted-brand' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Brand identity', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( "The official Quoted brand system — same palette, type, and logo files shipped to the marketing site and component kit.", 'quoted' ); ?></p>
				</div>
			</div>

			<div class="q-card" style="margin-bottom:16px;">
				<div class="q-section-title">
					<h2><?php esc_html_e( 'Logo', 'quoted' ); ?></h2>
					<p class="hint"><?php esc_html_e( 'SVG files bundled with the plugin. Use the primary mark inside Quoted UI, and the favicon variant for tab icons.', 'quoted' ); ?></p>
				</div>
				<div class="q-grid q-grid--2" style="margin-top:14px;gap:12px;">
					<?php foreach ( $logo_files as $file => $label ) : ?>
						<div style="display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--q-border);border-radius:var(--q-radius-md);background:#fff;">
							<div style="width:48px;height:48px;display:grid;place-items:center;background:#fafafb;border-radius:6px;">
								<img src="<?php echo esc_url( $logos_url . $file ); ?>" alt="" width="32" height="32" />
							</div>
							<div style="flex:1;">
								<div style="font-size:13px;font-weight:500;color:var(--q-text);"><?php echo esc_html( $label ); ?></div>
								<div style="font-size:11.5px;color:var(--q-text-muted);font-family:ui-monospace,Menlo,monospace;margin-top:2px;">admin/images/<?php echo esc_html( $file ); ?></div>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="q-card" style="margin-bottom:16px;">
				<div class="q-section-title">
					<h2><?php esc_html_e( 'Color palette', 'quoted' ); ?></h2>
					<p class="hint"><?php esc_html_e( 'CSS custom properties scoped to .quoted-page. Use these tokens, not raw hex, when extending the admin UI.', 'quoted' ); ?></p>
				</div>
				<div class="q-swatches" style="margin-top:14px;">
					<?php foreach ( $palette as $c ) : ?>
						<div class="q-swatch">
							<div class="q-swatch__color" style="background: <?php echo esc_attr( $c['hex'] ); ?>; <?php echo $c['hex'] === '#ffffff' ? 'border-bottom: 1px solid var(--q-border);' : ''; ?>"></div>
							<div class="q-swatch__meta">
								<div class="q-swatch__name"><?php echo esc_html( $c['name'] ); ?></div>
								<div class="q-swatch__hex"><?php echo esc_html( $c['hex'] ); ?> · <?php echo esc_html( $c['token'] ); ?></div>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="q-card" style="margin-bottom:16px;">
				<div class="q-section-title">
					<h2><?php esc_html_e( 'Typography', 'quoted' ); ?></h2>
					<p class="hint"><?php esc_html_e( 'System sans fallback chain — no webfont request from the admin UI for speed and privacy.', 'quoted' ); ?></p>
				</div>
				<div style="margin-top:14px;display:flex;flex-direction:column;gap:14px;">
					<div style="padding:18px;border:1px solid var(--q-border);border-radius:var(--q-radius-md);background:#fff;">
						<div class="q-stat__label"><?php esc_html_e( 'Display', 'quoted' ); ?></div>
						<div style="font-size:36px;font-weight:600;letter-spacing:-0.022em;color:var(--q-text);margin-top:4px;">AI-readable WordPress</div>
					</div>
					<div style="padding:18px;border:1px solid var(--q-border);border-radius:var(--q-radius-md);background:#fff;">
						<div class="q-stat__label"><?php esc_html_e( 'Heading', 'quoted' ); ?></div>
						<div style="font-size:22px;font-weight:600;letter-spacing:-0.018em;color:var(--q-text);margin-top:4px;">Dashboard</div>
					</div>
					<div style="padding:18px;border:1px solid var(--q-border);border-radius:var(--q-radius-md);background:#fff;">
						<div class="q-stat__label"><?php esc_html_e( 'Body', 'quoted' ); ?></div>
						<div style="font-size:13.5px;color:var(--q-text);margin-top:4px;line-height:1.55;">
							A quick read on how AI crawlers are seeing your site. All data lives locally on this WordPress install.
						</div>
					</div>
					<div style="padding:18px;border:1px solid var(--q-border);border-radius:var(--q-radius-md);background:#fff;">
						<div class="q-stat__label"><?php esc_html_e( 'Monospace', 'quoted' ); ?></div>
						<div style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:var(--q-text);margin-top:4px;">/wp-json/quoted/v1/llm/example-post</div>
					</div>
				</div>
			</div>

			<div class="q-card">
				<div class="q-section-title">
					<h2><?php esc_html_e( 'Component samples', 'quoted' ); ?></h2>
					<p class="hint"><?php esc_html_e( 'Reusable PHP component classes — same primitives used across the admin.', 'quoted' ); ?></p>
				</div>
				<div style="margin-top:14px;display:flex;flex-direction:column;gap:18px;">

					<div class="q-flex q-gap-2" style="flex-wrap:wrap;">
						<span class="q-btn q-btn--primary">Primary</span>
						<span class="q-btn q-btn--secondary">Secondary</span>
						<span class="q-btn q-btn--ghost">Ghost</span>
						<span class="q-btn q-btn--soft">Soft</span>
						<span class="q-btn q-btn--danger">Danger</span>
					</div>

					<div class="q-flex q-gap-2" style="flex-wrap:wrap;">
						<span class="q-badge q-badge--success"><span class="q-badge__dot"></span>Active</span>
						<span class="q-badge q-badge--info"><span class="q-badge__dot"></span>Auto · safe</span>
						<span class="q-badge q-badge--warning"><span class="q-badge__dot"></span>Article deferred</span>
						<span class="q-badge q-badge--danger"><span class="q-badge__dot"></span>Blocked</span>
						<span class="q-badge q-badge--neutral"><span class="q-badge__dot"></span>Open to AI</span>
						<span class="q-badge q-badge--muted">v0.4.0</span>
					</div>

					<div class="q-alert q-alert--info">
						<div class="q-alert__body">Info alert — neutral information with brand-color left border.</div>
					</div>
					<div class="q-alert q-alert--success">
						<div class="q-alert__body">Success alert — confirmation of a safe state.</div>
					</div>

				</div>
			</div>

		</div>
	</div>
</div>
