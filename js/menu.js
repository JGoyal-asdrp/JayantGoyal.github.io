const hamburger = document.querySelector('.hamburger');
const menuPanel = document.getElementById('menu-panel');

hamburger.addEventListener('click', () => {
  menuPanel.classList.toggle('open');
});