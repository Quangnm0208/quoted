/**
 * Quoted Admin — onboarding state machine + dashboard renderer.
 *
 * Vanilla JS + jQuery (WP admin convention). No build step.
 */
(function ($) {
	'use strict';

	$(document).ready(function () {

		var $onboarding = $('.quoted-onboarding');
		if ($onboarding.length) {
			initOnboarding();
		}

		var $dashboard = $('.quoted-dashboard');
		if ($dashboard.length) {
			initDashboard();
		}

		// ─── Onboarding flow ─────────────────────────────────────────────

		function initOnboarding() {

			// Step 1: Welcome → move to step 2
			$('#quoted-start-btn').on('click', function (e) {
				e.preventDefault();
				goToStep(2);
			});

			// Step 2: Generate llms.txt
			$('#quoted-scan-btn').on('click', function () {
				var $btn = $(this);
				var $result = $('#quoted-scan-result');

				$btn.prop('disabled', true).text(QuotedAdmin.i18n.connecting);
				$result.hide().empty();

				$.post(QuotedAdmin.ajax_url, {
					action: 'quoted_sync_posts',
					nonce: QuotedAdmin.nonce
				}).done(function (resp) {
					if (resp.success) {
						var count = (resp.data && resp.data.synced) || 0;
						$result.html(
							'<p><strong>✓ Found ' + escapeHtml(String(count)) + ' published posts.</strong></p>' +
							'<p>Your AI sitemap is now live at <code>' + escapeHtml(QuotedAdmin.site_url) + '/llms.txt</code></p>'
						).show();
						setTimeout(function () { goToStep(3); }, 1500);
					} else {
						$result.html('<p style="color:#d63638">Could not generate. Try again or check Settings.</p>').show();
						$btn.prop('disabled', false).text('Generate now');
					}
				}).fail(function () {
					$result.html('<p style="color:#d63638">Could not generate. Try again or check Settings.</p>').show();
					$btn.prop('disabled', false).text('Generate now');
				});
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
				var topHtml = '';
				for (var j = 0; j < topBots.length; j++) {
					var b = topBots[j];
					var pct = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
					topHtml += '<div class="quoted-top-bot-row">' +
						'<span>' + escapeHtml(b.bot_name) + '</span>' +
						'<span class="bar"><span class="bar-fill" style="width: ' + pct + '%"></span></span>' +
						'<span>' + escapeHtml(String(b.count)) + '</span>' +
						'</div>';
				}
				$('#quoted-top-bots').html(topHtml);
			} else {
				$('#quoted-top-bots').html('<p class="quoted-empty">No data yet.</p>');
			}

			// Published content count (no quota gating)
			var posts = d.posts || {};
			var published = posts.published || 0;
			$('#quoted-quota').html(
				'<p><strong>' + escapeHtml(String(published)) + '</strong> ' +
				(published === 1 ? 'published post or page' : 'published posts and pages') +
				'</p>' +
				'<p class="description">All of these are included in your /llms.txt.</p>'
			);
		}

		function renderDashboardError(data) {
			var msg = (data && data.message) || 'Unable to load dashboard data.';
			$('#quoted-bot-feed, #quoted-top-bots, #quoted-quota, #quoted-next-action').html(
				'<p class="quoted-empty" style="color:#d63638">' + escapeHtml(msg) + '</p>'
			);
		}

		function drawScoreGauge(score) {
			var canvas = document.getElementById('quoted-score-canvas');
			if (!canvas || typeof Chart === 'undefined') return;

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
