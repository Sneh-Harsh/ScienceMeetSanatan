const header = document.querySelector('.header');
const exploreWrap = document.querySelector('.explore-wrap');
const profileWrap = document.querySelector('.profile-wrap');
const profileTrigger = document.querySelector('.profile-trigger');
const slides = Array.from(document.querySelectorAll('.slide'));
const indicators = Array.from(document.querySelectorAll('.indicator'));

const didYouKnowGrid = document.querySelector('#didYouKnowGrid');
const prevCardsBtn = document.querySelector('.cards-nav.prev');
const nextCardsBtn = document.querySelector('.cards-nav.next');
const particleCanvas = document.querySelector('#particleCanvas');

const cardsData = [
  {
    title: 'Kalpa Vigraha',
    image:
      'https://picsum.photos/seed/gita1/600/350',
    detail:
      'Kalpa Vigraha symbolizes timeless divine form—representing the eternal truths that remain beyond changing ages.',
  },
  {
    title: 'Kurukshetra Field',
    image:
      'https://picsum.photos/seed/gita2/600/350',
    detail:
      'Kurukshetra in the Gita is both battlefield and inner mind, where duty and doubt face each other.',
  },
  {
    title: 'Krishna’s Flute',
    image:
      'https://picsum.photos/seed/gita3/600/350',
    detail:
      'The flute is a symbol of surrender: when ego empties, divine harmony flows naturally through life.',
  },
  {
    title: 'Bhakti Path',
    image:
      'https://picsum.photos/seed/gita4/600/350',
    detail:
      'Bhakti in the Gita teaches heartfelt devotion balanced with action, humility, and remembrance.',
  },
  {
    title: 'Dharma Wheel',
    image:
      'https://picsum.photos/seed/gita5/600/350',
    detail:
      'Dharma is right alignment with truth and responsibility—not mere ritual, but living wisdom in action.',
  },
  {
    title: 'Sacred Light',
    image:
      'https://picsum.photos/seed/gita6/600/350',
    detail:
      'Divine light in the Gita signifies clarity that dissolves confusion and reveals one’s true path.',
  },
  {
    title: 'Arjuna’s Resolve',
    image:
      'https://picsum.photos/seed/gita7/600/350',
    detail:
      'Arjuna’s journey transforms despair into disciplined action through guidance, awareness, and surrender.',
  },
  {
    title: 'Yoga of Action',
    image:
      'https://picsum.photos/seed/gita8/600/350',
    detail:
      'Karma Yoga teaches work without attachment to outcomes—performing duty with excellence and equanimity.',
  },
  {
    title: 'Inner Stillness',
    image:
      'https://picsum.photos/seed/gita9/600/350',
    detail:
      'Meditative stillness in the Gita is not escape, but centered awareness amid the movement of life.',
  },
  {
    title: 'Cosmic Vision',
    image:
      'https://picsum.photos/seed/gita10/600/350',
    detail:
      'The Vishvarupa reveals the vast interconnected reality where time, action, and divinity merge.',
  },
  {
    title: 'Path of Wisdom',
    image:
      'https://picsum.photos/seed/gita11/600/350',
    detail:
      'Jnana Yoga emphasizes discrimination between the eternal self and temporary identities.',
  },
  {
    title: 'Peace in Surrender',
    image:
      'https://picsum.photos/seed/gita12/600/350',
    detail:
      'Surrender in the Gita is trustful alignment with the divine will, leading to freedom from fear.',
  },
];

const cardsPerPage = 4;
const visualThemes = ['theme-sunrise', 'theme-indigo', 'theme-emerald', 'theme-amber'];
const visualIcons = ['🕉️', '⚔️', '🎵', '🪔', '🧘', '✨'];
let cardStartIndex = 0;
let isCardAnimating = false;

const getWrappedStartIndex = (nextStartIndex) => {
  const total = cardsData.length;
  if (total === 0) return 0;
  return (nextStartIndex + total) % total;
};

const getCardsForPage = () => {
  const total = cardsData.length;
  if (total === 0) return [];

  const cards = [];
  for (let i = 0; i < Math.min(cardsPerPage, total); i += 1) {
    const index = (cardStartIndex + i) % total;
    cards.push(cardsData[index]);
  }

  return cards;
};

const updateHeaderState = () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 8);
};

window.addEventListener('scroll', updateHeaderState, { passive: true });
updateHeaderState();

profileTrigger?.addEventListener('click', () => {
  profileWrap?.classList.toggle('open');
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;

  if (profileWrap && !profileWrap.contains(target)) {
    profileWrap.classList.remove('open');
  }

  if (exploreWrap && !exploreWrap.contains(target)) {
    exploreWrap.classList.remove('open');
  }
});

exploreWrap?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('.nav-link')) {
    event.preventDefault();
    exploreWrap.classList.toggle('open');
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    profileWrap?.classList.remove('open');
    exploreWrap?.classList.remove('open');
  }
});

if (slides.length > 1) {
  let activeIndex = slides.findIndex((slide) => slide.classList.contains('active'));
  if (activeIndex < 0) activeIndex = 0;

  const applySlide = (index) => {
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });

    indicators.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });

    activeIndex = index;
  };

  indicators.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.slide);
      if (Number.isInteger(index) && index >= 0 && index < slides.length) {
        applySlide(index);
      }
    });
  });

  window.setInterval(() => {
    const next = (activeIndex + 1) % slides.length;
    applySlide(next);
  }, 5200);

  applySlide(activeIndex);
}

const setCardMarkup = (cardElement, card, cardIndex) => {
  cardElement.className = 'dyk-card';
  cardElement.hidden = false;
  const themeClass = visualThemes[cardIndex % visualThemes.length];

  cardElement.innerHTML = `
    <div class="dyk-card-inner">
      <div class="dyk-card-face dyk-card-front ${themeClass}">
        <img src="${card.image}" alt="${card.title}" loading="lazy" onerror="this.style.display='none'" />
        <h3 class="front-title">${card.title}</h3>
      </div>
      <div class="dyk-card-face dyk-card-back">
        <h3>${card.title}</h3>
        <p>${card.detail}</p>
      </div>
    </div>
  `;
};

const ensureCardShells = () => {
  if (!didYouKnowGrid) return [];

  const existingCards = Array.from(didYouKnowGrid.querySelectorAll('.dyk-card'));
  while (existingCards.length < cardsPerPage) {
    const cardElement = document.createElement('div');
    cardElement.className = 'dyk-card';
    didYouKnowGrid.appendChild(cardElement);
    existingCards.push(cardElement);
  }

  return existingCards;
};

const renderCards = () => {
  if (!didYouKnowGrid) return;

  const pageCards = getCardsForPage();
  if (pageCards.length === 0) return;

  const shells = ensureCardShells();

  shells.forEach((shell, index) => {
    const card = pageCards[index];
    if (!card) {
      shell.hidden = true;
      return;
    }

    const absoluteIndex = (cardStartIndex + index) % cardsData.length;
    setCardMarkup(shell, card, absoluteIndex);
  });
};

const animateCardPage = (direction) => {
  if (!didYouKnowGrid || isCardAnimating) return;

  const offset = direction === 'next' ? cardsPerPage : -cardsPerPage;
  const nextStartIndex = getWrappedStartIndex(cardStartIndex + offset);

  isCardAnimating = true;
  didYouKnowGrid.classList.remove('slide-in-right', 'slide-in-left', 'slide-out-left', 'slide-out-right');
  didYouKnowGrid.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');

  window.setTimeout(() => {
    cardStartIndex = nextStartIndex;
    renderCards();

    didYouKnowGrid.classList.remove('slide-out-left', 'slide-out-right');
    didYouKnowGrid.classList.add(direction === 'next' ? 'slide-in-right' : 'slide-in-left');

    window.setTimeout(() => {
      didYouKnowGrid.classList.remove('slide-in-right', 'slide-in-left');
      isCardAnimating = false;
    }, 430);
  }, 360);
};

prevCardsBtn?.addEventListener('click', () => {
  animateCardPage('prev');
});

nextCardsBtn?.addEventListener('click', () => {
  animateCardPage('next');
});

renderCards();

if (particleCanvas) {
  const ctx = particleCanvas.getContext('2d');
  const particles = [];
  const count = 96;
  const colors = ['#5ea7ff', '#8f74ff', '#ffc56b', '#5ee4c2', '#ff72ba', '#76c5ff'];

  const resizeCanvas = () => {
    const parent = particleCanvas.parentElement;
    if (!parent) return;
    particleCanvas.width = parent.clientWidth;
    particleCanvas.height = parent.clientHeight;
  };

  const randomParticle = () => ({
    x: Math.random() * particleCanvas.width,
    y: Math.random() * particleCanvas.height,
    r: Math.random() * 2.8 + 1.3,
    vx: (Math.random() - 0.5) * 0.42,
    vy: (Math.random() - 0.5) * 0.42,
    color: colors[Math.floor(Math.random() * colors.length)],
  });

  const initParticles = () => {
    particles.length = 0;
    for (let i = 0; i < count; i += 1) {
      particles.push(randomParticle());
    }
  };

  const draw = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > particleCanvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > particleCanvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.72;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    requestAnimationFrame(draw);
  };

  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });

  resizeCanvas();
  initParticles();
  draw();
}
