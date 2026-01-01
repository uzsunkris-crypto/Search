<script>
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

    // Updated Category Mapping
    const categories = [
        { name: "Home & Living", link: "home.html" },
        { name: "Food & Hosp.", link: "food.html" },
        { name: "Fashion/Beauty", link: "fashion.html" },
        { name: "Health/Well", link: "health.html" },
        { name: "Education", link: "education.html" },
        { name: "Tech/Digital", link: "technology.html" },
        { name: "Business", link: "business.html" },
        { name: "Transport", link: "transport.html" },
        { name: "Construction", link: "construction.html" },
        { name: "Shopping", link: "shopping.html" },
        { name: "Agri/Env", link: "agriculture.html" },
        { name: "Media/Creative", link: "media.html" },
        { name: "Events/Ent.", link: "event.html" },
        { name: "Real Estate", link: "realestate.html" },
        { name: "Finance", link: "finance.html" },
        { name: "Public/Comm", link: "community.html" },
        { name: "Security", link: "security.html" },
        { name: "Freelance", link: "personal.html" },
        { name: "Automotive", link: "automotive.html" },
        { name: "Science", link: "science.html" },
        { name: "Talent", link: "talent.html" }
    ];

    const grid = document.getElementById('grid');
    
    categories.forEach((cat) => {
        // Create an anchor tag to wrap the card
        const linkWrapper = document.createElement('a');
        linkWrapper.href = cat.link;
        linkWrapper.style.textDecoration = 'none'; // Keep it clean
        
        const card = document.createElement('div');
        card.className = `category-card`;
        card.innerHTML = `
            <div class="card-content" style="background-image: url('https://picsum.photos/seed/${cat.name}/200/500')"></div>
            <div class="category-name">${cat.name}</div>
        `;
        
        linkWrapper.appendChild(card);
        grid.appendChild(linkWrapper);
    });

    // Animation Logic (updated to select cards inside the new anchor tags)
    const cards = document.querySelectorAll('.category-card');
    let pool = [];
    function startSequence() {
        if (pool.length === 0) pool = Array.from(Array(21).keys()).sort(() => Math.random() - 0.5);
        const cardIdx = pool.pop();
        
        grid.classList.add('has-active');
        cards[cardIdx].classList.add('active');
        
        setTimeout(() => { 
            grid.classList.remove('has-active');
            cards[cardIdx].classList.remove('active'); 
        }, 2000);
        setTimeout(startSequence, 4000);
    }
    startSequence();

    // Typing effect logic
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
</script>
          
