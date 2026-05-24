<?php
/**
 * Crawler controls — stats + filter + table per Quoted brand spec.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$meta      = Quoted_Bot_Detector::bot_metadata();
$allowlist = get_option( 'quoted_bot_allowlist', array() );
if ( ! is_array( $allowlist ) ) {
	$allowlist = array();
}

$bots = array();
foreach ( $meta as $key => $info ) {
	$state = isset( $allowlist[ $key ] ) ? $allowlist[ $key ] : 'allow';
	$bots[] = array(
		'key'      => $key,
		'name'     => $info[0],
		'operator' => isset( $info[1] ) ? $info[1] : '',
		'purpose'  => isset( $info[2] ) ? $info[2] : '',
		'allowed'  => $state !== 'block',
	);
}

$allowed_count = count( array_filter( $bots, function ( $b ) { return $b['allowed']; } ) );
$blocked_count = count( $bots ) - $allowed_count;

// Build robots.txt preview snippet for copy.
$robots_block = Quoted_Bot_Detector::robots_txt_block_rules();
if ( empty( $robots_block ) ) {
	$robots_block = "# No bots blocked. robots.txt has no Quoted-managed rules.";
}
?>
<div class="wrap quoted-page quoted-crawlers">
	<?php Quoted_Admin::render_subnav( 'quoted-crawlers' ); ?>

	<div class="q-page-body">
		<div class="q-page-inner">

			<div class="q-page-header">
				<div class="q-page-header__text">
					<h1><?php esc_html_e( 'AI crawler controls', 'quoted' ); ?></h1>
					<p class="lede"><?php esc_html_e( 'Decide which AI crawlers can access your content. Blocking is calm and reversible — not enforcement.', 'quoted' ); ?></p>
				</div>
			</div>

			<?php settings_errors( 'quoted' ); ?>

			<div class="q-alert q-alert--neutral">
				<div class="q-alert__body">
					<?php esc_html_e( 'Blocking a crawler may reduce how often that AI system can access your content. Use this only when you intentionally want to limit access.', 'quoted' ); ?>
				</div>
			</div>

			<div class="q-flex q-flex--between q-mt-4 q-mb-3" style="margin-top:18px;">
				<div class="q-flex q-gap-4" style="align-items:flex-end;">
					<div>
						<div class="q-stat__label"><?php esc_html_e( 'Allowed', 'quoted' ); ?></div>
						<div class="q-stat__row"><span class="q-stat__value"><?php echo (int) $allowed_count; ?></span></div>
					</div>
					<div>
						<div class="q-stat__label"><?php esc_html_e( 'Blocked', 'quoted' ); ?></div>
						<div class="q-stat__row"><span class="q-stat__value"><?php echo (int) $blocked_count; ?></span></div>
					</div>
				</div>
				<div class="q-flex q-gap-2">
					<div class="q-seg" data-target="#q-crawlers-table">
						<button type="button" class="q-seg__btn is-active" data-filter="all"><?php esc_html_e( 'All', 'quoted' ); ?></button>
						<button type="button" class="q-seg__btn" data-filter="allow"><?php esc_html_e( 'Allowed', 'quoted' ); ?></button>
						<button type="button" class="q-seg__btn" data-filter="block"><?php esc_html_e( 'Blocked', 'quoted' ); ?></button>
					</div>
					<button type="button" class="q-btn q-btn--secondary q-btn--sm" id="q-copy-robots">
						<?php Quoted_Admin::icon( 'download', 12 ); ?> <?php esc_html_e( 'Copy robots.txt', 'quoted' ); ?>
					</button>
				</div>
			</div>

			<form method="post" action="">
				<?php wp_nonce_field( 'quoted_crawlers_save' ); ?>
				<input type="hidden" name="quoted_crawlers_submit" value="1" />

				<div class="q-table" id="q-crawlers-table">
					<div class="q-table__head">
						<div><?php esc_html_e( 'Bot', 'quoted' ); ?></div>
						<div><?php esc_html_e( 'Operator', 'quoted' ); ?></div>
						<div><?php esc_html_e( 'Purpose', 'quoted' ); ?></div>
						<div><?php esc_html_e( 'Access', 'quoted' ); ?></div>
					</div>

					<?php foreach ( $bots as $b ) : ?>
						<div class="q-table__row" data-row-state="<?php echo $b['allowed'] ? 'allow' : 'block'; ?>">
							<div class="q-table__bot">
								<div class="q-table__avatar"><?php echo esc_html( mb_substr( $b['operator'] !== '' ? $b['operator'] : $b['name'], 0, 1 ) ); ?></div>
								<span class="q-table__name"><?php echo esc_html( $b['name'] ); ?></span>
							</div>
							<div class="q-table__op"><?php echo esc_html( $b['operator'] ); ?></div>
							<div class="q-table__purpose"><?php echo esc_html( $b['purpose'] ); ?></div>
							<div class="q-table__access">
								<span class="q-table__access-label"><?php echo $b['allowed'] ? esc_html__( 'Allow', 'quoted' ) : esc_html__( 'Block', 'quoted' ); ?></span>
								<label class="q-toggle">
									<input type="hidden" name="quoted_bot_allowlist[<?php echo esc_attr( $b['key'] ); ?>]" value="block" />
									<input type="checkbox" name="quoted_bot_allowlist[<?php echo esc_attr( $b['key'] ); ?>]" value="allow" <?php checked( $b['allowed'] ); ?> onchange="this.parentNode.previousElementSibling.textContent = this.checked ? 'Allow' : 'Block';" />
									<span class="q-toggle__slider"></span>
								</label>
							</div>
						</div>
					<?php endforeach; ?>
				</div>

				<p style="font-size:12.5px;color:var(--q-text-muted);margin-top:12px;">
					<?php
					printf(
						/* translators: 1: shown count, 2: total */
						esc_html__( 'Showing %1$d of %2$d known AI crawlers.', 'quoted' ),
						count( $bots ),
						count( $bots )
					);
					?>
					<a href="https://darkvisitors.com/agents" target="_blank" rel="noopener noreferrer" style="color:var(--q-primary);text-decoration:none;"><?php esc_html_e( 'See full list (60+)', 'quoted' ); ?></a>
				</p>

				<div class="q-mt-4">
					<button type="submit" class="q-btn q-btn--primary"><?php esc_html_e( 'Save changes', 'quoted' ); ?></button>
				</div>
			</form>

			<!-- Hidden robots.txt preview, used by Copy button -->
			<pre id="q-robots-preview" style="display:none;"><?php echo esc_html( $robots_block ); ?></pre>
		</div>
	</div>
</div>

<script>
(function(){
	var btn = document.getElementById('q-copy-robots');
	var preview = document.getElementById('q-robots-preview');
	if (!btn || !preview) return;
	btn.addEventListener('click', function(){
		var text = preview.textContent;
		var done = function(){
			var orig = btn.innerHTML;
			btn.innerHTML = '✓ Copied';
			setTimeout(function(){ btn.innerHTML = orig; }, 1400);
		};
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(done).catch(done);
		} else {
			var ta = document.createElement('textarea');
			ta.value = text; document.body.appendChild(ta);
			ta.select(); try { document.execCommand('copy'); } catch(e){}
			document.body.removeChild(ta); done();
		}
	});
})();
</script>
