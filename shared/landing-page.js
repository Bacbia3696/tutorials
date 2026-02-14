function resolveCacheBustedUrl(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const sourceUrl = new URL(import.meta.url);
  const cacheBust = sourceUrl.searchParams.get('v');
  if (cacheBust) {
    url.searchParams.set('v', cacheBust);
  }
  return url.href;
}

const { tutorialGroups, tutorialList } = await import(
  resolveCacheBustedUrl('./tutorial-registry.js'),
);

const categoryBadgeLabel = Object.freeze({
  ds: 'Data Structure',
  graph: 'Graph Algorithm',
  geometry: 'Computational Geometry',
});

function updateHeroBadge() {
  const heroBadge = document.querySelector('.hero-badge');
  if (!heroBadge) {
    return;
  }
  heroBadge.innerHTML = `<span class="dot"></span> ${tutorialList.length} interactive labs`;
}

function createTagElement(tagText) {
  const tag = document.createElement('span');
  tag.textContent = tagText;
  return tag;
}

function createCardElement(tutorial) {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = tutorial.route;
  card.dataset.category = tutorial.category;
  card.setAttribute('aria-label', `Open ${tutorial.landingTitle}`);

  const badge = document.createElement('span');
  badge.className = 'card-badge';
  badge.textContent = categoryBadgeLabel[tutorial.category] ?? 'Tutorial';

  const arrow = document.createElement('span');
  arrow.className = 'card-arrow';
  arrow.textContent = '↗';

  const title = document.createElement('h3');
  title.textContent = tutorial.landingTitle ?? tutorial.title;

  const description = document.createElement('p');
  description.className = 'desc';
  description.textContent = tutorial.landingDescription ?? tutorial.description;

  const tags = document.createElement('div');
  tags.className = 'card-tags';
  for (const tagText of tutorial.landingTags ?? []) {
    tags.appendChild(createTagElement(tagText));
  }

  card.appendChild(badge);
  card.appendChild(arrow);
  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(tags);
  return card;
}

function renderCategoryGrid(gridSelector, tutorials) {
  const grid = document.querySelector(gridSelector);
  if (!grid) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const tutorial of tutorials) {
    fragment.appendChild(createCardElement(tutorial));
  }
  grid.replaceChildren(fragment);
}

function renderLandingPage() {
  updateHeroBadge();
  renderCategoryGrid('#dsGrid', tutorialGroups.ds);
  renderCategoryGrid('#geometryGrid', tutorialGroups.geometry);
  renderCategoryGrid('#graphGrid', tutorialGroups.graph);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderLandingPage, { once: true });
} else {
  renderLandingPage();
}
