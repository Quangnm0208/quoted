/**
 * QuotedEasy AI Readiness admin scripts.
 */
(function ($) {
	'use strict';

	$(document).ready(function () {

		var $onboarding = $('.quotedeasy-ai-readiness-onboarding');
		if ($onboarding.length) {
			initOnboarding();
		}

		var $dashboard = $('.quotedeasy-ai-readiness-dashboard');
		if ($dashboard.length) {
			initDashboard();
		}

		function initOnboarding() {

			$('#quotedeasy-ai-readiness-start-btn').on('click', function (e) {
				e.preventDefault();
				goToStep(2);
			});

			$('#quotedeasy-ai-readiness-scan-btn').on('click', function () {
				var $btn = $(this);
				var $result = $('#quotedeasy-ai-readiness-scan-result');

				$btn.prop('disabled', true).text(QuotedEasyAIReadinessAdmin.i18n.connecting);
				$result.hide().empty();

				$.post(QuotedEasyAIReadinessAdmin.ajax_url, {
					action: 'quotedeasy_ai_readiness_sync_posts',
					nonce: QuotedEasyAIReadinessAdmin.nonce
				}).done(function (resp) {
					if (resp.success) {
						var count = (resp.data && resp.data.synced) || 0;
						$result.html(
							'<p><strong>Found ' + escapeHtml(String(count)) + ' published posts.</strong></p>' +
							'<p>Your AI sitemap is now live at <code>' + escapeHtml(QuotedEasyAIReadinessAdmin.site_url) + '/llms.txt</code></p>'
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
				$('.quotedeasy-ai-readiness-step').removeClass('active').hide();
				$('.quotedeasy-ai-readiness-step-' + stepNum).addClass('active').show();

				$('.quotedeasy-ai-readiness-progress li').each(function (i) {
					var stepIdx = i + 1;
					var $li = $(this);
					$li.removeClass('active done');
					if (stepIdx < stepNum) $li.addClass('done');
					if (stepIdx === stepNum) $li.addClass('active');
				});

				$('html, body').animate({ scrollTop: $('.quotedeasy-ai-readiness-onboarding').offset().top - 50 }, 200);
			}
		}

		function initDashboard() {
			loadDashboard();
			setInterval(loadDashboard, 60000);
		}

		function loadDashboard() {
			$.post(QuotedEasyAIReadinessAdmin.ajax_url, {
				action: 'quotedeasy_ai_readiness_dashboard_data',
				nonce: QuotedEasyAIReadinessAdmin.nonce
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
			var score = d.ai_distribution_score || 0;
			$('#quotedeasy-ai-readiness-score-number').text(score);
			drawScoreGauge(score);

			var delta = d.score_delta_7d || 0;
			var $delta = $('#quotedeasy-ai-readiness-score-delta');
			$delta.removeClass('positive negative');
			if (delta > 0) {
				$delta.addClass('positive').text('+' + delta + ' vs last week');
			} else if (delta < 0) {
				$delta.addClass('negative').text(delta + ' vs last week');
			} else {
				$delta.text('No change vs last week');
			}

			if (d.next_action) {
				var actionUrl = safeUrl(d.next_action.action_url);
				$('#quotedeasy-ai-readiness-next-action').html(
					'<div class="quotedeasy-ai-readiness-next-action-item">' +
						'<h3>' + escapeHtml(d.next_action.title) + '</h3>' +
						'<p>' + escapeHtml(d.next_action.description) + '</p>' +
						(actionUrl ?
							'<a href="' + escapeHtml(actionUrl) + '" class="button button-primary">Take action</a>'
							: '') +
					'</div>'
				);
			} else {
				$('#quotedeasy-ai-readiness-next-action').html('<p class="quotedeasy-ai-readiness-empty">All clear. Check back tomorrow.</p>');
			}

			var activity = d.bot_activity || {};
			var recent = activity.recent_crawls || [];
			if (recent.length > 0) {
				var html = '';
				for (var i = 0; i < Math.min(recent.length, 8); i++) {
					var ev = recent[i];
					html += '<div class="quotedeasy-ai-readiness-bot-event">' +
						'<span class="bot-name">' + escapeHtml(ev.bot_name) + '</span>' +
						'<span class="bot-url" title="' + escapeHtml(ev.url_path) + '">' + escapeHtml(ev.url_path) + '</span>' +
						'<span class="bot-time">' + escapeHtml(ev.human_time || ev.crawled_at) + '</span>' +
						'</div>';
				}
				$('#quotedeasy-ai-readiness-bot-feed').html(html);
			} else {
				$('#quotedeasy-ai-readiness-bot-feed').html(
					'<div class="quotedeasy-ai-readiness-empty">' +
						'<p>No AI bot visits yet.</p>' +
						'<p>This is normal in the first 24 hours. ClaudeBot and GPTBot usually find new llms.txt files within a day.</p>' +
					'</div>'
				);
			}

			var topBots = activity.top_bots || [];
			if (topBots.length > 0) {
				var maxCount = topBots[0].count;
				var topHtml = '';
				for (var j = 0; j < topBots.length; j++) {
					var b = topBots[j];
					var pct = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
					topHtml += '<div class="quotedeasy-ai-readiness-top-bot-row">' +
						'<span>' + escapeHtml(b.bot_name) + '</span>' +
						'<span class="bar"><span class="bar-fill" style="width: ' + pct + '%"></span></span>' +
						'<span>' + escapeHtml(String(b.count)) + '</span>' +
						'</div>';
				}
				$('#quotedeasy-ai-readiness-top-bots').html(topHtml);
			} else {
				$('#quotedeasy-ai-readiness-top-bots').html('<p class="quotedeasy-ai-readiness-empty">No data yet.</p>');
			}

			var posts = d.posts || {};
			var published = posts.published || 0;
			$('#quotedeasy-ai-readiness-quota').html(
				'<p><strong>' + escapeHtml(String(published)) + '</strong> ' +
				(published === 1 ? 'published post or page' : 'published posts and pages') +
				'</p>' +
				'<p class="description">All of these are included in your /llms.txt.</p>'
			);
		}

		function renderDashboardError(data) {
			var msg = (data && data.message) || 'Unable to load dashboard data.';
			$('#quotedeasy-ai-readiness-bot-feed, #quotedeasy-ai-readiness-top-bots, #quotedeasy-ai-readiness-quota, #quotedeasy-ai-readiness-next-action').html(
				'<p class="quotedeasy-ai-readiness-empty" style="color:#d63638">' + escapeHtml(msg) + '</p>'
			);
		}

		function drawScoreGauge(score) {
			var canvas = document.getElementById('quotedeasy-ai-readiness-score-canvas');
			if (!canvas || typeof Chart === 'undefined') return;

			if (canvas._qearChart) {
				canvas._qearChart.destroy();
			}

			var color = score >= 70 ? '#00a32a' : (score >= 40 ? '#dba617' : '#d63638');

			canvas._qearChart = new Chart(canvas, {
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

		function escapeHtml(str) {
			if (str === null || str === undefined) return '';
			return String(str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		}

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
