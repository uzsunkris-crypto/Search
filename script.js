// Particle System
const pContainer = document.getElementById('particle-container');
for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 2 + 1;
    p.style.width = p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.top = `${Math.random() * 100}vh`;
    p.style.animationDuration = `${Math.random() * 8 + 4}s`;
    pContainer.appendChild(p);
}

// Category Grid Generation
const categories = ["Home & Living", "Food & Hosp.", "Fashion/Beauty", "Health/Well", "Education", "Tech/Digital", "Business", "Transport", "Construction", "Shopping", "Agri/Env", "Media/Creative", "Events/Ent.", "Real Estate", "Finance", "Public/Comm", "Security", "Freelance", "Automotive", "Science", "Talent"];
const grid = document.getElementById('grid');

categories.forEach((cat) => {
    const card = document.createElement('div');
    card.className = `category-card`;
    card.innerHTML = `<div class="card-content" style="background-image: url('https://picsum.photos/seed/${cat}/200/500')"><div class="category-name">${cat}</div></div>`;
    grid.appendChild(card);
});

// Active Card Sequence with Grid Focus Logic
const cards = document.querySelectorAll('.category-card');
let pool = [];

function startSequence() {
    if (pool.length === 0) pool = Array.from(Array(21).keys()).sort(() => Math.random() - 0.5);
    const cardIdx = pool.pop();
    
    // 1. Tell the grid we have an active item (triggers blur on others)
    grid.classList.add('has-active');
    
    // 2. Highlight the specific card
    cards[cardIdx].classList.add('active');
    cards[cardIdx].style.transform = "scale(1.12)";
    
    setTimeout(() => { 
        // 3. Reset state
        cards[cardIdx].classList.remove('active'); 
        cards[cardIdx].style.transform = "scale(1)";
        grid.classList.remove('has-active');
    }, 2000);
    
    setTimeout(startSequence, 4000);
}
startSequence();

// Typing Effect
const typingElement = document.getElementById('typing-text');
const phrases = ["experts", "design", "delivery", "health"];
let phraseIdx = 0, charIdx = 0, isDeleting = false;

function typeEffect() {
    const currentPhrase = phrases[phraseIdx];
    typingElement.textContent = isDeleting ? currentPhrase.substring(0, charIdx--) : currentPhrase.substring(0, charIdx++);
    let speed = isDeleting ? 100 : 150;
    if (!isDeleting && charIdx > currentPhrase.length) { speed = 2000; isDeleting = true; }
    else if (isDeleting && charIdx === 0) { isDeleting = false; phraseIdx = (phraseIdx + 1) % phrases.length; speed = 500; }
    setTimeout(typeEffect, speed);
}
typeEffect();

