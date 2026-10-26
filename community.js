/*
 * ЭкоИркутск: отзывы и статистика.
 * Для общей статистики используется бесплатный Supabase.
 * Вставьте только публичный Publishable key (или anon public) в SUPABASE_PUBLIC_KEY.
 */
const SUPABASE_URL = 'https://kfbveridbvxtxiyktdsn.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_DAQ_xoH3-pgF_a1l8vLETQ_vtkPBYDj';

(() => {
  'use strict';

  const apiBase = SUPABASE_URL.trim().replace(/\/+$/, '');
  const publicKey = SUPABASE_PUBLIC_KEY.trim();
  const remoteMode = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(apiBase) && publicKey.length > 20;
  const storeKey = 'eco-irkutsk-community-v1';
  const sessionKey = 'eco-irkutsk-visit-session-v1';
  const form = document.getElementById('communityForm');
  const list = document.getElementById('communityList');
  const note = document.getElementById('communityModeNote');
  const feedback = document.getElementById('communityFeedback');
  const submit = document.getElementById('communitySubmit');
  const visitsEl = document.getElementById('communityVisits');
  const reviewsEl = document.getElementById('communityReviewsCount');
  const activeEl = document.getElementById('communityActive');
  const activeStat = document.getElementById('communityActiveStat');
  if (!form || !list || !note) return;

  const memoryStore = { visits: 0, reviews: [] };
  let localStoreAvailable = true;

  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
      if (!saved || typeof saved !== 'object') return { ...memoryStore };
      return {
        visits: Number.isSafeInteger(saved.visits) && saved.visits >= 0 ? saved.visits : 0,
        reviews: Array.isArray(saved.reviews) ? saved.reviews.slice(0, 30) : [],
      };
    } catch (_) {
      localStoreAvailable = false;
      return { ...memoryStore };
    }
  }

  function writeLocal(data) {
    memoryStore.visits = data.visits;
    memoryStore.reviews = data.reviews;
    try { localStorage.setItem(storeKey, JSON.stringify(data)); }
    catch (_) { localStoreAvailable = false; }
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(sessionKey);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(sessionKey, id);
      }
      return id;
    } catch (_) {
      return crypto.randomUUID();
    }
  }

  function getVisitorId() {
    const visitorKey = 'eco-irkutsk-visitor-id-v1';
    try {
      let id = localStorage.getItem(visitorKey);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(visitorKey, id);
      }
      return id;
    } catch (_) {
      return getSessionId();
    }
  }

  function setFeedback(text, error = false) {
    feedback.textContent = text;
    feedback.classList.toggle('is-error', error);
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Irkutsk',
    }).format(date);
  }

  function makeReview(review, isExample = false) {
    const card = document.createElement('article');
    card.className = 'community-review';
    if (isExample) {
      const tag = document.createElement('div');
      tag.className = 'community-demo-label';
      tag.textContent = 'Пример оформления · не отзыв посетителя';
      card.append(tag);
    }
    const top = document.createElement('div');
    top.className = 'community-review-top';
    const name = document.createElement('strong');
    name.className = 'community-review-name';
    name.textContent = String(review.name || 'Гость').slice(0, 32);
    const date = document.createElement('time');
    date.className = 'community-review-date';
    const dateText = formatDate(review.createdAt);
    date.textContent = isExample ? 'образец' : dateText;
    if (!isExample && dateText) date.dateTime = new Date(review.createdAt).toISOString();
    top.append(name, date);
    const stars = document.createElement('div');
    stars.className = 'community-review-stars';
    stars.setAttribute('aria-label', `Оценка: ${review.rating} из 5`);
    stars.textContent = '★'.repeat(Math.min(5, Math.max(1, Number(review.rating) || 5))) +
      '☆'.repeat(5 - Math.min(5, Math.max(1, Number(review.rating) || 5)));
    const body = document.createElement('p');
    body.className = 'community-review-body';
    body.textContent = String(review.text || '').slice(0, 600);
    card.append(top, stars, body);
    return card;
  }

  function renderReviews(reviews, mode) {
    list.replaceChildren();
    if (!reviews.length) {
      if (mode === 'local') {
        list.append(makeReview({
          name: 'Пример', rating: 5,
          text: 'Здесь появятся ваши отзывы. Когда будет подключён общий сервис, их смогут видеть и другие посетители.',
        }, true));
      } else {
        const empty = document.createElement('div');
        empty.className = 'community-empty';
        empty.textContent = 'Пока нет опубликованных отзывов. Расскажите о своём опыте первым.';
        list.append(empty);
      }
      return;
    }
    reviews.slice(0, 12).forEach(review => list.append(makeReview(review)));
  }

  function renderStats(visits, count, active) {
    visitsEl.textContent = new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(visits) || 0));
    reviewsEl.textContent = new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(count) || 0));
    if (remoteMode) activeEl.textContent = new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(active) || 0));
  }

  async function api(functionName, body = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publicKey,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Сервис временно недоступен. Попробуйте позже.');
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refreshRemote() {
    const data = await api('community_snapshot');
    renderStats(data.visits, data.reviewCount, data.activeLastFiveMinutes);
    renderReviews(Array.isArray(data.reviews) ? data.reviews : [], 'remote');
  }

  if (remoteMode) {
    note.textContent = 'Посетители считаются по браузерам. Активность показывает посетителей за последние 5 минут.';
    api('community_register_visit', { p_visitor_id: getVisitorId() })
      .then(refreshRemote)
      .catch(() => {
        note.textContent = 'Не удалось получить общую статистику. Попробуйте обновить страницу позже.';
        list.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'community-empty';
        empty.textContent = 'Отзывы сейчас недоступны.';
        list.append(empty);
      });
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api('community_register_visit', { p_visitor_id: getVisitorId() })
        .then(refreshRemote).catch(() => {});
    }, 90000);
  } else {
    activeStat.hidden = true;
    document.getElementById('communitySubmitLabel').textContent = 'Сохранить отзыв здесь';
    document.getElementById('communityVisitsLabel').textContent = 'Сеансы в этом браузере';
    document.getElementById('communityReviewsLabel').textContent = 'Отзывы в этом браузере';
    const data = readLocal();
    let shouldCount = true;
    try {
      shouldCount = !sessionStorage.getItem(sessionKey);
      if (shouldCount) sessionStorage.setItem(sessionKey, getSessionId());
    } catch (_) { /* приватный режим: счётчик действует до закрытия страницы */ }
    if (shouldCount) data.visits += 1;
    writeLocal(data);
    note.textContent = localStoreAvailable
      ? 'Демонстрация: данные хранятся только в этом браузере. Общий счётчик и отзывы появятся после подключения сервиса.'
      : 'Демонстрация: браузер не разрешил сохранение, данные исчезнут после закрытия страницы.';
    renderStats(data.visits, data.reviews.length, 0);
    renderReviews(data.reviews, 'local');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (document.getElementById('communityWebsite').value) return;
    const name = document.getElementById('communityName').value.trim().slice(0, 32) || 'Гость';
    const text = document.getElementById('communityText').value.trim();
    const rating = Number(document.getElementById('communityRating').value);
    if (text.length < 15 || text.length > 600) {
      setFeedback('Напишите отзыв длиной от 15 до 600 символов.', true);
      return;
    }
    submit.disabled = true;
    setFeedback('Сохраняем отзыв…');
    try {
      if (remoteMode) {
        await api('community_add_review', {
          p_visitor_id: getVisitorId(), p_name: name, p_body: text,
          p_rating: rating, p_website: '',
        });
        await refreshRemote();
        setFeedback('Отзыв опубликован. Спасибо!');
      } else {
        const data = readLocal();
        data.reviews.unshift({ name, text, rating, createdAt: Date.now() });
        data.reviews = data.reviews.slice(0, 30);
        writeLocal(data);
        renderStats(data.visits, data.reviews.length, 0);
        renderReviews(data.reviews, 'local');
        setFeedback('Отзыв сохранён в этом браузере.');
      }
      form.reset();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Не удалось отправить отзыв.', true);
    } finally {
      submit.disabled = false;
    }
  });
})();
