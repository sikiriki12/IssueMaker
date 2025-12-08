// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background on scroll
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
        navbar.style.background = 'rgba(10, 10, 15, 0.95)';
    } else {
        navbar.style.background = 'rgba(10, 10, 15, 0.8)';
    }

    lastScroll = currentScroll;
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Apply fade-in animation to sections
document.querySelectorAll('.feature-card, .step, .install-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Staggered animation for feature cards
document.querySelectorAll('.feature-card').forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.1}s`;
});

// Typewriter effect for hero title (optional enhancement)
const addSparkle = () => {
    const hero = document.querySelector('.hero-container');
    if (!hero) return;

    const sparkle = document.createElement('div');
    sparkle.innerHTML = '✨';
    sparkle.style.cssText = `
        position: absolute;
        font-size: ${Math.random() * 10 + 10}px;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: sparkle 1s ease forwards;
        pointer-events: none;
    `;
    hero.appendChild(sparkle);

    setTimeout(() => sparkle.remove(), 1000);
};

// Add sparkle effect occasionally
setInterval(addSparkle, 3000);

// Add CSS for sparkle animation
const style = document.createElement('style');
style.textContent = `
    @keyframes sparkle {
        0% { opacity: 0; transform: scale(0) rotate(0deg); }
        50% { opacity: 1; transform: scale(1) rotate(180deg); }
        100% { opacity: 0; transform: scale(0) rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Console Easter Egg
console.log('%c🐛 IssueMaker', 'font-size: 24px; font-weight: bold;');
console.log('%cCreate polished GitHub issues with AI-powered drafting!', 'font-size: 14px; color: #8b5cf6;');
console.log('%cCheck out the source: https://github.com/damirbandalo/IssueMaker', 'font-size: 12px; color: #6b6b7a;');
