<?php
/**
 * Setup — 4-step optional wizard per Quoted brand spec.
 * Welcome → Generate llms.txt → Markdown endpoints → Done.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$current_step = isset( $_GET['step'] ) ? max( 0, min( 3, (int) $_GET['step'] ) ) : 0;
$steps        = array(
	__( 'Welcome',             'quoted' ),
	__( 'Generate llms.txt',   'quoted' ),
	__( 'Markdown endpoints',  'quoted' ),
	__( 'Done',                'quoted' ),
);

// Handle "Generate now" action (step 1 -> 2 transition).
if ( isset( $_GET['regen'] ) && check_admin_referer( 'quoted_setup_regen' ) ) {
	Quoted_Llms_Txt::flush_cache();
	$llms = new Quoted_Llms_Txt();
	$llms->get_content(); // warms cache
}

$post_count = (int) wp_count_posts( 'post' )->publish;
$page_count = (int) wp_count_posts( 'page' )->publish;
$cap        = Quoted_Llms_Txt::effective_cap();
?>
<div class="wrap quoted-page quoted-onboarding">
	<?php Quoted_Admin::render_subnav( 'quoted-setup' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner" style="max-width:760px;margin:0 auto;">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Set up Quoted', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( 'A 4-step setup so AI tools can read your site cleanly.', 'quoted' ); ?></p>
				</div>
			</div>

			<!-- Step rail -->
			<div class="q-steps">
				<?php foreach ( $steps as $i => $label ) : ?>
					<?php
					$cls = '';
					if ( $i < $current_step )      { $cls = 'is-done'; }
					elseif ( $i === $current_step ) { $cls = 'is-current'; }
					$href = esc_url( add_query_arg( 'step', $i, admin_url( 'admin.php?page=quoted-setup' ) ) );
					?>
					<a class="q-steps__step <?php echo esc_attr( $cls ); ?>" href="<?php echo $i <= $current_step ? $href : '#'; ?>" style="text-decoration:none;">
						<span class="q-steps__num">
							<?php if ( $i < $current_step ) : Quoted_Admin::icon( 'check', 12 ); else : echo $i + 1; endif; ?>
						</span>
						<span class="q-steps__label"><?php echo esc_html( $label ); ?></span>
					</a>
					<?php if ( $i < count( $steps ) - 1 ) : ?>
						<span class="q-steps__connector"></span>
					<?php endif; ?>
				<?php endforeach; ?>
			</div>

			<div class="q-card" style="padding:32px;">

				<?php if ( $current_step === 0 ) : ?>
					<div class="q-welcome-icon">&ldquo;</div>
					<h2 style="font-size:22px;font-weight:600;letter-spacing:-0.018em;color:var(--q-text);margin:0;">
						<?php esc_html_e( 'Make your WordPress content easier for AI to read.', 'quoted' ); ?>
					</h2>
					<p style="font-size:14px;color:var(--q-text-muted);line-height:1.55;margin-top:10px;margin-bottom:0;">
						<?php
						echo wp_kses(
							__( 'Quoted generates <code>llms.txt</code>, exposes clean Markdown versions of your posts, and tracks AI crawler visits — all locally on this WordPress install.', 'quoted' ),
							array( 'code' => array() )
						);
						?>
					</p>
					<ul class="q-welcome-bullets">
						<li><?php Quoted_Admin::icon( 'check', 16 ); ?><?php esc_html_e( 'Generate an llms.txt index of your content', 'quoted' ); ?></li>
						<li><?php Quoted_Admin::icon( 'check', 16 ); ?><?php esc_html_e( 'Enable clean Markdown URLs for AI tools', 'quoted' ); ?></li>
						<li><?php Quoted_Admin::icon( 'check', 16 ); ?><?php esc_html_e( 'Track which AI crawlers visit your site', 'quoted' ); ?></li>
					</ul>
					<a href="<?php echo esc_url( add_query_arg( 'step', 1, admin_url( 'admin.php?page=quoted-setup' ) ) ); ?>" class="q-btn q-btn--primary q-btn--lg">
						<?php esc_html_e( 'Start setup', 'quoted' ); ?> <?php Quoted_Admin::icon( 'arrowRight', 14 ); ?>
					</a>

				<?php elseif ( $current_step === 1 ) : ?>
					<div class="q-section-title">
						<h2><?php esc_html_e( 'Generate llms.txt', 'quoted' ); ?></h2>
						<p class="hint"><?php esc_html_e( 'A simple guide that AI tools use to find your most important pages.', 'quoted' ); ?></p>
					</div>
					<div class="q-grid q-grid--3 q-mt-4 q-mb-3">
						<div class="q-card" style="padding:12px;">
							<div class="q-stat__label"><?php esc_html_e( 'Site', 'quoted' ); ?></div>
							<div style="font-size:18px;font-weight:600;color:var(--q-text);margin-top:4px;letter-spacing:-0.01em;"><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></div>
						</div>
						<div class="q-card" style="padding:12px;">
							<div class="q-stat__label"><?php esc_html_e( 'Posts found', 'quoted' ); ?></div>
							<div style="font-size:18px;font-weight:600;color:var(--q-text);margin-top:4px;letter-spacing:-0.01em;"><?php echo (int) $post_count; ?></div>
						</div>
						<div class="q-card" style="padding:12px;">
							<div class="q-stat__label"><?php esc_html_e( 'Pages found', 'quoted' ); ?></div>
							<div style="font-size:18px;font-weight:600;color:var(--q-text);margin-top:4px;letter-spacing:-0.01em;"><?php echo (int) $page_count; ?></div>
						</div>
					</div>
					<?php if ( $cap > 0 && $post_count > $cap ) : ?>
						<div class="q-alert q-alert--neutral">
							<div class="q-alert__body">
								<strong class="q-alert__title"><?php esc_html_e( 'Free plan: 50 posts', 'quoted' ); ?></strong>
								<?php
								printf(
									/* translators: %d: post count */
									esc_html__( 'The Free plan includes your 50 most recent posts. Upgrade to include your full archive (%d posts).', 'quoted' ),
									(int) $post_count
								);
								?>
							</div>
						</div>
					<?php endif; ?>
					<div class="q-mt-4 q-flex q-gap-2">
						<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( array( 'step' => 2, 'regen' => 1 ), admin_url( 'admin.php?page=quoted-setup' ) ), 'quoted_setup_regen' ) ); ?>" class="q-btn q-btn--primary q-btn--lg">
							<?php esc_html_e( 'Generate llms.txt', 'quoted' ); ?>
						</a>
						<a href="<?php echo esc_url( add_query_arg( 'step', 2, admin_url( 'admin.php?page=quoted-setup' ) ) ); ?>" class="q-btn q-btn--ghost q-btn--lg">
							<?php esc_html_e( 'Skip', 'quoted' ); ?>
						</a>
					</div>

				<?php elseif ( $current_step === 2 ) : ?>
					<div class="q-section-title">
						<h2><?php esc_html_e( 'Enable Markdown endpoints', 'quoted' ); ?></h2>
						<p class="hint"><?php esc_html_e( 'Clean text versions of your posts without menus, ads, or layout noise.', 'quoted' ); ?></p>
					</div>
					<div class="q-mt-4" style="padding:14px;border-radius:7px;background:#fafafb;border:1px solid var(--q-border);">
						<div style="font-size:11.5px;color:var(--q-text-muted);margin-bottom:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;"><?php esc_html_e( 'Example URL', 'quoted' ); ?></div>
						<div class="q-copy">
							<span class="q-copy__value"><?php echo esc_html( home_url( '/wp-json/quoted/v1/llm/example-post' ) ); ?></span>
							<button type="button" class="q-copy__btn">Copy</button>
						</div>
					</div>
					<p style="font-size:13px;color:var(--q-text-muted);line-height:1.55;margin-top:18px;">
						<?php esc_html_e( 'AI tools can fetch this URL to read your post without the theme, navigation, or scripts. Markdown endpoints are enabled by default — no action needed.', 'quoted' ); ?>
					</p>
					<div class="q-mt-4 q-flex q-gap-2">
						<a href="<?php echo esc_url( add_query_arg( 'step', 3, admin_url( 'admin.php?page=quoted-setup' ) ) ); ?>" class="q-btn q-btn--primary q-btn--lg">
							<?php esc_html_e( 'Continue', 'quoted' ); ?>
						</a>
					</div>

				<?php else : // step 3 - Done ?>
					<div style="width:56px;height:56px;border-radius:999px;background:var(--q-success-bg);color:var(--q-success);display:grid;place-items:center;margin-bottom:18px;">
						<?php Quoted_Admin::icon( 'check', 28 ); ?>
					</div>
					<h2 style="font-size:22px;font-weight:600;letter-spacing:-0.018em;color:var(--q-text);margin:0;">
						<?php esc_html_e( "You're set up.", 'quoted' ); ?>
					</h2>
					<p style="font-size:14px;color:var(--q-text-muted);line-height:1.55;margin-top:8px;margin-bottom:22px;">
						<?php esc_html_e( 'Quoted is now exposing AI-readable signals from your site. Activity will appear on the dashboard within an hour.', 'quoted' ); ?>
					</p>
					<div class="q-grid" style="gap:8px;margin-bottom:22px;">
						<a href="<?php echo esc_url( home_url( '/llms.txt' ) ); ?>" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--q-border);border-radius:6px;background:#fff;text-decoration:none;color:inherit;">
							<div style="width:30px;height:30px;border-radius:6px;background:var(--q-primary-soft);color:var(--q-primary);display:grid;place-items:center;flex-shrink:0;"><?php Quoted_Admin::icon( 'file', 15 ); ?></div>
							<div style="flex:1;">
								<div style="font-size:13px;font-weight:500;color:var(--q-text);"><?php esc_html_e( 'View your llms.txt', 'quoted' ); ?></div>
								<div style="font-size:12px;color:var(--q-text-muted);margin-top:1px;font-family:ui-monospace,Menlo,monospace;"><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) . '/llms.txt' ); ?></div>
							</div>
							<?php Quoted_Admin::icon( 'external', 14 ); ?>
						</a>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted-llmstxt' ) ); ?>" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--q-border);border-radius:6px;background:#fff;text-decoration:none;color:inherit;">
							<div style="width:30px;height:30px;border-radius:6px;background:var(--q-primary-soft);color:var(--q-primary);display:grid;place-items:center;flex-shrink:0;"><?php Quoted_Admin::icon( 'code', 15 ); ?></div>
							<div style="flex:1;">
								<div style="font-size:13px;font-weight:500;color:var(--q-text);"><?php esc_html_e( 'Try a Markdown endpoint', 'quoted' ); ?></div>
								<div style="font-size:12px;color:var(--q-text-muted);margin-top:1px;font-family:ui-monospace,Menlo,monospace;">/wp-json/quoted/v1/llm/{slug}</div>
							</div>
							<?php Quoted_Admin::icon( 'chevronRight', 14 ); ?>
						</a>
						<a href="https://quotedeasy.com/docs" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--q-border);border-radius:6px;background:#fff;text-decoration:none;color:inherit;">
							<div style="width:30px;height:30px;border-radius:6px;background:var(--q-primary-soft);color:var(--q-primary);display:grid;place-items:center;flex-shrink:0;"><?php Quoted_Admin::icon( 'book', 15 ); ?></div>
							<div style="flex:1;">
								<div style="font-size:13px;font-weight:500;color:var(--q-text);"><?php esc_html_e( 'Read the docs', 'quoted' ); ?></div>
								<div style="font-size:12px;color:var(--q-text-muted);margin-top:1px;"><?php esc_html_e( 'Setup tips, FAQs, troubleshooting', 'quoted' ); ?></div>
							</div>
							<?php Quoted_Admin::icon( 'external', 14 ); ?>
						</a>
					</div>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=quoted' ) ); ?>" class="q-btn q-btn--primary q-btn--lg">
						<?php esc_html_e( 'Go to dashboard', 'quoted' ); ?> <?php Quoted_Admin::icon( 'arrowRight', 14 ); ?>
					</a>
				<?php endif; ?>

			</div>
		</div>
	</div>
</div>
