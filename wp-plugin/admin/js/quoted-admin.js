/**
 * Quoted Admin — v0.4.0
 *
 * Vanilla JS + jQuery (WP admin convention). No build step.
 * Wires: Dashboard async data load, score gauge, segmented tabs (q-seg),
 * copy fields (q-copy), legacy onboarding form (for back-compat).
 */
(function ($) {
	'use strict';

	$(document).ready(function () {
		initDashboard();
		initTabs();
		initCopyFields();
		initSegmented();
		initLegacyOnboarding();
	});

	// ─── Dashboard ─────────────────────────────────────────────────────

	function initDashboard() {
		var $score = $('#q-score-number');
		if (!$score.length) {
			return;
		}

		$.post(QuotedAdmin.ajax_url, {
			action: 'quoted_dashboard_data',
			nonce: QuotedAdmin.nonce
		}).done(function (resp) {
			if (resp && resp.success && resp.data) {
				renderDashboard(resp.data);
			} else {
				renderDashboardError();
			}
		}).fail(function () {
			renderDashboardError();
		});
	}

	function renderDashboard(d) {
		var score = parseInt(d.score, 10) || 0;
		$('#q-score-number').text(score);
		drawScoreGauge(score);

		// Delta badge
		var delta = parseInt(d.score_delta, 10) || 0;
		var $deltaBadge = $('#q-score-delta');
		if ($deltaBadge.length) {
			if (delta > 0) {
				$deltaBadge.find('.q-badge__dot').show();
				$deltaBadge.find('.label').text('+' + delta + ' this week');
				$deltaBadge.removeClass('q-badge--muted').addClass('q-badge--success').show();
			} else if (delta < 0) {
				$deltaBadge.find('.label').text(delta + ' this week');
				$deltaBadge.removeClass('q-badge--muted q-badge--success').addClass('q-badge--warning').show();
			} else {
				$deltaBadge.hide();
			}
		}

		// Stat strip — visits / unique / posts indexed
		$('#q-stat-visits').text(formatNumber(d.total_visits));
		$('#q-stat-visits-delta').text(delta !== 0 ? (delta > 0 ? '+' + delta + '%' : delta + '%') : '');
		$('#q-stat-unique').text(d.unique_bots || 0);

		// Quota text — handle unlimited (cap === 0) gracefully
		var cap = parseInt(d.post_cap, 10);
		var indexed = parseInt(d.posts_indexed, 10) || 0;
		var quotaText;
		if (!cap || cap === 0) {
			quotaText = formatNumber(indexed) + ' · Unlimited';
		} else {
			quotaText = formatNumber(indexed) + ' / ' + formatNumber(cap);
		}
		$('#q-stat-posts').text(quotaText);

		// Top bots
		var topBots = d.top_bots || [];
		var $bots = $('#q-bots-list');
		if ($bots.length) {
			if (topBots.length) {
				var max = topBots[0].visits || 1;
				var html = '';
				for (var i = 0; i < topBots.length; i++) {
					var b = topBots[i];
					var pct = Math.round((b.visits / max) * 100);
					html += '<div class="q-row q-row--bot">';
					html += '<div><div class="q-table__name" style="font-weight:500;">' + escapeHtml(b.bot_name) + '</div>';
					html += '<div class="q-row__bot-meta">' + escapeHtml(operatorOf(b.bot_name)) + '</div></div>';
					html += '<div class="q-row__bar"><div class="q-row__bar-fill" style="width:' + pct + '%"></div></div>';
					html += '<div class="q-row__count">' + b.visits + ' · ' + escapeHtml(humanTime(b.last)) + '</div>';
					html += '</div>';
				}
				$bots.html(html);
			} else {
				$bots.html('<p class="q-empty">No AI bot visits yet. New crawlers typically appear within 24 hours.</p>');
			}
		}

		// Recent crawls
		var recent = d.recent || [];
		var $recent = $('#q-recent-list');
		if ($recent.length) {
			if (recent.length) {
				var html = '';
				for (var j = 0; j < recent.length; j++) {
					var r = recent[j];
					html += '<div class="q-row q-row--crawl">';
					html += '<span class="q-row__pulse ' + (j === 0 ? 'is-fresh' : '') + '"></span>';
					html += '<span class="q-row__url" title="' + escapeAttr(r.url_path) + '">' + escapeHtml(r.url_path) + '</span>';
					html += '<span class="q-row__bot-meta">' + escapeHtml(r.bot_name) + '</span>';
					html += '<span class="q-row__bot-meta">' + escapeHtml(humanTime(r.crawled_at)) + '</span>';
					html += '</div>';
				}
				$recent.html(html);
			} else {
				$recent.html('<p class="q-empty">No recent crawls yet.</p>');
			}
		}

		// Next action — show only when over quota
		var $callout = $('#q-next-action');
		if ($callout.length) {
			if (d.over_quota) {
				$callout.show();
				$('#q-next-action-desc').text(
					'You have ' + d.posts_total + ' posts but /llms.txt only includes the most recent ' +
					d.post_cap + ' on the Free plan. Upgrade for unlimited.'
				);
			} else {
				$callout.hide();
			}
		}
	}

	function renderDashboardError() {
		$('#q-bots-list, #q-recent-list').html('<p class="q-empty">Unable to load dashboard data.</p>');
	}

	function drawScoreGauge(score) {
		var canvas = document.getElementById('q-score-canvas');
		if (!canvas) {
			return;
		}
		var ctx = canvas.getContext('2d');
		var W = canvas.width;
		var H = canvas.height;
		var cx = W / 2;
		var cy = H / 2;
		var r = Math.min(W, H) / 2 - 8;

		ctx.clearRect(0, 0, W, H);

		// Background ring
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.lineWidth = 8;
		ctx.strokeStyle = '#e4e7ec';
		ctx.stroke();

		// Score arc — start at 12 o'clock, go clockwise
		var pct = Math.max(0, Math.min(100, score)) / 100;
		var start = -Math.PI / 2;
		var end = start + (Math.PI * 2 * pct);
		ctx.beginPath();
		ctx.arc(cx, cy, r, start, end);
		ctx.lineWidth = 8;
		ctx.lineCap = 'round';
		ctx.strokeStyle = '#3b3fbf';
		ctx.stroke();
	}

	// ─── Tab panels (q-tab-trigger / q-tab-panel) ──────────────────────

	function initTabs() {
		$(document).on('click', '.q-tab-trigger', function (e) {
			e.preventDefault();
			var $btn = $(this);
			var target = $btn.data('target');
			var group = $btn.data('group') || 'default';
			$('.q-tab-trigger[data-group="' + group + '"]').removeClass('is-active');
			$('.q-tab-panel[data-group="' + group + '"]').removeClass('is-active');
			$btn.addClass('is-active');
			$('.q-tab-panel[data-target="' + target + '"]').addClass('is-active');
		});
	}

	// ─── Copy field (q-copy) ───────────────────────────────────────────

	function initCopyFields() {
		$(document).on('click', '.q-copy__btn', function (e) {
			e.preventDefault();
			var $btn = $(this);
			var $field = $btn.closest('.q-copy');
			var text = $field.find('.q-copy__value').text().trim();

			var copy = function () {
				$btn.addClass('is-copied').text(QuotedAdmin.i18n.copied + ' ✓');
				setTimeout(function () {
					$btn.removeClass('is-copied').text(QuotedAdmin.i18n.copy);
				}, 1400);
			};

			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(copy).catch(function () {
					fallbackCopy(text); copy();
				});
			} else {
				fallbackCopy(text); copy();
			}
		});
	}

	function fallbackCopy(text) {
		var ta = document.createElement('textarea');
		ta.value = text;
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand('copy'); } catch (e) { /* noop */ }
		document.body.removeChild(ta);
	}

	// ─── Segmented control (q-seg + hidden input or page link) ──────────

	function initSegmented() {
		$(document).on('click', '.q-seg__btn[data-filter]', function () {
			var $btn = $(this);
			var $seg = $btn.closest('.q-seg');
			var filter = $btn.data('filter');
			$seg.find('.q-seg__btn').removeClass('is-active');
			$btn.addClass('is-active');

			// Filter rows in target table
			var target = $seg.data('target');
			if (!target) { return; }
			$(target).find('[data-row-state]').each(function () {
				var $row = $(this);
				var state = $row.data('row-state');
				$row.toggle(filter === 'all' || state === filter);
			});
		});
	}

	// ─── Legacy onboarding form (Quoted_Public connect flow, kept for back-compat) ──

	function initLegacyOnboarding() {
		var $form = $('#quoted-connect-form');
		if (!$form.length) { return; }

		$form.on('submit', function (e) {
			e.preventDefault();
			var key = $('#quoted-license-key').val().trim();
			var $status = $('#quoted-connect-status');
			var $btn = $('#quoted-connect-btn');
			if (!key) {
				$status.addClass('error').text('License key is required.');
				return;
			}
			$btn.prop('disabled', true);
			$status.removeClass('error').text(QuotedAdmin.i18n.connecting);
			$.post(QuotedAdmin.ajax_url, {
				action: 'quoted_connect_backend',
				nonce: QuotedAdmin.nonce,
				license_key: key
			}).done(function (resp) {
				if (resp && resp.success) {
					window.location.href = QuotedAdmin.site_url
						? '/wp-admin/admin.php?page=quoted-setup'
						: '/wp-admin/admin.php?page=quoted';
				} else {
					var msg = (resp && resp.data && resp.data.message) || QuotedAdmin.i18n.error_generic;
					$status.addClass('error').text(msg);
					$btn.prop('disabled', false);
				}
			}).fail(function () {
				$status.addClass('error').text(QuotedAdmin.i18n.error_generic);
				$btn.prop('disabled', false);
			});
		});
	}

	// ─── Utilities ─────────────────────────────────────────────────────

	function escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	}
	function escapeAttr(s) { return escapeHtml(s); }
	function formatNumber(n) {
		n = parseInt(n, 10) || 0;
		return n.toLocaleString('en-US');
	}
	function humanTime(iso) {
		if (!iso) { return ''; }
		var t = new Date(iso.replace(' ', 'T') + 'Z');
		if (isNaN(t.getTime())) { return iso; }
		var diff = Math.max(0, (Date.now() - t.getTime()) / 1000);
		if (diff < 60) { return Math.floor(diff) + 's'; }
		if (diff < 3600) { return Math.floor(diff / 60) + 'm'; }
		if (diff < 86400) { return Math.floor(diff / 3600) + 'h'; }
		var days = Math.floor(diff / 86400);
		if (days === 1) { return 'yesterday'; }
		return days + 'd';
	}
	function operatorOf(botName) {
		var map = {
			'GPTBot': 'OpenAI', 'ChatGPT-User': 'OpenAI', 'OAI-SearchBot': 'OpenAI',
			'ClaudeBot': 'Anthropic', 'Claude-SearchBot': 'Anthropic',
			'PerplexityBot': 'Perplexity', 'Perplexity-User': 'Perplexity',
			'GoogleExtended': 'Google', 'Google-Extended': 'Google',
			'Applebot-Extended': 'Apple', 'Bytespider': 'ByteDance',
			'FacebookBot': 'Meta', 'Meta-ExternalAgent': 'Meta',
			'CCBot': 'Common Crawl', 'DiffBot': 'Diffbot',
			'Cohere': 'Cohere', 'YouBot': 'You.com'
		};
		return map[botName] || '';
	}

})(jQuery);
