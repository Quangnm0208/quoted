/**
 * Quoted Billing — checkout & subscription management UI.
 */
(function ($) {
	'use strict';

	$(document).ready(function () {
		if (!$('.quoted-billing').length) return;

		// Upgrade button click → create checkout → redirect to LS
		$('.quoted-upgrade-btn').on('click', function () {
			var $btn = $(this);
			var tier = $btn.data('tier');

			if (!tier) return;

			$btn.prop('disabled', true);
			var originalText = $btn.text();
			$btn.text('Creating checkout...');

			$.post(QuotedAdmin.ajax_url, {
				action: 'quoted_create_checkout',
				nonce: QuotedAdmin.nonce,
				tier: tier
			}).done(function (resp) {
				if (resp.success && resp.data && resp.data.checkout_url) {
					// Redirect to Lemon Squeezy hosted checkout
					window.location.href = resp.data.checkout_url;
				} else {
					var msg = (resp.data && resp.data.message) || 'Failed to create checkout. Try again.';
					alert(msg);
					$btn.prop('disabled', false).text(originalText);
				}
			}).fail(function (xhr) {
				var msg = 'Failed to create checkout.';
				if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
					msg = xhr.responseJSON.data.message;
				}
				alert(msg);
				$btn.prop('disabled', false).text(originalText);
			});
		});

		// Manage subscription button → fetch portal URL → open in new tab
		$('#quoted-open-portal-btn').on('click', function () {
			var $btn = $(this);
			$btn.prop('disabled', true);

			$.post(QuotedAdmin.ajax_url, {
				action: 'quoted_get_customer_portal',
				nonce: QuotedAdmin.nonce
			}).done(function (resp) {
				if (resp.success && resp.data && resp.data.portal_url) {
					window.open(resp.data.portal_url, '_blank', 'noopener');
				} else {
					alert('Could not open customer portal. Try refreshing.');
				}
				$btn.prop('disabled', false);
			}).fail(function () {
				alert('Could not open customer portal. Try refreshing.');
				$btn.prop('disabled', false);
			});
		});
	});
})(jQuery);
