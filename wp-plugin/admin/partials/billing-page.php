<?php
/**
 * Plans & billing — Free / Solo / Agency tiers per Quoted brand spec.
 * Direct Lemon Squeezy hosted checkout URLs (no AJAX).
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$current_plan = Quoted_License::current_plan();
$license      = new Quoted_License();
$is_connected = $license->is_connected();

$cycle = isset( $_GET['cycle'] ) && $_GET['cycle'] === 'monthly' ? 'monthly' : 'yearly';

$solo_url     = Quoted_Billing::buy_url( 'solo' );
$pro_plus_url = Quoted_Billing::buy_url( 'pro_plus' );
$portal_url   = Quoted_Billing::customer_portal_url();
$configured   = Quoted_Billing::is_configured();

$plans = array(
	array(
		'key'      => 'free',
		'name'     => __( 'Free', 'quoted' ),
		'tagline'  => __( 'For starting sites.', 'quoted' ),
		'monthly'  => 0,
		'yearly'   => 0,
		'features' => array(
			__( 'AI bot tracking',                    'quoted' ),
			__( 'llms.txt up to 50 posts',            'quoted' ),
			__( 'Markdown endpoints',                 'quoted' ),
			__( 'Basic Article + FAQ schema',         'quoted' ),
			__( 'AI crawler controls',                'quoted' ),
			__( '7 days local bot history',           'quoted' ),
		),
		'cta'      => __( 'Current plan', 'quoted' ),
		'highlight'=> false,
		'is_current' => $current_plan === 'free',
		'url'      => null,
	),
	array(
		'key'      => 'solo',
		'name'     => __( 'Solo', 'quoted' ),
		'tagline'  => __( 'For one site you care about.', 'quoted' ),
		'monthly'  => 12,
		'yearly'   => 9,
		'features' => array(
			__( 'Everything in Free',                 'quoted' ),
			__( 'Unlimited posts in llms.txt',        'quoted' ),
			__( '30 days local bot history',          'quoted' ),
			__( 'Citation testing (Pro feature)',     'quoted' ),
			__( 'Live AI test (Pro feature)',         'quoted' ),
			__( 'BYO API key',                        'quoted' ),
			__( 'Remove footer badge',                'quoted' ),
			__( 'Up to 5 sites',                      'quoted' ),
		),
		'cta'      => __( 'Upgrade to Solo', 'quoted' ),
		'highlight'=> true,
		'is_current' => $current_plan === 'solo',
		'url'      => $solo_url,
	),
	array(
		'key'      => 'pro_plus',
		'name'     => __( 'Agency', 'quoted' ),
		'tagline'  => __( 'For teams managing many sites.', 'quoted' ),
		'monthly'  => 39,
		'yearly'   => 29,
		'features' => array(
			__( 'Everything in Solo',                 'quoted' ),
			__( 'Multi-site usage',                   'quoted' ),
			__( 'Client reports',                     'quoted' ),
			__( 'CSV export',                         'quoted' ),
			__( '90 days local bot history',          'quoted' ),
			__( 'Priority support',                   'quoted' ),
			__( 'Agency dashboard (coming)',          'quoted' ),
		),
		'cta'      => __( 'Upgrade to Agency', 'quoted' ),
		'highlight'=> false,
		'is_current' => $current_plan === 'pro_plus',
		'url'      => $pro_plus_url,
	),
);
?>
<div class="wrap quoted-page quoted-billing-page">
	<?php Quoted_Admin::render_subnav( 'quoted-billing' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'Plans & billing', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( 'Quoted is free to install. Pro plans unlock unlimited content, longer history, and future citation testing.', 'quoted' ); ?></p>
				</div>
				<div class="q-page-header__actions">
					<div class="q-seg">
						<a href="<?php echo esc_url( add_query_arg( 'cycle', 'monthly', admin_url( 'admin.php?page=quoted-billing' ) ) ); ?>" class="q-seg__btn <?php echo $cycle === 'monthly' ? 'is-active' : ''; ?>" style="text-decoration:none;"><?php esc_html_e( 'Monthly', 'quoted' ); ?></a>
						<a href="<?php echo esc_url( add_query_arg( 'cycle', 'yearly', admin_url( 'admin.php?page=quoted-billing' ) ) ); ?>" class="q-seg__btn <?php echo $cycle === 'yearly' ? 'is-active' : ''; ?>" style="text-decoration:none;"><?php esc_html_e( 'Yearly · save 25%', 'quoted' ); ?></a>
					</div>
				</div>
			</div>

			<?php settings_errors( 'quoted' ); ?>

			<?php if ( ! $configured ) : ?>
				<div class="q-alert q-alert--warning">
					<div class="q-alert__body">
						<strong class="q-alert__title"><?php esc_html_e( 'Plugin not yet configured for paid plans.', 'quoted' ); ?></strong>
						<?php esc_html_e( 'The Lemon Squeezy store and variant IDs in quoted.php still hold placeholder values. Buy buttons are disabled until those constants are updated.', 'quoted' ); ?>
					</div>
				</div>
			<?php endif; ?>

			<!-- License activate / deactivate form (only when configured) -->
			<?php if ( $configured ) : ?>
				<div class="q-card" style="margin-bottom:16px;">
					<div class="q-section-title">
						<h2><?php esc_html_e( 'License', 'quoted' ); ?></h2>
						<p class="hint">
							<?php
							if ( $is_connected ) {
								printf(
									/* translators: %s: plan name */
									esc_html__( 'Current plan: %s. Manage seats and billing in the Lemon Squeezy portal.', 'quoted' ),
									'<strong>' . esc_html( ucfirst( str_replace( '_', ' ', $current_plan ) ) ) . '</strong>'
								);
							} else {
								esc_html_e( 'Paste a license key from your Lemon Squeezy purchase email.', 'quoted' );
							}
							?>
						</p>
					</div>
					<form method="post" action="" style="display:flex;gap:8px;align-items:center;margin-top:10px;">
						<?php wp_nonce_field( 'quoted_license_action' ); ?>
						<?php if ( $is_connected ) : ?>
							<a href="<?php echo esc_url( $portal_url ); ?>" target="_blank" rel="noopener noreferrer" class="q-btn q-btn--secondary"><?php esc_html_e( 'Open customer portal', 'quoted' ); ?></a>
							<button type="submit" name="quoted_license_deactivate" class="q-btn q-btn--ghost"><?php esc_html_e( 'Deactivate license', 'quoted' ); ?></button>
						<?php else : ?>
							<input type="text" name="quoted_license_key" class="q-input q-input--mono" placeholder="qtd_live_..." style="max-width:340px;" required />
							<button type="submit" name="quoted_license_activate" class="q-btn q-btn--primary"><?php esc_html_e( 'Activate', 'quoted' ); ?></button>
						<?php endif; ?>
					</form>
				</div>
			<?php endif; ?>

			<div class="q-grid q-grid--3">
				<?php foreach ( $plans as $p ) : ?>
					<div class="q-plan-card <?php echo $p['highlight'] ? 'is-highlight' : ''; ?>">
						<?php if ( $p['highlight'] ) : ?>
							<div class="q-plan-card__pop"><?php esc_html_e( 'Most popular', 'quoted' ); ?></div>
						<?php endif; ?>

						<div class="q-plan-card__name"><?php echo esc_html( $p['name'] ); ?></div>
						<div class="q-plan-card__tagline"><?php echo esc_html( $p['tagline'] ); ?></div>

						<div class="q-plan-card__price">
							<span class="num">$<?php echo (int) $p[ $cycle ]; ?></span>
							<span class="unit"><?php echo $p['monthly'] === 0 ? esc_html__( 'forever', 'quoted' ) : esc_html__( '/ site / mo', 'quoted' ); ?></span>
						</div>

						<?php
						$disabled = $p['is_current'] || ( $p['key'] !== 'free' && empty( $p['url'] ) );
						$btn_class = $p['highlight'] ? 'q-btn--primary' : 'q-btn--secondary';
						$btn_label = $p['is_current'] ? __( 'Current plan', 'quoted' ) : $p['cta'];
						if ( ! $disabled && $p['url'] ) :
						?>
							<a href="<?php echo esc_url( $p['url'] ); ?>" target="_blank" rel="noopener noreferrer" class="q-btn <?php echo esc_attr( $btn_class ); ?> q-btn--full">
								<?php echo esc_html( $btn_label ); ?>
							</a>
						<?php else : ?>
							<span class="q-btn <?php echo esc_attr( $btn_class ); ?> q-btn--full is-disabled">
								<?php echo esc_html( $disabled && $p['key'] !== 'free' && ! $p['is_current'] ? __( 'Not configured', 'quoted' ) : $btn_label ); ?>
							</span>
						<?php endif; ?>

						<ul class="q-plan-card__features">
							<?php foreach ( $p['features'] as $f ) : ?>
								<li><?php Quoted_Admin::icon( 'check', 14 ); ?><span><?php echo esc_html( $f ); ?></span></li>
							<?php endforeach; ?>
						</ul>
					</div>
				<?php endforeach; ?>
			</div>

			<div class="q-mt-4">
				<div class="q-alert q-alert--neutral">
					<div class="q-alert__icon"><?php Quoted_Admin::icon( 'lock', 15 ); ?></div>
					<div class="q-alert__body">
						<?php
						echo wp_kses(
							__( 'Billing is handled by <strong>Lemon Squeezy</strong>. Citation testing and Live AI test will use <strong>your own API keys</strong> — Quoted does not proxy your queries.', 'quoted' ),
							array( 'strong' => array() )
						);
						?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
