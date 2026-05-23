/**
 * Quoted Admin — onboarding state machine + dashboard renderer.
 *
 * Vanilla JS + jQuery (WP admin convention). No build step.
 */
(function ($) {
	'use strict';

	$(document).ready(function () {

		// ─── Onboarding flow ─────────────────────────────────────────────

		var $onboarding = $('.quoted-onboarding');
		if ($onboarding.length) {
			initOnboarding();
		}

		var $dashboard = $('.quoted-dashboard');
		if ($dashboard.length) {
			initDashboard();
		}

		var $settings = $('.quoted-settings');
		if ($settings.length) {
			initSettings();
		}

		function initOnboarding() {

			// Step 1: Activate license (or skip)
			$('#quoted-skip-license').on('click', function (e) {
				e.preventDefault();
				goToStep(2);
			});

			$('#quoted-connect-form').on('submit', function (e) {
				e.preventDefault();
				var licenseKey = $('#quoted-license-key').val().trim();
				var $status = $('#quoted-connect-status');
				var $btn = $('#quoted-connect-btn');

				if (!licenseKey) {
					$status.addClass('error').text('License key is required.');
					return;
				}

				$btn.prop('disabled', true);
				$status.removeClass('error').text(QuotedAdmin.i18n.connecting);

				$.post(QuotedAdmin.ajax_url, {
					action: 'quoted_connect_backend',
					nonce: QuotedAdmin.nonce,
					license_key: licenseKey
				}).done(function (resp) {
					if (resp.success) {
						$status.text(QuotedAdmin.i18n.success);
						goToStep(2);
					} else {
						var msg = (resp.data && resp.data.message) || QuotedAdmin.i18n.error_generic;
						$status.addClass('error').text(msg);
						$btn.prop('disabled', false);
					}
				}).fail(function (xhr) {
					var msg = QuotedAdmin.i18n.error_generic;
					if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
						msg = xhr.responseJSON.data.message;
					}
					$status.addClass('error').text(msg);
					$btn.prop('disabled', false);
				});
			});

			// Step 2: Niche
			$('#quoted-niche-form').on('submit', function (e) {
				e.preventDefault();
				var niche = $('#quoted-niche').val();
				var $status = $('#quoted-niche-status');
				var $btn = $('#quoted-niche-btn');

				if (!niche) {
					$status.addClass('error').text('Please select a niche.');
					return;
				}

				$btn.prop('disabled', true);

				$.post(QuotedAdmin.ajax_url, {
					action: 'quoted_save_niche',
					nonce: QuotedAdmin.nonce,
					niche: niche
				}).done(function (resp) {
					if (resp.success) {
						goToStep(3);
					} else {
						$status.addClass('error').text(QuotedAdmin.i18n.error_generic);
						$btn.prop('disabled', false);
					}
				}).fail(function () {
					$status.addClass('error').text(QuotedAdmin.i18n.error_generic);
					$btn.prop('disabled', false);
				});
			});

			// Step 3: Auto-scan
			$('#quoted-scan-btn').on('click', function () {
				var $btn = $(this);
				var $result = $('#quoted-scan-result');

				$btn.prop('disabled', true).text(QuotedAdmin.i18n.syncing);
				$result.hide().empty();

				$.post(QuotedAdmin.ajax_url, {
					action: 'quoted_sync_posts',
					nonce: QuotedAdmin.nonce
				}).done(function (resp) {
					if (resp.success) {
						var synced = (resp.data && resp.data.synced) || 0;
						$result.html(
							'<p><strong>✓ Synced ' + synced + ' posts.</strong></p>' +
							'<p>Your AI sitemap is now live at <code>' + QuotedAdmin.site_url + '/llms.txt</code></p>'
						).show();
						setTimeout(function () { goToStep(4); }, 1500);
					} else {
						$result.html('<p style="color:#d63638">Sync failed. Try again or check Settings.</p>').show();
						$btn.prop('disabled', false).text('Auto-scan now');
					}
				}).fail(function () {
					$result.html('<p style="color:#d63638">Sync failed. Try again or check Settings.</p>').show();
					$btn.prop('disabled', false).text('Auto-scan now');
				});
			});

			// Step 4: Live AI Test (Phase 0 stub)
			$('#quoted-test-btn').on('click', function () {
				var $btn = $(this);
				var $result = $('#quoted-test-result');

				$btn.prop('disabled', true);
				$result.show();

				// Auto-advance after showing the placeholder
				setTimeout(function () { goToStep(5); }, 2500);
			});

			function goToStep(stepNum) {
				$('.quoted-step').removeClass('active').hide();
				$('.quoted-step-' + stepNum).addClass('active').show();

				$('.quoted-progress li').each(function (i) {
					var stepIdx = i + 1;
					var $li = $(this);
					$li.removeClass('active done');
					if (stepIdx < stepNum) $li.addClass('done');
					if (stepIdx === stepNum) $li.addClass('active');
				});

				// Scroll to top so the user actually sees the new step.
				$('html, body').animate({ scrollTop: $('.quoted-onboarding').offset().top - 50 }, 200);
			}
		}

		// ─── Dashboard ───────────────────────────────────────────────────

		function initDashboard() {
			loadDashboard();
			// Refresh every 60s for "alive" feeling.
			setInterval(loadDashboard, 60000);
		}

		function loadDashboard() {
			$.post(QuotedAdmin.ajax_url, {
				action: 'quoted_dashboard_data',
				nonce: QuotedAdmin.nonce
			}).done(function (resp) {
				if (resp.success && resp.data) {
					renderDashboard(resp.data);
				} else {
					renderDashboardError();
				}
			}).fail(function (xhr) {
				renderDashboardError(xhr.responseJSON && xhr.responseJSON.data);
			});
		}

		function renderDashboard(d) {
			// AI Distribution Score
			var score = d.ai_distribution_score || 0;
			$('#quoted-score-number').text(score);
			drawScoreGauge(score);

			// Delta
			var delta = d.score_delta_7d || 0;
			var $delta = $('#quoted-score-delta');
			$delta.removeClass('positive negative');
			if (delta > 0) {
				$delta.addClass('positive').text('▲ +' + delta + ' vs last week');
			} else if (delta < 0) {
				$delta.addClass('negative').text('▼ ' + delta + ' vs last week');
			} else {
				$delta.text('No change vs last week');
			}

			// Next action
			if (d.next_action) {
				var actionUrl = safeUrl(d.next_action.action_url);
				$('#quoted-next-action').html(
					'<div class="quoted-next-action-item">' +
						'<h3>' + escapeHtml(d.next_action.title) + '</h3>' +
						'<p>' + escapeHtml(d.next_action.description) + '</p>' +
						(actionUrl ?
							'<a href="' + escapeHtml(actionUrl) + '" class="button button-primary">Take action</a>'
							: '') +
					'</div>'
				);
			} else {
				$('#quoted-next-action').html('<p class="quoted-empty">All clear. Check back tomorrow.</p>');
			}

			// Bot activity
			var activity = d.bot_activity || {};
			var recent = activity.recent_crawls || [];
			if (recent.length > 0) {
				var html = '';
				for (var i = 0; i < Math.min(recent.length, 8); i++) {
					var ev = recent[i];
					html += '<div class="quoted-bot-event">' +
						'<span class="bot-name">' + escapeHtml(ev.bot_name) + '</span>' +
						'<span class="bot-url" title="' + escapeHtml(ev.url_path) + '">' + escapeHtml(ev.url_path) + '</span>' +
						'<span class="bot-time">' + escapeHtml(ev.human_time || ev.crawled_at) + '</span>' +
						'</div>';
				}
				$('#quoted-bot-feed').html(html);
			} else {
				$('#quoted-bot-feed').html(
					'<div class="quoted-empty">' +
						'<p>No AI bot visits yet.</p>' +
						'<p>This is normal in the first 24 hours. ClaudeBot and GPTBot usually find new llms.txt files within a day.</p>' +
					'</div>'
				);
			}

			// Top bots
			var topBots = activity.top_bots || [];
			if (topBots.length > 0) {
				var maxCount = topBots[0].count;
				var html = '';
				for (var i = 0; i < topBots.length; i++) {
					var b = topBots[i];
					var pct = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
					html += '<div class="quoted-top-bot-row">' +
						'<span>' + escapeHtml(b.bot_name) + '</span>' +
						'<span class="bar"><span class="bar-fill" style="width: ' + pct + '%"></span></span>' +
						'<span>' + b.count + '</span>' +
						'</div>';
				}
				$('#quoted-top-bots').html(html);
			} else {
				$('#quoted-top-bots').html('<p class="quoted-empty">No data yet.</p>');
			}

			// Quota
			var posts = d.posts || {};
			var pct = (posts.quota > 0) ? Math.round((posts.synced / posts.quota) * 100) : 0;
			var fillClass = pct >= 90 ? 'full' : (pct >= 70 ? 'warn' : '');
			$('#quoted-quota').html(
				'<p><strong>' + (posts.synced || 0) + ' / ' + (posts.quota || 0) + '</strong> posts synced</p>' +
				'<div class="quoted-quota-bar"><div class="quoted-quota-fill ' + fillClass + '" style="width: ' + pct + '%"></div></div>' +
				(pct >= 90 ? '<p style="color:#d63638;font-size:13px;margin-top:8px">Approaching free tier limit.</p>' : '')
			);
		}

		function renderDashboardError(data) {
			var msg = (data && data.message) || 'Unable to load dashboard data. Backend may be unreachable.';
			$('#quoted-bot-feed, #quoted-top-bots, #quoted-quota, #quoted-next-action').html(
				'<p class="quoted-empty" style="color:#d63638">' + escapeHtml(msg) + '</p>'
			);
		}

		function drawScoreGauge(score) {
			var canvas = document.getElementById('quoted-score-canvas');
			if (!canvas || typeof Chart === 'undefined') return;

			// Destroy previous instance if exists
			if (canvas._quotedChart) {
				canvas._quotedChart.destroy();
			}

			var color = score >= 70 ? '#00a32a' : (score >= 40 ? '#dba617' : '#d63638');

			canvas._quotedChart = new Chart(canvas, {
				type: 'doughnut',
				data: {
					datasets: [{
						data: [score, 100 - score],
						backgroundColor: [color, '#f0f0f1'],
						borderWidth: 0
					}]
				},
				options: {
					cutout: '75%',
					rotation: -90,
					circumference: 180,
					plugins: { legend: { display: false }, tooltip: { enabled: false } },
					animation: { duration: 600 }
				}
			});
		}

		// ─── Settings ────────────────────────────────────────────────────

		function initSettings() {
			$('#quoted-disconnect-btn').on('click', function () {
				if (!confirm('Disconnect from Quoted? Your local data is preserved.')) return;

				var $btn = $(this);
				$btn.prop('disabled', true);

				$.post(QuotedAdmin.ajax_url, {
					action: 'quoted_disconnect',
					nonce: QuotedAdmin.nonce
				}).done(function () {
					window.location.reload();
				}).fail(function () {
					alert('Disconnect failed. Try again.');
					$btn.prop('disabled', false);
				});
			});
		}

		// ─── Utilities ───────────────────────────────────────────────────

		function escapeHtml(str) {
			if (str === null || str === undefined) return '';
			return String(str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		}

		// Only allow http(s) URLs. Backend-sourced URLs are trusted, but a
		// javascript: scheme would slip past escapeHtml() and execute on
		// click, so we hard-validate here.
		function safeUrl(u) {
			if (!u) return '';
			try {
				var p = new URL(u, window.location.origin);
				return /^https?:$/.test(p.protocol) ? p.href : '';
			} catch (e) {
				return '';
			}
		}
	});
})(jQuery);
