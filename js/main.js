const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const progressWrap = document.querySelector('.progress-wrap');
const progressFill = document.querySelector('.progress-fill');
const progressGradient = document.querySelector('.progress-gradient');
const pickerCarousel = document.getElementById('pickerCarousel');
const pickerTrack = document.getElementById('pickerTrack');
const pickerRows = document.querySelectorAll('.picker-row');
const pickerPrevButton = document.getElementById('pickerPrevBtn');
const pickerNextButton = document.getElementById('pickerNextBtn');
const navLinks = document.querySelectorAll('.primary-nav a, #mobileMenu a');
const programCards = document.querySelectorAll('.program-card');
const programGrid = document.querySelector('.programs .split-grid');

const GRADIENT_SEGMENT = 60;
const ROW_COUNT = 2;
let focusRow = 0;
let touchStartY = 0;
const rowTouchState = new WeakMap();
const rowWheelState = new WeakMap();
const COLUMN_SCROLL_THRESHOLD = 55;
const COLUMN_SWIPE_THRESHOLD = 40;
const HORIZONTAL_INTENT_EPSILON = 8;
const rowColumnState = new Map();
let expandedProgramIndex = -1;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function toggleMenu(forceState) {
  if (!hamburger || !mobileMenu) return;
  const nextState = typeof forceState === 'boolean' ? forceState : !mobileMenu.classList.contains('open');
  mobileMenu.classList.toggle('open', nextState);
  hamburger.setAttribute('aria-expanded', String(nextState));
  mobileMenu.setAttribute('aria-hidden', String(!nextState));
}

function updateProgressBar() {
  if (!progressWrap || !progressFill || !progressGradient) return;
  const docElement = document.documentElement;
  const docHeight = docElement.scrollHeight - window.innerHeight;
  const percent = docHeight > 0 ? window.scrollY / docHeight : 0;
  const targetSolid = percent * window.innerWidth - 30;
  const trackWidth = progressWrap.clientWidth;
  const solidWidth = clamp(targetSolid, 0, trackWidth);
  const gradientWidth = Math.min(GRADIENT_SEGMENT, Math.max(0, trackWidth - solidWidth));
  const totalWidth = solidWidth + gradientWidth;

  progressFill.style.width = `${totalWidth}px`;
  progressGradient.style.width = `${gradientWidth}px`;
  progressGradient.style.left = `${Math.max(totalWidth - gradientWidth, 0)}px`;
  progressGradient.style.opacity = totalWidth > 0 ? 1 : 0;
}

function handleResize() {
  updateProgressBar();
  updatePickerFocus();
  rowColumnState.forEach((_, row) => updateRowColumnClasses(row));
}

function updatePickerFocus() {
  if (!pickerCarousel || !pickerTrack || !pickerRows.length) return;
  focusRow = clamp(focusRow, 0, ROW_COUNT - 1);
  const pickerWindow = pickerCarousel.querySelector('.picker-window');
  const rowHeight = pickerRows[0]?.offsetHeight ?? 220;
  const gap = 0;
  const windowHeight = pickerWindow?.offsetHeight ?? 400;

  const offsets = [
    windowHeight / 2 - rowHeight / 2,
    windowHeight / 2 - rowHeight * 1.5 - gap,
  ];
  if (pickerTrack) {
    pickerTrack.style.setProperty('--picker-offset', `${offsets[focusRow]}px`);
  }

  pickerRows.forEach((row, i) => {
    row.classList.remove('is-focused', 'is-above', 'is-below');
    if (i === focusRow) row.classList.add('is-focused');
    else if (i < focusRow) row.classList.add('is-above');
    else row.classList.add('is-below');
  });

  updateColumnNavState();
}

function pickerNext() {
  if (focusRow < ROW_COUNT - 1) {
    focusRow += 1;
    updatePickerFocus();
  }
}

function pickerPrev() {
  if (focusRow > 0) {
    focusRow -= 1;
    updatePickerFocus();
  }
}

function updateRowColumnClasses(row) {
  const state = rowColumnState.get(row);
  if (!state || !state.cards.length) return;
  state.focus = clamp(state.focus, 0, state.cards.length - 1);
  if (typeof state.expanded === 'number') {
    state.expanded = clamp(state.expanded, 0, state.cards.length - 1);
  }

  state.cards.forEach((card, index) => {
    card.classList.remove('is-col-focused', 'is-col-left', 'is-col-right', 'is-exploded');
    if (index === state.focus) card.classList.add('is-col-focused');
    else if (index < state.focus) card.classList.add('is-col-left');
    else card.classList.add('is-col-right');

    const isExpanded = index === state.expanded;
    if (isExpanded) card.classList.add('is-exploded');
    card.setAttribute('aria-expanded', String(isExpanded));
    const detail = card.querySelector('.project-details');
    if (detail) detail.setAttribute('aria-hidden', String(!isExpanded));
  });

  const columnTemplate =
    typeof state.expanded === 'number'
      ? state.cards
          .map((_, cardIndex) => (cardIndex === state.expanded ? '1.6fr' : '0.9fr'))
          .join(' ')
      : '1fr 1fr 1fr';
  row.style.setProperty('--picker-template', columnTemplate);
  row.classList.toggle('has-exploded', typeof state.expanded === 'number');

  if (row === pickerRows[focusRow]) updateColumnNavState();
}

function setRowColumnFocus(row, nextIndex, shouldUpdate = true) {
  const state = rowColumnState.get(row);
  if (!state) return undefined;
  state.focus = clamp(nextIndex, 0, state.cards.length - 1);
  if (shouldUpdate) updateRowColumnClasses(row);
  return state;
}

function focusRowColumnNext(row) {
  const state = rowColumnState.get(row);
  if (!state || state.focus >= state.cards.length - 1) return false;
  setRowColumnFocus(row, state.focus + 1);
  return true;
}

function focusRowColumnPrev(row) {
  const state = rowColumnState.get(row);
  if (!state || state.focus <= 0) return false;
  setRowColumnFocus(row, state.focus - 1);
  return true;
}

function updateColumnNavState() {
  if (!pickerPrevButton || !pickerNextButton) return;
  const row = pickerRows[focusRow];
  const state = rowColumnState.get(row);
  const disablePrev = !state || state.focus <= 0;
  const disableNext = !state || state.focus >= state.cards.length - 1;
  pickerPrevButton.disabled = disablePrev;
  pickerNextButton.disabled = disableNext;
}

function handleCardInteraction(row, cardIndex) {
  const state = setRowColumnFocus(row, cardIndex, false);
  if (!state) return;
  state.expanded = state.expanded === cardIndex ? null : cardIndex;
  updateRowColumnClasses(row);
}

function initRowColumnPicker() {
  pickerRows.forEach((row) => {
    const cards = Array.from(row.querySelectorAll('.project-card'));
    if (!cards.length) return;
    rowColumnState.set(row, {
      cards,
      focus: Math.floor(cards.length / 2),
      expanded: null,
    });
    updateRowColumnClasses(row);

    cards.forEach((card, index) => {
      card.addEventListener('click', () => handleCardInteraction(row, index));
    });

    attachRowScrollHandlers(row);
  });
}

function handleRowWheelGesture(row, deltaX) {
  const state = rowWheelState.get(row) ?? { buffer: 0, timeoutId: null };
  const delta = Number.isFinite(deltaX) ? deltaX : 0;
  state.buffer += delta;
  clearTimeout(state.timeoutId);
  state.timeoutId = setTimeout(() => {
    state.buffer = 0;
  }, 180);

  while (Math.abs(state.buffer) >= COLUMN_SCROLL_THRESHOLD) {
    const moved = state.buffer > 0 ? focusRowColumnNext(row) : focusRowColumnPrev(row);
    if (!moved) {
      state.buffer = 0;
      break;
    }
    state.buffer += state.buffer > 0 ? -COLUMN_SCROLL_THRESHOLD : COLUMN_SCROLL_THRESHOLD;
  }

  rowWheelState.set(row, state);
}

function attachRowScrollHandlers(row) {
  row.addEventListener(
    'wheel',
    (event) => {
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!horizontalIntent) return;
      const delta = event.shiftKey && Math.abs(event.deltaX) < 1 ? event.deltaY : event.deltaX;
      event.preventDefault();
      event.stopPropagation();
      handleRowWheelGesture(row, delta);
    },
    { passive: false }
  );

  row.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      rowTouchState.set(row, {
        startX: touch.clientX,
        startY: touch.clientY,
        handled: false,
      });
    },
    { passive: true }
  );

  row.addEventListener(
    'touchmove',
    (event) => {
      const state = rowTouchState.get(row);
      if (!state) return;
      const touch = event.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      if (!state.handled && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > HORIZONTAL_INTENT_EPSILON) {
        state.handled = true;
      }

      if (state.handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { passive: false }
  );

  function finishTouchSwipe(event) {
    const state = rowTouchState.get(row);
    if (!state) return;
    if (state.handled) {
      const touch = (event.changedTouches && event.changedTouches[0]) || event;
      const dx = touch.clientX - state.startX;
      const swipeDistance = Math.abs(dx);
      if (swipeDistance > COLUMN_SWIPE_THRESHOLD) {
        const direction = dx < 0 ? 1 : -1;
        const steps = Math.max(1, Math.round(swipeDistance / COLUMN_SWIPE_THRESHOLD));
        for (let i = 0; i < steps; i += 1) {
          const moved = direction > 0 ? focusRowColumnNext(row) : focusRowColumnPrev(row);
          if (!moved) break;
        }
      }
      event.stopPropagation();
    }
    rowTouchState.delete(row);
  }

  row.addEventListener('touchend', finishTouchSwipe, { passive: false });
  row.addEventListener(
    'touchcancel',
    () => {
      rowTouchState.delete(row);
    },
    { passive: true }
  );
}

const programCardList = Array.from(programCards);

function resetProgramCards() {
  programCardList.forEach((card) => {
    card.classList.remove('is-expanded', 'is-sidelined-left', 'is-sidelined-right');
    card.setAttribute('aria-expanded', 'false');
    const details = card.querySelector('.card-details');
    if (details) {
      details.setAttribute('aria-hidden', 'true');
    }
    const hint = card.querySelector('.card-hint');
    if (hint) {
      const defaultLabel = hint.dataset.defaultLabel || hint.textContent;
      hint.textContent = defaultLabel;
      hint.dataset.defaultLabel = defaultLabel;
    }
  });
  expandedProgramIndex = -1;
  if (programGrid) {
    programGrid.classList.remove('has-expanded');
  }
}

function toggleProgramCard(targetCard) {
  const cardIndex = programCardList.indexOf(targetCard);
  if (cardIndex === -1) return;

  const shouldCollapse = cardIndex === expandedProgramIndex;
  resetProgramCards();

  if (shouldCollapse) {
    return;
  }

  expandedProgramIndex = cardIndex;
  targetCard.classList.add('is-expanded');
  targetCard.setAttribute('aria-expanded', 'true');
  const details = targetCard.querySelector('.card-details');
  if (details) {
    details.setAttribute('aria-hidden', 'false');
  }
  const hint = targetCard.querySelector('.card-hint');
  if (hint) {
    const expandedLabel = hint.dataset.expandedLabel || 'Click to close';
    hint.textContent = expandedLabel;
  }

  if (programGrid) {
    programGrid.classList.add('has-expanded');
  }

  programCardList.forEach((card, index) => {
    if (card === targetCard) return;
    card.classList.add(index < cardIndex ? 'is-sidelined-left' : 'is-sidelined-right');
  });
}

function initProgramCards() {
  if (!programCardList.length) return;
  programCardList.forEach((card) => {
    const hint = card.querySelector('.card-hint');
    if (hint && !hint.dataset.defaultLabel) {
      hint.dataset.defaultLabel = hint.textContent.trim();
    }

    card.addEventListener('click', () => toggleProgramCard(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleProgramCard(card);
      }
    });
  });
}

window.addEventListener('scroll', updateProgressBar);
window.addEventListener('resize', handleResize);

document.addEventListener('DOMContentLoaded', () => {
  updateProgressBar();
  updatePickerFocus();
  initRowColumnPicker();
  initProgramCards();

  if (hamburger) {
    hamburger.addEventListener('click', () => toggleMenu());
  }

  navLinks.forEach((link) =>
    link.addEventListener('click', () => {
      toggleMenu(false);
    })
  );

  if (pickerCarousel) {
    pickerCarousel.addEventListener('wheel', (e) => {
      const verticalIntent = Math.abs(e.deltaY) >= Math.abs(e.deltaX) && !e.shiftKey;
      if (!verticalIntent) return;
      e.preventDefault();
      if (e.deltaY > 0) pickerNext();
      else if (e.deltaY < 0) pickerPrev();
    }, { passive: false });

    pickerCarousel.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    pickerCarousel.addEventListener('touchend', (e) => {
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > 50) {
        if (dy > 0) pickerPrev();
        else pickerNext();
      }
    }, { passive: true });
  }

  if (pickerPrevButton) {
    pickerPrevButton.addEventListener('click', () => {
      const row = pickerRows[focusRow];
      if (row) focusRowColumnPrev(row);
    });
  }

  if (pickerNextButton) {
    pickerNextButton.addEventListener('click', () => {
      const row = pickerRows[focusRow];
      if (row) focusRowColumnNext(row);
    });
  }

});
